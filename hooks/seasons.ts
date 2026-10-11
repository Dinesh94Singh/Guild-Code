// The seasons: when each theme pack dresses the realm, and the one event it runs.
//
// A pack is cosmetic first: it never changes where work goes. Its event pays a small bonus
// through the treasury's hourly cap, and its wares sell only while it lasts. Kept pure, like
// treasury.ts, so the mod, the page and the tests all read the same calendar.

export type SeasonId = 'halloween' | 'thanksgiving' | 'christmas'

export type Season = {
  id: SeasonId
  name: string
  /** First and last day, as [month (1-12), day], local time. A window may run over the new year. */
  from: [number, number]
  to: [number, number]
  /** The event: every `every` quests closed pays `pays` crowns. */
  event: { name: string; every: number; pays: number }
  /** A day on which one deed pays more: Hallow's Eve itself pays half again for every monster slain. */
  boost?: { deed: 'slay'; on: [number, number]; factor: number }
}

export const SEASONS: Record<SeasonId, Season> = {
  halloween: {
    id: 'halloween', name: "Hallow's Eve", from: [10, 15], to: [11, 1],
    event: { name: 'Candy pail', every: 5, pays: 25 },
    boost: { deed: 'slay', on: [10, 31], factor: 1.5 },
  },
  thanksgiving: {
    id: 'thanksgiving', name: 'Harvest Feast', from: [11, 10], to: [11, 30],
    event: { name: 'Feast table', every: 12, pays: 40 },
  },
  christmas: {
    id: 'christmas', name: 'Midwinter', from: [12, 1], to: [1, 6],
    event: { name: 'Presents under the tree', every: 6, pays: 30 },
  },
}

export const isSeason = (id: unknown): id is SeasonId => typeof id === 'string' && id in SEASONS

const md = (at: number) => { const d = new Date(at); return (d.getMonth() + 1) * 100 + d.getDate() }

/** The season in force at a moment, by the local calendar, or null between seasons. */
export function seasonOf(at: number): SeasonId | null {
  const now = md(at)
  for (const s of Object.values(SEASONS)) {
    const from = s.from[0] * 100 + s.from[1], to = s.to[0] * 100 + s.to[1]
    if (from <= to ? now >= from && now <= to : now >= from || now <= to) return s.id
  }
  return null
}

/** How much more a deed pays today, in a season with a boost on this day. */
export function boostOf(season: SeasonId | null, deed: string, at: number): number {
  const b = season ? SEASONS[season].boost : undefined
  return b && b.deed === deed && md(at) === b.on[0] * 100 + b.on[1] ? b.factor : 1
}
