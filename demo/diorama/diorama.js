// The valley in 3D: the GHIBLI style's prototype. The same world as hooks/world.js (its coast,
// biomes, river, lake, roads, places and the party's ways along them) raised into a lit
// diorama with three.js. One world pixel is one unit: world x runs along X, world y along Z,
// and height is Y. One sun lights the land, the buildings and the party alike.
import * as THREE from 'three'
import { BIOMES, FOLK, H, PLACES, RIVER, ROADS, W, biomeAt, coastY, fbm, way } from '../../hooks/world.js'
import { hash } from '../../hooks/pixelart.js'

const { PLAINS, FOREST, PEAKS, BADLANDS, SWAMP, BEACH } = BIOMES
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
const mix = (a, b, t) => a + (b - a) * t

// ───────────── the land ─────────────
// Distance fields on a 2-unit grid: to the nearest road and to the river's course.
const STEP = 2, GX = W / STEP + 1, GZ = H / STEP + 1
function field(lines, reach, beyond = false) {
  const d = new Float32Array(GX * GZ).fill(reach)
  for (const p of lines) {
    const i0 = Math.floor((p.x - reach) / STEP), i1 = Math.ceil((p.x + reach) / STEP), j0 = Math.floor((p.y - reach) / STEP), j1 = Math.ceil((p.y + reach) / STEP)
    for (let j = Math.max(0, j0); j <= Math.min(GZ - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(GX - 1, i1); i++) {
      const k = j * GX + i, v = Math.hypot(i * STEP - p.x, j * STEP - p.y)
      if (v < d[k]) d[k] = v
    }
  }
  // Past the map's edge a road stops; the river runs on (it comes down from beyond the snows).
  return (x, z) => (!beyond && (x < 0 || z < 0 || x > W || z > H) ? reach : d[clamp(Math.round(z / STEP), 0, GZ - 1) * GX + clamp(Math.round(x / STEP), 0, GX - 1)])
}
const roadDist = field(Object.values(ROADS).flat(), 14)
const riverDist = field(RIVER, 24, true)
// The land runs on past the map, so the valley sits in a world rather than on a slab.
const MARGIN = 300
const riverW = y => 5 + y / H * 5

// The lie of the land before the river cuts it: hills, the mountains to the north, the crag
// under the tower and the cliffs where the cavern meets the sea.
const ridged = (x, z) => 1 - Math.abs(fbm(x, z) * 2 - 1)
function ground(x, z) {
  const coast = coastY(x) - z
  if (coast < 0) return Math.max(-14, coast * 0.35 - 1.5) // the sea floor, shelving down
  const peaks = Math.max(clamp(1 - Math.hypot((x - 540) / 310, (z + 6) / 104)), clamp(1 - Math.hypot((x - 220) / 140, (z + 20) / 60)) * .8)
  let h = 1.5 + fbm(x / 70 + 3, z / 70 + 9) * 7
  h += Math.pow(peaks, 1.3) * (34 + ridged(x / 38, z / 38) * 46)
  // the forests stand on rolling ground; the town and the places on flatter
  const settled = Math.max(...[PLACES.tavern, PLACES.armory].map(p => clamp(1 - Math.hypot(x - p.at.x, z - p.at.y) / 120)), clamp(1 - Math.hypot((x - 330) / 170, (z - 270) / 80)))
  h = mix(h, 2.5 + fbm(x / 90, z / 90) * 2, smooth(0, .6, settled))
  // the crag the tower stands on
  const s = PLACES.study.at, crag = Math.hypot(x - s.x, (z - s.y - 14) * 1.2)
  h += 26 * (1 - smooth(18, 30, crag))
  // the sea cliffs in the south-east, under the cavern
  h += 9 * smooth(640, 700, x) * smooth(300, 340, z) * smooth(0, 6, coast)
  // the beach: down to the water's edge
  h *= smooth(0, 14, coast)
  return h + .4 * smooth(0, 3, coast)
}

// The river's surface falls from the snows to the bay, never climbing: the lowest ground along
// its course so far. Where the land drops away it falls too (the falls by the ruins).
const riverLevel = (() => {
  const levels = []
  let lowest = Infinity
  for (const p of RIVER) { lowest = Math.min(lowest, ground(p.x, p.y) - 1.2); levels.push({ y: p.y, h: Math.max(-.2, lowest) }) }
  return z => { let best = levels[0]; for (const l of levels) if (Math.abs(l.y - z) < Math.abs(best.y - z)) best = l; return best.h }
})()
const L = FOLK.lake, LAKE_LEVEL = 3.4
const lakeIn = (x, z) => ((x - L.x) / L.rx) ** 2 + ((z - L.y) / L.ry) ** 2

function height(x, z) {
  let h = ground(x, z)
  // the river's bed, and its banks easing down to it
  const dr = riverDist(x, z), rw = riverW(z)
  if (dr < rw + 8) { const bed = riverLevel(z) - 1.4; h = mix(bed, Math.max(h, bed), smooth(rw * .6, rw + 8, dr)) }
  // the lake's basin
  const li = lakeIn(x, z)
  if (li < 2.2) h = mix(LAKE_LEVEL - 1.6, h, smooth(.7, 2.2, li))
  // roads are worn flat
  const rd = roadDist(x, z)
  if (rd < 6) h = mix(h, Math.min(h, ground(x, z)) * .9 + .2, (1 - smooth(2, 6, rd)) * .5)
  return h
}

// ───────────── colour ─────────────
const C = hex => new THREE.Color(hex)
const PAL = {
  grass: C('#6fae4a'), grassDry: C('#9dbd5a'), meadow: C('#86c25a'), forest: C('#3f7a3a'), forestDeep: C('#2f5f2e'),
  rock: C('#8c8478'), rockDark: C('#5f5850'), snow: C('#f4f6fa'), sand: C('#e2cf98'), seabed: C('#3c7f9c'),
  dirt: C('#c3a06a'), dirtEdge: C('#a8875a'), swamp: C('#5f7a40'), bad: C('#55504a'), cobble: C('#a59e93'), bank: C('#8f7c58'),
}
function groundColour(x, z, h, slope) {
  const b = biomeAt(x, z), coast = coastY(x) - z, n = fbm(x / 22 + 5, z / 22 + 7)
  if (coast < 0) return PAL.seabed.clone().lerp(PAL.sand, clamp(1 + coast / 10))
  let c = (b === FOREST ? PAL.forest.clone().lerp(PAL.forestDeep, n) : b === SWAMP ? PAL.swamp.clone() : b === BADLANDS ? PAL.bad.clone() : PAL.grass.clone().lerp(n > .55 ? PAL.meadow : PAL.grassDry, Math.abs(n - .5) * 1.6))
  if (b === PEAKS || h > 22) c.lerp(PAL.rock.clone().lerp(PAL.rockDark, n), smooth(14, 26, h))
  if (slope > .9) c.lerp(PAL.rockDark, smooth(.9, 1.6, slope) * .8) // steep faces are bare rock
  if (h > 38 - n * 10 && slope < 1.4) c.lerp(PAL.snow, smooth(38 - n * 10, 46 - n * 10, h))
  if (coast < 12 && b !== PEAKS) c.lerp(PAL.sand, 1 - smooth(4, 12, coast))
  const rd = roadDist(x, z)
  if (rd < 5.5) c.lerp(rd < 3.6 ? PAL.dirt : PAL.dirtEdge, rd < 3.6 ? .95 : .55)
  if (riverDist(x, z) < riverW(z) + 2.5 || (lakeIn(x, z) > .85 && lakeIn(x, z) < 1.25)) c.lerp(PAL.bank, .55)
  const T = FOLK.town
  if (((x - T.x) / T.rx) ** 2 + ((z - T.y) / T.ry) ** 2 < 1) c.lerp(PAL.cobble, .85)
  return c
}

function buildTerrain() {
  const FW = W + MARGIN * 2, FH = H + MARGIN * 2, geo = new THREE.PlaneGeometry(FW, FH, Math.round(FW / 2.5), Math.round(FH / 2.5))
  geo.rotateX(-Math.PI / 2); geo.translate(W / 2, 0, H / 2)
  const pos = geo.attributes.position, colours = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)))
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i)
    const slope = Math.hypot(height(x + 2, z) - height(x - 2, z), height(x, z + 2) - height(x, z - 2)) / 4
    groundColour(x, z, h, slope).toArray(colours, i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }))
  mesh.receiveShadow = true; mesh.castShadow = true
  return mesh
}

// ───────────── water ─────────────
function buildWater() {
  const g = new THREE.Group()
  const seaMat = new THREE.MeshStandardMaterial({ color: '#3f8fc0', roughness: .25, metalness: .1, transparent: true, opacity: .86 })
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(W * 16, H * 16), seaMat) // out to the horizon
  sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, 0, H / 2); sea.receiveShadow = true
  g.add(sea)
  // the river: a ribbon along its course at its own falling level, whitening where it falls
  const pts = RIVER, verts = [], cols = [], idx = []
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q.x - o.x, dz = q.y - o.y, len = Math.hypot(dx, dz) || 1
    const nx = -dz / len, nz = dx / len, w = riverW(p.y) + .5, y = riverLevel(p.y) + .05
    const fall = clamp((riverLevel(o.y) - riverLevel(q.y)) / 3)
    for (const side of [-1, 1]) { verts.push(p.x + nx * w * side, y, p.y + nz * w * side); C('#4a9fd0').lerp(C('#eef6fb'), fall).toArray(cols, cols.length) }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  })
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); rg.setIndex(idx); rg.computeVertexNormals()
  g.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2, transparent: true, opacity: .9, side: THREE.DoubleSide })))
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), seaMat.clone())
  lake.material.color.set('#4a9fd0'); lake.rotation.x = -Math.PI / 2; lake.scale.set(L.rx * 1.05, L.ry * 1.05, 1); lake.position.set(L.x, LAKE_LEVEL, L.y)
  g.add(lake)
  return { group: g, sea: seaMat }
}

// ───────────── trees ─────────────
function buildTrees(clearings) {
  const pines = [], oaks = []
  for (let z = 2 - MARGIN; z < H + MARGIN; z += 5) for (let x = 2 - MARGIN; x < W + MARGIN; x += 5) {
    const jx = x + (hash(x, z) - .5) * 5, jz = z + (hash(z + 7, x) - .5) * 5, r = hash(jx * 7 | 0, jz * 13 | 0)
    if (coastY(jx) - jz < 8 || roadDist(jx, jz) < 7 || riverDist(jx, jz) < riverW(jz) + 4 || lakeIn(jx, jz) < 1.5) continue
    if (clearings.some(c => Math.hypot(jx - c.x, jz - c.y) < c.r)) continue
    const b = biomeAt(jx, jz), h = height(jx, jz), grove = b === PLAINS && fbm(jx / 28, jz / 28 + 11) > .6
    if (h > 44) continue
    if (b === FOREST && r < .62) (r < .48 ? pines : oaks).push({ x: jx, z: jz, h, s: .8 + hash(jx | 0, 3) * .5 })
    else if (b === PEAKS && r < .22 && h < 34) pines.push({ x: jx, z: jz, h, s: .7 + hash(jx | 0, 5) * .4, snow: h > 20 })
    else if (grove && r < .5) (r < .3 ? oaks : pines).push({ x: jx, z: jz, h, s: .8 + hash(jx | 0, 9) * .4 })
    else if ((b === PLAINS || b === SWAMP) && r < .045) oaks.push({ x: jx, z: jz, h, s: .7 + hash(jx | 0, 1) * .5 })
  }
  const g = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
  const inst = (geo, mat, list, place, colour) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    list.forEach((t, i) => { const [y, s] = place(t); m.compose(new THREE.Vector3(t.x, t.h + y * t.s, t.z), q.setFromAxisAngle(up, hash(i, 2) * 6.28), new THREE.Vector3(s * t.s, s * t.s, s * t.s)); im.setMatrixAt(i, m); if (colour) im.setColorAt(i, colour(t, i)) })
    im.castShadow = true; im.receiveShadow = true
    return im
  }
  const trunk = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 }), leaf = new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true })
  g.add(inst(new THREE.CylinderGeometry(.5, .7, 3, 5), trunk, [...pines, ...oaks], () => [1.5, 1]))
  g.add(inst(new THREE.ConeGeometry(3.4, 9, 7), leaf, pines, () => [7, 1], (t, i) => (t.snow ? C('#cfe0d8') : C('#2f6b3a')).offsetHSL(0, 0, (hash(i, 4) - .5) * .08)))
  g.add(inst(new THREE.ConeGeometry(2.5, 6, 7), leaf, pines, () => [10.5, 1], (t, i) => (t.snow ? C('#f2f6f8') : C('#3a7d44')).offsetHSL(0, 0, (hash(i, 6) - .5) * .08)))
  g.add(inst(new THREE.IcosahedronGeometry(3.6, 1), leaf, oaks, () => [5.5, 1], (t, i) => C(hash(i, 8) > .5 ? '#5a9a44' : '#4a8a3c').offsetHSL((hash(i, 9) - .5) * .04, 0, (hash(i, 7) - .5) * .1)))
  return g
}

// ───────────── buildings ─────────────
const MAT = {}
const mat = (hex, rough = .85) => (MAT[hex + rough] ??= new THREE.MeshStandardMaterial({ color: hex, roughness: rough }))
function mesh(geo, hex, x, y, z, ry = 0) { const o = new THREE.Mesh(geo, mat(hex)); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; return o }
// A gabled roof: a triangular prism along X, its ridge up and its base `h / 3` below the middle.
function gable(w, d, h, hex) { const geo = new THREE.CylinderGeometry(1, 1, w, 3); geo.rotateZ(Math.PI / 2); geo.rotateX(-Math.PI / 2); geo.scale(1, h / 1.5, d / 1.732); return new THREE.Mesh(geo, mat(hex)) }
function house(x, z, w, roof, wallH = 7, depth = w * .7) {
  const g = new THREE.Group(), y = height(x, z)
  g.add(mesh(new THREE.BoxGeometry(w, wallH, depth), '#efe2c4', 0, wallH / 2, 0))
  const rh = depth * .6, r = gable(w + 1.5, depth + 2.4, rh, roof); r.position.y = wallH + rh / 3; r.castShadow = r.receiveShadow = true; g.add(r)
  g.add(mesh(new THREE.BoxGeometry(2.4, 3.6, .4), '#5a3720', 0, 1.8, depth / 2 + .1))
  for (const wx of [-w / 3, w / 3]) g.add(mesh(new THREE.BoxGeometry(1.8, 1.8, .3), '#ffd27a', wx, wallH * .6, depth / 2 + .1))
  g.position.set(x, y, z)
  return g
}
function tower(x, z, r, h, roof, cap = 1.4) {
  const g = new THREE.Group()
  g.add(mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 14), '#a8a196', 0, h / 2, 0))
  g.add(mesh(new THREE.ConeGeometry(r * cap, r * 2.6, 14), roof, 0, h + r * 1.3, 0))
  g.position.set(x, height(x, z), z)
  return g
}
function buildBuildings() {
  const g = new THREE.Group(), P = PLACES
  // the Wizard's tower on its crag, with its library
  { const t = tower(P.study.at.x, P.study.at.y, 5, 34, '#5b4bb5', 1.5); g.add(t); g.add(house(P.study.at.x + 12, P.study.at.y + 4, 12, '#3b5fa8', 6)) }
  // the Riverside Tavern
  { const t = P.tavern.at, b = house(t.x, t.y - 8, 40, '#b8503a', 14, 22); g.add(b); g.add(mesh(new THREE.BoxGeometry(3, 8, 3), '#8a4a3a', t.x - 12, height(t.x, t.y) + 22, t.y - 10)) }
  // the town
  for (const h of FOLK.houses) g.add(house(h.x, h.y - 6, h.w * .8, h.roof[0]))
  // the castle keep: a curtain wall, corner towers, the halls and the great tower
  { const k = FOLK.keep, y = height(k.x, k.y), wall = '#b3aa9b'
    for (const [dx, dz, w, d] of [[0, 0, 110, 4], [0, -46, 110, 4], [-55, -23, 4, 46], [55, -23, 4, 46]]) g.add(mesh(new THREE.BoxGeometry(w, 12, d), wall, k.x + dx, y + 6, k.y + dz - 2))
    for (const [dx, dz] of [[-55, 0], [55, 0], [-55, -46], [55, -46]]) g.add(tower(k.x + dx, k.y + dz - 2, 5, 20, '#b8503a'))
    g.add(house(k.x - 26, k.y - 26, 26, '#b8503a', 12)); g.add(house(k.x + 24, k.y - 22, 30, '#b8503a', 14))
    g.add(tower(k.x - 2, k.y - 30, 7, 44, '#b8503a')) }
  // the guild hall, long under blue roofs, with its tower
  { const h = FOLK.hall; g.add(house(h.x, h.y - 8, 44, '#3b5fa8', 12, 18)); g.add(tower(h.x - 24, h.y - 8, 4, 20, '#3b5fa8')) }
  // the Blacksmith's armory: a stone forge hall with a great chimney
  { const a = P.armory.at, y = height(a.x, a.y)
    g.add(mesh(new THREE.BoxGeometry(34, 16, 24), '#9a9184', a.x, y + 8, a.y - 12)); g.add(mesh(new THREE.BoxGeometry(12, 10, .6), '#2a1d18', a.x, y + 5, a.y))
    g.add(mesh(new THREE.BoxGeometry(5, 14, 5), '#7d766a', a.x + 10, y + 22, a.y - 16)) }
  // the Alchemist's hut on stilts under a mushroom roof
  { const c = P.cauldron.at, y = height(c.x, c.y)
    for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) g.add(mesh(new THREE.CylinderGeometry(.6, .6, 8, 5), '#5a3720', c.x + dx, y + 4, c.y + dz))
    g.add(mesh(new THREE.BoxGeometry(14, 7, 10), '#7a5a3a', c.x, y + 11, c.y))
    g.add(mesh(new THREE.SphereGeometry(11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#c0392b', c.x, y + 14, c.y)) }
  // the Dungeon's cavern: a dark mouth in a rock face, a pale skull over it
  { const d = P.dungeon.at, y = height(d.x, d.y)
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(24, 1), mat('#5f5850')); rock.scale.set(1.3, .8, .9); rock.position.set(d.x + 6, y + 6, d.y - 16); rock.castShadow = rock.receiveShadow = true; g.add(rock)
    g.add(mesh(new THREE.SphereGeometry(8, 16, 10, 0, Math.PI), '#140d10', d.x, y, d.y + 2, Math.PI))
    g.add(mesh(new THREE.SphereGeometry(5, 14, 10), '#ece6d8', d.x, y + 16, d.y + 1)) }
  // the ruins by the falls
  { const r = FOLK.ruins
    for (let i = 0; i < 6; i++) { const hgt = 4 + hash(i, 5) * 12; g.add(mesh(new THREE.CylinderGeometry(1.6, 1.8, hgt, 8), '#a7a196', r.x - 24 + i * 9, height(r.x - 24 + i * 9, r.y) + hgt / 2, r.y + (i % 2) * 6)) } }
  // the harbour's piers and boats
  for (const [x, len] of [[120, 44], [164, 52], [208, 40]]) { const z0 = coastY(x) - 6; g.add(mesh(new THREE.BoxGeometry(8, 1, len), '#a3723f', x, .8, z0 + len / 2)) }
  for (const b of FOLK.boats) { g.add(mesh(new THREE.BoxGeometry(14, 3, 6), '#7a4a2a', b.x, .8, b.y)); g.add(mesh(new THREE.ConeGeometry(4, 14, 3), '#efe6d2', b.x + 1, 9, b.y)) }
  return g
}

// ───────────── clouds ─────────────
// Summer cumulus drifting over the valley. Over the map only their shadows show, sliding across
// the land, so they never hide the party; around the edges they are seen, framing the view.
function buildClouds() {
  const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: .95 })
  const unseen = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), n = 6 + Math.floor(hash(i, 1) * 5)
    for (let k = 0; k < n; k++) {
      const r = 10 + hash(i, k + 10) * 12, puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), i < 9 ? unseen : white)
      puff.position.set((k - n / 2) * 11 + (hash(k, i) - .5) * 8, Math.max(0, r * .5 - Math.abs(k - n / 2) * 2) + hash(i, k) * 6, (hash(k + 3, i) - .5) * 18)
      puff.scale.y = .7; puff.castShadow = true; c.add(puff)
    }
    if (i < 9) c.position.set(-MARGIN + hash(i, 5) * (W + MARGIN * 2), 150 + hash(i, 6) * 40, -40 + hash(i, 7) * (H + 80))
    else { const side = i % 3; c.position.set(side === 0 ? -120 - hash(i, 5) * 120 : side === 1 ? W + 120 + hash(i, 5) * 120 : hash(i, 5) * W, 90 + hash(i, 6) * 40, side === 2 ? -150 - hash(i, 7) * 80 : hash(i, 7) * H) }
    c.userData.seen = i >= 9
    c.userData.v = 4 + hash(i, 8) * 4
    g.add(c)
  }
  return g
}

// ───────────── the party ─────────────
const CLASS_LOOK = {
  guildmaster: { body: '#c0392b', hat: '#f2b84b', cape: '#8e2a20' }, wizard: { body: '#5b4bb5', hat: '#3b2f8a', cape: '#3b2f8a' },
  rogue: { body: '#3a3a44', hat: '#2a2a30', cape: '#6a1a22' }, dwarf: { body: '#7a5a3a', hat: '#8a8f99', cape: '#5a3a24' }, alchemist: { body: '#3f8f4f', hat: '#2c6b3a', cape: '#2c6b3a' },
}
function hero(cls) {
  const look = CLASS_LOOK[cls], g = new THREE.Group(), body = new THREE.Group()
  body.add(mesh(new THREE.CapsuleGeometry(1.3, 2.2, 4, 10), look.body, 0, 2.6, 0))
  body.add(mesh(new THREE.SphereGeometry(1.15, 14, 10), '#f1c49b', 0, 5.3, 0))
  body.add(mesh(cls === 'wizard' ? new THREE.ConeGeometry(1.3, 3.2, 12) : cls === 'dwarf' ? new THREE.SphereGeometry(1.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.CylinderGeometry(.9, 1.2, .9, 12), look.hat, 0, cls === 'wizard' ? 7.3 : 6.1, 0))
  const cape = mesh(new THREE.BoxGeometry(2.4, 3.2, .3), look.cape, 0, 3.2, -1.2); body.add(cape)
  g.add(body); g.userData = { body }
  g.scale.setScalar(1.7) // a touch larger than life, to be seen from above
  return g
}

// ───────────── the scene ─────────────
export function start(canvas, ui) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#bcd8ea', 420, 1100)
  const sun = new THREE.DirectionalLight('#fff1d6', 3.4)
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .6
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 360, bottom: -360, near: 10, far: 1600 })
  sun.target.position.set(W / 2, 0, H / 2); scene.add(sun, sun.target)
  const sky = new THREE.HemisphereLight('#cfe6ff', '#4a5a3a', 1.1); scene.add(sky)

  const clearings = [
    ...Object.values(PLACES).map(p => ({ ...p.at, r: 26 })), { x: FOLK.keep.x, y: FOLK.keep.y - 24, r: 72 }, { x: FOLK.hall.x, y: FOLK.hall.y - 10, r: 34 },
    { ...FOLK.ruins, r: 40 }, ...FOLK.houses.map(h => ({ x: h.x, y: h.y - 6, r: h.w * .7 })), { x: PLACES.study.at.x, y: PLACES.study.at.y + 10, r: 34 },
  ]
  scene.add(buildTerrain())
  const water = buildWater(); scene.add(water.group)
  scene.add(buildTrees(clearings))
  scene.add(buildBuildings())
  const clouds = buildClouds(); scene.add(clouds)

  // five of the party walk the valley's roads, place to place, and rest a moment at each
  const stops = ['tavern', 'study', 'armory', 'cauldron', 'dungeon']
  const walkers = ['guildmaster', 'wizard', 'rogue', 'dwarf', 'alchemist'].map((cls, i) => {
    const h = hero(cls); scene.add(h)
    h.traverse(o => { o.castShadow = true })
    return { h, at: stops[i], path: [], t: 0, rest: 1 + i, phase: i }
  })
  const plan = w => { const next = stops[(stops.indexOf(w.at) + 1 + Math.floor(hash(w.phase, w.t | 0) * 4)) % stops.length]; w.path = way(w.at, next, 1); w.to = next; w.t = 0 }
  const SPEED = 16

  // the camera: a three-quarter view over the valley; drag to pan, wheel to zoom
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 3000)
  window.__valleyCamera = camera; window.__valleyHeight = height // for the page's tags
  const view = { x: W / 2, z: H / 2 + 10, dist: 640, tilt: .95, yaw: 0 }
  const place = () => {
    const d = view.dist, y = Math.sin(view.tilt) * d, back = Math.cos(view.tilt) * d
    camera.position.set(view.x + Math.sin(view.yaw) * back, y, view.z + Math.cos(view.yaw) * back); camera.lookAt(view.x, 0, view.z)
  }
  let drag = null
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, vx: view.x, vz: view.z, yaw: view.yaw, rotate: e.shiftKey || e.button === 2 }; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointermove', e => {
    if (!drag) return
    const k = view.dist / canvas.clientHeight * .9, dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (drag.rotate) { view.yaw = drag.yaw - dx * .005; return }
    view.x = clamp(drag.vx - (dx * Math.cos(view.yaw) + dy * Math.sin(view.yaw)) * k, 0, W); view.z = clamp(drag.vz - (dy * Math.cos(view.yaw) - dx * Math.sin(view.yaw)) * k, 0, H)
  })
  canvas.addEventListener('pointerup', () => { drag = null })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = clamp(view.dist * Math.exp(e.deltaY * .0012), 90, 760); view.tilt = mix(.62, 1.02, (view.dist - 90) / 670) }, { passive: false })

  // the day: the sun rises in the east, crosses the south and sets in the west
  const SKY = { day: C('#a9d3f0'), dusk: C('#f2b48a'), night: C('#0e1630') }
  const state = { tod: .38, speed: 1 / 90, follow: null }
  ui?.({ state, view })
  let last = performance.now()
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
  new ResizeObserver(resize).observe(canvas); resize()

  renderer.setAnimationLoop(now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now
    state.tod = (state.tod + dt * state.speed) % 1
    const a = (state.tod - .25) * Math.PI * 2, elev = Math.sin(a), day = smooth(-.08, .2, elev)
    sun.position.set(W / 2 - Math.cos(a) * 640, Math.max(30, elev * 420), H / 2 + 300)
    sun.intensity = 3.6 * day; sun.color.copy(C('#ffd9a8').lerp(C('#fff4e0'), smooth(.05, .5, elev)))
    sky.intensity = .18 + .55 * day; sky.color.copy(SKY.night).lerp(C('#cfe6ff'), day)
    const bg = SKY.night.clone().lerp(SKY.dusk, smooth(-.1, .1, elev)).lerp(SKY.day, smooth(.1, .35, elev))
    scene.background = bg; scene.fog.color.copy(bg)
    water.sea.color.set('#3f8fc0').lerp(C('#14233e'), 1 - day)

    for (const c of clouds.children) { c.position.x += c.userData.v * dt * (c.userData.seen ? .3 : 1); if (c.position.x > W + MARGIN) c.position.x = -MARGIN }
    for (const w of walkers) {
      if (w.rest > 0) { w.rest -= dt; if (w.rest <= 0) plan(w); continue }
      w.t += dt * SPEED
      const i = Math.min(w.path.length - 1, Math.floor(w.t)), p = w.path[i], q = w.path[Math.min(w.path.length - 1, i + 1)], f = w.t - Math.floor(w.t)
      const x = mix(p.x, q.x, f), z = mix(p.y, q.y, f)
      w.h.position.set(x, height(x, z), z)
      if (q !== p) w.h.rotation.y = Math.atan2(q.x - p.x, q.y - p.y)
      w.h.userData.body.position.y = Math.abs(Math.sin(now / 110 + w.phase)) * .6
      if (i >= w.path.length - 1) { w.at = w.to; w.rest = 2 + hash(w.phase, now | 0) * 3 }
    }
    if (state.follow != null) { const h = walkers[state.follow].h.position; view.x = mix(view.x, h.x, .06); view.z = mix(view.z, h.z, .06) }
    // haze deepens with distance from the camera, not from the valley, so close views stay clear
    scene.fog.near = view.dist * .95; scene.fog.far = view.dist * 3.2
    place()
    renderer.render(scene, camera)
  })
  return { walkers }
}
