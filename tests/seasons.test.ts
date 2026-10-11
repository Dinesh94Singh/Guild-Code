import { expect, test } from 'claude-code/testing'

import { boostOf, seasonOf } from '../hooks/seasons'
import { CATALOG, NEW_TREASURY, buy, closeQuest, earn } from '../hooks/treasury'
import type { Ware } from '../hooks/treasury'

const on = (iso: string) => Date.parse(`${iso}T12:00:00`)

test('the calendar picks the season, over the new year too', () => {
  expect(seasonOf(on('2026-10-14'))).toBe(null)
  expect(seasonOf(on('2026-10-15'))).toBe('halloween')
  expect(seasonOf(on('2026-11-01'))).toBe('halloween')
  expect(seasonOf(on('2026-11-05'))).toBe(null)
  expect(seasonOf(on('2026-11-20'))).toBe('thanksgiving')
  expect(seasonOf(on('2026-12-25'))).toBe('christmas')
  expect(seasonOf(on('2027-01-06'))).toBe('christmas')
  expect(seasonOf(on('2027-01-07'))).toBe(null)
})

test("Hallow's Eve itself pays half again for every monster slain", () => {
  expect(boostOf('halloween', 'slay', on('2026-10-31'))).toBe(1.5)
  expect(boostOf('halloween', 'slay', on('2026-10-30'))).toBe(1)
  expect(boostOf(null, 'slay', on('2026-10-31'))).toBe(1)
  expect(earn(NEW_TREASURY, 'slay', 2, on('2026-10-31'), 'halloween').paid).toBe(30)
})

test("a season's event fills with closed quests and pays when full", () => {
  let t = NEW_TREASURY, paid = 0
  // Five quests within the hour.
  for (let i = 0; i < 5; i++) {
    const r = closeQuest(t, on('2026-10-20') + i * 60_000, 'halloween')
    t = r.treasury
    paid += r.event
  }
  expect(paid).toBe(25)
  expect(t.event).toEqual({ season: 'halloween', step: 0 })
  // Out of season, nothing counts.
  expect(closeQuest(t, on('2026-11-05'), null).treasury.event).toEqual({ season: 'halloween', step: 0 })
})

test('a seasonal ware sells only in its season', () => {
  const ware: Ware = { id: 'test-pumpkin', name: 'Test pumpkin', region: 'town', tier: 'trinket', price: 10, desc: '', season: 'halloween' }
  CATALOG.push(ware)
  const rich = { ...NEW_TREASURY, crowns: 100, earned: 100 }
  expect(buy(rich, 'test-pumpkin', null)).toEqual({ refusal: 'season' })
  expect('treasury' in buy(rich, 'test-pumpkin', 'halloween')).toBe(true)
  CATALOG.pop()
})
