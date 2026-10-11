// The realm: one world for the dry run and the mod. Its layout, and a painter that draws it
// into a plain pixel buffer (no browser needed), so the dry run paints the very image the
// mod's map is built from (see demo/build.mjs, which writes it to hooks/world-art.ts).
//
// Land fills the frame, the sea keeps to the south coast. The guild town sits in the centre-west
// with a broad river to its east. From the town gate the roads branch like a tree: north-west into
// the forest to the Wizard's tower, south-west into the swamp to the Alchemist's hut, and east over
// the one bridge, where the road forks north up to the Armory in the snowy mountains and east to
// the Dungeon in the volcanic badlands, under the fire mountain.
import {
  PALETTES, SEASON, Recorder, alchemistHut, shade, shadow, cookfire, deadTree, dungeonCave, field, flowers, forgeHall, gravestone, hash,
  house, lamp, lavaCrack, marks, volcano, mineEntrance, mountain, mushroom, oak, palm, pine, px, questBoard, reeds, resetMarks, rock, stall,
  tavern, tuft, washingLine, well, willow, windmill, wizardTower, woodyard,
} from './pixelart.js'
import { PACK_ART, PACK_ESTATES } from './packs/art.js'

export const W = 512, H = 320

// ── the places ──
// at: the landmark's foot · tag: where its name plate hangs · spots: where the party stands
export const PLACES = {
  tavern: { at: { x: 168, y: 172 }, tag: { x: 168, y: 104 }, spots: [{ x: 152, y: 198 }, { x: 172, y: 204 }, { x: 190, y: 198 }, { x: 160, y: 214 }, { x: 182, y: 214 }, { x: 140, y: 208 }] },
  study: { at: { x: 56, y: 122 }, tag: { x: 60, y: 14 }, spots: [{ x: 74, y: 136 }, { x: 90, y: 140 }, { x: 62, y: 140 }, { x: 82, y: 148 }, { x: 100, y: 148 }] },
  armory: { at: { x: 392, y: 96 }, tag: { x: 392, y: 22 }, spots: [{ x: 412, y: 116 }, { x: 392, y: 112 }, { x: 374, y: 118 }, { x: 402, y: 124 }, { x: 384, y: 126 }] },
  cauldron: { at: { x: 66, y: 266 }, tag: { x: 66, y: 204 }, spots: [{ x: 110, y: 262 }, { x: 124, y: 268 }, { x: 138, y: 262 }, { x: 116, y: 276 }, { x: 132, y: 278 }] },
  dungeon: { at: { x: 420, y: 236 }, tag: { x: 392, y: 168 }, spots: [{ x: 382, y: 250 }, { x: 370, y: 258 }, { x: 386, y: 264 }, { x: 372, y: 244 }, { x: 362, y: 252 }] },
}
export const HUB = { x: 214, y: 190 } // the town gate, where every road begins
export const DOORWAY = { x: 168, y: 174 } // the tavern door, where new party members step out
export const BOARD = { x: 98, y: 198 } // the quest board's top-left
export const CAULDRON = { x: 124, y: 252 }
export const CHEST = { x: 456, y: 250 }
export const VOLCANO = { x: 478, y: 182 }
export const MONSTER_SLOTS = [[404, 246], [416, 250], [428, 246], [398, 256], [410, 260], [424, 258], [438, 254], [392, 242], [418, 266], [432, 264], [404, 268], [444, 262]].map(([x, y]) => ({ x, y }))

// Roads branch from the town gate; the two eastern roads share the bridge and fork beyond it.
export const ROADS_RAW = {
  tavern: [[214, 190], [204, 192], [194, 196]],
  study: [[214, 190], [228, 166], [224, 138], [204, 118], [170, 110], [134, 114], [106, 128], [88, 136]],
  cauldron: [[214, 190], [210, 212], [200, 236], [178, 252], [158, 258], [144, 258]],
  armory: [[214, 190], [240, 182], [268, 176], [298, 174], [322, 158], [346, 138], [366, 120]],
  dungeon: [[214, 190], [240, 182], [268, 176], [298, 174], [326, 190], [350, 210], [366, 238]],
}
export const RIVER_RAW = [[288, -8], [298, 50], [282, 110], [296, 170], [280, 230], [292, 280], [286, 330]]

export function smooth(raw, step) {
  const out = []
  for (let i = 0; i < raw.length - 1; i++) {
    const p0 = raw[Math.max(0, i - 1)], p1 = raw[i], p2 = raw[i + 1], p3 = raw[Math.min(raw.length - 1, i + 2)]
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) })
    }
  }
  const last = raw[raw.length - 1]
  out.push({ x: last[0], y: last[1] })
  return out
}
export const ROADS = Object.fromEntries(Object.entries(ROADS_RAW).map(([k, r]) => [k, smooth(r, 2)]))
export const WALK = Object.fromEntries(Object.entries(ROADS_RAW).map(([k, r]) => [k, smooth(r, 3)]))
export const RIVER = smooth(RIVER_RAW, 2)

// ── the folk and their work: anchors the dry run animates and the mod's map dresses ──
export const FOLK = {
  mine: { x: 336, y: 66 },
  woodyard: { x: 30, y: 184 },
  cookfire: { x: 158, y: 280 },
  laundry: { x: 14, y: 222 },
  fishing: { x: 270, y: 122 },
  field: { x: 228, y: 268, w: 44, h: 20 },
  windmill: { x: 214, y: 288 },
  pen: { x: 254, y: 242, rx: 16, ry: 7 },
  glade: { x: 232, y: 86 },
  lake: { x: 128, y: 56, rx: 22, ry: 11 },
  dock: { x: 204, y: 304 },
  perch: { x: 452, y: 196 },
  town: { x: 166, y: 198, rx: 46, ry: 24 },
  houses: [{ x: 108, y: 190, w: 28, roof: ['#3b5fa8', '#2c4a85'], chimney: true }, { x: 124, y: 238, w: 28, roof: ['#b8503a', '#8e3a2a'], chimney: true }, { x: 238, y: 216, w: 28, roof: ['#3f8f4f', '#2c6b3a'], chimney: false }, { x: 176, y: 242, w: 30, roof: ['#7a4fc9', '#5a3a99'], chimney: true }],
  well: { x: 200, y: 214 },
  stall: { x: 146, y: 226 },
  lamps: [{ x: 196, y: 180 }, { x: 130, y: 208 }],
  // where the townsfolk, animals and birds go about their day
  townPoints: [{ x: 136, y: 202 }, { x: 150, y: 216 }, { x: 186, y: 214 }, { x: 200, y: 198 }, { x: 160, y: 192 }, { x: 124, y: 214 }, { x: 108, y: 194 }, { x: 238, y: 220 }, { x: 176, y: 246 }],
  catPoints: [{ x: 108, y: 194 }, { x: 124, y: 242 }, { x: 238, y: 220 }, { x: 176, y: 246 }, { x: 196, y: 216 }],
  chickens: [{ x: 200, y: 264 }, { x: 212, y: 266 }, { x: 206, y: 262 }],
  frogPads: [{ x: 50, y: 270 }, { x: 88, y: 272 }],
  pools: [{ x: 54, y: 268 }, { x: 84, y: 270 }, { x: 70, y: 274 }],
  fireflies: { x: 10, y: 226, w: 120, h: 60 },
  butterflies: { x: 196, y: 96, w: 80, h: 50 },
  flurries: { x: 300, y: 0, w: 212, h: 130 },
  gulls: [{ x: 60, y: 308, r: 16, v: 0.9 }, { x: 260, y: 310, r: 20, v: -0.7 }, { x: 440, y: 308, r: 18, v: 0.6 }],
  ship: { y: 314, from: 230, to: 490 },
}

// ── the estates: what the treasury buys (hooks/treasury.ts) and where each one stands ──
// `clears` keeps the trees off its ground; `paint` draws its still part into the realm and returns
// the marks the page's overlays animate. Wares with no `paint` live only in the overlays (the owl,
// the bard, the wisps, the hound, the rainbow), around `at`.
const stone = (b, L, T, w, h, light, mid, dark) => {
  px(b, '#1b1424', L - 1, T - 1, w + 2, h + 1)
  for (let yy = T; yy < T + h; yy++) for (let xx = 0; xx < w; xx++) {
    const row = Math.floor((yy - T) / 4), seam = (yy - T) % 4 === 0 || (xx + (row % 2) * 2) % 5 === 0
    px(b, seam ? shade(dark, -16) : xx < 2 ? light : xx < w - 3 ? mid : dark, L + xx, yy)
  }
}
const spire = (b, x, top, rows, half, a, dark) => {
  for (let i = 0; i < rows; i++) {
    const hw = Math.max(1, Math.round((rows - i) / rows * half))
    px(b, '#1b1424', x - hw - 1, top - 1 - i, hw * 2 + 2, 1); px(b, a, x - hw, top - 1 - i, hw, 1); px(b, dark, x, top - 1 - i, hw, 1)
  }
}
export const ESTATES = {
  lanterns: {
    at: { x: 214, y: 190 }, lamps: [{ x: 222, y: 124 }, { x: 116, y: 130 }, { x: 212, y: 240 }, { x: 262, y: 188 }, { x: 314, y: 182 }],
    get clears() { return this.lamps.map(l => ({ ...l, r: 4 })) },
    paint(b) { for (const l of this.lamps) lamp(b, l.x, l.y); return {} },
  },
  fountain: {
    at: { x: 138, y: 194 }, clears: [{ x: 138, y: 194, r: 10 }],
    paint(b) {
      const { x, y } = this.at
      shadow(b, x, y + 1, 24)
      px(b, '#1b1424', x - 11, y - 8, 22, 8); px(b, '#b0a99c', x - 10, y - 7, 20, 6); px(b, '#7a7266', x - 10, y - 2, 20, 1)
      px(b, '#2a6fa0', x - 9, y - 6, 18, 3); px(b, '#3f97c9', x - 9, y - 6, 18, 2); px(b, '#5aaed8', x - 6, y - 6, 5, 1)
      px(b, '#1b1424', x - 2, y - 16, 5, 11); px(b, '#b0a99c', x - 1, y - 15, 3, 10); px(b, '#8a8478', x + 1, y - 15, 1, 10)
      px(b, '#1b1424', x - 6, y - 18, 13, 3); px(b, '#b0a99c', x - 5, y - 17, 11, 1); px(b, '#3f97c9', x - 4, y - 18, 9, 1)
      return { jet: { x, y: y - 19 }, pool: { x, y: y - 6 } }
    },
  },
  bard: { at: { x: 147, y: 182 }, clears: [] },
  belltower: {
    at: { x: 252, y: 160 }, clears: [{ x: 252, y: 156, r: 14 }],
    paint(b) {
      const { x, y } = this.at, top = y - 30
      shadow(b, x + 2, y, 18)
      stone(b, x - 6, top, 12, 30, '#b0a99c', '#9a938a', '#7a7266')
      px(b, '#1b1424', x - 2, y - 7, 4, 7); px(b, '#5a3720', x - 1, y - 6, 2, 6)
      px(b, '#1b1424', x - 4, top + 3, 8, 9); px(b, '#2a2233', x - 3, top + 4, 6, 7)
      px(b, '#5a3720', x - 4, top + 3, 8, 1)
      spire(b, x, top, 14, 8, '#b8503a', '#8e3a2a')
      px(b, '#3a2414', x, top - 20, 1, 6); px(b, '#f2b84b', x + 1, top - 20, 3, 2)
      return { bell: { x, y: top + 5 } }
    },
  },
  fairyring: {
    at: { x: 34, y: 150 }, clears: [{ x: 34, y: 150, r: 13 }],
    paint(b) {
      const { x, y } = this.at
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; mushroom(b, Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 4) + 2, k % 2 ? '#a593ff' : '#e8606f') }
      return { ring: { x, y } }
    },
  },
  owl: { at: { x: 56, y: 62 }, clears: [] },
  obelisk: {
    at: { x: 100, y: 96 }, clears: [{ x: 100, y: 102, r: 18 }],
    paint(b) {
      const { x, y } = this.at
      shadow(b, x + 1, y, 12)
      px(b, '#1b1424', x - 5, y - 3, 11, 3); px(b, '#9a938a', x - 4, y - 2, 9, 2)
      px(b, '#1b1424', x - 3, y - 21, 7, 18); px(b, '#6e6880', x - 2, y - 20, 5, 17); px(b, '#8a839a', x - 2, y - 20, 1, 17); px(b, '#4f4a60', x + 2, y - 20, 1, 17)
      px(b, '#1b1424', x - 2, y - 24, 5, 3); px(b, '#8a839a', x - 1, y - 23, 3, 2); px(b, '#1b1424', x, y - 25, 1, 1)
      const runes = [{ x, y: y - 17 }, { x: x - 1, y: y - 12 }, { x, y: y - 7 }]
      for (const r of runes) px(b, '#3a3550', r.x, r.y, 2, 2)
      return { runes }
    },
  },
  dummies: {
    at: { x: 452, y: 118 }, clears: [{ x: 452, y: 116, r: 14 }],
    paint(b) {
      for (const [x, y] of [[446, 117], [459, 119]]) {
        shadow(b, x, y, 8)
        px(b, '#5a3720', x, y - 14, 1, 14); px(b, '#5a3720', x - 5, y - 10, 11, 1)
        px(b, '#1b1424', x - 3, y - 12, 7, 9); px(b, '#d9b85a', x - 2, y - 11, 5, 7); px(b, '#b8323f', x - 1, y - 9, 3, 2); px(b, '#fff3d0', x, y - 9, 1, 1)
        px(b, '#1b1424', x - 2, y - 17, 5, 5); px(b, '#e8cf7a', x - 1, y - 16, 3, 3)
      }
      return {}
    },
  },
  watchtower: {
    at: { x: 318, y: 110 }, clears: [{ x: 318, y: 104, r: 16 }],
    paint(b) {
      const { x, y } = this.at, top = y - 34
      shadow(b, x + 2, y, 20)
      stone(b, x - 7, top, 14, 34, '#9a958c', '#86817a', '#66615a')
      px(b, '#1b1424', x - 9, top - 4, 18, 5); px(b, '#86817a', x - 8, top - 3, 16, 3)
      for (let k = 0; k < 4; k++) { px(b, '#1b1424', x - 9 + k * 5, top - 7, 4, 4); px(b, '#9a958c', x - 8 + k * 5, top - 6, 2, 2) }
      px(b, '#1b1424', x - 1, top + 8, 2, 6); px(b, '#1b1424', x - 1, top + 20, 2, 6)
      px(b, '#1b1424', x - 3, y - 9, 6, 9); px(b, '#5a3720', x - 2, y - 8, 4, 8)
      px(b, '#3a2414', x - 3, top - 9, 6, 3); px(b, '#5a3720', x - 2, top - 9, 4, 1)
      return { beacon: { x, y: top - 10 } }
    },
  },
  pikes: {
    at: { x: 474, y: 272 }, clears: [{ x: 474, y: 268, r: 12 }],
    paint(b) {
      const { x, y } = this.at
      ;['#d1495b', '#9b59d0', '#e07a2f'].forEach((c, i) => {
        const p = x - 8 + i * 8, yy = y + (i === 1 ? -2 : 0)
        px(b, 'rgba(0,0,0,.3)', p - 1, yy - 1, 4, 2)
        px(b, '#3a2414', p, yy - 18, 1, 18); px(b, '#c4cfdc', p, yy - 20, 1, 2)
        px(b, '#1b1424', p + 1, yy - 17, 6, 6); px(b, c, p + 1, yy - 16, 5, 4); px(b, '#fff', p + 2, yy - 15, 1, 1); px(b, '#fff', p + 4, yy - 15, 1, 1)
      })
      return {}
    },
  },
  wisps: { at: { x: 470, y: 246 }, clears: [] },
  shelf: {
    at: { x: 24, y: 252 }, clears: [{ x: 24, y: 248, r: 11 }],
    paint(b) {
      const { x, y } = this.at
      shadow(b, x, y, 18)
      px(b, '#1b1424', x - 8, y - 15, 16, 15); px(b, '#7a4a2a', x - 7, y - 14, 14, 14)
      px(b, '#4a2f1d', x - 7, y - 9, 14, 1); px(b, '#4a2f1d', x - 7, y - 4, 14, 1)
      const bottles = []
      for (const [row, cs] of [[y - 13, ['#84d488', '#a593ff', '#e8606f']], [y - 8, ['#5fd3f3', '#f2b84b', '#84d488']]])
        cs.forEach((c, i) => { const bx = x - 5 + i * 4; px(b, '#1b1424', bx, row, 3, 4); px(b, c, bx + 1, row + 1, 1, 3); px(b, '#efe6d2', bx + 1, row, 1, 1); bottles.push({ x: bx + 1, y: row + 2, c }) })
      return { bottles }
    },
  },
  cauldron2: {
    at: { x: 152, y: 252 }, clears: [{ x: 152, y: 250, r: 10 }],
    paint(b) {
      const { x, y } = this.at
      shadow(b, x, y + 2, 16)
      px(b, '#1b1424', x - 5, y - 1, 2, 3); px(b, '#1b1424', x + 3, y - 1, 2, 3)
      px(b, '#1b1424', x - 7, y - 9, 14, 9); px(b, '#2e2a36', x - 6, y - 8, 12, 7); px(b, '#4a4556', x - 6, y - 8, 12, 1)
      px(b, '#7a5fd9', x - 5, y - 9, 10, 2)
      return { brew: { x, y: y - 9 } }
    },
  },
  lighthouse: {
    at: { x: 338, y: 280 }, clears: [{ x: 338, y: 274, r: 13 }],
    paint(b) {
      const { x, y } = this.at
      shadow(b, x + 2, y, 18)
      px(b, '#1b1424', x - 8, y - 4, 16, 4); px(b, '#7a7266', x - 7, y - 3, 14, 3)
      for (let i = 4; i < 34; i++) {
        const hw = 5 - Math.round((i - 4) * 2 / 30), band = Math.floor((i - 4) / 6) % 2 ? '#b8323f' : '#efe6d2'
        px(b, '#1b1424', x - hw - 1, y - i, hw * 2 + 2, 1); px(b, band, x - hw, y - i, hw * 2, 1); px(b, 'rgba(0,0,0,.18)', x + 1, y - i, hw - 1, 1)
      }
      px(b, '#1b1424', x - 5, y - 41, 10, 8); px(b, '#ffd27a', x - 3, y - 39, 6, 4); px(b, '#fff3c0', x - 3, y - 39, 2, 2)
      px(b, '#1b1424', x - 4, y - 44, 8, 3); px(b, '#b8323f', x - 3, y - 43, 6, 1); px(b, '#1b1424', x, y - 46, 1, 2)
      return { lamp: { x, y: y - 37 } }
    },
  },
  hound: { at: { x: 168, y: 200 }, clears: [] },
  rainbow: { at: { x: 256, y: 160 }, clears: [] },
  ...PACK_ESTATES,
}

// ── the painter ──
const CELL = 2, GW = W / CELL, GH = H / CELL
const SEA = 0, LAND = 1, FRESH = 2
const PLAINS = 0, FOREST = 1, PEAKS = 2, BADLANDS = 3, SWAMP = 4, BEACH = 5
const PAL_HEX = {
  grassA: '#5c9e3e', grassB: '#529338', grassHi: '#74b54e', grassLo: '#447f30',
  forestA: '#3f7431', forestB: '#376a2c', forestHi: '#4f8a3c', forestLo: '#2c5824',
  peakA: '#7c7467', peakB: '#716a5e', peakHi: '#8d857a', peakLo: '#5f584e',
  badA: '#4e4440', badB: '#463d3a', badHi: '#5e5250', badLo: '#3a3230',
  swampA: '#4d6239', swampB: '#465a34', swampHi: '#5f7646', swampLo: '#3a4c2c',
  sandA: '#dcc893', sandB: '#d3bd86', sandHi: '#e9d9a8', sandLo: '#bfa873',
  snowA: '#e8eef4', snowB: '#dde5ee', snowHi: '#ffffff', snowLo: '#c4cfdc',
  dirt: '#b8955c', dirtHi: '#c9a86e', dirtLo: '#9f7f4c', dirtEdge: '#7f6440',
  cobA: '#a39a8c', cobB: '#978e81', mortar: '#6a6258', plazaEdge: '#5a5248',
  plank: '#9a6a3c', plankLo: '#5a3720', rail: '#3a2414',
  river: '#3f97c9', riverHi: '#5aaed8', bank: '#8f7c58', pool: '#2f4b3e', poolHi: '#3d6150',
  shoal: '#62b4d6', sea1: '#4aa3c9', sea2: '#3484b8', sea3: '#2a68a0', cliffHi: '#8a6a44', cliffLo: '#5a4028',
}
const GROUND = {
  [PLAINS]: ['grassA', 'grassB', 'grassHi', 'grassLo'], [FOREST]: ['forestA', 'forestB', 'forestHi', 'forestLo'],
  [PEAKS]: ['peakA', 'peakB', 'peakHi', 'peakLo'], [BADLANDS]: ['badA', 'badB', 'badHi', 'badLo'],
  [SWAMP]: ['swampA', 'swampB', 'swampHi', 'swampLo'], [BEACH]: ['sandA', 'sandB', 'sandHi', 'sandLo'],
}
const SNOW_GROUND = ['snowA', 'snowB', 'snowHi', 'snowLo']

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
export const fbm = (x, y) => (vnoise(x, y) * 4 + vnoise(x * 2 + 17, y * 2 + 9) * 2 + vnoise(x * 4 + 41, y * 4 + 3)) / 7

const parsed = new Map()
function parseColor(c) {
  let v = parsed.get(c)
  if (v) return v
  if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1]
  else { const m = c.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(',').map(Number) : [0, 0, 0, 1]; v = [p[0], p[1], p[2], p[3] ?? 1] }
  parsed.set(c, v)
  return v
}
/** A tiny stand-in for a 2D canvas: fillStyle, fillRect and alpha blending into RGBA pixels. */
export class SoftCanvas {
  constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); this.fillStyle = '#000' }
  set(x, y, r, g, b) { if (x < 0 || y < 0 || x >= this.width || y >= this.height) return; const o = (y * this.width + x) * 4; this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = 255 }
  fillRect(x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
    if (w < 0) { x += w; w = -w } if (h < 0) { y += h; h = -h }
    const [r, g, b, a] = parseColor(this.fillStyle)
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) {
      const o = (j * this.width + i) * 4
      if (a >= 1) { this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = 255 }
      else { this.data[o] += (r - this.data[o]) * a; this.data[o + 1] += (g - this.data[o + 1]) * a; this.data[o + 2] += (b - this.data[o + 2]) * a }
    }
  }
}

function coastY(x) { return 288 + (fbm(x / 38 + 3, 7) - 0.5) * 26 }
function biomeAt(x, y) {
  const n = fbm(x / 34 + 50, y / 34 + 50) - 0.5
  const ell = (cx, cy, rx, ry) => 1 - Math.hypot((x - cx) / rx, (y - cy) / ry) + n * 0.6
  const w = [[PEAKS, ell(390, 26, 180, 74)], [FOREST, ell(50, 90, 120, 100)], [BADLANDS, ell(462, 214, 96, 86)], [SWAMP, ell(56, 268, 104, 56)]]
  let best = PLAINS, top = 0
  for (const [b, v] of w) if (v > top) { top = v; best = b }
  return best
}

/** Paints the whole realm. Returns the RGBA pixels and where the lights, smoke and water are. */
export function paintWorld(owned = [], season = null) {
  resetMarks()
  const built = owned.filter(id => ESTATES[id]?.paint), estates = {}, art = (season && PACK_ART[season]) || {}
  SEASON.snow = !!art.snow; SEASON.crops = !art.snow
  const PAL = Object.fromEntries(Object.entries({ ...PAL_HEX, ...art.ground }).map(([k, v]) => [k, parseColor(v)]))
  const KIND = new Uint8Array(GW * GH), BIOME = new Uint8Array(GW * GH), SNOWY = new Uint8Array(GW * GH), DEPTH = new Float32Array(GW * GH)
  const cell = (x, y) => Math.max(0, Math.min(GH - 1, Math.floor(y / CELL))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x / CELL)))
  // Masks: which cells a road, the river, the lake or the town square covers.
  const stamp = (pts, radius) => {
    const m = new Uint8Array(GW * GH)
    for (const p of pts) {
      const r = typeof radius === 'function' ? radius(p) : radius
      for (let j = Math.floor((p.y - r) / CELL); j <= Math.ceil((p.y + r) / CELL); j++) for (let i = Math.floor((p.x - r) / CELL); i <= Math.ceil((p.x + r) / CELL); i++) {
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue
        if (Math.hypot(i * CELL + 1 - p.x, j * CELL + 1 - p.y) <= r) m[j * GW + i] = 1
      }
    }
    return m
  }
  const oval = (cx, cy, rx, ry) => { const m = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (((i * CELL + 1 - cx) / rx) ** 2 + ((j * CELL + 1 - cy) / ry) ** 2 <= 1) m[j * GW + i] = 1; return m }
  const roadPts = Object.values(ROADS).flat()
  const ROAD = stamp(roadPts, 3.5), ROAD_EDGE = stamp(roadPts, 5.5), ROAD_NEAR = stamp(roadPts, 12)
  const riverW = p => 5 + p.y / H * 5
  const RIV = stamp(RIVER, riverW), RIV_BANK = stamp(RIVER, p => riverW(p) + 3)
  const L = FOLK.lake, LAKE = oval(L.x, L.y, L.rx, L.ry), LAKE_BANK = oval(L.x, L.y, L.rx + 3, L.ry + 3)
  const T = FOLK.town, PLAZA = oval(T.x, T.y, T.rx, T.ry), PLAZA_EDGE = oval(T.x, T.y, T.rx + 3, T.ry + 3)

  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i, x = i * CELL + 1, y = j * CELL + 1
    const d = (coastY(x) - y) / 40
    DEPTH[k] = d
    let kind = d > 0 ? LAND : SEA, biome = PLAINS
    if (kind === LAND) {
      biome = biomeAt(x, y)
      if (d < 0.12 && biome !== PEAKS) biome = BEACH
      if (RIV[k] || LAKE[k]) kind = FRESH
      else if (biome === SWAMP && !ROAD_NEAR[k] && fbm(x / 16 + 9, y / 16 + 4) > 0.64 && Math.hypot(x - PLACES.cauldron.at.x, y - PLACES.cauldron.at.y) > 34) kind = FRESH
      // the mountains around the Armory lie under snow
      SNOWY[k] = kind === LAND && biome !== BADLANDS && (biome === PEAKS || Math.hypot((x - 392) / 1.6, y - 56) + (fbm(x / 30 + 5, y / 30 + 5) - 0.5) * 50 < 86) ? 1 : 0
    }
    if (RIV[k] && d <= 0) kind = SEA
    KIND[k] = kind; BIOME[k] = biome
  }
  const cv = new SoftCanvas(W, H)
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i, d = DEPTH[k], kind = KIND[k], biome = BIOME[k], tone = fbm(i / 11, j / 11)
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const x = i * CELL + dx, y = j * CELL + dy, h = hash(x, y)
      let c
      if (kind === SEA) c = PAL[d > -0.12 ? 'sea1' : d > -0.3 ? 'sea2' : 'sea3']
      else if (kind === FRESH) {
        if (ROAD[k]) c = x % 4 === 0 ? PAL.plankLo : PAL.plank // a bridge
        else if (ROAD_EDGE[k]) c = PAL.rail
        else if (!RIV[k] && !LAKE[k]) c = h > 0.96 ? PAL.poolHi : PAL.pool // swamp pools
        else c = h > 0.985 ? PAL.riverHi : PAL.river
      } else if (PLAZA[k]) {
        const off = Math.floor(y / 3) % 2 ? 3 : 0
        c = y % 3 === 0 || (x + off) % 6 === 0 ? PAL.mortar : hash(Math.floor((x + off) / 6), Math.floor(y / 3)) > 0.5 ? PAL.cobA : PAL.cobB
      } else if (ROAD[k]) c = h > 0.98 ? PAL.dirtHi : PAL.dirt
      else if (ROAD_EDGE[k]) c = h > 0.5 ? PAL.dirtLo : PAL.dirtEdge
      else if (PLAZA_EDGE[k]) c = PAL.plazaEdge
      else if (RIV_BANK[k] || LAKE_BANK[k]) c = PAL.bank
      else {
        const g = SNOWY[k] && biome !== BEACH ? SNOW_GROUND : GROUND[biome]
        const base = tone > 0.5 ? g[0] : g[1]
        c = PAL[h > 0.985 ? g[2] : h < 0.012 ? g[3] : base]
      }
      cv.set(x, y, c[0], c[1], c[2])
    }
  }
  // the coast: a cliff where the land drops to the sea, shallows below it
  const foam = [], sparks = []
  for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
    const k = j * GW + i
    if (KIND[k] !== SEA) continue
    const x = i * CELL, y = j * CELL
    if (KIND[k - GW] !== SEA) { for (let dx = 0; dx < CELL; dx++) { cv.set(x + dx, y, ...PAL.cliffHi); cv.set(x + dx, y + 1, ...PAL.cliffLo) } foam.push({ x, y: y + 2 }); continue }
    if (KIND[k - 2 * GW] !== SEA || KIND[k - 3 * GW] !== SEA) for (let dx = 0; dx < CELL; dx++) for (let dy = 0; dy < CELL; dy++) if ((x + dx + y + dy) % 2 === 0) cv.set(x + dx, y + dy, ...PAL.shoal)
  }
  for (let j = 0; j < GH; j += 4) for (let i = 0; i < GW; i += 4) { const k = j * GW + i; if (KIND[k] !== LAND && hash(i * 3, j * 7) > 0.5) sparks.push({ x: i * CELL, y: j * CELL, fresh: KIND[k] === FRESH }) }

  // the scenery, back to front
  const items = []
  const add = (y, fn) => items.push({ y, fn })
  const P = PLACES
  const clear = [
    { ...P.study.at, r: 30 }, { x: P.armory.at.x, y: P.armory.at.y - 20, r: 60 }, { x: P.dungeon.at.x, y: P.dungeon.at.y - 14, r: 48 }, { ...P.cauldron.at, r: 44 },
    { ...FOLK.mine, r: 30 }, { ...FOLK.woodyard, r: 18 }, { ...FOLK.fishing, r: 12 }, { ...FOLK.glade, r: 18 }, { ...FOLK.windmill, r: 18 }, { x: FOLK.pen.x, y: FOLK.pen.y, r: 30 }, { ...FOLK.laundry, r: 18 }, { ...FOLK.dock, r: 18 },
    { ...CAULDRON, r: 16 }, { ...CHEST, r: 10 }, { x: VOLCANO.x, y: VOLCANO.y - 30, r: 52 }, ...MONSTER_SLOTS.map(s => ({ ...s, r: 6 })), ...P.dungeon.spots.map(s => ({ ...s, r: 10 })), ...P.armory.spots.map(s => ({ ...s, r: 9 })), ...P.cauldron.spots.map(s => ({ ...s, r: 9 })), ...P.study.spots.map(s => ({ ...s, r: 9 })),
    ...built.flatMap(id => ESTATES[id].clears),
  ]
  const F = FOLK.field
  const inTown = (x, y) => ((x - 168) / 92) ** 2 + ((y - 206) / 60) ** 2 < 1
  const cleared = (x, y) => clear.some(c => Math.hypot(x - c.x, y - c.y) < c.r) || inTown(x, y) || (x > F.x - 6 && x < F.x + F.w + 6 && y > F.y - 4 && y < F.y + F.h + 10)
  for (let y = -6; y < 120; y += 9) for (let x = 250; x < W + 20; x += 14) {
    const jx = x + Math.floor(hash(x, y + 99) * 10) - 5, jy = y + Math.floor(hash(y + 99, x) * 7)
    const k = cell(jx, jy)
    if (BIOME[k] !== PEAKS || KIND[k] !== LAND || ROAD_NEAR[k] || cleared(jx, jy)) continue
    const w = 22 + Math.floor(hash(jx, jy * 3) * 22), h = Math.floor(w * (0.6 + hash(jy, jx) * 0.3))
    if (KIND[cell(jx - w / 2, jy)] !== LAND || KIND[cell(jx + w / 2, jy)] !== LAND) continue
    add(jy, b => mountain(b, jx, jy, w, h))
  }
  for (let y = 4; y < H; y += 6) for (let x = 3; x < W; x += 6) {
    const jx = x + Math.floor(hash(x, y * 3) * 5) - 2, jy = y + Math.floor(hash(x * 5, y) * 5) - 2
    const k = cell(jx, jy), r = hash(jx * 7, jy * 13), biome = BIOME[k]
    if (KIND[k] === FRESH && biome === SWAMP && r < 0.12) { add(jy, b => { px(b, '#4f8a3c', jx - 1, jy, 3, 2); if (r < 0.04) px(b, '#e88aa8', jx, jy, 1, 1) }); continue }
    if (KIND[k] !== LAND || DEPTH[k] < 0.1 || ROAD_NEAR[k] || cleared(jx, jy)) continue
    const nearSkull = Math.hypot(jx - P.dungeon.at.x, jy - P.dungeon.at.y) < 80
    if (SNOWY[k] && biome !== PEAKS) {
      if (r < 0.32) add(jy, b => pine(b, jx, jy, 10 + Math.floor(hash(jy, jx) * 7), true))
      else if (r < 0.38) add(jy, b => rock(b, jx, jy, 2, '#f4f8fc', '#aebccc'))
      continue
    }
    const grove = biome === PLAINS && fbm(jx / 28, jy / 28 + 11) > 0.6
    if (grove) {
      if (r < 0.42) add(jy, b => oak(b, jx, jy, 5 + Math.floor(hash(jx, 2) * 2), hash(jx, 3) > 0.5 ? PALETTES.OAK : PALETTES.DARK_OAK))
      else if (r < 0.54) add(jy, b => pine(b, jx, jy, 11 + Math.floor(hash(jy, jx) * 6)))
      else if (r < 0.64) add(jy, b => oak(b, jx, jy, 3, PALETTES.OAK, 0))
      continue
    }
    switch (biome) {
      case FOREST:
        if (r < 0.66) add(jy, b => pine(b, jx, jy, 12 + Math.floor(hash(jy, jx) * 8)))
        else if (r < 0.78) add(jy, b => oak(b, jx, jy, 5, PALETTES.DARK_OAK))
        else if (r < 0.82) add(jy, b => mushroom(b, jx, jy))
        break
      case PLAINS:
        if (r < 0.08) add(jy, b => oak(b, jx, jy, 5 + Math.floor(hash(jx, 1) * 2)))
        else if (r < 0.13) add(jy, b => oak(b, jx, jy, 3, PALETTES.OAK, 0))
        else if (r < 0.26) add(jy, b => flowers(b, jx, jy))
        else if (r < 0.28) add(jy, b => rock(b, jx, jy, 2))
        else if (r < 0.36) add(jy, b => tuft(b, jx, jy))
        break
      case PEAKS:
        if (r < 0.12) add(jy, b => rock(b, jx, jy, 2 + Math.floor(r * 16)))
        else if (r < 0.28) add(jy, b => pine(b, jx, jy, 9 + Math.floor(r * 16), true))
        break
      case BADLANDS:
        if (nearSkull && r < 0.16) add(jy, b => gravestone(b, jx, jy, r < 0.05))
        else if (r < 0.06) add(jy, b => deadTree(b, jx, jy))
        else if (r < 0.1) add(jy, b => lavaCrack(b, jx, jy))
        else if (r < 0.15) add(jy, b => rock(b, jx, jy, 1 + Math.floor(r * 14), '#8a8070', '#5e5648'))
        break
      case SWAMP:
        if (r < 0.18) add(jy, b => willow(b, jx, jy))
        else if (r < 0.24) add(jy, b => reeds(b, jx, jy))
        else if (r < 0.29) add(jy, b => mushroom(b, jx, jy, r < 0.26 ? '#a593ff' : '#c0392b'))
        break
      case BEACH:
        if (r < 0.04) add(jy, b => palm(b, jx, jy))
        else if (r < 0.08) add(jy, b => rock(b, jx, jy, 1, '#c4b896', '#9a8a68'))
        break
    }
  }
  // the guild town
  add(P.tavern.at.y, b => tavern(b, P.tavern.at.x, P.tavern.at.y))
  for (const h of FOLK.houses) add(h.y, b => house(b, h.x, h.y, h.w, 14, 12, h.roof[0], h.roof[1], h.chimney))
  add(BOARD.y + 28, b => questBoard(b, BOARD.x, BOARD.y))
  add(FOLK.well.y, b => well(b, FOLK.well.x, FOLK.well.y))
  add(FOLK.stall.y, b => stall(b, FOLK.stall.x, FOLK.stall.y))
  for (const l of FOLK.lamps) add(l.y, b => lamp(b, l.x, l.y))
  add(FOLK.windmill.y, b => windmill(b, FOLK.windmill.x, FOLK.windmill.y))
  add(FOLK.mine.y, b => mineEntrance(b, FOLK.mine.x, FOLK.mine.y))
  add(FOLK.woodyard.y - 1, b => woodyard(b, FOLK.woodyard.x, FOLK.woodyard.y))
  add(FOLK.cookfire.y - 1, b => cookfire(b, FOLK.cookfire.x, FOLK.cookfire.y))
  add(FOLK.laundry.y - 1, b => washingLine(b, FOLK.laundry.x, FOLK.laundry.y))
  add(FOLK.dock.y, b => { px(b, '#3a2414', FOLK.dock.x - 2, FOLK.dock.y - 14, 6, 22); px(b, '#9a6a3c', FOLK.dock.x - 1, FOLK.dock.y - 14, 4, 22); for (let i = 0; i < 22; i += 3) px(b, '#5a3720', FOLK.dock.x - 1, FOLK.dock.y - 14 + i, 4, 1) })
  // the fire mountain behind the Dungeon
  add(VOLCANO.y, b => volcano(b, VOLCANO.x, VOLCANO.y))
  // the four far places
  add(P.study.at.y, b => wizardTower(b, P.study.at.x, P.study.at.y))
  add(P.armory.at.y, b => forgeHall(b, P.armory.at.x, P.armory.at.y))
  add(P.dungeon.at.y, b => dungeonCave(b, P.dungeon.at.x, P.dungeon.at.y))
  add(P.cauldron.at.y, b => alchemistHut(b, P.cauldron.at.x, P.cauldron.at.y))
  // the sheep pen's fence and the field
  add(F.y, b => field(b, { ...F, crop: 'wheat' }))
  // what the treasury has built
  for (const id of built) add(ESTATES[id].at.y, b => { estates[id] = ESTATES[id].paint(b) })
  // the season's dress, painted in among the rest
  const seasonal = art.paint ? art.paint({ add, px, marks, built, W, H, FOLK, PLACES, ESTATES, SKULL: P.dungeon.at }) ?? {} : {}
  items.sort((p, q) => p.y - q.y).forEach(it => it.fn(cv))
  return { width: W, height: H, data: cv.data, foam, sparks, marks: JSON.parse(JSON.stringify(marks)), estates, seasonal }
}

export { Recorder }
