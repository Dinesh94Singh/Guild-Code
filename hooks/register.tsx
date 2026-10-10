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

import type { GuildClass, GuildDungeon, GuildEntry, GuildLocation, GuildMember, GuildOutcome, GuildQuest, GuildQuota, GuildRealm, GuildSendMode, GuildXp } from '../types'
import { classifyTool, readBattle } from './classify'
import type { Placement } from './classify'
import { CLASSES, LANGS, LOCATIONS, ORDER, PLACE_INFO, PROJECT_COLORS, SUMMONS, TEAMS, classOf, classOfAgentType, questText, windowLabel } from './lore'
import { describeMap, drawMap } from './map'
import { alertArt, deskArt, legendArt, manaArt } from './panels'

const PANE = 'guild-hall'
const MAIN = 'main'
const CHRONICLE_MAX = 60

const NO_XP: GuildXp = { guildmaster: 0, wizard: 0, rogue: 0, dwarf: 0, alchemist: 0 }
const NEW_DUNGEON: GuildDungeon = { monsters: 0, slain: 0, isCleared: false, hasRun: false }
const GUILDMASTER: GuildMember = {
  id: MAIN,
  label: 'Guildmaster',
  location: 'tavern',
  activity: 'awaits a quest',
  isBusy: false,
}

const party = atom({ plugin: 'guild-code', key: 'party' } as const, [GUILDMASTER])
const chronicle = atom({ plugin: 'guild-code', key: 'chronicle' } as const, [] as GuildEntry[])
const dungeon = atom({ plugin: 'guild-code', key: 'dungeon' } as const, NEW_DUNGEON)
const quests = atom({ plugin: 'guild-code', key: 'quests' } as const, [] as GuildQuest[])
const xp = atom({ plugin: 'guild-code', key: 'xp' } as const, NO_XP)
const quota = atom({ plugin: 'guild-code', key: 'quota' } as const, [] as GuildQuota[])
const realms = atom({ plugin: 'guild-code', key: 'realms' } as const, [] as GuildRealm[])
const viewing = atom({ plugin: 'guild-code', key: 'viewing' } as const, '')
const selected = atom({ plugin: 'guild-code', key: 'selected' } as const, '' as GuildLocation | '')
const picked = atom({ plugin: 'guild-code', key: 'picked' } as const, '')
const legend = atom({ plugin: 'guild-code', key: 'legend' } as const, false)
const teams = atom({ plugin: 'guild-code', key: 'teams' } as const, 0)
const sendMode = atom({ plugin: 'guild-code', key: 'sendMode' } as const, 'petition' as GuildSendMode)
const summon = atom({ plugin: 'guild-code', key: 'summon' } as const, 'guildmaster' as GuildClass)

type Decree = { key: string; label: string; text: string }

/**
 * The Guildmaster's Desk: a quest or decree reaches Claude as a petition drafted into the
 * prompt box for the person to send, or, sealed, as a prompt submitted at once.
 */
async function petition($: EngineInterface, text: string, title: string, asUser = false) {
  const mode = await read($, sendMode)
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
    $.ui.toast(drafted.refusal === 'dialog' ? '📜 Close the open dialog, then press again.' : '📜 No prompt box here to hold the petition.')
  }
}

/** One-press decrees for what the guild can see right now: each a ready-made prompt. */
function decrees(d: GuildDungeon, board: GuildQuest[], mana: GuildQuota[], pick: GuildLocation | '', members: GuildMember[], entries: GuildEntry[]): Decree[] {
  const out: Decree[] = []
  if (d.hasRun && d.monsters > 0) {
    const run = d.lastCommand ? ` Run \`${d.lastCommand}\`,` : ' Run the tests,'
    out.push({ key: 'slay', label: `⚔️ Slay the ${d.monsters} monster${d.monsters === 1 ? '' : 's'}`, text: `Fix the ${d.monsters} failing test${d.monsters === 1 ? '' : 's'}${d.framework ? ` (${d.framework})` : ''}.${run} find each root cause and fix it, then run the tests again to confirm.` })
  }
  if (d.hasRun && d.lastCommand) out.push({ key: 'retrial', label: '🔁 Re-run the trial', text: `Run \`${d.lastCommand}\` again and report what passes and what still fails.` })
  for (const q of board.filter(q => !q.isDone).slice(0, 3)) out.push({ key: `pursue-${q.id}`, label: `🗡️ Pursue: ${q.title.length > 28 ? `${q.title.slice(0, 27)}…` : q.title}`, text: `Work on the task "${q.title}" now, and mark it done when it is.` })
  for (const q of board.filter(q => q.isDone).slice(-1)) out.push({ key: `verify-${q.id}`, label: `🔍 Verify & seal: ${q.title.length > 22 ? `${q.title.slice(0, 21)}…` : q.title}`, text: `Check that the task "${q.title}" is really done: verify it against the code and tests, and report.` })
  const place: Record<GuildLocation, Decree> = {
    tavern: { key: 'board', label: '📜 Read the board', text: 'Summarize the open tasks and what you would do next, in order.' },
    study: { key: 'archives', label: '📚 Consult the archives', text: 'Explain how this project is laid out: its main modules, how they connect, and where to start reading.' },
    dungeon: { key: 'scout', label: '🕯️ Scout the dungeon', text: 'Run the test suite and report what passes and what fails, without changing any code yet.' },
    armory: { key: 'temper', label: '🔨 Temper the blade', text: "Run the project's formatter and linter, fix what they report, and show a summary of the diff." },
    cauldron: { key: 'rebrew', label: '⚗️ Rebrew', text: 'Rebuild the project (reinstall dependencies if needed), fix any build errors, and report the result.' },
  }
  if (pick) out.push(place[pick])
  const low = mana.filter(q => q.percentLeft < 30).sort((a, b) => a.percentLeft - b.percentLeft)[0]
  if (low) out.push({ key: 'ration', label: `🧪 Ration mana (${Math.round(low.percentLeft)}% left)`, text: `Our ${low.label.toLowerCase()} rate limit is running low (${Math.round(low.percentLeft)}% left). For the rest of this work, be lean: fewer, more targeted tool calls and shorter replies.` })
  for (const m of members.filter(m => m.id !== MAIN && !m.project && !m.isDim).slice(0, 2)) out.push({ key: `recall-${m.id}`, label: `🪶 Recall the ${m.label}`, text: `Tell the ${m.label} subagent working on "${m.activity}" to wrap up, report what it has done so far, and return.` })
  const recent = entries.slice(-3)
  if (recent.length) out.push({ key: 'scribe', label: '🪶 Ask the scribe', text: `Explain the last few steps you took and why:\n${recent.map(x => `- ${x.who}: ${x.text}`).join('\n')}` })
  return out
}

const REALM_PREFIX = 'realm:'
const PUBLISH_MS = 4000
const STALE_MS = 2 * 60_000
const FORGET_MS = 24 * 3600_000

const toQuota = (limits: readonly SessionRateLimit[]): GuildQuota[] =>
  limits.map(l => ({ kind: l.kind, label: windowLabel(l.kind), percentLeft: Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10), resetsAt: l.resetsAt }))

let ticker: { cancel: () => void } | undefined
let published = ''
let publishedAt = 0

/** Write this session's guild to the shared store, and read every other live one back. */
async function share($: EngineInterface) {
  const id = await $.session.id()
  const cwd = await $.session.cwd()
  const at = await $.clock.now()
  const mine = { id, name: cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests) }
  const body = JSON.stringify(mine)
  if (body !== published || at - publishedAt > STALE_MS / 2) {
    await $.store.set(`${REALM_PREFIX}${id}`, { ...mine, updatedAt: at })
    published = body
    publishedAt = at
  }
  const others: GuildRealm[] = []
  for (const key of await $.store.keys()) {
    if (!key.startsWith(REALM_PREFIX) || key === `${REALM_PREFIX}${id}`) continue
    const realm = (await $.store.get(key)) as GuildRealm | undefined
    if (!realm || typeof realm !== 'object' || typeof realm.updatedAt !== 'number') continue
    if (at - realm.updatedAt > FORGET_MS) void $.store.delete(key).catch(() => undefined)
    if (at - realm.updatedAt > STALE_MS) continue
    others.push(realm)
  }
  others.sort((a, b) => a.name.localeCompare(b.name))
  await update($, realms, cur => (JSON.stringify(cur) === JSON.stringify(others) ? cur : others))
  const view = await read($, viewing)
  if (view && view !== 'self' && !others.some(r => r.id === view)) await update($, viewing, () => '')
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
  const next = await update($, xp, cur => ({ ...cur, [cls]: (cur[cls] ?? 0) + amount }))
  void $.store.set('xp', next).catch(() => undefined)
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
      const mode = await $.store.get('sendMode')
      if (mode === 'petition' || mode === 'seal') await update($, sendMode, () => mode)
    } catch {
      // Petitions by default.
    }
    try {
      const usage = await $.session.usage()
      await update($, quota, () => toQuota(usage.rateLimits))
    } catch {
      // No readings yet: the mana panel waits for the first response.
    }
    ticker?.cancel()
    ticker = $.clock.every(PUBLISH_MS, () => void share($).catch(() => undefined))
    void share($).catch(() => undefined)
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
    } catch {
      // A stale realm ages out of the others' view by itself.
    }
    return next(e)
  })

  on('command.run', { command: 'guild' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Guild Hall', focus: true })
    return { text: opened.isPlaced ? '🏰 The Guild Hall is open.' : '🏰 The Guild Hall will show where this surface seats panes.' }
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
  on('classic.Notification', async ($, e, next) => {
    try {
      if (/idle/.test(e.notification_type)) await awaitPerson($, e.agent_id ?? MAIN, 'waits for your next quest', false)
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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const others = await read($, realms)
    const view = await read($, viewing)
    const here = (await $.session.cwd().catch(() => '')).split(/[\\/]/).filter(Boolean).pop() ?? 'this workspace'
    // Every workspace shares one map: this one from live state, the others from their last
    // published snapshots, each party in its project's colour. A highlighted one draws the rest faint.
    const own = { id: 'self', name: here, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests) }
    const all = [own, ...others]
    const multi = others.length > 0
    const focus = all.find(r => r.id === view)
    const members: GuildMember[] = all.flatMap((r, i) =>
      r.party.map(m => ({ ...m, project: multi ? { name: r.name, color: PROJECT_COLORS[i % PROJECT_COLORS.length]! } : undefined, isDim: !!focus && focus !== r })),
    )
    const entries = await read($, chronicle) // deeds are this session's own
    const shownRealms = focus ? [focus] : all
    const d: GuildDungeon = {
      monsters: shownRealms.reduce((n, r) => n + r.dungeon.monsters, 0),
      slain: shownRealms.reduce((n, r) => n + r.dungeon.slain, 0),
      hasRun: shownRealms.some(r => r.dungeon.hasRun),
      isCleared: shownRealms.every(r => !r.dungeon.hasRun || r.dungeon.isCleared),
      framework: shownRealms.length === 1 ? shownRealms[0]!.dungeon.framework : undefined,
    }
    const board = shownRealms.flatMap(r => r.quests)
    const mana = await read($, quota)
    const pick = await read($, selected)
    const now = await $.clock.now().catch(() => 0)
    const cols = Math.max(30, e.props.bodyColumns ?? 80)
    const { Box: B, Text: Tx, Button } = $.ui.resolve(e)
    const setPlace = (loc: GuildLocation) => () => void update($, selected, cur => (cur === loc ? '' : loc))
    const setView = (id: string) => () => void update($, viewing, () => id)
    const mode = await read($, sendMode)
    const calling = await read($, summon)
    const ui = $.ui.resolve(e)
    const Input = 'Input' in ui ? ui.Input : undefined
    const ownMembers = members.filter(m => !m.project || m.project.name === here)
    const deeds = decrees(own.dungeon, own.quests, mana, pick, ownMembers.map(m => ({ ...m, project: undefined })), entries)
    const toggleMode = () => void update($, sendMode, cur => {
      const next: GuildSendMode = cur === 'petition' ? 'seal' : 'petition'
      void $.store.set('sendMode', next).catch(() => undefined)
      return next
    })
    // The quest scroll and the decrees reach only this session: ravens to other guilds come later.
    const desk = () => (
      <B flexDirection="column" paddingX={1} borderStyle="round" borderColor="warning">
        <Tx bold>🪶 The Guildmaster's Desk{multi ? ` · quests go to ${here}` : ''}</Tx>
        {Input ? (
          <Input
            key="quest-scroll"
            label="📜 Quest scroll"
            placeholder={calling === 'guildmaster' ? 'Write a quest for the guild…' : `Write a quest for the ${CLASSES[calling].name}…`}
            submitLabel={mode === 'seal' ? 'Seal & send' : 'Draft petition'}
            onSubmit={value => {
              if (value.trim()) void petition($, questText(value, calling), `Quest for the ${CLASSES[calling].name}`, calling === 'guildmaster')
            }}
          />
        ) : (
          <Tx dimColor>The quest scroll needs a surface with text fields; the decrees below still work.</Tx>
        )}
        <B flexWrap="wrap" gap={1}>
          <Tx dimColor>Summon:</Tx>
          {(Object.keys(CLASSES) as GuildClass[]).map(c => (
            <Button key={`summon-${c}`} label={`${calling === c ? '▸ ' : ''}${CLASSES[c].icon} ${CLASSES[c].name}`} dimColor={calling !== c} onPress={() => void update($, summon, () => c)} />
          ))}
        </B>
        <Tx dimColor>{CLASSES[calling].icon} {CLASSES[calling].name}: {SUMMONS[calling]}</Tx>
        {deeds.length > 0 && <Tx bold>Decrees</Tx>}
        <B flexWrap="wrap" gap={1}>
          {deeds.map(x => <Button key={`decree-${x.key}`} label={x.label} onPress={() => void petition($, x.text, x.label.replace(/^\S+\s/, ''))} />)}
        </B>
        <B gap={1}>
          <Button key="send-mode" label={mode === 'seal' ? '🔏 Sealed: sends at once' : '📜 Petitions: you approve each'} dimColor onPress={toggleMode} />
        </B>
      </B>
    )

    const glyph = (o: GuildOutcome) => (o === 'running' ? '…' : o === 'ok' ? '✓' : '✗')
    const realmBar = () =>
      others.length > 0 && (
        <B flexDirection="column" paddingX={1}>
          <Tx bold>🗺️ Workspaces</Tx>
          <B flexWrap="wrap" gap={1}>
            <Button key="realm-all" label={`${view === '' ? '▸ ' : ''}All workspaces`} dimColor={view !== ''} onPress={setView('')} />
            <Button key="realm-here" label={`${view === 'self' ? '▸ ' : ''}${here} (this one)`} dimColor={view !== 'self'} onPress={setView(view === 'self' ? '' : 'self')} />
            {others.map(r => {
              const out = r.party.filter(m => m.isBusy).length
              return <Button key={`realm-${r.id}`} label={`${view === r.id ? '▸ ' : ''}${r.name} · ${out ? `${out} at work` : 'resting'}${r.dungeon.monsters ? ` · 💀${r.dungeon.monsters}` : ''}`} dimColor={view !== r.id} onPress={setView(view === r.id ? '' : r.id)} />
            })}
          </B>
        </B>
      )
    const showLegend = await read($, legend)
    const pickedId = await read($, picked)
    const placeBar = () => (
      <B flexWrap="wrap" gap={1} paddingX={1}>
        {ORDER.map(loc => (
          <Button key={`place-${loc}`} label={`${LOCATIONS[loc].icon} ${LOCATIONS[loc].name}`} dimColor={pick !== loc} onPress={setPlace(loc)} />
        ))}
        <Button key="legend" label={showLegend ? '📖 Close legend' : '📖 Legend'} variant={showLegend ? 'primary' : undefined} onPress={() => void update($, legend, on => !on)} />
      </B>
    )
    // Who waits on the person, across every workspace on the map.
    const waiting = members.filter(m => m.waiting && !m.isDim).map(m => ({ who: `${m.project ? `${m.project.name}: ` : ''}${m.fixedClass ? m.label : CLASSES[classOf(m)].name}`, where: LOCATIONS[m.location].name, what: m.waiting! }))
    // A party member picked from the roster: its task in full, which the map leaves unwritten.
    const pickedKey = (m: GuildMember) => `${m.project?.name ?? ''}/${m.id}`
    const chosen = members.find(m => pickedKey(m) === pickedId)
    const memberCard = () => {
      if (!chosen) return null
      const cls = classOf(chosen)
      const name = chosen.fixedClass ? chosen.label : `${CLASSES[cls].name} (main loop)`
      const theirs = entries.filter(x => x.who === (chosen.fixedClass ? chosen.label : CLASSES[cls].name)).slice(-5).reverse()
      return (
        <B flexDirection="column" paddingX={1} borderStyle="round" borderColor={chosen.waiting ? 'error' : LOCATIONS[chosen.location].color}>
          <B justifyContent="space-between">
            <Tx bold>{CLASSES[cls].icon} {name}</Tx>
            <Button key="unpick" label="✕" plain onPress={() => void update($, picked, () => '')} />
          </B>
          {chosen.project && <Tx dimColor>Workspace: {chosen.project.name}</Tx>}
          <Tx>At the {LOCATIONS[chosen.location].icon} {LOCATIONS[chosen.location].name}{chosen.lang ? ` · ${LANGS[chosen.lang].name}` : ''}{chosen.team ? ` · 🚩 ${chosen.team.name}` : ''}</Tx>
          {chosen.waiting && <Tx color="error" bold>❗ Waits on you: {chosen.waiting}</Tx>}
          <Tx wrap="wrap">{chosen.isBusy ? '⚒️ ' : '💤 '}{chosen.activity}</Tx>
          {theirs.length > 0 && <Tx bold>Recent deeds</Tx>}
          {theirs.map(x => (
            <Tx wrap="truncate-end">
              <Tx color={tone(x.outcome)}>{glyph(x.outcome)}</Tx> <Tx dimColor>{x.text}</Tx>
            </Tx>
          ))}
        </B>
      )
    }
    const inspector = () => {
      if (!pick) return null
      const info = LOCATIONS[pick]
      const people = members.filter(m => m.location === pick)
      const deeds = entries.filter(x => x.location === pick).slice(-6).reverse()
      return (
        <B flexDirection="column" paddingX={1} borderStyle="round" borderColor={info.color}>
          <Tx bold color={info.color}>{info.icon} {info.name}</Tx>
          <Tx dimColor>{PLACE_INFO[pick].blurb}</Tx>
          <Tx dimColor>{PLACE_INFO[pick].tools}</Tx>
          {pick === 'dungeon' && <Tx>{d.hasRun ? `💀 ${d.monsters} lurk · ${d.slain} slain${d.framework ? ` (${d.framework})` : ''}` : '💀 0 lurk · 0 slain · no trials yet'}</Tx>}
          {pick === 'tavern' && <Tx>📜 {board.filter(q => !q.isDone).length} open · {board.filter(q => q.isDone).length} done</Tx>}
          <Tx bold>Here now</Tx>
          {people.length === 0 && <Tx dimColor>Nobody is here.</Tx>}
          {people.map(m => (
            <Tx wrap="truncate-end">
              {m.project ? `[${m.project.name}] ` : ''}{CLASSES[classOf(m)].icon} {m.fixedClass ? m.label : CLASSES[classOf(m)].name}{m.team ? ` 🚩${m.team.name}` : ''} <Tx dimColor>{m.activity}</Tx>
            </Tx>
          ))}
          <Tx bold>Recent deeds{multi ? ` in ${here}` : ''}</Tx>
          {deeds.length === 0 && <Tx dimColor>Nothing has happened here yet.</Tx>}
          {deeds.map(x => (
            <Tx wrap="truncate-end">
              <Tx color={tone(x.outcome)}>{glyph(x.outcome)}</Tx> {x.who} <Tx dimColor>{x.text}</Tx>
            </Tx>
          ))}
        </B>
      )
    }
    const manaPanel = () => (
      <B flexDirection="column" paddingX={1}>
        <Tx bold>🔮 Mana · rate limits left</Tx>
        {mana.length === 0 && <Tx dimColor>No reading yet: the engine reports windows after the first response on a subscription.</Tx>}
        {mana.map(q => (
          <Tx wrap="truncate-end">
            {q.label.padEnd(18)} <Tx color={q.percentLeft < 20 ? 'error' : q.percentLeft < 50 ? 'warning' : 'success'}>{bar(q.percentLeft)}</Tx> {Math.round(q.percentLeft)}% left<Tx dimColor>{until(q.resetsAt, now)}</Tx>
          </Tx>
        ))}
      </B>
    )
    const partyList = () => {
      const out = members.filter(m => !m.isDim)
      if (out.length === 0) return null
      return (
        <B flexDirection="column" paddingX={1}>
          <Tx bold>⚔️ The party · pick one for its task</Tx>
          <B flexWrap="wrap" gap={1}>
            {out.map(m => (
              <Button
                key={`pick-${pickedKey(m)}`}
                label={`${m.waiting ? '❗' : CLASSES[classOf(m)].icon} ${m.project ? `${m.project.name}: ` : ''}${m.fixedClass ? m.label : CLASSES[classOf(m)].name}`}
                dimColor={pickedKey(m) !== pickedId && !m.waiting}
                variant={pickedKey(m) === pickedId ? 'primary' : undefined}
                onPress={() => void update($, picked, cur => (cur === pickedKey(m) ? '' : pickedKey(m)))}
              />
            ))}
          </B>
        </B>
      )
    }
    const tone = (o: GuildOutcome) => (o === 'running' ? 'warning' : o === 'ok' ? 'success' : 'error')
    const recent = entries.slice(-10).reverse()
    const openQuests = board.filter(q => !q.isDone)
    const doneQuests = board.filter(q => q.isDone)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const half = Math.max(14, Math.floor((cols - 1) / 2))
      const room = (loc: (typeof ORDER)[number], width: number) => {
        const info = LOCATIONS[loc]
        const here = members.filter(m => m.location === loc)
        const busy = here.some(m => m.isBusy)
        return (
          <Box key={loc} flexDirection="column" width={width} borderStyle="round" borderColor={busy ? info.color : 'inactive'} paddingX={1}>
            <Text bold color={busy ? info.color : undefined}>
              {info.icon} {info.name}
            </Text>
            {here.length === 0 && <Text dimColor>empty</Text>}
            {here.map(m => (
              <Text wrap="truncate-end" dimColor={m.isDim}>
                {m.project ? `[${m.project.name}] ` : ''}{CLASSES[classOf(m)].icon} {m.fixedClass ? m.label : CLASSES[classOf(m)].name}
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
                📜 {openQuests.length} open · {doneQuests.length} done
              </Text>
            )}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          {realmBar()}
          {focus && multi && <Text bold> 🗺️ Highlighting {focus.name}</Text>}
          <Box>
            {room('study', half)}
            {room('armory', half)}
          </Box>
          <Box>{room('tavern', half * 2)}</Box>
          <Box>
            {room('dungeon', half)}
            {room('cauldron', half)}
          </Box>
          {desk()}
          {placeBar()}
          {showLegend && (
            <Box flexDirection="column" paddingX={1} borderStyle="round">
              <Text bold>📖 Legend</Text>
              {ORDER.map(loc => <Text>{LOCATIONS[loc].icon} {LOCATIONS[loc].name}: <Text dimColor>{PLACE_INFO[loc].blurb}</Text></Text>)}
              <Text dimColor>💀 failing tests · ❗ waits on you · 🚩 a team of subagents</Text>
            </Box>
          )}
          {waiting.map(x => <Text color="error" bold>❗ {x.who} at the {x.where} {x.what}</Text>)}
          {inspector()}
          {partyList()}
          {memberCard()}
          {manaPanel()}
          {openQuests.length > 0 && (
            <Box flexDirection="column" paddingX={1}>
              <Text bold>Quest board</Text>
              {openQuests.slice(0, 5).map(q => (
                <Text wrap="truncate-end">☐ {q.title}</Text>
              ))}
            </Box>
          )}
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
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    // The map with the desk and the mana beside it when there is room; stacked when narrow.
    const wide = cols >= 110
    const deskControls = () => (
      <Box flexDirection="column" gap={1}>
        {Input ? (
          <Input
            key="quest-scroll"
            placeholder={calling === 'guildmaster' ? '📜 Write a quest for the guild…' : `📜 Write a quest for the ${CLASSES[calling].name}…`}
            submitLabel={mode === 'seal' ? '⚜ Seal & send' : '✎ Draft petition'}
            onSubmit={value => {
              if (value.trim()) void petition($, questText(value, calling), `Quest for the ${CLASSES[calling].name}`, calling === 'guildmaster')
            }}
          />
        ) : (
          <Text dimColor>The quest scroll needs a surface with text fields; the decrees still work.</Text>
        )}
        <Box flexWrap="wrap" gap={1}>
          {(Object.keys(CLASSES) as GuildClass[]).map(c => (
            <Button key={`summon-${c}`} label={CLASSES[c].icon} dimColor={calling !== c} variant={calling === c ? 'primary' : undefined} onPress={() => void update($, summon, () => c)} />
          ))}
          <Button key="send-mode" label={mode === 'seal' ? '⚜ Sealed' : '✎ Petitions'} dimColor onPress={toggleMode} />
        </Box>
        {deeds.length > 0 && (
          <Box flexDirection="column" gap={0}>
            <Text bold color="warning">⚔ Decrees</Text>
            <Box flexWrap="wrap" gap={1}>
              {deeds.map(x => <Button key={`decree-${x.key}`} label={x.label} onPress={() => void petition($, x.text, x.label.replace(/^\S+\s/, ''))} />)}
            </Box>
          </Box>
        )}
      </Box>
    )
    const column = (
      <Box flexDirection="column" gap={1} width={wide ? 46 : undefined}>
        {waiting.length > 0 && <Svg source={alertArt(waiting)} alt={`Awaiting your word: ${waiting.map(x => `${x.who} at the ${x.where} ${x.what}`).join('; ')}`} />}
        {partyList()}
        {memberCard()}
        <Svg source={deskArt(calling, mode, own.quests.filter(q => !q.isDone).length)} alt={`The Guildmaster's Desk: the quest scroll summons the ${CLASSES[calling].name}; ${mode === 'seal' ? 'quests are sealed and sent at once' : 'quests are drafted as petitions for you to send'}.`} />
        {deskControls()}
        <Svg source={manaArt(mana, now)} alt={mana.length ? `Mana: ${mana.map(q => `${q.label} ${Math.round(q.percentLeft)}% left`).join(', ')}.` : 'Mana: no rate-limit reading yet.'} isInteractive />
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {realmBar()}
        <Box flexDirection={wide ? 'row' : 'column'} gap={1}>
          <Box flexDirection="column" flexGrow={1} gap={1}>
            <Svg source={drawMap(members, d, board, { selected: pick, hour: new Date(now).getHours(), now })} alt={describeMap(members, d)} isInteractive />
            {placeBar()}
            {showLegend && <Svg source={legendArt()} alt="Legend: the Tavern takes prompts and hires subagents; the Wizard's Study is reading and research; the Armory is edits, linting and formatting; the Cauldron is builds and installs; the Dungeon is test runs, where failing tests are monsters. A red ! marks an agent waiting on you; a pennant marks a team; a glowing road marks work under way." />}
            {inspector()}
          </Box>
          {column}
        </Box>
        <Box flexDirection="column" paddingX={1}>
          <Text bold>📖 Chronicle</Text>
          {recent.length === 0 && <Text dimColor>The hall is quiet. Post a quest to begin.</Text>}
          {recent.map(entry => (
            <Text wrap="truncate-end">
              <Text color={tone(entry.outcome)}>{glyph(entry.outcome)}</Text> {CLASSES[entry.cls].icon} {entry.who}
              {entry.lang ? ` [${LANGS[entry.lang].crest}]` : ''} <Text dimColor>{entry.text}</Text>
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
