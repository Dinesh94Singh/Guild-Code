// Hallow's Eve (15 Oct – 1 Nov): the wares the merchant brings for the season.
import type { Ware } from '../treasury'

export const HALLOWEEN_WARES: Ware[] = [
  { id: 'pumpkinpatch', name: 'Pumpkin patch', region: 'forest', tier: 'trinket', price: 90, season: 'halloween', desc: 'A patch at the edge of the woods; its pumpkins grin after dark.' },
  { id: 'scarecrow', name: 'Scarecrow sentinel', region: 'town', tier: 'fixture', price: 300, season: 'halloween', desc: 'Stands in the wheat and turns its head to watch whoever is working.' },
  { id: 'manor', name: 'Haunted manor', region: 'badlands', tier: 'landmark', price: 1300, season: 'halloween', desc: 'Its windows flicker green while tests are failing.' },
  { id: 'coven', name: 'Coven circle', region: 'swamp', tier: 'wonder', price: 3300, season: 'halloween', desc: 'Standing stones in the swamp around a green fire that roars while a brew bubbles.' },
]
