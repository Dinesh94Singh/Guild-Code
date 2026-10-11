// Guild Code: a medieval guild hall drawn over Claude's real work.
//
// Every tool call is placed in one room of the hall (see classify.ts):
//   Tavern Board          prompts, subagent dispatch, tasks
//   Wizard's Study        reading files, searching, docs and web
//   Dungeon               running tests; failing tests are monsters
//   Armory                edits, lint, format, diffs
//   Alchemist's Cauldron  builds, installs, bundlers, containers
// The main loop and each subagent are party members who walk between rooms;
// subagents out at the same time march as one team.
//
// Every session publishes its guild to the plugin's store (one JSON file shared by all
// sessions), so the pane can show every workspace open on this machine, and it reads
// the account's rate-limit windows from the engine as the guild's mana.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { GuildClass, GuildDungeon, GuildEntry, GuildMember, GuildOutcome, GuildPetition, GuildQuest, GuildQuota, GuildRealm, GuildSendMode, GuildXp } from '../types'
import { classifyTool, readBattle } from './classify'
import type { Placement } from './classify'
import { CLASSES, LANGS, LOCATIONS, ORDER, PROJECT_COLORS, TEAMS, classOf, classOfAgentType, windowLabel } from './lore'
import { describeMap, drawMap } from './map'

const PANE = 'guild-hall'
const MAIN = 'main'
const CHRONICLE_MAX = 60

const NO_XP: GuildXp = { guildmaster: 0, wizard: 0, rogue: 0, dwarf: 0, alchemist: 0 }
const NEW_DUNGEON: GuildDungeon = { monsters: 0, slain: 0, isCleared: false, hasRun: false }
const GUILDMASTER: GuildMember = {
  id: MAIN,
  label: 'Guildmaster',
  location: 'tavern',
  activity: 'rests at the tavern',
  isBusy: false,
}

const party = atom({ plugin: 'guild-code', key: 'party' } as const, [GUILDMASTER])
const chronicle = atom({ plugin: 'guild-code', key: 'chronicle' } as const, [] as GuildEntry[])
const dungeon = atom({ plugin: 'guild-code', key: 'dungeon' } as const, NEW_DUNGEON)
const quests = atom({ plugin: 'guild-code', key: 'quests' } as const, [] as GuildQuest[])
const xp = atom({ plugin: 'guild-code', key: 'xp' } as const, NO_XP)
const quota = atom({ plugin: 'guild-code', key: 'quota' } as const, [] as GuildQuota[])
const realms = atom({ plugin: 'guild-code', key: 'realms' } as const, [] as GuildRealm[])
const teams = atom({ plugin: 'guild-code', key: 'teams' } as const, 0)
const hallUrl = atom({ plugin: 'guild-code', key: 'hall' } as const, '')

/**
 * A quest from the Guild Hall page reaches Claude as a petition drafted into the prompt box
 * for the person to send, or, sealed, as a prompt submitted at once.
 */
async function petition($: EngineInterface, text: string, title: string, mode: GuildSendMode, asUser = false) {
  if (mode === 'seal') {
    await $.prompt.submit(asUser ? { text, asUser: true } : { text })
    $.ui.toast(`🔏 ${title}: sealed and sent.`)
    await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `🔏 Sealed: ${title}`, outcome: 'ok' })
    return
  }
  const drafted = await $.prompt.fill({ text })
  if (drafted.isFilled) {
    $.ui.toast(`📜 ${title}: the petition waits in your prompt box. Press Enter to send it.`)
    await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `📜 Petition drafted: ${title}`, outcome: 'ok' })
  } else {
    $.ui.toast(drafted.refusal === 'dialog' ? '📜 Close the open dialog, then send the quest again.' : '📜 No prompt box here to hold the petition.')
  }
}

const REALM_PREFIX = 'realm:'
const PUBLISH_MS = 4000
const STALE_MS = 2 * 60_000
const FORGET_MS = 24 * 3600_000

const toQuota = (limits: readonly SessionRateLimit[]): GuildQuota[] =>
  limits.map(l => ({ kind: l.kind, label: windowLabel(l.kind), percentLeft: Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10), resetsAt: l.resetsAt }))

const PETITION_PREFIX = 'petition:'
const HALL_PREFIX = 'hall:'
const HALL_PORT = 8790
// The hall's address: every *.localhost name reaches this machine, so it needs no setup.
const hallAddress = (port: number) => `http://guildmaster.localhost:${port}/`

let ticker: { cancel: () => void } | undefined
let published = ''
let publishedAt = 0

/** Write this session's guild to the shared store, and read every other live one back. */
async function share($: EngineInterface) {
  const id = await $.session.id()
  const cwd = await $.session.cwd()
  const at = await $.clock.now()
  const mine: Omit<GuildRealm, 'updatedAt'> = { id, name: cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests), chronicle: (await read($, chronicle)).slice(-20), quota: await read($, quota) }
  const body = JSON.stringify(mine)
  if (body !== published || at - publishedAt > STALE_MS / 2) {
    await $.store.set(`${REALM_PREFIX}${id}`, { ...mine, updatedAt: at })
    published = body
    publishedAt = at
  }
  const others: GuildRealm[] = []
  for (const key of await $.store.keys()) {
    if (key.startsWith(`${PETITION_PREFIX}${id}:`)) {
      // A quest the Guild Hall page sent here through another session's server.
      const p = await $.store.get(key)
      await $.store.delete(key)
      if (isPetition(p)) await petition($, p.text, p.title, p.mode, p.asUser)
      continue
    }
    if (!key.startsWith(REALM_PREFIX) || key === `${REALM_PREFIX}${id}`) continue
    const realm = (await $.store.get(key)) as GuildRealm | undefined
    if (!realm || typeof realm !== 'object' || typeof realm.updatedAt !== 'number') continue
    if (at - realm.updatedAt > FORGET_MS) void $.store.delete(key).catch(() => undefined)
    if (at - realm.updatedAt > STALE_MS) continue
    others.push(realm)
  }
  others.sort((a, b) => a.name.localeCompare(b.name))
  await update($, realms, cur => (JSON.stringify(cur) === JSON.stringify(others) ? cur : others))
  if (hallPort) await writeLive($, { ...mine, updatedAt: at }, others, at)
}

/** Sessions open in the same folder share its name: number the others so each reads apart. */
function named<R extends { name: string }>(here: string, others: R[]): R[] {
  let twin = 1
  return others.map(r => (r.name === here ? { ...r, name: `${here} #${(twin += 1)}` } : r))
}

// ───────────── the Guild Hall page ─────────────
// /guild serves the full pixel-art hall from this session on 127.0.0.1 and opens it in the
// browser. The page reads live.json, which every session with a server keeps fresh, and
// posts its quests back; the server prints each one and this session sends it on.

let hallPort = 0
let hallStarting: Promise<number> | undefined
let hallDir = ''

const isPetition = (p: unknown): p is GuildPetition => {
  const o = p as GuildPetition
  return !!o && typeof o === 'object' && typeof o.realm === 'string' && typeof o.title === 'string' && typeof o.text === 'string' && !!o.text.trim() && (o.mode === 'seal' || o.mode === 'petition')
}

async function hallFolder($: EngineInterface): Promise<string> {
  if (!hallDir) {
    const { stdout } = await $.process.run(['printenv', 'HOME'])
    hallDir = `${stdout.trim()}/.claude/guild-code/hall`
  }
  return hallDir
}

async function writeLive($: EngineInterface, mine: GuildRealm, others: GuildRealm[], at: number) {
  const list = [mine, ...named(mine.name, others)].map((r, i) => ({ ...r, color: PROJECT_COLORS[i % PROJECT_COLORS.length]! }))
  // Mana is the account's: a session billed by API key has no windows, so the page takes the
  // freshest reading any open session has.
  const reading = [mine, ...[...others].sort((a, b) => b.updatedAt - a.updatedAt)].find(r => r.quota?.length)
  const live = { at, self: mine.id, realms: list, quota: reading?.quota ?? [], xp: await read($, xp) }
  await $.fs.write(`${await hallFolder($)}/live.json`, JSON.stringify(live))
}

/** A quest from the page: this session's own is sent here, another's waits in the store for it. */
async function receive($: EngineInterface, p: unknown) {
  if (!isPetition(p)) return
  const id = await $.session.id()
  if (p.realm === id) return petition($, p.text, p.title, p.mode, p.asUser)
  await $.store.set(`${PETITION_PREFIX}${p.realm}:${(await $.clock.now()).toString(36)}-${(seq += 1)}`, p)
}

/** Start this session's hall server, once, and resolve its port. */
function startHall($: EngineInterface, preferred = HALL_PORT): Promise<number> {
  if (hallStarting) return hallStarting
  const started = (async () => {
    const dir = await hallFolder($)
    const page = await $.fs.read(`${$.plugin.root}/demo/guild-hall.html`)
    // The flag that turns the dry run live goes first; the server fills in its token.
    const flag = `<script>window.GUILD_LIVE = { token: '__GUILD_TOKEN__' }</script>\n`
    const head = page.startsWith('<meta charset="utf-8">\n') ? '<meta charset="utf-8">\n'.length : 0
    await $.fs.write(`${dir}/index.html`, page.slice(0, head) + flag + page.slice(head))
    return new Promise<number>((resolve, reject) => {
      void (async () => {
        let buf = ''
        try {
          // The child lives as long as this loop: the session's, or until the module reloads.
          for await (const { stream, text } of $.process.spawn({ argv: ['python3', `${$.plugin.root}/hooks/hall-server.py`, dir, String(preferred)] })) {
            if (stream !== 'stdout') continue
            buf += text
            for (let nl = buf.indexOf('\n'); nl >= 0; nl = buf.indexOf('\n')) {
              const line = buf.slice(0, nl)
              buf = buf.slice(nl + 1)
              let msg: { ready?: number; petition?: unknown }
              try {
                msg = JSON.parse(line)
              } catch {
                continue
              }
              if (typeof msg.ready === 'number') {
                hallPort = msg.ready
                await $.store.set(`${HALL_PREFIX}${await $.session.id()}`, hallPort)
                await update($, hallUrl, () => hallAddress(hallPort))
                await share($)
                resolve(hallPort)
              } else if (msg.petition) {
                await receive($, msg.petition).catch(() => undefined)
              }
            }
          }
        } catch (err) {
          reject(err)
        }
        hallPort = 0
        hallStarting = undefined
        await update($, hallUrl, () => '').catch(() => undefined)
        reject(new Error('The Guild Hall server stopped. Is python3 installed?'))
      })()
    })
  })()
  hallStarting = started
  started.catch(() => {
    if (hallStarting === started) hallStarting = undefined
  })
  return started
}

const BUILT_IN_BROWSER = 'mcp__Claude_Browser__preview_start'

/** Open the hall in the desktop app's own browser pane, where the session has one. */
async function openInBuiltInBrowser($: EngineInterface, url: string): Promise<boolean> {
  const tools = await $.tool.list().catch(() => [])
  if (!tools.some(t => t.name === BUILT_IN_BROWSER)) return false
  return $.tool.call({ tool: BUILT_IN_BROWSER, url }).then(r => !r.isError, () => false)
}

/** Open a page in the person's browser, whichever opener this system has. */
async function openInBrowser($: EngineInterface, url: string): Promise<boolean> {
  for (const argv of [['open', url], ['xdg-open', url], ['cmd', '/c', 'start', '', url]]) {
    const ok = await $.process.run(argv).then(r => r.exitCode === 0, () => false)
    if (ok) return true
  }
  return false
}

function bar(percent: number, cells = 10): string {
  const full = Math.round((Math.max(0, Math.min(100, percent)) / 100) * cells)
  return '▰'.repeat(full) + '▱'.repeat(cells - full)
}

function until(iso: string | undefined, now: number): string {
  const at = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(at)) return ''
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  return ` · resets in ${d ? `${d}d ${h}h` : `${h}h ${mins % 60}m`}`
}

let seq = 0
const nextId = (at: number) => `${at.toString(36)}-${(seq += 1)}`

async function log($: EngineInterface, entry: Omit<GuildEntry, 'id' | 'at'>): Promise<string> {
  const at = await $.clock.now().catch(() => 0)
  const id = nextId(at)
  await update($, chronicle, list => [...list, { ...entry, id, at }].slice(-CHRONICLE_MAX))
  return id
}

async function settle($: EngineInterface, id: string, outcome: GuildOutcome, text?: string) {
  await update($, chronicle, list =>
    list.map(e => (e.id === id ? { ...e, outcome, text: text ?? e.text } : e)),
  )
}

async function move($: EngineInterface, memberId: string, change: Partial<GuildMember>) {
  const at = await $.clock.now().catch(() => 0)
  await update($, party, list => list.map(m => {
    if (m.id !== memberId) return m
    // A change of place starts a walk along the roads, drawn by the map.
    const walks = change.location !== undefined && change.location !== m.location
    return { ...m, ...change, ...(walks ? { from: m.location, movedAt: at } : {}) }
  }))
}

async function gainXp($: EngineInterface, cls: GuildClass, amount: number) {
  const total = await update($, xp, cur => ({ ...cur, [cls]: (cur[cls] ?? 0) + amount }))
  void $.store.set('xp', total).catch(() => undefined)
}

/** A member now waits on the person: it raises its hand on the map, and the person is told. */
async function awaitPerson($: EngineInterface, memberId: string, what: string, notify: boolean) {
  const roster = await read($, party)
  const m = roster.find(one => one.id === memberId)
  if (!m || m.waiting === what) return
  await update($, party, list => list.map(one => (one.id === memberId ? { ...one, waiting: what } : one)))
  const who = m.fixedClass ? m.label : CLASSES[classOf(m)].name
  const where = LOCATIONS[m.location].name
  $.ui.toast(`❗ ${who} at the ${where} awaits your word: ${what}`)
  if (notify) void $.ui.notify(`${who} at the ${where} ${what}`, { title: '❗ The guild awaits your word' }).catch(() => undefined)
  await log($, { who, cls: classOf(m), location: m.location, text: `❗ awaits your word: ${what}`, outcome: 'running' })
}
async function answered($: EngineInterface, memberId: string) {
  await update($, party, list => (list.some(m => m.id === memberId && m.waiting) ? list.map(m => (m.id === memberId ? { ...m, waiting: undefined } : m)) : list))
}

function statusLine(m: GuildMember): string {
  const cls = CLASSES[classOf(m)]
  const crest = m.lang ? ` [${LANGS[m.lang].crest}]` : ''
  return `${cls.icon} ${cls.name} · ${LOCATIONS[m.location].name}${crest} · ${m.activity}`
}

function narrate(p: Placement, tool: string): string {
  switch (p.location) {
    case 'study':
      return tool === 'Bash' ? `consults ${p.detail}` : `reads ${p.detail}`
    case 'armory':
      return tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit'
        ? `forges ${p.detail}`
        : `hammers ${p.detail}`
    case 'dungeon':
      return `delves: ${p.detail}`
    case 'cauldron':
      return `brews ${p.detail}`
    case 'tavern':
      return tool === 'Agent' || tool === 'Task' ? `dispatches: ${p.detail}` : p.detail
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'guild', description: 'Open the Guild Code map of your party at work' })
    await $.command.register({ name: 'guild-stats', description: 'Show Guild Code XP per class and the dungeon record' })
    try {
      const saved = (await $.store.get('xp')) as Partial<GuildXp> | undefined
      if (saved && typeof saved === 'object') await update($, xp, () => ({ ...NO_XP, ...saved }))
    } catch {
      // A fresh guild: no XP yet.
    }
    try {
      const usage = await $.session.usage()
      await update($, quota, () => toQuota(usage.rateLimits))
    } catch {
      // No readings yet: the mana panel waits for the first response.
    }
    // An idle session used to be marked as waiting on the person; it rests now.
    await update($, party, list => (list.some(m => m.waiting === 'waits for your next quest') ? list.map(m => (m.waiting === 'waits for your next quest' ? { ...m, waiting: undefined, activity: 'rests at the tavern', isBusy: false } : m)) : list))
    ticker?.cancel()
    ticker = $.clock.every(PUBLISH_MS, () => void share($).catch(() => undefined))
    void share($).catch(() => undefined)
    // A reload ends the hall's server with the old module: start it again on the same port,
    // so a Guild Hall page left open picks up where it was.
    const port = await $.store.get(`${HALL_PREFIX}${await $.session.id()}`).catch(() => undefined)
    if (typeof port === 'number') void startHall($, port).catch(() => undefined)
    void $.ui.open({ id: PANE, title: 'Guild Hall' })
    return next(e)
  })

  // The account's rate-limit windows, pushed whenever one moves a whole point.
  on('session.measure', async ($, e, next) => {
    try {
      if (e.changed.includes('rateLimits')) await update($, quota, () => toQuota(e.rateLimits))
    } catch {
      // ignore
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    ticker?.cancel()
    try {
      await $.store.delete(`${REALM_PREFIX}${await $.session.id()}`)
      await $.store.delete(`${HALL_PREFIX}${await $.session.id()}`)
    } catch {
      // A stale realm ages out of the others' view by itself.
    }
    return next(e)
  })

  on('command.run', { command: 'guild' }, async $ => {
    void $.ui.open({ id: PANE, title: 'Guild Hall' })
    try {
      const port = await startHall($)
      const url = hallAddress(port)
      // A browser that does not resolve *.localhost still reaches it by number.
      const also = ` (also at http://127.0.0.1:${port}/)`
      if (await openInBuiltInBrowser($, url)) return { text: `🏰 The Guild Hall is open in the browser pane: ${url}${also}` }
      const opened = await openInBrowser($, url)
      return { text: opened ? `🏰 The Guild Hall is open in your browser: ${url}${also}` : `🏰 The Guild Hall is ready: open ${url}${also}` }
    } catch (err) {
      return { text: `🏰 The map is in the pane, but the full Guild Hall could not start: ${err instanceof Error ? err.message : String(err)}` }
    }
  })

  on('command.run', { command: 'guild-stats' }, async $ => {
    const points = await read($, xp)
    const d = await read($, dungeon)
    const rows = (Object.keys(CLASSES) as GuildClass[]).map(c => `${CLASSES[c].icon} ${CLASSES[c].name}: ${points[c] ?? 0} XP (level ${1 + Math.floor((points[c] ?? 0) / 50)})`)
    const record = d.hasRun ? `💀 Dungeon: ${d.monsters} monsters left, ${d.slain} slain${d.framework ? ` (${d.framework})` : ''}` : '💀 Dungeon: no trials yet this session'
    return { text: ['🏰 Guild record', ...rows, record].join('\n') }
  })

  // An agent stuck on the person: a permission to grant, or a question to answer.
  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      const input = (e.tool_input ?? {}) as Record<string, unknown>
      const detail = typeof input.command === 'string' ? input.command : typeof input.file_path === 'string' ? input.file_path : typeof input.url === 'string' ? input.url : ''
      await awaitPerson($, e.agent_id ?? MAIN, `asks leave to use ${e.tool_name}${detail ? `: ${detail.length > 60 ? `${detail.slice(0, 59)}…` : detail}` : ''}`, true)
    } catch {
      // ignore
    }
    return next(e)
  })
  // Only a decision raises the call: a permission (above), a question (AskUserQuestion, below)
  // or a form to fill in. A session that is merely idle rests: it never asks for a quest.
  on('classic.Notification', async ($, e, next) => {
    try {
      if (/elicitation/.test(e.notification_type)) await awaitPerson($, e.agent_id ?? MAIN, 'asks you to choose', true)
    } catch {
      // ignore
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await answered($, MAIN)
      const words = e.text.replace(/\s+/g, ' ').trim()
      if (words.length > 0 && !words.startsWith('/')) {
        const short = words.length > 48 ? `${words.slice(0, 47)}…` : words
        await move($, MAIN, { location: 'tavern', activity: `takes a quest: ${short}`, isBusy: true, lang: undefined })
        await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `📜 New quest: ${short}`, outcome: 'ok' })
      }
    } catch {
      // The map is decoration: never stand in the prompt's way.
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    try {
      if (ran.agentId !== undefined) {
        const fixedClass = classOfAgentType(e.subagentType)
        const label = fixedClass ? CLASSES[fixedClass].name : e.subagentType
        const member: GuildMember = {
          id: ran.agentId,
          label,
          fixedClass,
          location: 'tavern',
          activity: `joins the party: ${e.description}`,
          isBusy: true,
        }
        // A second subagent out at once makes a team of everyone who is out.
        const out = (await read($, party)).filter(m => m.id !== MAIN && m.id !== member.id)
        let team = out.find(m => m.team)?.team
        if (!team && out.length > 0) {
          const n = await update($, teams, c => c + 1)
          team = TEAMS[(n - 1) % TEAMS.length]!
          const names = [...out.map(m => m.label), label].join(', ')
          await update($, party, list => list.map(m => (m.id !== MAIN ? { ...m, team } : m)))
          await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `🚩 The ${team.name} forms: ${names}`, outcome: 'ok' })
        }
        if (team) member.team = team
        await update($, party, list => [...list.filter(m => m.id !== member.id), member])
        await log($, {
          who: label,
          cls: fixedClass ?? 'guildmaster',
          location: 'tavern',
          text: `⚔️ ${label} answers the call: ${e.description}`,
          outcome: 'ok',
        })
      }
    } catch {
      // ignore
    }
    return ran
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('tool.call', async ($, e, next) => {
    const memberId = e.agentId ?? MAIN
    const input = e as unknown as Record<string, unknown>
    let entryId: string | undefined
    let place: Placement | undefined
    let member: GuildMember | undefined
    try {
      place = classifyTool(String(e.tool), input)
      const roster = await read($, party)
      member =
        roster.find(m => m.id === memberId) ??
        // A loop we never saw spawn (a workflow agent, a fork): it joins now.
        ({ id: memberId, label: 'Sellsword', location: place.location, activity: '', isBusy: true } satisfies GuildMember)
      if (!roster.some(m => m.id === memberId)) await update($, party, list => [...list, member!])
      const activity = narrate(place, String(e.tool))
      const moved = { ...member, location: place.location, activity, isBusy: true, lang: place.lang ?? member.lang }
      await move($, memberId, moved)
      const cls = classOf(moved)
      entryId = await log($, { who: moved.fixedClass ? moved.label : CLASSES[cls].name, cls, location: place.location, text: activity, lang: place.lang, outcome: 'running' })
      if (memberId === MAIN) $.ui.status(statusLine(moved))
    } catch {
      // ignore: the tool still runs
    }

    if (String(e.tool) === 'AskUserQuestion') await awaitPerson($, memberId, 'asks you a question', true).catch(() => undefined)
    const ran = await next(e)
    await answered($, memberId).catch(() => undefined) // whatever it waited on is settled once the tool returns

    try {
      if (place && entryId && member) {
        const failed = ran.deny !== undefined || ran.isError === true
        const cls = classOf({ fixedClass: member.fixedClass, location: place.location })
        let outcome: GuildOutcome = failed ? 'fail' : 'ok'
        let text: string | undefined

        if (place.location === 'dungeon' && (String(e.tool) === 'Bash' || String(e.tool) === 'PowerShell')) {
          const battle = readBattle(ran.text ?? '')
          const before = await read($, dungeon)
          if (battle) {
            outcome = battle.failed > 0 ? 'fail' : 'ok'
            text = battle.failed > 0
              ? `⚔️ ${place.detail}: ${battle.failed} monster${battle.failed === 1 ? '' : 's'} stand, ${battle.passed} slain`
              : `⚔️ ${place.detail}: all ${battle.passed} slain`
            await update($, dungeon, () => ({
              monsters: battle.failed,
              slain: battle.passed,
              lastCommand: place!.detail,
              framework: battle.framework ?? place!.framework,
              lang: place!.lang,
              isCleared: battle.failed === 0,
              hasRun: true,
            }))
            await gainXp($, cls, 2 + Math.max(0, before.monsters - battle.failed) * 5)
            if (battle.failed === 0 && before.monsters > 0) {
              $.ui.toast(`🏆 Dungeon cleared! ${before.monsters} monster${before.monsters === 1 ? '' : 's'} vanquished.`)
            }
          } else {
            await update($, dungeon, d => ({ ...d, hasRun: true, lastCommand: place!.detail, lang: place!.lang ?? d.lang }))
          }
        } else if (!failed) {
          await gainXp($, cls, 1)
        }

        // The Tavern's quest board follows the task list.
        if (!failed && e.tool === 'TaskCreate') {
          const id = (ran.text ?? '').match(/#(\d+)/)?.[1] ?? entryId
          const title = String(input.subject ?? 'A quest')
          await update($, quests, list => [...list.filter(q => q.id !== id), { id, title, isDone: false }])
        }
        if (!failed && e.tool === 'TaskUpdate') {
          const id = String(input.taskId ?? '')
          const status = String(input.status ?? '')
          if (status === 'deleted') await update($, quests, list => list.filter(q => q.id !== id))
          else if (status) await update($, quests, list => list.map(q => (q.id === id ? { ...q, isDone: status === 'completed', title: typeof input.subject === 'string' ? input.subject : q.title } : q)))
          if (status === 'completed') await gainXp($, 'guildmaster', 10)
        }
        if (!failed && e.tool === 'TodoWrite' && Array.isArray(input.todos)) {
          const todos = input.todos as { content?: string; status?: string }[]
          await update($, quests, () => todos.map((t, i) => ({ id: `todo-${i}`, title: String(t.content ?? 'A quest'), isDone: t.status === 'completed' })))
        }

        await settle($, entryId, outcome, text)
      }
    } catch {
      // ignore: the result stands
    }
    return ran
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('turn.complete', async ($, e, next) => {
    try {
      if (e.agentId === undefined) {
        await move($, MAIN, { location: 'tavern', activity: e.isAborted ? 'called back to the tavern' : 'rests at the tavern', isBusy: false })
        $.ui.status(undefined)
      } else {
        const roster = await read($, party)
        const m = roster.find(one => one.id === e.agentId)
        if (m) {
          await log($, { who: m.label, cls: classOf(m), location: 'tavern', text: `🍺 ${m.label} returns with the spoils`, outcome: e.isAborted ? 'fail' : 'ok' })
          await update($, party, list => list.filter(one => one.id !== e.agentId))
        }
      }
    } catch {
      // ignore
    }
    return next(e)
  })

  // The pane is the map alone: everything to act on lives on the Guild Hall page.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const here = (await $.session.cwd().catch(() => '')).split(/[\\/]/).filter(Boolean).pop() ?? 'this workspace'
    // Every workspace shares one map: this one from live state, the others from their last
    // published snapshots, each party in its project's colour.
    const others = named(here, await read($, realms))
    const own = { name: here, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests) }
    const all = [own, ...others]
    const multi = others.length > 0
    const members: GuildMember[] = all.flatMap((r, i) =>
      r.party.map(m => ({ ...m, project: multi ? { name: r.name, color: PROJECT_COLORS[i % PROJECT_COLORS.length]! } : undefined })),
    )
    const d: GuildDungeon = {
      monsters: all.reduce((n, r) => n + r.dungeon.monsters, 0),
      slain: all.reduce((n, r) => n + r.dungeon.slain, 0),
      hasRun: all.some(r => r.dungeon.hasRun),
      isCleared: all.every(r => !r.dungeon.hasRun || r.dungeon.isCleared),
      framework: all.length === 1 ? all[0]!.dungeon.framework : undefined,
    }
    const board = all.flatMap(r => r.quests)
    const url = await read($, hallUrl)
    const now = await $.clock.now().catch(() => 0)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const cols = Math.max(30, e.props.bodyColumns ?? 80)
      const half = Math.max(14, Math.floor((cols - 1) / 2))
      const glyph = (o: GuildOutcome) => (o === 'running' ? '…' : o === 'ok' ? '✓' : '✗')
      const tone = (o: GuildOutcome) => (o === 'running' ? 'warning' : o === 'ok' ? 'success' : 'error')
      const room = (loc: (typeof ORDER)[number], width: number) => {
        const info = LOCATIONS[loc]
        const there = members.filter(m => m.location === loc)
        const busy = there.some(m => m.isBusy)
        return (
          <Box key={loc} flexDirection="column" width={width} borderStyle="round" borderColor={busy ? info.color : 'inactive'} paddingX={1}>
            <Text bold color={busy ? info.color : undefined}>
              {info.icon} {info.name}
            </Text>
            {there.length === 0 && <Text dimColor>empty</Text>}
            {there.map(m => (
              <Text wrap="truncate-end">
                {m.waiting ? '❗ ' : ''}{m.project ? `[${m.project.name}] ` : ''}{CLASSES[classOf(m)].icon} {m.fixedClass ? m.label : CLASSES[classOf(m)].name}
                {m.lang ? ` [${LANGS[m.lang].crest}]` : ''} <Text dimColor>{m.activity}</Text>
              </Text>
            ))}
            {loc === 'dungeon' && (
              <Text color={d.monsters > 0 ? 'error' : d.hasRun ? 'success' : undefined} dimColor={!d.hasRun}>
                {`${'💀'.repeat(Math.min(d.monsters, 6))} ${d.monsters} lurk · ${d.slain} slain`}
              </Text>
            )}
            {loc === 'tavern' && (
              <Text dimColor>
                📜 {board.filter(q => !q.isDone).length} open · {board.filter(q => q.isDone).length} done
              </Text>
            )}
          </Box>
        )
      }
      const recent = (await read($, chronicle)).slice(-8).reverse()
      return (
        <Box flexDirection="column">
          <Box>
            {room('study', half)}
            {room('armory', half)}
          </Box>
          <Box>{room('tavern', half * 2)}</Box>
          <Box>
            {room('dungeon', half)}
            {room('cauldron', half)}
          </Box>
          <Box flexDirection="column" paddingX={1}>
            <Text bold>Chronicle</Text>
            {recent.length === 0 && <Text dimColor>The hall is quiet. Post a quest to begin.</Text>}
            {recent.map(entry => (
              <Text wrap="truncate-end">
                <Text color={tone(entry.outcome)}>{glyph(entry.outcome)}</Text> {CLASSES[entry.cls].icon} {entry.who}
                {entry.lang ? ` [${LANGS[entry.lang].crest}]` : ''} <Text dimColor>{entry.text}</Text>
              </Text>
            ))}
          </Box>
          <Text dimColor> {url ? `🏰 The full Guild Hall: ${url}` : '🏰 /guild opens the full Guild Hall in your browser.'}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg, Link } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={drawMap(members, d, board, { hour: new Date(now).getHours(), now })} alt={describeMap(members, d)} />
        {url ? <Link href={url} label="🏰 Open the full Guild Hall ↗" /> : <Text dimColor>🏰 /guild opens the full Guild Hall in your browser.</Text>}
      </Box>
    )
  })
}
