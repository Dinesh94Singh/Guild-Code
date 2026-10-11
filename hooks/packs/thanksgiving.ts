// The Harvest Feast (10 – 30 Nov): the wares the merchant brings for the season.
import type { Ware } from '../treasury'

export const THANKSGIVING_WARES: Ware[] = [
  { id: 'haymaze', name: 'Hay maze', region: 'town', tier: 'trinket', price: 80, season: 'thanksgiving', desc: 'Bales stacked into a maze by the chickens; townsfolk wander lost in it.' },
  { id: 'applepress', name: 'Apple press', region: 'forest', tier: 'fixture', price: 280, season: 'thanksgiving', desc: 'An orchard press that fills a barrel of cider while a brew bubbles.' },
  { id: 'market', name: 'Harvest market', region: 'coast', tier: 'landmark', price: 1100, season: 'thanksgiving', desc: 'A row of stalls east of the river, their lamps lit for every open quest.' },
  { id: 'granary', name: 'Great granary', region: 'coast', tier: 'wonder', price: 3200, season: 'thanksgiving', desc: 'A barn and silo whose grain rises as the feast table fills.' },
]
