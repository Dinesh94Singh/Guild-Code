// The Harvest Feast on the page: what moves, fills and glows. The still parts are painted by
// hooks/packs/thanksgiving-art.js; the hooks below are the ones demo/src.html's seasons section lists.
GuildPacks.thanksgiving = api => {
  const { px, hash, glow, burst, reduced } = api
  const P = (c, x, y, w = 1, h = 1) => px(api.g, c, Math.round(x), Math.round(y), w, h)
  const LEAVES = Array.from({ length: 34 }, (_, i) => ({ x: hash(i, 41) * api.W, y: hash(i, 42) * api.H, v: 6 + hash(i, 43) * 8, ph: hash(i, 44) * 6.28, c: ['#d8742a', '#b8503a', '#f2a24a', '#c9a03a'][i % 4] }))
  const GEESE = [{ y: 70, v: -16, off: 0, n: 7 }, { y: 180, v: -12, off: 420, n: 5 }]
  const TURKEYS = [{ x: 214, y: 254, ph: 0 }, { x: 226, y: 260, ph: 2.1 }, { x: 206, y: 266, ph: 4.2 }]
  const HATS = { '#3b5fa8': true, '#e39a4d': true, '#f3e6c0': true }
  let feast = 0
  // how full the feast table is: the season's event, as the treasury counts it
  const dishes = () => { const p = api.purse, every = api.SEASONS.thanksgiving.event.every; return feast > 0 ? every : p.event.season === 'thanksgiving' ? p.event.step : 0 }

  // a turkey: a fan of tail feathers, a red wattle, and a strut
  const turkey = (x, y, f, t, scale = 1) => {
    const g = api.g; g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(f * scale, scale)
    const fan = ['#8e2a20', '#c9a03a', '#5a3720', '#e39a4d']
    for (let i = 0; i < 4; i++) P(fan[i], -7 + i, -10 + Math.abs(i - 1.5), 2, 8 - Math.abs(i - 1.5) * 2)
    P('#1b1424', -4, -7, 8, 6); P('#6b4426', -3, -6, 6, 4); P('#8a5a34', -3, -6, 6, 1)
    P('#1b1424', 3, -11, 3, 6); P('#a8743a', 3, -10, 2, 4); P('#e8606f', 5, -9, 1, 3); P('#f2b84b', 6, -10, 1, 1); P('#1b1424', 4, -10, 1, 1)
    const step = Math.floor(t * 4) % 2
    P('#e39a4d', -1 + step, -1, 1, 2); P('#e39a4d', 1 - step, -1, 1, 2)
    g.restore()
  }
  // the dishes, in the order they come to the table; the roast turkey comes last
  const DISH = [
    (x, y) => { P('#c9a03a', x - 2, y - 2, 4, 2); P('#e8cf7a', x - 1, y - 2, 2, 1) },
    (x, y) => { P('#efe6d2', x - 2, y - 1, 5, 1); P('#e39a4d', x - 2, y - 3, 5, 2); P('#c9a03a', x - 1, y - 3, 1, 1) },
    (x, y) => { P('#84a83a', x - 2, y - 3, 4, 3); P('#4f8a3c', x, y - 4, 1, 1) },
    (x, y) => { P('#efe6d2', x - 2, y - 1, 5, 1); P('#b8323f', x - 1, y - 3, 3, 2) },
    (x, y) => { P('#d9b85a', x - 2, y - 3, 4, 3); P('#e8913a', x - 1, y - 2, 2, 1) },
  ]

  return {
    color: '#e39a4d',
    banner: 'THE HARVEST IS IN',
    // long golden afternoons
    grade: 'rgba(255,160,60,.07)',
    monsters: [['#e39a4d', '#a8541c'], ['#c9a03a', '#8a6a20'], ['#84a83a', '#4f6e2a']],
    dragon: { far: '#5a3720', tail: '#7a4a2a', body: '#a8743a', belly: '#e8cf7a', hi: '#c98a4a', spine: '#d8742a', eye: '#f2b84b', fire: '#ffd27a', tip: '#e39a4d' },
    crown: {
      // the crown, wreathed in wheat
      rows: ['w.k.k..k.k.w', 'wkykkyykkykw', 'wkyyyyyyyykw', '.kyRyyByyRk.', 'wkyyyyyyyykw', '.wkkkkkkkkw.'],
      pal: { w: '#e8cf7a', y: '#f2b84b', R: '#b8323f', B: '#e39a4d', k: '#1b1424' },
    },
    css: `
      body[data-season="thanksgiving"] h1 { color: #f2a24a; text-shadow: 3px 3px 0 #4a2210; }
      body[data-season="thanksgiving"] .card h2 { color: #f2a24a; }
      body[data-season="thanksgiving"] .px { border-color: #5a3a20; }
      body[data-season="thanksgiving"] .card.px { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'%3E%3Cpath d='M19 3l2 4 4-1-2 4 3 2-4 1 1 4-4-2-1 4-2-4-3 2 1-4-4-1 3-2-2-4 4 1z' fill='%23b8503a' fill-opacity='.55'/%3E%3Cpath d='M19 9v12' stroke='%235a3720' stroke-opacity='.6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: top 4px right 4px; }
      body[data-season="thanksgiving"] .badge { background: #e39a4d; }
    `,

    update(dt) { feast = Math.max(0, feast - dt) },
    // the twelfth dish: the town sits down to feast
    onEvent() { feast = 8; const t = api.WORLD?.seasonal?.table; if (t) for (const c of ['#f2b84b', '#d8742a', '#b8503a']) burst(null, t.x + t.w / 2, t.y - 8, c, 18) },

    drawGround() {
      const c = api.clock, S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}
      // the dishes on the feast table
      const t = S.table
      if (t) {
        const n = dishes(), every = api.SEASONS.thanksgiving.event.every
        for (let i = 0; i < Math.min(n, every); i++) {
          const x = t.x + 3 + i * ((t.w - 6) / (every - 1)), y = t.y - 3
          if (i === every - 1) { P('#efe6d2', x - 3, y, 7, 1); P('#b8642a', x - 3, y - 3, 6, 3); P('#d98a4a', x - 2, y - 3, 3, 1); P('#efe6d2', x + 3, y - 3, 1, 1) }
          else DISH[i % DISH.length](x, y)
        }
        if (feast > 0 && !reduced) for (let i = 0; i < 4; i++) { const k = (c * .8 + i / 4) % 1; api.g.globalAlpha = 1 - k; P('#efe6d2', t.x + 6 + i * 7 + Math.sin(c * 3 + i) * 2, t.y - 8 - k * 10, 1, 2); api.g.globalAlpha = 1 }
      }
      // leaves drifting down across the island
      if (!reduced) for (const l of LEAVES) {
        const y = (l.y + c * l.v) % api.H, x = l.x + Math.sin(c * 1.3 + l.ph) * 8 + c * 3 % api.W, flip = Math.floor(c * 3 + l.ph) % 2
        P(l.c, x % api.W, y, flip ? 2 : 1, flip ? 1 : 2)
      }
      // the apple press's barrel froths while a brew bubbles
      if (E.applepress && api.busyAt('cauldron')) { const b = E.applepress.barrel; for (let i = 0; i < 2; i++) P('#f3e6c0', b.x - 1 + i * 2, b.y - 1 - (Math.floor(c * 4 + i) % 2), 1, 1) }
      // the granary's grain rises as the feast table fills
      if (E.granary) { const s = E.granary.silo, f = Math.round(s.h * dishes() / api.SEASONS.thanksgiving.event.every); if (f > 0) { P('#e8cf7a', s.x - 1, s.y + s.h - f, 2, f); P('#f2dc7a', s.x - 1, s.y + s.h - f, 1, 1) } }
    },

    // turkeys strut by the pen where the chickens peck
    folk() {
      return TURKEYS.map(tk => ({ y: tk.y, d: () => api.outdoors(() => { const t = api.clock + tk.ph, x = tk.x + Math.sin(t * .35) * 7; turkey(x, tk.y, Math.cos(t * .35) > 0 ? 1 : -1, t) }) }))
    },

    // geese flying south in a V instead of the birds
    drawBirds() {
      if (reduced) return
      const c = api.clock, span = api.W + 400
      for (const f of GEESE) {
        const u = ((c * Math.abs(f.v) + f.off) % span) - 200, x0 = f.v > 0 ? u : api.W - u
        for (let i = 0; i < f.n; i++) {
          const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2), x = x0 - Math.sign(f.v) * rank * 7, y = f.y + side * rank * 4, up = Math.floor(c * 6 + i) % 2
          P('#3a2a1e', x - 2, y - up, 2, 1); P('#3a2a1e', x + 1, y - up, 2, 1); P('#3a2a1e', x, y, 1, 1); P('#efe6d2', x - 1, y + 1, 1, 1)
        }
      }
    },

    lights(dark) {
      const S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}
      if (S.table) for (const dx of [6, 17, 28]) api.LIGHT(S.table.x + dx, S.table.y - 6, 12, 'rgba(255,200,110,.6)', dark)
      if (E.market) { const open = api.everyone().filter(a => a.busy).length; E.market.lamps.forEach((l, i) => { if (i < Math.max(1, open)) api.LIGHT(l.x, l.y, 14, 'rgba(255,190,90,.6)', dark) }) }
    },

    // a few townsfolk in wide-brimmed harvest hats
    villager(v) {
      if (!HATS[v.shirt]) return false
      api.drawVillager(v)
      const x = Math.round(v.x), y = Math.round(v.y)
      P('#1b1424', x - 4, y - 12, 8, 1); P('#5a3720', x - 3, y - 12, 6, 1); P('#1b1424', x - 2, y - 15, 4, 3); P('#5a3720', x - 1, y - 14, 2, 2); P('#c9a03a', x - 2, y - 13, 4, 1)
      return true
    },

    // failing tests break loose as runaway turkeys and gourds
    drawMonster(m) {
      const pop = m.born < 1 ? m.born : 1, x = Math.round(m.x), y = Math.round(m.y)
      P('rgba(0,0,0,.4)', x - 5, m.y - 1, 10, 2)
      if (m.dying !== undefined && Math.floor(m.dying * 20) % 2) return true
      if (m.kind % 3 === 0) { turkey(x + Math.sin(m.t * 6) * 2, y, Math.sin(m.t * .8) > 0 ? 1 : -1, m.t * 2, pop); return true }
      const g = api.g, bob = reduced ? 0 : Math.round(Math.sin(m.t * 5)); g.save(); g.translate(x, y + bob); g.scale(pop, pop)
      const [o, d] = m.kind % 3 === 1 ? ['#c9a03a', '#8a6a20'] : ['#84a83a', '#4f6e2a']
      P('#1b1424', -4, -9, 8, 9); P('#1b1424', -5, -6, 10, 6); P(o, -3, -8, 6, 8); P(o, -4, -5, 8, 4); P(d, -1, -8, 1, 8); P(d, 2, -6, 1, 5)
      P('#5a3720', 0, -11, 1, 3); P('#4f8a3c', 1, -11, 2, 1)
      P('#1b1424', -2, -5, 1, 2); P('#1b1424', 1, -5, 1, 2); P('#1b1424', -1, -2, 2, 1)
      g.restore()
      return true
    },
  }
}
