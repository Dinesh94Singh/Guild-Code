import { expect, test } from 'claude-code/testing'

import { windowLabel } from '../hooks/lore'

test('rate-limit windows read as mana gauges, naming a model when the window has one', () => {
  expect(windowLabel('five_hour')).toBe('5-hour window')
  expect(windowLabel('seven_day')).toBe('Weekly')
  expect(windowLabel('seven_day_opus')).toBe('Weekly · Opus')
  expect(windowLabel('seven_day_sonnet')).toBe('Weekly · Sonnet')
  expect(windowLabel('spend_limit')).toBe('Spend limit')
  expect(windowLabel('monthly_tokens')).toBe('Monthly tokens')
})
