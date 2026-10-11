// Midwinter (1 Dec – 6 Jan): the wares the merchant brings for the season.
import type { Ware } from '../treasury'

export const CHRISTMAS_WARES: Ware[] = [
  { id: 'snowmen', name: 'Snowman row', region: 'town', tier: 'trinket', price: 70, season: 'christmas', desc: 'A row by the east road that gains a snowman for each day of your streak.' },
  { id: 'rink', name: 'Skating rink', region: 'forest', tier: 'fixture', price: 320, season: 'christmas', desc: 'Benches and lanterns on the frozen lake; townsfolk skate while the guild rests.' },
  { id: 'gingerbread', name: 'Gingerbread house', region: 'town', tier: 'landmark', price: 1200, season: 'christmas', desc: 'Iced and sugared; its windows light one by one as presents pile up.' },
  { id: 'aurora', name: 'Aurora spire', region: 'peaks', tier: 'wonder', price: 3600, season: 'christmas', desc: 'An ice tower on the ridge that hangs the northern lights over the island at night.' },
]
