import { expect, test } from 'claude-code/testing'

import { questText, windowLabel } from '../hooks/lore'

test('rate-limit windows read as mana gauges, naming a model when the window has one', () => {
  expect(windowLabel('five_hour')).toBe('5-hour window')
  expect(windowLabel('seven_day')).toBe('Weekly')
  expect(windowLabel('seven_day_opus')).toBe('Weekly · Opus')
  expect(windowLabel('seven_day_sonnet')).toBe('Weekly · Sonnet')
  expect(windowLabel('spend_limit')).toBe('Spend limit')
  expect(windowLabel('monthly_tokens')).toBe('Monthly tokens')
})

test('a quest scroll sends the words as written, or asks for the summoned class', () => {
  expect(questText('  Fix the login bug  ', 'guildmaster')).toBe('Fix the login bug')
  expect(questText('Fix the login bug', 'rogue')).toBe('Fix the login bug\n\nSend the guild-code:rogue subagent (the Rogue) on this quest.')
})
