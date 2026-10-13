// Midwinter, painted: snow over the island, snow-laden trees, the lake frozen white, a great
// tree in the square, a wreath on the Tavern door, strings of lights along the eaves and
// snowmen about the town; and where the season's wares stand. The page
// (demo/packs/christmas.js) lights, twinkles and moves the rest.
import { shadow } from '../pixelart.js'

const snowman = (px, b, x, y, s = 1) => {
  shadow(b, x, y, 9)
  px(b, '#1b1424', x - 4, y - 7, 9, 7); px(b, '#f4f8fc', x - 3, y - 6, 7, 6); px(b, '#c4cfdc', x + 1, y - 6, 2, 6)
  px(b, '#1b1424', x - 3, y - 12, 7, 6); px(b, '#ffffff', x - 2, y - 11, 5, 5)
  px(b, '#1b1424', x - 1, y - 10, 1, 1); px(b, '#1b1424', x + 1, y - 10, 1, 1); px(b, '#e39a4d', x, y - 9, 2, 1)
  px(b, '#b8323f', x - 2, y - 7, 5, 1); px(b, '#b8323f', x + 2, y - 7, 1, 3)
  if (s) { px(b, '#1b1424', x - 3, y - 13, 7, 1); px(b, '#1b1424', x - 2, y - 16, 5, 3) }
  px(b, '#5a3720', x - 6, y - 6, 3, 1); px(b, '#5a3720', x + 4, y - 6, 3, 1)
}

export const CHRISTMAS_ART = {
  snow: true,
  // the land under snow: meadows, woods and swamp alike
  ground: {
    grassA: '#e8eef4', grassB: '#dde5ee', grassHi: '#ffffff', grassLo: '#c4cfdc',
    forestA: '#d4dde8', forestB: '#cad4e0', forestHi: '#e8eef4', forestLo: '#b4c0d0',
    swampA: '#c8d4dc', swampB: '#bccad4', swampHi: '#dce6ee', swampLo: '#a8b8c4',
    badA: '#7a7484', badB: '#6e6878', badHi: '#9a94a4', badLo: '#5e586a',
    pool: '#b8d8ec', poolHi: '#e0f2fc',
  },
  // snow lies on every canopy
  trees: {
    OAK: ['#1d3b1c', '#2f5a2c', '#e8eef4', '#ffffff'],
    DARK_OAK: ['#14301a', '#24552a', '#dde5ee', '#ffffff'],
    WILLOW: ['#16261a', '#2e4a2a', '#c4cfdc', '#f4f8fc'],
  },
  paint({ add, px, FOLK, PLACES }) {
    const T = PLACES.tavern.at, lights = []
    // the lake, frozen white with a sheen
    const L = FOLK.lake
    add(L.y - L.ry - 1, b => {
      for (let j = -L.ry; j <= L.ry; j++) { const w = Math.round(L.rx * Math.sqrt(1 - (j / L.ry) ** 2)); px(b, j < -L.ry / 3 ? '#e8f6ff' : '#cfe8f6', L.x - w, L.y + j, w * 2, 1) }
      for (const [dx, dy, w] of [[-12, -3, 8], [4, 1, 10], [-4, 5, 6]]) px(b, '#ffffff', L.x + dx, L.y + dy, w, 1)
    })
    // the great tree in the square, its foot where the presents will pile
    const tree = { x: 404, y: 252 }
    const bulbs = []
    add(tree.y, b => {
      const { x, y } = tree
      shadow(b, x + 2, y, 26)
      px(b, '#3a2414', x - 1, y - 4, 3, 4)
      for (let i = 0; i < 34; i++) {
        const row = y - 4 - i, hw = Math.round(2 + (i % 8 < 4 ? 0 : 0) + (34 - i) * .36 - (i % 8) * .5)
        px(b, '#1b1424', x - hw - 1, row, hw * 2 + 3, 1); px(b, i % 8 === 0 ? '#e8eef4' : '#2c6b3a', x - hw, row, hw * 2 + 1, 1); px(b, '#1f5230', x + 1, row, hw, 1)
      }
      px(b, '#1b1424', x - 2, y - 42, 5, 5); px(b, '#f2b84b', x - 1, y - 41, 3, 3); px(b, '#fff3c0', x, y - 41, 1, 1)
    })
    for (let i = 0; i < 16; i++) { const row = 6 + (i % 8) * 4, side = i < 8 ? -1 : 1, hw = Math.round(2 + (34 - row) * .36 - (row % 8) * .5); bulbs.push({ x: tree.x + side * Math.max(1, hw - 1 - (i % 3)), y: tree.y - 4 - row + 1 }) }
    // a wreath on the Tavern door
    add(T.y + .4, b => {
      const x = T.x, y = T.y - 18
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; px(b, a % 3 ? '#2c6b3a' : '#3f8f4f', Math.round(x + Math.cos(t) * 3.5) - 1, Math.round(y + Math.sin(t) * 3.5) - 1, 2, 2) }
      px(b, '#b8323f', x - 2, y + 3, 4, 2); px(b, '#e8606f', x - 1, y + 3, 1, 1)
    })
    // strings of lights along the Tavern's and every house's eaves
    const eaves = [{ x: T.x - 42, y: T.y - 32, w: 84 }, ...FOLK.houses.map(h => ({ x: h.x - (h.w >> 1), y: h.y - 14, w: h.w }))]
    for (const e of eaves) for (let i = 1; i < e.w; i += 4) lights.push({ x: e.x + i, y: e.y + (i % 8 < 4 ? 0 : 1), c: i % 12 })
    // snowmen about the town
    for (const [x, y, hat] of [[250, 270, 1], [442, 288, 0], [150, 322, 1]]) add(y, b => snowman(px, b, x, y, hat))
    // snow on the Tavern roof's ridge
    add(T.y + .5, b => { for (let i = 0; i < 70; i += 3) px(b, '#ffffff', T.x - 35 + i, T.y - 58 + Math.round(Math.abs(i - 35) * .7), 3, 1) })
    return { tree, bulbs, lights, presents: { x: tree.x, y: tree.y + 2 } }
  },
}

export const CHRISTMAS_ESTATES = {
  snowmen: {
    at: { x: 580, y: 214 }, clears: [{ x: 580, y: 210, r: 14 }],
    paint(b) { return { slots: [-12, -4, 4, 12, 20, -20, 28].map(dx => ({ x: this.at.x + dx, y: this.at.y })) } },
  },
  rink: {
    at: { x: 452, y: 164 }, clears: [{ x: 432, y: 164, r: 6 }, { x: 474, y: 164, r: 6 }],
    paint(b) {
      const L = { x: 452, y: 150 }, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }, lanterns = []
      for (const dx of [-20, 20]) { const x = L.x + dx, y = L.y + 14; p('#1b1424', x, y - 10, 1, 10); p('#1b1424', x - 1, y - 13, 3, 3); p('#ffd27a', x, y - 12, 1, 1); lanterns.push({ x, y: y - 12 }) }
      for (const dx of [-10, 6]) { const x = L.x + dx, y = L.y + 15; p('#1b1424', x - 1, y - 3, 8, 3); p('#8a5a34', x, y - 3, 6, 1); p('#5a3720', x, y - 1, 1, 1); p('#5a3720', x + 5, y - 1, 1, 1) }
      return { lake: L, lanterns }
    },
  },
  gingerbread: {
    at: { x: 536, y: 186 }, clears: [{ x: 536, y: 180, r: 15 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x + 1, y, 26)
      p('#1b1424', x - 11, y - 14, 22, 14); p('#a8642a', x - 10, y - 13, 20, 13); p('#8a4a1e', x + 5, y - 13, 5, 13)
      for (let i = 0; i < 20; i += 4) p('#f4f8fc', x - 10 + i, y - 13, 2, 1)
      for (let i = 0; i < 9; i++) { const hw = 13 - i * 1.4; p('#1b1424', x - hw - 1, y - 15 - i, hw * 2 + 2, 1); p(i % 2 ? '#f4f8fc' : '#e8606f', x - hw, y - 15 - i, hw * 2, 1) }
      const windows = [{ x: x - 8, y: y - 10 }, { x: x + 4, y: y - 10 }, { x: x - 2, y: y - 23 }]
      for (const w of windows) { p('#f4f8fc', w.x - 1, w.y - 1, 5, 5); p('#5a2a14', w.x, w.y, 3, 3) }
      p('#f4f8fc', x - 3, y - 7, 6, 7); p('#5a2a14', x - 2, y - 6, 4, 6)
      for (const [dx, c] of [[-9, '#e8606f'], [-6, '#84d488'], [6, '#f2b84b'], [9, '#5fd3f3']]) p(c, x + dx, y - 2, 2, 2)
      return { windows }
    },
  },
  aurora: {
    at: { x: 330, y: 104 }, clears: [{ x: 330, y: 96, r: 15 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x + 2, y, 18)
      for (let i = 0; i < 40; i++) { const hw = Math.max(1, Math.round(6 - i * .14)); p('#1b1424', x - hw - 1, y - i, hw * 2 + 2, 1); p(i % 6 < 3 ? '#bfe8ff' : '#a8d8f0', x - hw, y - i, hw, 1); p('#7fb8d8', x, y - i, hw, 1) }
      for (const [dx, h] of [[-8, 10], [7, 8], [-5, 6]]) { p('#1b1424', x + dx - 1, y - h, 3, h); p('#d6f2ff', x + dx, y - h + 1, 1, h - 1) }
      p('#1b1424', x - 2, y - 46, 5, 6); p('#e0f8ff', x - 1, y - 45, 3, 4)
      return { tip: { x, y: y - 43 } }
    },
  },
}
