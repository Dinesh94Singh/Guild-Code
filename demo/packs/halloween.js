// Hallow's Eve on the page: what moves, glows and grins. The still parts are painted by
// hooks/packs/halloween-art.js; the hooks below are the ones demo/src.html's seasons section lists.
GuildPacks.halloween = api => {
  const { px, hash, glow, burst, reduced } = api
  const P = (c, x, y, w = 1, h = 1) => px(api.g, c, Math.round(x), Math.round(y), w, h)
  // the harvest moon is seen in the sea south of the island: its reflection, fixed on the water
  const MOON = { x: 436, y: 306 }
  const BATS = Array.from({ length: 9 }, (_, i) => ({ y: 30 + hash(i, 3) * 200, v: (hash(i, 4) > .5 ? 1 : -1) * (14 + hash(i, 5) * 14), off: hash(i, 6) * 900, ph: hash(i, 7) * 6 }))
  const FOGS = Array.from({ length: 7 }, (_, i) => ({ x: 360 + hash(i, 11) * 150, y: 200 + hash(i, 12) * 80, r: 22 + hash(i, 13) * 18, v: 3 + hash(i, 14) * 4 }))
  const COSTUME = { '#b8323f': 'ghost', '#84d488': 'ghost', '#3b5fa8': 'witch', '#7a4fc9': 'witch' }
  const night = () => api.darkness()
  // how far into the night: nothing at dusk, all of it once it is properly dark
  const deep = () => Math.max(0, Math.min(1, (night() - .35) * 2.5))

  // the haunts: where ghosts drift after dark
  const HAUNTS = [[470, 256, 22], [420, 214, 16], [170, 214, 30], [100, 118, 22], [128, 60, 18], [62, 236, 18], [300, 120, 20]]
  const GHOSTS = HAUNTS.map(([x, y, r], i) => ({ x, y, r, ph: hash(i, 21) * 6.28, v: .25 + hash(i, 22) * .3 }))
  // werewolves prowl the Wizard's forest between these clearings, and stop now and then to howl
  const DEN = [[20, 40], [32, 100], [90, 30], [100, 110], [16, 140], [130, 100], [170, 40], [60, 150]].map(([x, y]) => ({ x, y }))
  const WOLVES = [0, 5].map((k, i) => ({ x: DEN[k].x, y: DEN[k].y, to: DEN[(k + 2) % DEN.length], wait: 1 + i * 3, facing: 1, howl: 0, dist: 0 }))
  // eyes that glint between the trees
  const EYES = Array.from({ length: 10 }, (_, i) => ({ x: 8 + hash(i, 31) * 180, y: 20 + hash(i, 32) * 150, ph: hash(i, 33) * 9 }))

  const ghost = (x, y, a, t) => {
    const g = api.g, wave = Math.floor(t * 4) % 2
    g.globalAlpha = a
    glow(x, y - 5, 12, 'rgba(200,220,255,.6)', .5)
    P('#e8eefc', x - 3, y - 11, 7, 7); P('#e8eefc', x - 4, y - 7, 9, 5); P('#e8eefc', x - 4 + wave, y - 2, 2, 2); P('#e8eefc', x, y - 2 + wave, 2, 2); P('#e8eefc', x + 3 - wave, y - 2, 2, 2)
    P('#1b1424', x - 2, y - 9, 1, 2); P('#1b1424', x + 1, y - 9, 1, 2); P('#1b1424', x - 1, y - 5, 2, 2)
    g.globalAlpha = 1
  }
  // a werewolf, drawn from a sprite like the folk: grey fur rimmed in moonlight, yellow eyes,
  // a raised head when it howls. Rows face right; a wolf facing left is mirrored.
  const WOLF = [
    '...........k..k..', '..........kfk.kfk', '..........kfffffk', '.........kfyffffkk', '.........kffffffffk',
    'k.......kkfffffkk.', 'kk...kkkffffffk...', '.kkkkfffffffffk...', '..kfLLfffLLfffk...', '..kffffffffffLfk..',
    '..kffkkffkkfffk...', '..kfk..kfk.kfk....', '..kfk..kfk.kfk....', '..kwk..kwk.kwk....',
  ]
  const HOWL = ['............kk', '...........kfk', '..........kffk', '.........kfyfk', '........kffffk']
  const WOLF_PAL = { k: '#1b1424', f: '#6e6478', L: '#a49ac0', y: '#ffd23a', w: '#efe6d2' }
  const wolf = (w, a) => {
    const g = api.g, f = w.facing, x0 = Math.round(w.x), y0 = Math.round(w.y) - WOLF.length, step = w.wait > 0 || w.howl > 0 ? 0 : Math.floor(w.dist / 4) % 2
    const dot = (ch, i, j, dy = 0) => { const col = WOLF_PAL[ch]; if (col) P(col, f > 0 ? x0 - 8 + i : x0 + 8 - i, y0 + j + dy, 1, 1) }
    g.globalAlpha = a
    P('rgba(0,0,0,.35)', x0 - 7, y0 + WOLF.length - 1, 14, 2)
    WOLF.forEach((row, j) => { if (w.howl > 0 && j < 5) return; [...row].forEach((ch, i) => dot(ch, i, j, j >= 11 && step && i > 6 ? -1 : 0)) })
    if (w.howl > 0) HOWL.forEach((row, j) => [...row].forEach((ch, i) => dot(ch, i, j, 0)))
    g.globalAlpha = 1
    const eye = w.howl > 0 ? { i: 11, j: 3 } : { i: 11, j: 3 }
    return { ex: f > 0 ? x0 - 8 + eye.i : x0 + 8 - eye.i, ey: y0 + eye.j }
  }


  // a witch on her broom, black against whatever is below her
  const witch = (x, y, dir) => {
    const k = '#1b1424', f = d => x + d * dir
    P(k, f(-9), y + 2, 1, 1); P('#8a6a44', Math.min(f(-8), f(6)), y + 1, 15, 1)
    for (let i = 0; i < 4; i++) P('#d9b85a', f(-8 - i), y + (i % 2), 1, 2)
    P(k, f(-1), y - 4, 4, 5); P(k, f(0), y - 7, 2, 3); P(k, f(-2), y - 7, 6, 1); P(k, f(1), y - 10, 1, 3); P(k, f(2), y - 1, 3, 2)
    P('#8fe36a', f(2), y - 5, 1, 1)
  }

  return {
    color: '#ff8a2a',
    banner: 'THE VEIL IS THIN',
    // dusk lingers all day long, and a violet cast hangs over the island
    minDark: .26,
    grade: 'rgba(70,24,96,.13)',
    monsters: [['#ff8a2a', '#c0561a'], ['#9b59d0', '#6d3a99'], ['#8fe36a', '#4f9c3a']],
    dragon: { far: '#4a4458', tail: '#8a8478', body: '#d8d0c0', belly: '#efe6d2', hi: '#b8b0a0', spine: '#efe6d2', eye: '#8fe36a', fire: '#8fe36a', tip: '#8fe36a' },
    crown: {
      // a carved pumpkin with a little crown of its own
      rows: ['...y.y.y...', '...yyyyy...', '....kgk....', '.kkooooookk', 'koooooooook', 'kooykooykok', 'koooooooook', 'kooykyykook', '.kkooooookk'],
      pal: { o: '#ff8a2a', g: '#4f8a3c', y: '#ffd27a', k: '#1b1424' },
    },
    css: `
      body[data-season="halloween"] h1 { color: #ff8a2a; text-shadow: 3px 3px 0 #3a1050; }
      body[data-season="halloween"] .card h2 { color: #ff9a3a; }
      body[data-season="halloween"] .px { border-color: #4a2a5e; }
      body[data-season="halloween"] .card.px { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Cg fill='none' stroke='%23d6d0e0' stroke-opacity='.35' stroke-width='1'%3E%3Cpath d='M34 0L0 34M34 0V34M34 0H0M34 12Q22 12 22 0M34 22Q12 22 12 0M34 31Q3 31 3 0'/%3E%3C/g%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: top right; }
      body[data-season="halloween"] .badge { background: #ff8a2a; }
    `,

    update(dt) {
      const d = deep()
      for (const w of WOLVES) {
        if (w.howl > 0) { w.howl -= dt; continue }
        if (w.wait > 0) {
          w.wait -= dt
          // now and then, under a full dark sky, a wolf howls at the moon
          if (w.wait <= 0 && d > .6 && Math.random() < .35) { w.howl = 2.4; api.float?.(w.x, w.y - 24, 'AWOOO', '#c8d0ff') }
          continue
        }
        const dx = w.to.x - w.x, dy = w.to.y - w.y, dist = Math.hypot(dx, dy), v = Math.min(dist, 22 * dt)
        if (dist < 1) { w.wait = 2 + Math.random() * 4; w.to = DEN[Math.floor(Math.random() * DEN.length)]; continue }
        w.x += dx / dist * v; w.y += dy / dist * v; w.dist += v; if (Math.abs(dx) > .5) w.facing = Math.sign(dx)
      }
    },

    onEvent() { const t = api.ROOMS.tavern.at; burst(null, t.x, t.y - 20, '#ff8a2a', 26); burst(null, t.x, t.y - 20, '#9b59d0', 18); burst(null, t.x, t.y - 20, '#8fe36a', 12) },

    // fog curling out of the Dungeon, and the grinning faces of every jack-o'-lantern
    drawGround() {
      const g = api.g, c = api.clock, S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}
      g.fillStyle = 'rgba(214,206,236,.10)'
      for (const f of FOGS) { const x = f.x + Math.sin(c * .05 * f.v + f.r) * 18; g.beginPath(); g.ellipse(x, f.y, f.r, f.r * .35, 0, 0, Math.PI * 2); g.fill() }
      const lit = (x, y) => { const k = reduced ? .7 : .55 + Math.sin(c * 9 + x * 3 + y) * .25 + Math.sin(c * 5.3 + y) * .2; P(k > .6 ? '#ffd27a' : '#ff9a3a', x - 1, y + 1, 1, 1); P(k > .6 ? '#ffd27a' : '#ff9a3a', x + 1, y + 1, 1, 1); P('#ffb347', x - 1, y + 3, 3, 1) }
      for (const j of S.jacks ?? []) lit(j.x, j.y)
      for (const j of E.pumpkinpatch?.faces ?? []) lit(j.x, j.y)
      for (const cd of S.candles ?? []) if (Math.sin(c * 11 + cd.x) > -.6) P('#ffd27a', cd.x, cd.y, 1, 1)
      // the scarecrow's pumpkin head turns to watch whoever is at work
      if (E.scarecrow) {
        const h = E.scarecrow.head, busy = api.everyone().find(a => a.busy && !a.fading), look = busy ? Math.sign(busy.x - h.x) : Math.sin(c * .3) > 0 ? 1 : -1
        P('#1b1424', h.x - 4, h.y - 6, 9, 7); P('#ff8a2a', h.x - 3, h.y - 5, 7, 5); P('#c0561a', h.x, h.y - 5, 1, 5); P('#4f8a3c', h.x, h.y - 8, 1, 2)
        P('#1b1424', h.x - 2 + look, h.y - 4, 1, 1); P('#1b1424', h.x + 1 + look, h.y - 4, 1, 1); P('#1b1424', h.x - 1 + look, h.y - 2, 3, 1)
        P('#3a2414', h.x - 4, h.y - 7, 9, 1); P('#3a2414', h.x - 2, h.y - 10, 5, 3)
      }
      // the manor's windows flicker green while any test is failing
      if (E.manor) { const haunted = api.allMonsters().length > 0; for (const w of E.manor.windows) { const on = haunted ? Math.sin(c * 7 + w.x * 2 + w.y) > -.2 : Math.sin(c * .7 + w.x) > .7; if (on) { P(haunted ? '#8fe36a' : '#ffd27a', w.x - 1, w.y - 2, 3, 4); if (haunted) glow(w.x, w.y, 6, 'rgba(143,227,106,.8)', .5) } } }
      // the coven's green fire, roaring while a brew bubbles
      if (E.coven) {
        const f = E.coven.fire, big = api.busyAt('cauldron') ? 2 : 1
        for (let i = 0; i < 3 + big * 2; i++) { const t = reduced ? .5 : (c * 1.7 + i / 5) % 1; P(t < .5 ? '#d6ffb0' : '#8fe36a', f.x - 2 + (i % 4) + Math.sin(c * 6 + i) * 1.5, f.y - t * 9 * big, 1, 2) }
        glow(f.x, f.y - 3, 10 * big, 'rgba(143,227,106,.75)', .55)
      }
    },

    // after dark: ghosts and glinting eyes, hands from the graves, the witch, the moon on the sea, a haze
    drawSky() {
      const n = night(), d = deep(), g = api.g, c = api.clock, S = api.WORLD?.seasonal ?? {}
      if (d > 0) {
        // werewolves prowl the forest, their eyes burning; more eyes glint between the trees
        for (const w of [...WOLVES].sort((p, q) => p.y - q.y)) { const e = wolf(w, d); glow(e.ex, e.ey, 6, 'rgba(255,200,60,.8)', .55 * d) }
        for (const e of EYES) { const open = Math.sin(c * .6 + e.ph) > .55 && Math.floor(c * 2 + e.ph) % 7 !== 0; if (open) { g.globalAlpha = d; P('#ffd23a', e.x, e.y, 1, 1); P('#ffd23a', e.x + 3, e.y, 1, 1); g.globalAlpha = 1 } }
        // hands claw up among the candles, and sink again
        for (const [i, cd] of (S.candles ?? []).entries()) {
          const t = ((c * .4 + i * .37) % 1), up = t < .5 ? Math.sin(t * 2 * Math.PI) * 4 : 0
          if (up > .5) { g.globalAlpha = d; P('#d8d0c0', cd.x + 4, cd.y + 5 - up, 1, up); P('#d8d0c0', cd.x + 3, cd.y + 5 - up, 1, 1); P('#d8d0c0', cd.x + 5, cd.y + 5 - up, 1, 1); g.globalAlpha = 1 }
        }
        // ghosts drift through their haunts, fading in and out
        for (const [i, gh] of GHOSTS.entries()) {
          const t = reduced ? i : c * gh.v + gh.ph, a = d * (.35 + Math.max(0, Math.sin(t * .7)) * .5)
          if (a > .05) ghost(gh.x + Math.sin(t) * gh.r, gh.y + Math.sin(t * 1.3) * gh.r * .4 - 4, a, t)
        }
      }
      if (n < .2) return
      const k = Math.min(1, (n - .2) * 2.5)
      // the harvest moon's reflection, broken by the swell
      g.globalAlpha = k
      glow(MOON.x, MOON.y, 26, 'rgba(255,170,80,.45)', .5)
      for (let r = 0; r < 7; r++) {
        const w = Math.round((7 - Math.abs(r - 3) * 1.8) * 2 + Math.sin(c * 1.6 + r) * 2), off = reduced ? 0 : Math.round(Math.sin(c * 1.1 + r * 1.7) * 2)
        P(r % 2 ? '#e8913a' : '#ffb347', MOON.x - (w >> 1) + off, MOON.y - 6 + r * 2, w, 1)
      }
      // the witch rides over the island, her shadow sliding over the land beneath her
      if (!reduced) {
        const t = (c % 52) / 52, wx = -30 + t * (api.W + 60), wy = 70 + Math.sin(t * Math.PI * 2) * 40 + t * 60
        g.globalAlpha = .22 * k; P('#000', wx - 7, wy + 30, 14, 2); P('#000', wx - 1, wy + 28, 4, 2)
        g.globalAlpha = k; witch(wx, wy, 1)
      }
      g.globalAlpha = 1
      // a violet haze rolling slowly over everything, on the view
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0)
      const VW = g.canvas.width, VH = g.canvas.height
      for (let i = 0; i < 5; i++) {
        const x = ((c * (4 + i) + i * 140) % (VW + 300)) - 150, y = VH * (.2 + i * .17), r = 110 + i * 14
        const h = g.createRadialGradient(x, y, 0, x, y, r); h.addColorStop(0, `rgba(150,130,190,${.16 * k})`); h.addColorStop(1, 'rgba(150,130,190,0)')
        g.fillStyle = h; g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.fillStyle = `rgba(16,6,32,${.14 * k})`; g.fillRect(0, 0, VW, VH)
      g.restore()
    },

    // bats where the birds would be, out at all hours this season
    drawBirds() {
      if (reduced) return
      const c = api.clock, span = api.W + 300
      for (const b of BATS) {
        const u = ((c * Math.abs(b.v) + b.off) % span) - 150, x = b.v > 0 ? u : api.W - u, y = b.y + Math.sin(c * 1.7 + b.ph) * 10, up = Math.floor(c * 10 + b.ph) % 2
        P('#1b1424', x - 1, y, 3, 2); P('#1b1424', x - 4, y - up, 3, 1); P('#1b1424', x + 2, y - up, 3, 1); P('#e8606f', x, y, 1, 1)
      }
    },

    // the jack-o'-lanterns, candles and green windows light the dusk
    lights(dark) {
      const S = api.WORLD?.seasonal ?? {}, E = api.WORLD?.estates ?? {}
      for (const j of S.jacks ?? []) api.LIGHT(j.x, j.y + 2, 16, 'rgba(255,140,40,.6)', dark * (.75 + api.flick(j.x, j.y) * .25))
      for (const j of E.pumpkinpatch?.faces ?? []) api.LIGHT(j.x, j.y + 2, 12, 'rgba(255,140,40,.6)', dark)
      for (const cd of S.candles ?? []) api.LIGHT(cd.x, cd.y, 9, 'rgba(255,210,122,.6)', dark)
      if (E.coven) api.LIGHT(E.coven.fire.x, E.coven.fire.y - 3, 30, 'rgba(143,227,106,.6)', dark)
      if (E.manor && api.allMonsters().length) for (const w of E.manor.windows) api.LIGHT(w.x, w.y, 12, 'rgba(143,227,106,.6)', dark)
    },

    // townsfolk out in costume: sheet ghosts and witches' hats
    villager(v) {
      const kind = COSTUME[v.shirt]
      if (!kind) return false
      const x = Math.round(v.x), y = Math.round(v.y), step = v.wait > 0 ? 0 : Math.floor(v.dist / 3) % 2
      if (kind === 'ghost') {
        P('rgba(0,0,0,.35)', x - 3, y - 1, 7, 2)
        P('#1b1424', x - 4, y - 12, 8, 12); P('#efeaf6', x - 3, y - 11, 6, 10); P('#efeaf6', x - 3 + step, y - 1, 2, 1); P('#efeaf6', x + 1 - step, y - 1, 2, 1)
        P('#1b1424', x - 2, y - 9, 1, 2); P('#1b1424', x + 1, y - 9, 1, 2)
        return true
      }
      api.drawVillager(v)
      P('#1b1424', x - 5, y - 12, 10, 1); P('#1b1424', x - 3, y - 15, 6, 3); P('#1b1424', x - 1, y - 18, 3, 3); P('#1b1424', x + 1, y - 19, 2, 1); P('#7a4fc9', x - 3, y - 13, 6, 1)
      P('#1b1424', x + 3, y - 6, 4, 3); P('#ff8a2a', x + 4, y - 5, 2, 2)
      return true
    },

    // failing tests crawl out as pumpkins; five or more bring a ghost, ten a skeleton knight
    drawMonster(m) {
      const n = m.proj?.state?.dungeon?.monsters ?? 0, mine = api.allMonsters().filter(o => o.proj === m.proj), i = mine.indexOf(m)
      const pop = m.born < 1 ? m.born : 1, bob = reduced ? 0 : Math.round(Math.sin(m.t * 5)), x = Math.round(m.x), y = Math.round(m.y + bob)
      P('rgba(0,0,0,.4)', x - 5, m.y - 1, 10, 2)
      if (m.dying !== undefined && Math.floor(m.dying * 20) % 2) return true
      const g = api.g; g.save(); g.translate(x, y); g.scale(pop, pop)
      if (n >= 10 && i === 0) {
        // the skeleton knight: bone white, a rusted helm, a notched sword
        P('#1b1424', -4, -16, 8, 16); P('#efe6d2', -3, -15, 6, 5); P('#1b1424', -2, -13, 1, 1); P('#1b1424', 1, -13, 1, 1); P('#7a6a58', -3, -16, 6, 2)
        P('#efe6d2', -3, -9, 6, 1); P('#efe6d2', -3, -7, 6, 1); P('#efe6d2', -1, -10, 1, 6); P('#efe6d2', -3, -3, 1, 3); P('#efe6d2', 2, -3, 1, 3)
        P('#c4cfdc', 4, -14, 1, 9); P('#8a8478', 3, -6, 3, 1)
      } else if (n >= 5 && i === 1) {
        const a = .55 + Math.sin(m.t * 2) * .25; g.globalAlpha = a
        P('#efeaf6', -4, -12, 8, 8); P('#efeaf6', -5, -6, 10, 4); P('#efeaf6', -5, -2, 2, 2); P('#efeaf6', -1, -2, 2, 2); P('#efeaf6', 3, -2, 2, 2)
        P('#1b1424', -2, -10, 1, 2); P('#1b1424', 1, -10, 1, 2); P('#1b1424', -1, -6, 2, 2)
        g.globalAlpha = 1
      } else {
        const [o, d] = [['#ff8a2a', '#c0561a'], ['#e07a2f', '#a8541c'], ['#ffa040', '#c0661a']][m.kind % 3], blink = Math.floor(m.t * 3) % 6 === 0
        P('#1b1424', -5, -8, 10, 8); P('#1b1424', -4, -9, 8, 1); P(o, -4, -8, 8, 7); P(o, -3, -9, 6, 1); P(d, -1, -8, 1, 7); P(d, 2, -8, 1, 7)
        P('#4f8a3c', 0, -11, 1, 2); P('#4f8a3c', 1, -11, 2, 1)
        P(blink ? o : '#ffd27a', -3, -6, 2, 2); P(blink ? o : '#ffd27a', 1, -6, 2, 2); P('#1b1424', -3, -3, 6, 1); P('#ffd27a', -2, -3, 1, 1); P('#ffd27a', 1, -3, 1, 1)
      }
      g.restore()
      return true
    },
  }
}
