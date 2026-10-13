// The Harvest Feast, painted: amber woods and golden grass, hay bales in the wheat, a
// cornucopia at the Tavern door, gourds on the market stall, fallen leaves about the town and a
// long feast table in the square; and where the season's wares stand. The page
// (demo/packs/thanksgiving.js) sets the dishes on the table and moves the rest.
import { hash, shadow } from '../pixelart.js'

const bale = (px, b, x, y, w = 7, h = 5) => {
  px(b, '#1b1424', x - 1, y - h - 1, w + 2, h + 1)
  px(b, '#e8cf7a', x, y - h, w, h); px(b, '#c9a84e', x, y - 2, w, 1); px(b, '#a8843a', x + 2, y - h, 1, h); px(b, '#a8843a', x + w - 3, y - h, 1, h)
}

export const THANKSGIVING_ART = {
  ground: {
    grassA: '#7a8a3a', grassB: '#718034', grassHi: '#94a24c', grassLo: '#5e6c2c',
    forestA: '#4f5e2a', forestB: '#475526', forestHi: '#5f6e34', forestLo: '#3a4620',
    swampA: '#5a5e34', swampB: '#52562e', swampHi: '#6a6e3e', swampLo: '#444828',
  },
  // the leaves turn: oaks to amber and red, the dark oaks to maple, the willows to gold
  trees: {
    OAK: ['#4a1e10', '#a8441e', '#d8742a', '#f2a24a'],
    DARK_OAK: ['#3a1810', '#8e2a20', '#b8503a', '#d8742a'],
    WILLOW: ['#3a2a10', '#8a6a20', '#b08a2a', '#d8b04a'],
  },
  paint({ add, px, FOLK, PLACES }) {
    const T = PLACES.tavern.at, F = FOLK.field, S = FOLK.stall
    // the harvest is under way: bales stand among the wheat
    for (const [dx, dy] of [[5, 6], [17, 8], [32, 6], [24, 16]]) add(F.y + dy + .5, b => bale(px, b, F.x + dx, F.y + dy))
    // a cornucopia spilling fruit by the Tavern door
    add(T.y + .4, b => {
      const x = T.x - 22, y = T.y + 1
      px(b, '#1b1424', x - 1, y - 7, 10, 7); px(b, '#a8743a', x, y - 6, 8, 5); px(b, '#7a4a2a', x, y - 3, 8, 1); px(b, '#1b1424', x + 8, y - 4, 2, 2)
      px(b, '#b8323f', x - 4, y - 4, 3, 3); px(b, '#e39a4d', x - 6, y - 2, 3, 3); px(b, '#84a83a', x - 3, y - 1, 3, 2); px(b, '#7a4fc9', x - 7, y - 4, 2, 2); px(b, '#f2b84b', x - 5, y - 6, 2, 2)
    })
    // gourds and squash along the market stall's counter
    add(S.y + .2, b => { for (const [dx, c] of [[-9, '#e39a4d'], [-5, '#c9a03a'], [-1, '#84a83a'], [3, '#e8913a'], [7, '#d9b85a']]) { px(b, '#1b1424', S.x + dx - 1, S.y - 11, 4, 4); px(b, c, S.x + dx, S.y - 10, 2, 3); px(b, '#4f8a3c', S.x + dx + 1, S.y - 12, 1, 1) } })
    // the feast table, across the square before the Tavern
    const table = { x: T.x - 17, y: T.y + 16, w: 34 }
    add(table.y + 2, b => {
      px(b, 'rgba(0,0,0,.3)', table.x + 1, table.y + 2, table.w, 3)
      px(b, '#1b1424', table.x - 1, table.y - 5, table.w + 2, 6); px(b, '#8a5a34', table.x, table.y - 4, table.w, 4); px(b, '#efe6d2', table.x, table.y - 4, table.w, 1); px(b, '#b8323f', table.x, table.y - 3, table.w, 1)
      for (const lx of [table.x + 1, table.x + table.w - 2]) px(b, '#4a2f1d', lx, table.y, 1, 3)
    })
    // leaves fallen about the town and along the roads out of it
    for (let i = 0; i < 70; i++) {
      const a = hash(i, 91) * Math.PI * 2, r = 30 + hash(i, 92) * 80, x = Math.round(FOLK.town.x + Math.cos(a) * r * 1.4), y = Math.round(FOLK.town.y + Math.sin(a) * r * .8)
      if (y > 352 || x < 4) continue // not in the sea
      const c = ['#d8742a', '#b8503a', '#f2a24a', '#c9a03a'][i % 4]
      add(y - 30, b => { px(b, c, x, y, 2, 1); if (i % 3 === 0) px(b, c, x + 1, y - 1, 1, 1) })
    }
    return { table }
  },
}

export const THANKSGIVING_ESTATES = {
  haymaze: {
    at: { x: 426, y: 354 }, clears: [{ x: 426, y: 350, r: 12 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x, y + 1, 26)
      for (const [dx, dy, w] of [[-12, -12, 24], [-12, -7, 6], [0, -7, 12], [-6, -2, 18], [-12, -2, 3]]) { p('#1b1424', x + dx - 1, y + dy - 1, w + 2, 6); p('#e8cf7a', x + dx, y + dy, w, 4); p('#c9a84e', x + dx, y + dy + 3, w, 1) }
      return { entry: { x: x - 12, y: y + 2 } }
    },
  },
  applepress: {
    at: { x: 220, y: 206 }, clears: [{ x: 216, y: 200, r: 17 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      // an apple tree heavy with fruit
      shadow(b, x - 8, y - 4, 14)
      p('#3a2414', x - 9, y - 12, 2, 8)
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (Math.hypot(dx, dy * 1.1) < 6.5) p(Math.hypot(dx, dy * 1.1) > 5.6 ? '#14301a' : dx + dy < -3 ? '#4f8a3c' : '#2f6a2c', x - 8 + dx, y - 18 + dy)
      for (const [dx, dy] of [[-3, -3], [2, -1], [-1, 3], [4, 2], [-5, 1]]) p('#d1495b', x - 8 + dx, y - 18 + dy)
      // the press and its barrel
      shadow(b, x + 6, y, 14)
      p('#1b1424', x, y - 10, 12, 10); p('#7a4a2a', x + 1, y - 9, 10, 9); p('#4a2f1d', x + 1, y - 6, 10, 1); p('#5a3720', x + 5, y - 14, 2, 5); p('#5a3720', x + 2, y - 14, 8, 1)
      p('#1b1424', x + 13, y - 7, 6, 7); p('#8a5a34', x + 14, y - 6, 4, 6); p('#4a2f1d', x + 14, y - 4, 4, 1)
      return { barrel: { x: x + 16, y: y - 6 } }
    },
  },
  market: {
    at: { x: 300, y: 278 }, clears: [{ x: 300, y: 270, r: 18 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }, lamps = []
      ;[['#e39a4d', '#fff3d0', ['#b8323f', '#e39a4d', '#84a83a']], ['#3f8f4f', '#fff3d0', ['#d9b85a', '#c9a03a', '#e8913a']], ['#8e2a20', '#fff3d0', ['#7a4fc9', '#d1495b', '#efe6d2']]].forEach(([a, c, goods], k) => {
        const sx = x - 14 + k * 14
        shadow(b, sx, y, 14)
        p('#3a2414', sx - 6, y - 12, 1, 12); p('#3a2414', sx + 5, y - 12, 1, 12)
        p('#1b1424', sx - 7, y - 6, 14, 6); p('#8a5a34', sx - 6, y - 5, 12, 4)
        goods.forEach((g, i) => p(g, sx - 5 + i * 4, y - 8, 3, 3))
        for (let i = 0; i < 14; i += 2) { p('#1b1424', sx - 7 + i, y - 16, 2, 5); p((i / 2) % 2 ? c : a, sx - 7 + i, y - 15, 2, 3) }
        lamps.push({ x: sx + 5, y: y - 12 })
      })
      return { lamps }
    },
  },
  granary: {
    at: { x: 470, y: 320 }, clears: [{ x: 470, y: 310, r: 16 }],
    paint(b) {
      const { x, y } = this.at, p = (c, a, d, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(a, d, w, h) }
      shadow(b, x + 2, y, 32)
      // the barn: red boards, white trim, a hayloft door
      p('#1b1424', x - 15, y - 16, 22, 16); p('#a8341e', x - 14, y - 15, 20, 15); for (let i = 0; i < 20; i += 3) p('#8e2a1a', x - 14 + i, y - 15, 1, 15)
      p('#efe6d2', x - 8, y - 9, 8, 9); p('#a8341e', x - 7, y - 8, 6, 8); p('#efe6d2', x - 7, y - 8, 6, 1); p('#efe6d2', x - 4, y - 8, 1, 8)
      for (let i = 0; i < 8; i++) { const hw = 12 - i * 1.4; p('#1b1424', x - 4 - hw - 1, y - 17 - i, hw * 2 + 2, 1); p('#5a3a2a', x - 4 - hw, y - 17 - i, hw * 2, 1) }
      p('#1b1424', x - 6, y - 21, 5, 4); p('#e8cf7a', x - 5, y - 20, 3, 2)
      // the silo: grain shows through its window as the season's crowns come in
      p('#1b1424', x + 7, y - 30, 10, 30); p('#b0a99c', x + 8, y - 29, 8, 29); p('#8a8478', x + 13, y - 29, 3, 29)
      for (let i = 0; i < 29; i += 5) p('#8a8478', x + 8, y - 29 + i, 8, 1)
      p('#1b1424', x + 7, y - 34, 10, 4); p('#6e6880', x + 8, y - 33, 8, 3)
      p('#1b1424', x + 10, y - 24, 4, 18)
      return { silo: { x: x + 11, y: y - 23, h: 16 } }
    },
  },
}
