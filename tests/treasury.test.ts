import { expect, test } from 'claude-code/testing'

import { CATALOG, HOURLY_CAP, NEW_TREASURY, buy, closeQuest, earn, rankOf, sell, treasuryOf } from '../hooks/treasury'

const NOON = Date.parse('2026-10-10T12:00:00')
const DAY = 86_400_000

test('deeds pay crowns, and an hour pays no more than the cap', () => {
  let t = earn(NEW_TREASURY, 'slay', 3, NOON).treasury
  expect(t.crowns).toBe(30)
  expect(t.earned).toBe(30)
  const capped = earn(t, 'slay', 100, NOON + 60_000)
  expect(capped.paid).toBe(HOURLY_CAP - 30)
  expect(capped.treasury.crowns).toBe(HOURLY_CAP)
  expect(earn(capped.treasury, 'brew', 1, NOON + 120_000).paid).toBe(0)
  // A new hour pays again.
  t = earn(capped.treasury, 'brew', 1, NOON + 3600_000).treasury
  expect(t.crowns).toBe(HOURLY_CAP + 8)
})

test('the first quest of the day pays the streak, a missed day steps it back one', () => {
  let r = closeQuest(NEW_TREASURY, NOON)
  expect(r.bonus).toBe(10)
  expect(r.treasury.crowns).toBe(25)
  expect(closeQuest(r.treasury, NOON + 3600_000).bonus).toBe(0)
  r = closeQuest(r.treasury, NOON + DAY)
  expect(r.treasury.streak.count).toBe(2)
  r = closeQuest(r.treasury, NOON + 2 * DAY)
  expect(r.treasury.streak.count).toBe(3)
  // Skip a day: day 3 → back to 3 on return rather than on to 4.
  r = closeQuest(r.treasury, NOON + 4 * DAY)
  expect(r.treasury.streak.count).toBe(3)
  expect(r.bonus).toBe(20)
})

test('rank follows crowns ever earned, and opens the shop tier by tier', () => {
  expect(rankOf(0).name).toBe('Hamlet')
  expect(rankOf(600).name).toBe('Village')
  expect(rankOf(2500).next?.name).toBe('Port')
  const rich = { ...NEW_TREASURY, crowns: 5000, earned: 600 }
  expect(buy(rich, 'belltower')).toEqual({ refusal: 'locked' })
  expect('treasury' in buy(rich, 'fountain')).toBe(true)
})

test('buying spends crowns, selling returns half, and neither runs twice', () => {
  const t = { ...NEW_TREASURY, crowns: 100, earned: 100 }
  expect(buy(t, 'nothing')).toEqual({ refusal: 'unknown' })
  expect(buy({ ...t, crowns: 10 }, 'lanterns')).toEqual({ refusal: 'poor' })
  const bought = buy(t, 'lanterns')
  if (!('treasury' in bought)) throw new Error('should buy')
  expect(bought.treasury.crowns).toBe(20)
  expect(bought.treasury.owned).toEqual(['lanterns'])
  expect(buy(bought.treasury, 'lanterns')).toEqual({ refusal: 'owned' })
  const sold = sell(bought.treasury, 'lanterns')
  if (!('treasury' in sold)) throw new Error('should sell')
  expect(sold.treasury.crowns).toBe(60)
  expect(sell(sold.treasury, 'lanterns')).toEqual({ refusal: 'not-owned' })
  // Selling never lowers the rank.
  expect(sold.treasury.earned).toBe(100)
})

test('a treasury read back from the store drops what it cannot trust', () => {
  const t = treasuryOf({ crowns: 50.7, earned: -3, owned: ['owl', 'castle', 4], streak: { day: 7 } })
  expect(t.crowns).toBe(50)
  expect(t.earned).toBe(50)
  expect(t.owned).toEqual(['owl'])
  expect(t.streak).toEqual({ day: '', count: 0 })
  expect(treasuryOf(undefined)).toEqual(NEW_TREASURY)
  expect(CATALOG.every(w => w.price > 0)).toBe(true)
})
