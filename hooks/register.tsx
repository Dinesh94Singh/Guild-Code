// Guild Code: a medieval guild hall drawn over Claude's real work.
//
// Every tool call is placed in one room of the hall (see classify.ts):
//   Tavern Board          prompts, subagent dispatch, tasks
//   Wizard's Study        reading files, searching, docs and web
//   Dungeon               running tests; failing tests are monsters
//   Armory                edits, lint, format, diffs
//   Alchemist's Cauldron  builds, installs, bundlers, containers
// The main loop and each subagent are party members who walk between rooms.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GuildClass, GuildDungeon, GuildEntry, GuildMember, GuildOutcome, GuildQuest, GuildXp } from '../types'
import { classifyTool, readBattle } from './classify'
import type { Placement } from './classify'
import { CLASSES, LANGS, LOCATIONS, ORDER, classOf, classOfAgentType } from './lore'
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
    void $.ui.open({ id: PANE, title: 'Guild Hall' })
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
    const members = await read($, party)
    const entries = await read($, chronicle)
    const d = await read($, dungeon)
    const board = await read($, quests)
    const cols = Math.max(30, e.props.bodyColumns ?? 80)

    const glyph = (o: GuildOutcome) => (o === 'running' ? '…' : o === 'ok' ? '✓' : '✗')
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
              <Text wrap="truncate-end">
                {CLASSES[classOf(m)].icon} {m.fixedClass ? m.label : CLASSES[classOf(m)].name}
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
          <Box>
            {room('study', half)}
            {room('armory', half)}
          </Box>
          <Box>{room('tavern', half * 2)}</Box>
          <Box>
            {room('dungeon', half)}
            {room('cauldron', half)}
          </Box>
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
        <Svg source={drawMap(members, d, board)} alt={describeMap(members, d)} isInteractive />
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
