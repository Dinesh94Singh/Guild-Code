// Hallow's Eve, painted: jack-o'-lanterns on the lamp posts and doorsteps, cobwebs on the
// Tavern, candles among the graves, a dusk-tinted land, and where the season's wares stand.
// The page (demo/packs/halloween.js) lights and moves what is painted here.
import { shadow } from '../pixelart.js'

const pumpkin = (px, b, x, y, w = 5, h = 4) => {
  px(b, '#1b1424', x - (w >> 1) - 1, y - h - 1, w + 2, h + 1)
  px(b, '#ff8a2a', x - (w >> 1), y - h, w, h); px(b, '#c0561a', x, y - h, 1, h)
  px(b, '#4f8a3c', x, y - h - 2, 1, 2)
}
const face = (px, b, x, y, glow = '#ffd27a') => { px(b, glow, x - 1, y - 3, 1, 1); px(b, glow, x + 1, y - 3, 1, 1); px(b, glow, x - 1, y - 1, 3, 1) }

export const HALLOWEEN_ART = {
  // a land at dusk: the grass a little greyer, the badlands a little more violet
  ground: {
    grassA: '#53893a', grassB: '#4a7f34', grassHi: '#68a048', grassLo: '#3e702c',
    forestA: '#375f2c', forestB: '#305628', forestHi: '#466f36', forestLo: '#264a20',
    badA: '#4a3f4a', badB: '#423844', badHi: '#5a4e5c', badLo: '#362e38',
  },
  paint({ add, px, built, FOLK, PLACES, ESTATES, SKULL }) {
    const jacks = [], candles = []
    // a jack-o'-lantern atop every lamp post, the road lanterns too once they are built
    const posts = [...FOLK.lamps, ...(built.includes('lanterns') ? ESTATES.lanterns.lamps : [])]
    for (const l of posts) { jacks.push({ x: l.x, y: l.y - 16 }); add(l.y + 0.1, b => { pumpkin(px, b, l.x, l.y - 15); face(px, b, l.x, l.y - 15) }) }
    // and one on each doorstep, with the Tavern's two beside its door
    const T = PLACES.tavern.at
    for (const d of [...FOLK.houses.map(h => ({ x: h.x + 7, y: h.y + 1 })), { x: T.x - 15, y: T.y + 1 }, { x: T.x + 14, y: T.y + 1 }]) {
      jacks.push({ x: d.x, y: d.y - 2 }); add(d.y + 0.2, b => { pumpkin(px, b, d.x, d.y, 6, 5); face(px, b, d.x, d.y - 1) })
    }
    // cobwebs in the Tavern's upper corners
    add(T.y + 0.3, b => {
      for (const [cx, dir] of [[T.x - 42, 1], [T.x + 41, -1]]) {
        const cy = T.y - 32
        for (let i = 0; i < 9; i++) { px(b, 'rgba(230,230,240,.55)', cx + dir * i, cy, 1, 1); px(b, 'rgba(230,230,240,.55)', cx, cy + i, 1, 1); px(b, 'rgba(230,230,240,.45)', cx + dir * Math.round(i * .7), cy + Math.round(i * .7), 1, 1) }
        for (const r of [4, 7]) for (let k = 0; k <= r; k++) px(b, 'rgba(230,230,240,.4)', cx + dir * k, cy + r - k, 1, 1)
      }
    })
    // candles among the graves around the skull
    for (const [dx, dy] of [[-30, 10], [-18, 34], [26, 16], [40, 34], [54, 6], [10, 40]]) {
      const c = { x: SKULL.x + dx, y: SKULL.y + dy }; candles.push({ x: c.x, y: c.y - 5 })
      add(c.y, b => { px(b, '#1b1424', c.x - 1, c.y - 4, 3, 4); px(b, '#efe6d2', c.x, c.y - 3, 1, 3); px(b, '#ffd27a', c.x, c.y - 5, 1, 1) })
    }
    return { jacks, candles }
  },
}

export const HALLOWEEN_ESTATES = {
  pumpkinpatch: {
    at: { x: 80, y: 170 }, clears: [{ x: 80, y: 172, r: 19 }],
    paint(b) {
      const { x, y } = this.at, faces = []
      // a dark patch of tilled earth and creeping vines
      for (let j = -6; j <= 0; j += 2) { b.fillStyle = '#4a3324'; b.fillRect(x - 13, y + j, 26, 2) }
      for (let k = 0; k < 8; k++) { b.fillStyle = '#3f7a32'; b.fillRect(x - 12 + k * 3, y - 6 + (k % 3) * 2, 3, 1) }
      const pxx = (bb, c, a, d, w = 1, h = 1) => { bb.fillStyle = c; bb.fillRect(a, d, w, h) }
      for (const [dx, dy, w, h] of [[-9, 0, 7, 5], [-1, -2, 5, 4], [6, 1, 8, 6], [-5, -5, 4, 3], [10, -4, 4, 3]]) {
        pumpkin(pxx, b, x + dx, y + dy, w, h)
        if (w >= 7) { face(pxx, b, x + dx, y + dy - 1, '#3a1d0e'); faces.push({ x: x + dx, y: y + dy - 3 }) }
      }
      return { faces }
    },
  },
  scarecrow: {
    at: { x: 258, y: 282 }, clears: [],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x, y, 10)
      p('#5a3720', x, y - 18, 1, 18); p('#5a3720', x - 7, y - 13, 15, 1)
      p('#1b1424', x - 4, y - 14, 9, 9); p('#7a5a9a', x - 3, y - 13, 7, 7); p('#d9b85a', x - 6, y - 12, 2, 2); p('#d9b85a', x + 5, y - 12, 2, 2); p('#d9b85a', x - 2, y - 6, 1, 2); p('#d9b85a', x + 2, y - 6, 1, 2)
      return { head: { x, y: y - 17 } }
    },
  },
  manor: {
    at: { x: 478, y: 232 }, clears: [{ x: 478, y: 222, r: 20 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x + 2, y, 34)
      // the house: two storeys of dark boards, a gabled roof and a crooked tower
      p('#1b1424', x - 15, y - 24, 30, 24); p('#3a3344', x - 14, y - 23, 28, 23); p('#2e2838', x + 8, y - 23, 6, 23)
      for (let i = 0; i < 4; i++) p('#2a2433', x - 14, y - 20 + i * 6, 28, 1)
      for (let i = 0; i < 10; i++) { const hw = 17 - Math.round(i * 1.7); p('#1b1424', x - hw - 1, y - 25 - i, hw * 2 + 2, 1); p(i % 3 ? '#4a3a5a' : '#3a2e48', x - hw, y - 25 - i, hw * 2, 1) }
      p('#1b1424', x + 6, y - 46, 9, 22); p('#3a3344', x + 7, y - 45, 7, 21)
      for (let i = 0; i < 7; i++) { const hw = 6 - i; p('#1b1424', x + 10 - hw - 1, y - 47 - i, hw * 2 + 3, 1); p('#4a3a5a', x + 10 - hw, y - 47 - i, hw * 2 + 1, 1) }
      const windows = [{ x: x - 10, y: y - 19 }, { x: x - 3, y: y - 19 }, { x: x - 10, y: y - 10 }, { x: x + 9, y: y - 40 }, { x: x + 9, y: y - 30 }]
      for (const w of windows) { p('#1b1424', w.x - 1, w.y - 1, 5, 6); p('#2a1d30', w.x, w.y, 3, 4) }
      p('#1b1424', x + 1, y - 9, 6, 9); p('#4a2f1d', x + 2, y - 8, 4, 8)
      // a broken fence
      for (let i = 0; i < 6; i++) if (i !== 3) p('#5a4a3a', x - 20 + i * 8, y + 2 - (i % 2), 1, 5)
      p('#5a4a3a', x - 20, y + 3, 14, 1); p('#5a4a3a', x + 12, y + 3, 10, 1)
      return { windows: windows.map(w => ({ x: w.x + 1, y: w.y + 2 })) }
    },
  },
  coven: {
    at: { x: 22, y: 272 }, clears: [{ x: 22, y: 268, r: 15 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      p('rgba(0,0,0,.25)', x - 14, y - 6, 28, 9)
      p('#2a2420', x - 4, y - 2, 9, 3); p('#4a4040', x - 3, y - 1, 7, 1)
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 - Math.PI / 2, sx = Math.round(x + Math.cos(a) * 12), sy = Math.round(y - 1 + Math.sin(a) * 5), h = 7 + (k % 2) * 2
        p('#1b1424', sx - 2, sy - h, 4, h); p('#8a8478', sx - 1, sy - h + 1, 2, h - 1); p('#a8a094', sx - 1, sy - h + 1, 1, 1)
      }
      return { fire: { x: x + 1, y: y - 2 } }
    },
  },
}
