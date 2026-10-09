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

import type { GuildClass, GuildDungeon, GuildEntry, GuildLocation, GuildMember, GuildOutcome, GuildQuest, GuildQuota, GuildRealm, GuildXp } from '../types'
import { classifyTool, readBattle } from './classify'
import type { Placement } from './classify'
import { CLASSES, LANGS, LOCATIONS, ORDER, PLACE_INFO, PROJECT_COLORS, TEAMS, classOf, classOfAgentType, windowLabel } from './lore'
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
const teams = atom({ plugin: 'guild-code', key: 'teams' } as const, 0)

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
  await update($, party, list => list.map(m => (m.id === memberId ? { ...m, ...change } : m)))
}

async function gainXp($: EngineInterface, cls: GuildClass, amount: number) {
  const next = await update($, xp, cur => ({ ...cur, [cls]: (cur[cls] ?? 0) + amount }))
  void $.store.set('xp', next).catch(() => undefined)
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
    const record = d.hasRun ? `💀 Dungeon: ${d.monsters} monsters left, ${d.slain} slain${d.framework ? ` (${d.framework})` : ''}` : '💀 Dungeon: unexplored this session'
    return { text: ['🏰 Guild record', ...rows, record].join('\n') }
  })

  on('prompt.submit', async ($, e, next) => {
    try {
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

    const ran = await next(e)

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
    const placeBar = () => (
      <B flexWrap="wrap" gap={1} paddingX={1}>
        {ORDER.map(loc => (
          <Button key={`place-${loc}`} label={`${LOCATIONS[loc].icon} ${LOCATIONS[loc].name}`} dimColor={pick !== loc} onPress={setPlace(loc)} />
        ))}
      </B>
    )
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
          {pick === 'dungeon' && <Tx>{d.hasRun ? `💀 ${d.monsters} lurk · ${d.slain} slain${d.framework ? ` (${d.framework})` : ''}` : 'Unexplored'}</Tx>}
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
      const out = members.filter(m => m.id !== MAIN && !m.isDim)
      if (out.length === 0) return null
      return (
        <B flexDirection="column" paddingX={1}>
          <Tx bold>⚔️ Party out</Tx>
          {out.map(m => (
            <Tx wrap="truncate-end">
              {m.project ? `[${m.project.name}] ` : ''}{CLASSES[classOf(m)].icon} {m.label}{m.team ? ` 🚩${m.team.name}` : ''} · {LOCATIONS[m.location].name} <Tx dimColor>{m.activity}</Tx>
            </Tx>
          ))}
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
                {d.hasRun ? `${'💀'.repeat(Math.min(d.monsters, 6))} ${d.monsters} lurk · ${d.slain} slain` : 'unexplored'}
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
          {placeBar()}
          {inspector()}
          {partyList()}
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
    return (
      <Box flexDirection="column">
        {realmBar()}
        <Svg source={drawMap(members, d, board, { realm: focus ? focus.name : multi ? `${all.length} workspaces` : here, selected: pick, quota: mana, hour: new Date(now).getHours() })} alt={describeMap(members, d)} isInteractive />
        {placeBar()}
        {inspector()}
        {partyList()}
        {manaPanel()}
        {openQuests.length > 0 && (
          <Box flexDirection="column" paddingX={1}>
            <Text bold>📜 Quest board</Text>
            {openQuests.slice(0, 6).map(q => (
              <Text>☐ {q.title}</Text>
            ))}
          </Box>
        )}
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
