// Theme packs: how each season dresses the painted realm (hooks/world.js), gathered here.
//   PACK_ART[season] = { snow?, ground?: { [palette key]: hex }, trees?: { OAK|DARK_OAK|WILLOW: [4 hex] }, paint?(ctx) }
//     ctx: { add(y, fn), px, marks, W, H } — add() queues a painter in the realm's depth order.
//   PACK_ESTATES = { [ware id]: estate } — where each seasonal ware stands (see ESTATES).
// A pack adds its own file and spreads it in below.
import { CHRISTMAS_ART, CHRISTMAS_ESTATES } from './christmas-art.js'
import { HALLOWEEN_ART, HALLOWEEN_ESTATES } from './halloween-art.js'
import { THANKSGIVING_ART, THANKSGIVING_ESTATES } from './thanksgiving-art.js'

export const PACK_ART = { halloween: HALLOWEEN_ART, thanksgiving: THANKSGIVING_ART, christmas: CHRISTMAS_ART }
export const PACK_ESTATES = { ...HALLOWEEN_ESTATES, ...THANKSGIVING_ESTATES, ...CHRISTMAS_ESTATES }
