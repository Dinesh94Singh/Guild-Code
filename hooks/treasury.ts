// The treasury: Guild Crowns, earned by deeds the guild can see and spent on the realm.
//
// Crowns pay for outcomes (a failing test that now passes, a build fixed, a quest closed),
// never for raw tool calls, so the realm grows with good work rather than busy work. An hour
// pays at most HOURLY_CAP. Rank follows every crown ever earned, so spending never sets it back.
// One purse per machine: every project shares the one island, so they share its treasury.
//
// Kept pure, like classify.ts: the mod and the Guild Hall page both run it, and it is tested
// without the engine.
import type { GuildTreasury } from '../types'
import { PACK_WARES } from './packs'
import { SEASONS, boostOf } from './seasons'
import type { SeasonId } from './seasons'

export type Deed =
  | 'slay' // a failing test now passes (per monster)
  | 'clear' // the whole suite goes green after a failure
  | 'brew' // a build, install or bundle succeeds
  | 'rescue' // a build that failed now passes
  | 'temper' // a linter, formatter or type checker comes back clean
  | 'commit' // a git commit lands
  | 'quest' // a task on the quest board is done
  | 'return' // a subagent comes home
  | 'team' // two or more subagents march at once

export const REWARDS: Record<Deed, number> = {
  slay: 10,
  clear: 40,
  brew: 8,
  rescue: 20,
  temper: 6,
  commit: 5,
  quest: 15,
  return: 5,
  team: 20,
}

export const DEED_NAMES: Record<Deed, string> = {
  slay: 'Monster slain',
  clear: 'Dungeon cleared',
  brew: 'Clean brew',
  rescue: 'Spoiled brew rescued',
  temper: 'Blade tempered',
  commit: 'Commit scribed',
  quest: 'Quest closed',
  return: 'Party returned',
  team: 'Team marched',
}

/** At most this many crowns in any one hour, so a loop can't farm the treasury. */
export const HOURLY_CAP = 300
const HOUR = 3600_000

/** The first quest closed each day pays the streak's bonus; day 7 and on pays the last. */
export const STREAK_BONUS = [10, 15, 20, 25, 30, 40, 60]

export type Tier = 'trinket' | 'fixture' | 'landmark' | 'wonder'
export type Region = 'town' | 'forest' | 'peaks' | 'badlands' | 'swamp' | 'coast' | 'heroes' | 'realm'

export const REGIONS: Record<Region, { name: string; color: string }> = {
  town: { name: 'Town', color: '#f2b84b' },
  forest: { name: 'Forest', color: '#a593ff' },
  peaks: { name: 'Peaks', color: '#a9b6c6' },
  badlands: { name: 'Badlands', color: '#e8606f' },
  swamp: { name: 'Swamp', color: '#84d488' },
  coast: { name: 'Coast', color: '#5fd3f3' },
  heroes: { name: 'Heroes', color: '#ff7ad9' },
  realm: { name: 'Realm', color: '#efe6d2' },
}

export const TIERS: Record<Tier, { name: string; color: string }> = {
  trinket: { name: 'Trinket', color: '#9be0c7' },
  fixture: { name: 'Fixture', color: '#9fc3ff' },
  landmark: { name: 'Landmark', color: '#f2b84b' },
  wonder: { name: 'Wonder', color: '#ff9a6b' },
}

/** Ranks by crowns ever earned. Each opens the next tier of the shop. */
export const RANKS: { name: string; at: number; opens: Tier }[] = [
  { name: 'Hamlet', at: 0, opens: 'trinket' },
  { name: 'Village', at: 500, opens: 'fixture' },
  { name: 'Town', at: 2500, opens: 'landmark' },
  { name: 'Port', at: 10_000, opens: 'wonder' },
  { name: 'City', at: 40_000, opens: 'wonder' },
  { name: 'Kingdom', at: 100_000, opens: 'wonder' },
]
const TIER_ORDER: Tier[] = ['trinket', 'fixture', 'landmark', 'wonder']

export type Ware = {
  id: string; name: string; region: Region; tier: Tier; price: number; desc: string
  /** Sold only while this season lasts (hooks/seasons.ts); once bought it stays built. */
  season?: SeasonId
}

/** What the merchant sells. Each has its place on the island (hooks/world.js, ESTATES). */
const BASE_WARES: Ware[] = [
  { id: 'lanterns', name: 'Road lanterns', region: 'town', tier: 'trinket', price: 80, desc: 'Lamp posts along the roads out of town, lit after dark.' },
  { id: 'fountain', name: 'Square fountain', region: 'town', tier: 'fixture', price: 350, desc: 'A stone fountain on the cobbled square.' },
  { id: 'bard', name: 'Tavern bard', region: 'town', tier: 'fixture', price: 260, desc: 'Plays by the Tavern door, and strikes up when a quest closes.' },
  { id: 'belltower', name: 'Bell tower', region: 'town', tier: 'landmark', price: 1200, desc: 'Its bell swings whenever a dungeon is cleared.' },
  { id: 'fairyring', name: 'Fairy ring', region: 'forest', tier: 'trinket', price: 90, desc: 'A ring of mushrooms in the woods that glows at night.' },
  { id: 'owl', name: 'Owl familiar', region: 'forest', tier: 'fixture', price: 300, desc: "Circles the Wizard's tower, and perches while someone reads." },
  { id: 'obelisk', name: 'Rune obelisk', region: 'forest', tier: 'landmark', price: 900, desc: 'Its runes burn bright while the Study is at work.' },
  { id: 'dummies', name: 'Training dummies', region: 'peaks', tier: 'trinket', price: 120, desc: 'Straw dummies in the snow beside the Armory.' },
  { id: 'watchtower', name: 'Watchtower', region: 'peaks', tier: 'landmark', price: 1100, desc: 'A stone tower on the ridge with a beacon fire at night.' },
  { id: 'pikes', name: 'Trophy pikes', region: 'badlands', tier: 'trinket', price: 100, desc: 'Slime banners on pikes by the skull gate.' },
  { id: 'wisps', name: 'Graveyard wisps', region: 'badlands', tier: 'fixture', price: 280, desc: 'Pale lights drifting among the stones after dark.' },
  { id: 'shelf', name: 'Potion shelf', region: 'swamp', tier: 'trinket', price: 140, desc: 'Bottles by the hut that glow while a brew bubbles.' },
  { id: 'cauldron2', name: 'Second cauldron', region: 'swamp', tier: 'landmark', price: 1000, desc: 'A second pot beside the first, bubbling along with it.' },
  { id: 'lighthouse', name: 'Lighthouse', region: 'coast', tier: 'landmark', price: 1400, desc: 'Sweeps its beam across the sea at night.' },
  { id: 'hound', name: 'Guild hound', region: 'heroes', tier: 'fixture', price: 450, desc: 'A dog that trots after the Guildmaster.' },
  { id: 'rainbow', name: 'Rainbow', region: 'realm', tier: 'trinket', price: 120, desc: 'Every rain ends with a rainbow over the island.' },
]

/** Every ware: the year-round ones and each theme pack's seasonal ones (hooks/packs). */
export const CATALOG: Ware[] = [...BASE_WARES, ...PACK_WARES]

export type Treasury = GuildTreasury

export const NEW_TREASURY: Treasury = { crowns: 0, earned: 0, owned: [], hour: { start: 0, paid: 0 }, streak: { day: '', count: 0 }, event: { season: '', step: 0 } }

/** A treasury read back from the store: anything missing or malformed takes its default. */
export function treasuryOf(saved: unknown): Treasury {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Treasury>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  return {
    crowns: num(s.crowns),
    earned: Math.max(num(s.earned), num(s.crowns)),
    owned: Array.isArray(s.owned) ? s.owned.filter((id): id is string => typeof id === 'string' && CATALOG.some(w => w.id === id)) : [],
    hour: { start: num(s.hour?.start), paid: num(s.hour?.paid) },
    streak: { day: typeof s.streak?.day === 'string' ? s.streak.day : '', count: num(s.streak?.count) },
    event: { season: typeof s.event?.season === 'string' ? s.event.season : '', step: num(s.event?.step) },
  }
}

/** The local date of a moment, as YYYY-MM-DD. */
export function dayOf(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pay out a deed `times` over, within the hour's cap. Returns the treasury and what was paid. */
export function earn(t: Treasury, deed: Deed, times: number, at: number, season: SeasonId | null = null): { treasury: Treasury; paid: number } {
  return pay(t, Math.round(REWARDS[deed] * Math.max(0, Math.floor(times)) * boostOf(season, deed, at)), at)
}

/** Pay `want` crowns, within the hour's cap. */
function pay(t: Treasury, want: number, at: number): { treasury: Treasury; paid: number } {
  const hour = at - t.hour.start >= HOUR || at < t.hour.start ? { start: at, paid: 0 } : t.hour
  const paid = Math.max(0, Math.min(want, HOURLY_CAP - hour.paid))
  if (paid === 0) return { treasury: hour === t.hour ? t : { ...t, hour }, paid }
  return { treasury: { ...t, crowns: t.crowns + paid, earned: t.earned + paid, hour: { start: hour.start, paid: hour.paid + paid } }, paid }
}

/**
 * A quest closed: the day's first one pays the streak bonus. A day missed steps the streak back
 * one day rather than to the start; a gap of several days steps back one per missed day. In a
 * season, it also steps the season's event on, which pays (within the cap) each time it fills.
 */
export function closeQuest(t: Treasury, at: number, season: SeasonId | null = null): { treasury: Treasury; paid: number; bonus: number; event: number } {
  const quest = earn(t, 'quest', 1, at, season)
  let after = quest.treasury, paid = quest.paid, bonus = 0, event = 0
  const today = dayOf(at)
  if (t.streak.day !== today) {
    const missed = t.streak.day ? Math.max(0, Math.round((Date.parse(today) - Date.parse(t.streak.day)) / 86_400_000) - 1) : 0
    const count = Math.max(1, t.streak.count - missed + 1)
    bonus = STREAK_BONUS[Math.min(count, STREAK_BONUS.length) - 1]!
    // The streak bonus is a daily gift, outside the hourly cap.
    after = { ...after, crowns: after.crowns + bonus, earned: after.earned + bonus, streak: { day: today, count } }
    paid += bonus
  }
  if (season) {
    const spec = SEASONS[season].event
    const step = (after.event.season === season ? after.event.step : 0) + 1
    if (step >= spec.every) {
      const filled = pay(after, spec.pays, at)
      after = { ...filled.treasury, event: { season, step: 0 } }
      event = filled.paid
      paid += event
    } else after = { ...after, event: { season, step } }
  }
  return { treasury: after, paid, bonus, event }
}

export function rankOf(earned: number): { name: string; index: number; next?: { name: string; at: number } } {
  let index = 0
  RANKS.forEach((r, i) => {
    if (earned >= r.at) index = i
  })
  const next = RANKS[index + 1]
  return { name: RANKS[index]!.name, index, next: next ? { name: next.name, at: next.at } : undefined }
}

/** The highest tier the rank has opened. */
export function openTier(earned: number): Tier {
  return RANKS[rankOf(earned).index]!.opens
}

export const isOpen = (tier: Tier, earned: number) => TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(openTier(earned))

export type Refusal = 'unknown' | 'owned' | 'not-owned' | 'locked' | 'poor' | 'season'

/** Buy a ware: it must exist, not be owned, be in season, be open at this rank, and be affordable. */
export function buy(t: Treasury, id: string, season: SeasonId | null = null): { treasury: Treasury } | { refusal: Refusal } {
  const ware = CATALOG.find(w => w.id === id)
  if (!ware) return { refusal: 'unknown' }
  if (t.owned.includes(id)) return { refusal: 'owned' }
  if (ware.season && ware.season !== season) return { refusal: 'season' }
  if (!isOpen(ware.tier, t.earned)) return { refusal: 'locked' }
  if (t.crowns < ware.price) return { refusal: 'poor' }
  return { treasury: { ...t, crowns: t.crowns - ware.price, owned: [...t.owned, id] } }
}

/** Sell a ware back for half its price. */
export function sell(t: Treasury, id: string): { treasury: Treasury } | { refusal: Refusal } {
  const ware = CATALOG.find(w => w.id === id)
  if (!ware) return { refusal: 'unknown' }
  if (!t.owned.includes(id)) return { refusal: 'not-owned' }
  return { treasury: { ...t, crowns: t.crowns + Math.floor(ware.price / 2), owned: t.owned.filter(o => o !== id) } }
}

/** What a shop order from the Guild Hall page asks for. */
export type ShopOrder = { action: 'buy' | 'sell'; item: string }

export const isShopOrder = (o: unknown): o is ShopOrder => {
  const s = o as ShopOrder
  return !!s && typeof s === 'object' && (s.action === 'buy' || s.action === 'sell') && typeof s.item === 'string'
}

export function trade(t: Treasury, order: ShopOrder, season: SeasonId | null = null): { treasury: Treasury } | { refusal: Refusal } {
  return order.action === 'buy' ? buy(t, order.item, season) : sell(t, order.item)
}

export const REFUSALS: Record<Refusal, string> = {
  unknown: 'The merchant has no such ware.',
  owned: 'The realm already has one.',
  'not-owned': 'The realm has none to sell.',
  locked: 'The realm must grow to a higher rank first.',
  poor: 'Not enough crowns in the treasury.',
  season: 'That ware sells only in its season.',
}
