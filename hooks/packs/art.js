// Theme packs: how each season dresses the painted realm (hooks/world.js), gathered here.
//   PACK_ART[season] = { snow?, ground?: { [palette key]: hex }, paint?(ctx) }
//     ctx: { add(y, fn), px, marks, W, H } — add() queues a painter in the realm's depth order.
//   PACK_ESTATES = { [ware id]: estate } — where each seasonal ware stands (see ESTATES).
// A pack adds its own file and spreads it in below.
export const PACK_ART = {}
export const PACK_ESTATES = {}
