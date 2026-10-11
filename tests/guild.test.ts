import { expect, mock, test } from 'claude-code/testing'

// Fake tool output standing in for real runs, by command.
const OUTPUT: Record<string, string> = {
  'cargo test': 'running 6 tests\ntest result: FAILED. 4 passed; 2 failed; 0 ignored',
  'cargo test --workspace': 'running 6 tests\ntest result: ok. 6 passed; 0 failed; 0 ignored',
  'npx eslint . --fix': '',
  'mvn -q package': 'BUILD SUCCESS',
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
  const seeded: Record<string, unknown> = {
    'realm:live': realm('live', 'awake', { updatedAt: now, activeAt: now }),
    'realm:old': realm('old', 'forgotten', { updatedAt: now - 25 * HOUR, activeAt: now - 25 * HOUR }),
  }
  // Open but unused for two hours, with a deed from then and one from long before.
  seeded['realm:idle'] = realm('idle', 'dozing', {
    updatedAt: now, activeAt: now - 2 * HOUR,
    chronicle: [{ id: 'x', at: now - 2 * HOUR, who: 'Wizard', cls: 'wizard', location: 'study', text: 'reads recent.md', outcome: 'ok' }, { id: 'y', at: now - 5 * HOUR, who: 'Wizard', cls: 'wizard', location: 'study', text: 'reads ancient.md', outcome: 'ok' }],
  })
  for (let i = 1; i <= 5; i++) seeded[`realm:s${i}`] = realm(`s${i}`, `slept${i}`, { updatedAt: now - i * HOUR, activeAt: now - i * HOUR, endedAt: now - i * HOUR })
  mock.store(on, seeded)
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
})
