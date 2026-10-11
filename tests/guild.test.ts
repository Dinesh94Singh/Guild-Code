import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// Fake tool output standing in for real runs, by command.
const OUTPUT: Record<string, string> = {
  'cargo test': 'running 6 tests\ntest result: FAILED. 4 passed; 2 failed; 0 ignored',
  'cargo test --workspace': 'running 6 tests\ntest result: ok. 6 passed; 0 failed; 0 ignored',
  'npx eslint . --fix': '',
  'mvn -q package': 'BUILD SUCCESS',
}

/**
 * A machine in memory beneath the plugins: the files Guild Code shares between sessions, and
 * the few commands it runs on them (printenv, mv, rm, kill). No hall server is ever running.
 */
function machine(on: On, seed: Record<string, unknown> = {}) {
  const files = new Map<string, string>(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]))
  const run = (code: number, stdout = '') => ({ value: { exitCode: code, stdout, stderr: '' } }) as never
  on('fs.exists', ($, e) => ({ value: files.has(e.path) || [...files.keys()].some(k => k.startsWith(`${e.path}/`)) }) as never)
  on('fs.read', ($, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`no such file: ${e.path}`)
    return { value: text } as never
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined } as never
  })
  on('fs.list', ($, e) => {
    const names = new Set([...files.keys()].filter(k => k.startsWith(`${e.path}/`)).map(k => k.slice(e.path.length + 1).split('/')[0]!))
    return { value: [...names].map(name => ({ name, kind: files.has(`${e.path}/${name}`) ? 'file' : 'dir', size: 0, mtimeMs: 0, isLink: false })) } as never
  })
  on('process.run', ($, e) => {
    const [cmd, ...args] = e.argv
    if (cmd === 'printenv') return run(0, '/home/guild\n')
    if (cmd === 'mv') {
      const [from, to] = args.filter(a => !a.startsWith('-'))
      const text = files.get(from!)
      if (text === undefined) return run(1)
      files.delete(from!)
      files.set(to!, text)
      return run(0)
    }
    if (cmd === 'rm') {
      for (const path of args.filter(a => !a.startsWith('-'))) for (const k of [...files.keys()]) if (k === path || k.startsWith(`${path}/`)) files.delete(k)
      return run(0)
    }
    return run(1)
  })
  return files
}

const PANE = {
  plugin: 'guild-code',
  component: 'Pane',
  requestId: 'guild-hall',
  props: { title: 'Guild Hall', isFocused: false, bodyColumns: 90, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the party walks the hall, and the dungeon counts its monsters', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  machine(on)
  // Beneath the plugin, answer every tool as the engine would.
  on('tool.call', ($, e) => {
    const command = String((e as unknown as { command?: string }).command ?? '')
    const text = OUTPUT[command] ?? 'ok'
    return /FAILED/.test(text) ? { isError: true as const, result: text, text } : { result: text, text }
  })
  const text = async (surface: 'terminal') => {
    const ui = await $.ui.mount({ ...PANE, surface })
    const all = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
    await ui.unmount()
    return all
  }

  await $.tool.call({ tool: 'Read', file_path: '/repo/src/lib.rs' })
  await $.tool.call({ tool: 'Bash', command: 'cargo test' })
  let drawn = await text('terminal')
  expect(drawn).toMatch(/2 lurk · 4 slain/)
  expect(drawn).toMatch(/Rogue \[RS\]/)
  expect(drawn).toMatch(/2 monsters stand, 4 slain/)

  await $.tool.call({ tool: 'Bash', command: 'npx eslint . --fix' })
  drawn = await text('terminal')
  expect(drawn).toMatch(/Dwarf \[JS\]/)

  await $.tool.call({ tool: 'Bash', command: 'cargo test --workspace' })
  drawn = await text('terminal')
  expect(drawn).toMatch(/0 lurk · 6 slain/)
  expect(drawn).toMatch(/all 6 slain/)

  await $.tool.call({ tool: 'Bash', command: 'mvn -q package' })
  drawn = await text('terminal')
  expect(drawn).toMatch(/Alchemist \[JV\]/)
  expect(drawn).toMatch(/brews mvn -q package/)
  expect(drawn).toMatch(/reads src\/lib\.rs/)

  // Crowns for the outcomes, none for the reading: a clean lint (6), two slain (20), the
  // dungeon cleared (40) and a clean brew (8).
  const stats = await $.command.run({ command: 'guild-stats', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  expect(String((stats as { text?: string } | undefined)?.text ?? '')).toMatch(/Treasury: 74 crowns · Hamlet \(426 more to Village\)/)

  // A picture on the surfaces that draw them, with words for those who can't see it.
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.source ?? '')).toMatch(/<svg[\s\S]*Alchemist[\s\S]*<\/svg>/)
    expect(String(svg?.props.alt ?? '')).toMatch(/Alchemist in the Alchemist's Cauldron/)
    await ui.unmount()
  }
})

test('the map shows the live sessions and the last few asleep, and forgets one unused for a day', async ($, on) => {
  const HOUR = 3600_000
  const clock = mock.clock(on, { now: 30 * HOUR })
  const realm = (id: string, name: string, extra: Record<string, unknown>) => ({
    id, name, party: [{ id: 'main', label: 'Guildmaster', location: 'armory', activity: 'forges src/x.rs', isBusy: true }],
    dungeon: { monsters: 0, slain: 0, isCleared: false, hasRun: false }, quests: [], ...extra,
  })
  const now = clock.now()
  // One live, five that ended at different times, and one last used more than a day ago.
  const DIR = '/home/guild/.claude/guild-code/realm/realms'
  const seeded: Record<string, unknown> = {
    '/home/guild/.claude/guild-code/realm/realms/live.json': realm('live', 'awake', { updatedAt: now, activeAt: now }),
    '/home/guild/.claude/guild-code/realm/realms/old.json': realm('old', 'forgotten', { updatedAt: now - 25 * HOUR, activeAt: now - 25 * HOUR }),
  }
  // Open but unused for two hours, with a deed from then and one from long before.
  seeded[`${DIR}/idle.json`] = realm('idle', 'dozing', {
    updatedAt: now, activeAt: now - 2 * HOUR,
    chronicle: [{ id: 'x', at: now - 2 * HOUR, who: 'Wizard', cls: 'wizard', location: 'study', text: 'reads recent.md', outcome: 'ok' }, { id: 'y', at: now - 5 * HOUR, who: 'Wizard', cls: 'wizard', location: 'study', text: 'reads ancient.md', outcome: 'ok' }],
  })
  for (let i = 1; i <= 5; i++) seeded[`${DIR}/s${i}.json`] = realm(`s${i}`, `slept${i}`, { updatedAt: now - i * HOUR, activeAt: now - i * HOUR, endedAt: now - i * HOUR })
  // A quest the hall filed for this session, waiting in its inbox.
  seeded['/home/guild/.claude/guild-code/realm/inbox/here/1.json'] = { realm: 'here', title: 'Ask the scribe', text: 'What happened today?', mode: 'petition' }
  mock.store(on)
  const files = machine(on, seeded)
  on('prompt.fill', () => ({ isFilled: true }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: undefined }) as never)
  on('session.id', () => ({ value: 'here' }) as never)
  on('session.cwd', () => ({ value: '/repo/here' }) as never)
  await $.session.start({ cwd: '/repo/here', surface: 'terminal', isInteractive: true })
  await clock.advance(5000)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const drawn = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  await ui.unmount()
  expect(drawn).toMatch(/\[awake\][\s\S]*forges src\/x\.rs/)
  expect(drawn).toMatch(/\[slept1\][\s\S]*sleeps at the tavern · last active 1h ago/)
  // An open session unused for an hour sleeps too, and ranks among the sleepers by its last work.
  expect(drawn).toMatch(/\[dozing\][\s\S]*last active 2h ago/)
  expect(drawn).toMatch(/\[slept1\]/)
  // This session, one at work and three asleep make five: the rest stay off the map.
  expect(drawn).not.toMatch(/slept3|slept4|slept5/)
  expect(drawn).not.toMatch(/forgotten/)
  // This session is the scribe (the least id of the open ones): it forgets the old realm for everyone.
  expect(files.has(`${DIR}/old.json`)).toBe(false)
  expect(files.has(`${DIR}/s5.json`)).toBe(true)
  // Its own realm is in the shared folder, and the quest in its inbox was drafted and cleared.
  expect(JSON.parse(files.get(`${DIR}/here.json`)!).name).toBe('here')
  expect(drawn).toMatch(/Petition drafted: Ask the scribe/)
  expect([...files.keys()].some(k => k.includes('/inbox/'))).toBe(false)
})
