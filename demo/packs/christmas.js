// Midwinter on the page: what twinkles, falls, glides and piles up. The still parts are painted
// by hooks/packs/christmas-art.js; the hooks below are the ones demo/src.html's seasons section lists.
GuildPacks.christmas = api => {
  const { px, hash, glow, burst, reduced } = api
  const P = (c, x, y, w = 1, h = 1) => px(api.g, c, Math.round(x), Math.round(y), w, h)
  const BULB = ['#e8606f', '#f2b84b', '#5fd3f3', '#84d488', '#a593ff']
  const SNOW = Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 51) * 512, y: hash(i, 52) * 320, v: 6 + hash(i, 53) * 8, ph: hash(i, 54) * 6.28, s: hash(i, 55) > .8 ? 2 : 1 }))
  const ROBINS = [{ y: 90, v: 14, off: 0, n: 3 }, { y: 210, v: -11, off: 380, n: 2 }]
  const PRESENT = [['#b8323f', '#f2b84b'], ['#3b5fa8', '#efe6d2'], ['#2c6b3a', '#e8606f'], ['#a593ff', '#f2b84b'], ['#f2b84b', '#b8323f'], ['#efe6d2', '#3f8f4f']]
  let opened = 0
  const night = () => api.darkness()
  const deep = () => Math.max(0, Math.min(1, (night() - .35) * 2.5))
  // presents under the tree: the season's event, as the treasury counts it
  const presents = () => { const p = api.purse; return opened > 0 ? 0 : p.event.season === 'christmas' ? p.event.step : 0 }
  const twinkle = (i, c) => Math.sin(c * 3 + i * 1.7) > -.3

  const smallSnowman = (x, y) => { P('#1b1424', x - 3, y - 5, 7, 5); P('#f4f8fc', x - 2, y - 4, 5, 4); P('#1b1424', x - 2, y - 9, 5, 4); P('#ffffff', x - 1, y - 8, 3, 3); P('#e39a4d', x + 1, y - 7, 1, 1); P('#b8323f', x - 2, y - 5, 5, 1) }
  const skater = (x, y, shirt, lean) => { P('rgba(0,0,0,.2)', x - 2, y, 5, 1); P('#1b1424', x - 2, y - 9, 4, 8); P(shirt, x - 1, y - 6, 2, 4); P('#f1c49b', x - 1, y - 8, 2, 2); P('#b8323f', x - 1, y - 9, 2, 1); P('#1b1424', x - 2 + lean, y - 1, 2, 1); P('#c4cfdc', x - 3 + lean, y, 3, 1) }
  // a sleigh and two reindeer, Rudolph's nose lighting the way
  const sleigh = (x, y, dir) => {
    const f = d => x + d * dir, k = '#1b1424'
    for (const [dx, nose] of [[14, true], [8, false]]) {
      P(k, f(dx) - 3, y - 3, 7, 3); P('#8a5a34', f(dx) - 2, y - 3, 5, 2); P(k, f(dx + 3), y - 6, 2, 3); P('#8a5a34', f(dx + 3), y - 5, 1, 1)
      P('#c9a86e', f(dx + 2), y - 8, 1, 2); P('#c9a86e', f(dx + 4), y - 8, 1, 2); P(k, f(dx) - 2, y, 1, 2); P(k, f(dx) + 2, y, 1, 2)
      if (nose) { P('#ff4a4a', f(dx + 5), y - 5, 1, 1); glow(f(dx + 5), y - 5, 5, 'rgba(255,80,80,.8)', .7) }
    }
    P('#c9a86e', Math.min(f(0), f(6)), y - 3, 7, 1)
    P(k, f(-6) - 1, y - 6, 9, 6); P('#b8323f', f(-6), y - 5, 7, 4); P('#f2b84b', f(-7), y, 10, 1)
    P('#b8323f', f(-4), y - 9, 3, 4); P('#efe6d2', f(-4), y - 9, 3, 1); P('#f1c49b', f(-3), y - 8, 1, 1); P('#efe6d2', f(-3), y - 7, 2, 1)
    P('#7a4a2a', f(-8), y - 8, 3, 3)
  }

  return {
    color: '#e8606f',
    banner: 'MIDWINTER CHEER',
    // cold, clear light over the snow
    grade: 'rgba(120,160,230,.07)',
    monsters: [['#8ad4f0', '#4a8ab0'], ['#3a3440', '#1e1a24'], ['#4a4450', '#2a2630']],
    dragon: { far: '#4a8ab0', tail: '#6aa8d0', body: '#a8d8f0', belly: '#e8f6ff', hi: '#8ac4e0', spine: '#ffffff', eye: '#5fd3f3', fire: '#e8f6ff', tip: '#ffffff' },
    crown: {
      // the crown, with holly at its brow
      rows: ['.k.k..k..k.k', '.kykkyykkyk.', 'gGykyyyykyGg', 'GgRRyyyyRRgG', '.kyyyyyyyyk.', '.kkkkkkkkkk.'],
      pal: { y: '#f2b84b', g: '#2c6b3a', G: '#3f8f4f', R: '#e8606f', k: '#1b1424' },
    },
    css: `
      body[data-season="christmas"] h1 { color: #e8606f; text-shadow: 3px 3px 0 #efe6d2; }
      body[data-season="christmas"] .card h2 { color: #ff9aa8; }
      body[data-season="christmas"] .px { border-color: #2c4a6a; }
      body[data-season="christmas"] .card.px { border-top: 5px solid #e8eef4; }
      body[data-season="christmas"]::before { content: ""; position: fixed; inset: 0 0 auto 0; height: 10px; z-index: 5; pointer-events: none;
        background: radial-gradient(circle at 7px 6px, #e8606f 0 3px, transparent 3.5px) 0 0 / 56px 10px repeat-x, radial-gradient(circle at 21px 6px, #f2b84b 0 3px, transparent 3.5px) 0 0 / 56px 10px repeat-x,
          radial-gradient(circle at 35px 6px, #5fd3f3 0 3px, transparent 3.5px) 0 0 / 56px 10px repeat-x, radial-gradient(circle at 49px 6px, #84d488 0 3px, transparent 3.5px) 0 0 / 56px 10px repeat-x,
          linear-gradient(#1b1424, #1b1424) 0 2px / 100% 1px repeat-x; }
      body[data-season="christmas"] .badge { background: #e8606f; color: #fff; }
    `,

    update(dt) { opened = Math.max(0, opened - dt) },
    // the sixth present: the town opens them all around the tree
    onEvent() { opened = 3; const S = api.WORLD?.seasonal; if (S?.tree) for (const c of ['#e8606f', '#f2b84b', '#5fd3f3', '#84d488']) burst(null, S.tree.x, S.tree.y - 10, c, 16) },

    drawGround() {
      const c = api.clock, S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}
      // the great tree's bulbs and the eaves' lights twinkle
      for (const [i, b] of (S.bulbs ?? []).entries()) if (twinkle(i, c)) P(BULB[i % BULB.length], b.x, b.y, 1, 1)
      for (const [i, l] of (S.lights ?? []).entries()) P(twinkle(i, c * .7) ? BULB[l.c % BULB.length] : '#3a3446', l.x, l.y, 1, 1)
      // presents piling up under the tree
      if (S.presents) {
        const n = presents()
        for (let i = 0; i < n; i++) { const [a, r] = PRESENT[i % PRESENT.length], x = S.presents.x - 10 + (i % 3) * 7 + (i > 2 ? 3 : 0), y = S.presents.y - (i > 2 ? 4 : 0); P('#1b1424', x - 1, y - 5, 6, 5); P(a, x, y - 4, 4, 4); P(r, x + 1, y - 4, 1, 4); P(r, x, y - 3, 4, 1) }
      }
      // the snowman row: one for each day of the streak
      if (E.snowmen) { const n = Math.min(E.snowmen.slots.length, Math.max(1, api.purse.streak.count)); E.snowmen.slots.slice(0, n).forEach(s => smallSnowman(s.x, s.y)) }
      // skaters glide round the frozen lake
      if (E.rink) { const L = E.rink.lake; ['#3b5fa8', '#b8323f', '#84d488'].forEach((shirt, i) => { const a = (reduced ? i * 2 : c * .5) + i * 2.1; skater(L.x + Math.cos(a) * 15, L.y + 3 + Math.sin(a) * 6, shirt, Math.sin(a) > 0 ? 1 : 0) }) }
      // the gingerbread house's windows light one by one as presents pile up
      if (E.gingerbread) { const lit = Math.ceil(E.gingerbread.windows.length * presents() / api.SEASONS.christmas.event.every); E.gingerbread.windows.forEach((w, i) => { if (i < lit) P('#ffd27a', w.x, w.y, 3, 3) }) }
    },

    // carolers gather at the well after dark
    folk() {
      const d = deep(); if (d <= 0) return []
      const w = api.FOLK.well
      return [['#b8323f', '#6b4426'], ['#3f8f4f', '#2b1b14'], ['#3b5fa8', '#c9a86e']].map(([shirt, hair], i) => {
        const x = w.x - 10 + i * 10, y = w.y + 10
        return { y, d: () => { api.g.globalAlpha = d; api.drawVillager({ x, y, shirt, hair, dist: 0, wait: 1 }); P('#efe6d2', x - 2, y - 5, 4, 1); api.g.globalAlpha = 1
          if (!reduced) { const t = (api.clock * .7 + i / 3) % 1; api.g.globalAlpha = d * (1 - t); P('#f2b84b', x + 2 + t * 4, y - 14 - t * 10, 1, 3); P('#f2b84b', x + 1 + t * 4, y - 12 - t * 10, 2, 1); api.g.globalAlpha = 1 } } }
      })
    },

    // after dark: the northern lights if the spire stands, the sleigh across the island; and always, gentle snow
    drawSky() {
      const g = api.g, c = api.clock, n = night(), d = deep(), E = api.WORLD?.estates ?? {}
      if (E.aurora && d > 0) {
        for (let band = 0; band < 3; band++) for (let x = 0; x < api.W; x += 2) {
          const y = 18 + band * 12 + Math.sin(x * .02 + c * .4 + band) * 10 + Math.sin(x * .05 - c * .3) * 4, h = 10 + Math.sin(x * .03 + c * .5 + band * 2) * 6
          g.globalAlpha = d * (.14 + Math.max(0, Math.sin(x * .015 + c * .25 + band)) * .16)
          P(band === 1 ? '#a593ff' : '#84f0b0', x, y, 2, h)
        }
        g.globalAlpha = 1
        glow(E.aurora.tip.x, E.aurora.tip.y, 12, 'rgba(180,240,255,.8)', .6 * d)
      }
      if (n > .4 && !reduced) {
        const t = (c % 48) / 48, sx = api.W + 40 - t * (api.W + 80), sy = 60 + Math.sin(t * Math.PI * 2) * 30 + t * 40
        g.globalAlpha = .2; P('#000', sx - 10, sy + 32, 26, 2); g.globalAlpha = 1
        sleigh(sx, sy, -1)
      }
      if (!reduced) for (const s of SNOW) { const y = (s.y + c * s.v) % 320, x = (s.x + Math.sin(c * .8 + s.ph) * 6 + 512) % 512; P('#ffffff', x, y, s.s, s.s) }
    },

    // robins where the birds would be
    drawBirds() {
      if (reduced) return
      const c = api.clock, span = api.W + 300
      for (const f of ROBINS) {
        const u = ((c * Math.abs(f.v) + f.off) % span) - 150, x0 = f.v > 0 ? u : api.W - u
        for (let i = 0; i < f.n; i++) { const x = x0 - Math.sign(f.v) * i * 10, y = f.y + Math.sin(c * 2 + i) * 4, up = Math.floor(c * 8 + i) % 2; P('#5a3a2a', x - 2, y - up, 2, 1); P('#5a3a2a', x + 1, y - up, 2, 1); P('#5a3a2a', x, y, 1, 1); P('#e8606f', x, y + 1, 1, 1) }
      }
    },

    lights(dark) {
      const S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}, c = api.clock
      for (const [i, b] of (S.bulbs ?? []).entries()) if (twinkle(i, c)) api.LIGHT(b.x, b.y, 7, 'rgba(255,220,160,.6)', dark)
      if (S.tree) api.LIGHT(S.tree.x, S.tree.y - 42, 16, 'rgba(255,220,120,.8)', dark)
      for (const [i, l] of (S.lights ?? []).entries()) if (i % 3 === 0 && twinkle(i, c * .7)) api.LIGHT(l.x, l.y, 5, 'rgba(255,220,160,.5)', dark)
      for (const l of E.rink?.lanterns ?? []) api.LIGHT(l.x, l.y, 16, 'rgba(255,210,122,.6)', dark)
      if (E.gingerbread) E.gingerbread.windows.forEach(w => api.LIGHT(w.x + 1, w.y + 1, 9, 'rgba(255,210,122,.5)', dark))
    },

    // scarves for the cold
    villager(v) {
      api.drawVillager(v)
      const x = Math.round(v.x), y = Math.round(v.y)
      P(v.shirt === '#b8323f' ? '#efe6d2' : '#b8323f', x - 2, y - 7, 4, 1); P(v.shirt === '#b8323f' ? '#efe6d2' : '#b8323f', x + 1, y - 7, 1, 3)
      return true
    },

    // failing tests sneak out as frost gremlins and lumps of coal
    drawMonster(m) {
      const pop = m.born < 1 ? m.born : 1, x = Math.round(m.x), y = Math.round(m.y), bob = reduced ? 0 : Math.round(Math.sin(m.t * 5))
      P('rgba(0,0,0,.4)', x - 5, m.y - 1, 10, 2)
      if (m.dying !== undefined && Math.floor(m.dying * 20) % 2) return true
      const g = api.g; g.save(); g.translate(x, y + bob); g.scale(pop, pop)
      if (m.kind % 3 === 0) {
        // a frost gremlin: ice-blue, spiky-eared, grinning
        P('#1b1424', -4, -9, 8, 8); P('#8ad4f0', -3, -8, 6, 6); P('#bfe8ff', -3, -8, 6, 1)
        P('#1b1424', -5, -11, 2, 3); P('#1b1424', 3, -11, 2, 3); P('#8ad4f0', -4, -10, 1, 2); P('#8ad4f0', 4, -10, 1, 2)
        P('#ff4a6a', -2, -6, 1, 1); P('#ff4a6a', 1, -6, 1, 1); P('#1b1424', -2, -3, 4, 1); P('#ffffff', -1, -3, 1, 1)
        P('#1b1424', -3, -1, 2, 1); P('#1b1424', 1, -1, 2, 1)
      } else {
        // a lump of coal with a scowl
        P('#1b1424', -4, -7, 8, 7); P('#1b1424', -5, -5, 10, 4); P('#3a3440', -3, -6, 6, 5); P('#5a5464', -3, -6, 2, 1); P('#5a5464', 1, -4, 1, 1)
        P('#ff7a3a', -2, -4, 1, 1); P('#ff7a3a', 1, -4, 1, 1); P('#e8606f', -1, -2, 2, 1)
      }
      g.restore()
      return true
    },
  }
}
