// The valley in 3D: the GHIBLI style's prototype. The same world as hooks/world.js (its coast,
// biomes, river, lake, roads, places and the party's ways along them) raised into a lit
// diorama with three.js. One world pixel is one unit: world x runs along X, world y along Z,
// and height is Y. One sun lights the land, the buildings and the party alike.
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from '../vendor/three/addons/libs/meshopt_decoder.module.js'
import { clone as cloneRigged } from '../vendor/three/addons/utils/SkeletonUtils.js'
import { BIOMES, CHEST, FOLK, H, MONSTER_SLOTS, PLACES, RIVER, ROADS, W, biomeAt, coastY, fbm, way } from '../../hooks/world.js'
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONES }))
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

// ───────────── the models ─────────────
// KayKit's CC0 town, nature and characters (demo/vendor/kaykit), slimmed: one kit of buildings
// and nature, each character's mesh, and the clips every character shares.
const ASSETS = 'vendor/kaykit/'
const CHARACTERS = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded', 'Skeleton_Minion', 'Skeleton_Warrior']
async function loadModels() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [kit, clips, risen, ...chars] = await Promise.all(['valley-kit.glb', 'animations.glb', 'animations-skeletons.glb', ...CHARACTERS.map(c => `${c}.glb`)].map(f => loader.loadAsync(ASSETS + f)))
  return {
    kit: Object.fromEntries(kit.scenes.map(sc => [sc.name, sc])),
    clips: [...clips.animations, ...risen.animations],
    chars: Object.fromEntries(CHARACTERS.map((c, i) => [c, chars[i].scene])),
  }
}

// Soft cel shading: three tones of light, so the models read as painted shapes, not plastic.
const TONES = (() => { const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t })()
const toon = new Map()
function toonify(root, tint) {
  root.traverse(o => {
    if (!o.isMesh) return
    const m = o.material, key = `${m.uuid}${tint ?? ''}`
    if (!toon.has(key)) { const t = new THREE.MeshToonMaterial({ map: m.map, color: m.color.clone(), gradientMap: TONES, transparent: m.transparent, opacity: m.opacity }); if (tint) t.color.multiply(C(tint)); toon.set(key, t) }
    o.material = toon.get(key); o.castShadow = true; o.receiveShadow = true
  })
  return root
}

// Many copies of one model drawn at once: an instanced mesh for each of its parts.
function instanced(model, spots) {
  const g = new THREE.Group(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
  if (!spots.length) return g
  model.updateMatrixWorld(true)
  model.traverse(o => {
    if (!o.isMesh) return
    const im = new THREE.InstancedMesh(o.geometry, o.material, spots.length)
    spots.forEach((p, i) => { m.compose(new THREE.Vector3(p.x, p.y, p.z), q.setFromAxisAngle(up, p.r ?? 0), new THREE.Vector3(p.s, p.s, p.s)).multiply(o.matrixWorld); im.setMatrixAt(i, m) })
    im.castShadow = true; im.receiveShadow = true; g.add(im)
  })
  return g
}
// One copy of a model, standing on the land.
function place(model, x, z, s, ry = 0, lift = 0) {
  if (!model) throw new Error('place: that model is not in the kit')
  const o = model.clone(true); o.position.set(x, height(x, z) + lift, z); o.scale.setScalar(s); o.rotation.y = ry
  o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true } })
  return o
}

// ───────────── the woods, the hills and the mountains ─────────────
function buildNature(kit, clearings) {
  const g = new THREE.Group(), pick = (list, k) => list[Math.floor(hash(k, 77) * list.length) % list.length]
  const free = (x, z, pad = 0) => coastY(x) - z > 8 + pad && roadDist(x, z) > 8 + pad && riverDist(x, z) > riverW(z) + 5 + pad && lakeIn(x, z) > 1.5 && !clearings.some(c => Math.hypot(x - c.x, z - c.y) < c.r + pad)
  const spots = {}
  const add = (name, x, z, s, r, sink = .3) => (spots[name] ??= []).push({ x, y: height(x, z) - sink, z, s, r })
  // The mountains are the land's own (the kit's are hexagonal board tiles): pines climb their lower slopes.
  // the woods: clusters in the forests, groves on the plains, the odd lone tree
  for (let z = -MARGIN; z < H + MARGIN; z += 13) for (let x = -MARGIN; x < W + MARGIN; x += 13) {
    const jx = x + (hash(x, z + 1) - .5) * 9, jz = z + (hash(z + 1, x) - .5) * 9, k = (jx | 0) * 7 + (jz | 0), r = hash(k, 3)
    if (!free(jx, jz) || height(jx, jz) > 34) continue
    const b = biomeAt(jx, jz), grove = b === PLAINS && fbm(jx / 28, jz / 28 + 11) > .58
    if (b === FOREST || b === SWAMP) { if (r < .85) add(pick(['trees_A_large', 'trees_A_medium', 'trees_B_large', 'trees_B_medium'], k), jx, jz, 9 + hash(k, 4) * 3, hash(k, 5) * 6.28) }
    else if (b === PEAKS) { if (r < .3) add(pick(['trees_B_small', 'trees_A_small'], k), jx, jz, 8, hash(k, 5) * 6.28) }
    else if (grove) { if (r < .7) add(pick(['trees_A_medium', 'trees_B_small', 'tree_single_A', 'tree_single_B'], k), jx, jz, 9 + hash(k, 4) * 2, hash(k, 5) * 6.28) }
    else if (r < .06) add(pick(['tree_single_A', 'tree_single_B'], k), jx, jz, 10, hash(k, 5) * 6.28)
    else if (r < .085 && b !== BEACH) add(pick(['rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D'], k), jx, jz, 18, hash(k, 6) * 6.28)
  }
  // lilies on the lake
  for (let i = 0; i < 10; i++) { const a = hash(i, 8) * 6.28, d = .3 + hash(i, 9) * .5; (spots.waterlily_A ??= []).push({ x: L.x + Math.cos(a) * L.rx * d, y: LAKE_LEVEL + .1, z: L.y + Math.sin(a) * L.ry * d, s: 26, r: a }) }
  for (const [name, list] of Object.entries(spots)) g.add(instanced(kit[name], list))
  return g
}

// ───────────── the buildings ─────────────
const S = 28 // the kit's buildings, scaled to the valley
function buildTown(kit) {
  const g = new THREE.Group(), P = PLACES, at = (name, x, z, s = S, ry = 0, lift = 0) => g.add(place(kit[name], x, z, s, ry, lift))
  at('building_tower_A_blue', P.study.at.x, P.study.at.y + 6, 22)                      // the Wizard's tower, on its crag
  at('building_tavern_red', P.tavern.at.x, P.tavern.at.y - 10, 36)                     // the Riverside Tavern
  at('building_blacksmith_red', P.armory.at.x, P.armory.at.y - 12, 34)                 // the Blacksmith & Armory
  at('building_home_A_blue', P.cauldron.at.x, P.cauldron.at.y - 8, 28)                 // the Alchemist's cottage in the woods
  at('building_mine_red', P.dungeon.at.x + 8, P.dungeon.at.y - 16, 30, -.4)            // the cavern: a mouth in the cliff
  at('building_castle_red', FOLK.keep.x, FOLK.keep.y - 28, 26)                         // the keep
  at('building_barracks_blue', FOLK.hall.x, FOLK.hall.y - 10, 30)                      // the guild hall
  at('building_church_blue', FOLK.hall.x - 30, FOLK.hall.y - 4, 22)
  at('building_destroyed', FOLK.ruins.x, FOLK.ruins.y, 30)                             // the ruins by the falls
  at('building_market_red', FOLK.town.x - 6, FOLK.town.y - 14, 24)                    // the square's market
  at('building_well_red', FOLK.well.x + 10, FOLK.well.y, 16)
  at('building_windmill_red', FOLK.windmill.x, FOLK.windmill.y, 28)
  at('building_watermill_red', FOLK.fishing.x - 6, FOLK.fishing.y, 24, Math.PI / 2)
  at('building_lumbermill_red', FOLK.woodyard.x + 14, FOLK.woodyard.y, 24)
  at('building_mine_red', FOLK.mine.x, FOLK.mine.y, 26)
  FOLK.houses.forEach((h, i) => at(i % 3 === 2 ? 'building_home_A_blue' : i % 2 ? 'building_home_B_red' : 'building_home_A_red', h.x, h.y - 6, 26, (hash(i, 4) - .5) * .5))
  // the keep's curtain wall, a gate to the south
  { const k = FOLK.keep, cx = k.x, cz = k.y - 28, hw = 58, hd = 30
    for (let x = cx - hw + 12; x <= cx + hw - 12; x += 24) at(Math.abs(x - cx) < 10 ? 'wall_straight_gate' : 'wall_straight', x, cz + hd, 12)
    for (let x = cx - hw + 12; x <= cx + hw - 12; x += 24) at('wall_straight', x, cz - hd, 12)
    for (let z = cz - hd + 12; z <= cz + hd - 12; z += 24) { at('wall_straight', cx - hw, z, 12, Math.PI / 2); at('wall_straight', cx + hw, z, 12, Math.PI / 2) } }
  // bridges wherever a road meets the river
  for (const pts of Object.values(ROADS)) {
    const i = pts.findIndex(p => riverDist(p.x, p.y) < riverW(p.y) * .6)
    if (i < 0) continue
    const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 3)], p = pts[i]
    g.add(place(kit.building_bridge_A, p.x, p.y, 13, Math.atan2(b.x - a.x, b.y - a.y), 1.6))
  }
  // the harbour's piers and boats (the kit has none: plain timber)
  const wood = new THREE.MeshToonMaterial({ color: '#a3723f', gradientMap: TONES }), sail = new THREE.MeshToonMaterial({ color: '#efe6d2', gradientMap: TONES }), hull = new THREE.MeshToonMaterial({ color: '#7a4a2a', gradientMap: TONES })
  for (const [x, len] of [[120, 44], [164, 52], [208, 40]]) { const z0 = coastY(x) - 6, pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, len), wood); pier.position.set(x, .8, z0 + len / 2); pier.castShadow = pier.receiveShadow = true; g.add(pier) }
  for (const b of FOLK.boats) { const boat = new THREE.Group(), h = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 6), hull), s = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 3), sail); s.position.set(1, 8, 0); boat.add(h, s); boat.position.set(b.x, .8, b.y); boat.traverse(o => { o.castShadow = true }); g.add(boat) }
  return g
}

// ───────────── clouds ─────────────
// Summer cumulus: over the map only their shadows show, sliding across the land; around the
// edges the kit's clouds are seen, framing the view.
function buildClouds(kit) {
  const g = new THREE.Group(), unseen = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  for (let i = 0; i < 16; i++) {
    const c = kit[i % 2 ? 'cloud_big' : 'cloud_small'].clone(true), shadowOnly = i < 9
    c.traverse(o => { if (o.isMesh) { if (shadowOnly) o.material = unseen; o.castShadow = true } })
    c.scale.setScalar(26 + hash(i, 3) * 14)
    if (shadowOnly) c.position.set(-MARGIN + hash(i, 5) * (W + MARGIN * 2), 150 + hash(i, 6) * 40, -40 + hash(i, 7) * (H + 80))
    else { const side = i % 3; c.position.set(side === 0 ? -120 - hash(i, 5) * 120 : side === 1 ? W + 120 + hash(i, 5) * 120 : hash(i, 5) * W, 90 + hash(i, 6) * 40, side === 2 ? -150 - hash(i, 7) * 80 : hash(i, 7) * H) }
    c.userData = { v: 4 + hash(i, 8) * 4, seen: !shadowOnly }
    g.add(c)
  }
  return g
}

// ───────────── the party ─────────────
// Each class wears a KayKit adventurer, and carries only its own gear.
const HERO = {
  guildmaster: { model: 'Knight', gear: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'] },
  wizard: { model: 'Mage', gear: ['Mage_Hat', 'Mage_Cape', '2H_Staff'] },
  rogue: { model: 'Rogue', gear: ['Rogue_Cape', 'Knife', 'Knife_Offhand'] },
  dwarf: { model: 'Barbarian', gear: ['Barbarian_Hat', 'Barbarian_Cape', '2H_Axe'] },
  alchemist: { model: 'Rogue_Hooded', gear: ['Rogue_Cape', 'Throwable'], tint: '#8fd48a' },
}
const BODY = /_(ArmLeft|ArmRight|Body|Head|Head_Hooded|LegLeft|LegRight|Cloak|Eyes|Jaw|Helmet)$/
// What each does on arriving at a place.
const AT_PLACE = { tavern: 'Sit_Floor_Idle', study: 'Interact', armory: '2H_Melee_Attack_Chop', dungeon: '1H_Melee_Attack_Chop', cauldron: 'Use_Item' }
function rig(models, name, gear, tint, scale) {
  const o = cloneRigged(models.chars[name])
  o.traverse(c => { if (c.isMesh) c.visible = BODY.test(c.name) || gear.includes(c.name) })
  toonify(o, tint)
  o.scale.setScalar(scale)
  const mixer = new THREE.AnimationMixer(o), acts = Object.fromEntries(models.clips.map(c => [c.name, mixer.clipAction(c)]))
  let now = null
  const play = (clip, fade = .25) => { const a = acts[clip] ?? acts.Idle; if (a === now) return; a.reset().fadeIn(fade).play(); now?.fadeOut(fade); now = a }
  return { o, mixer, play }
}

// ───────────── the scene ─────────────
export async function start(canvas, ui) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#bcd8ea', 420, 1100)
  const sun = new THREE.DirectionalLight('#fff1d6', 3.2)
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .6
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 360, bottom: -360, near: 10, far: 1600 })
  sun.target.position.set(W / 2, 0, H / 2); scene.add(sun, sun.target)
  const sky = new THREE.HemisphereLight('#cfe6ff', '#5a6a4a', .9); scene.add(sky)

  const models = await loadModels()
  for (const m of Object.values(models.kit)) toonify(m)
  const clearings = [
    ...Object.values(PLACES).map(p => ({ ...p.at, r: 28 })), { x: FOLK.keep.x, y: FOLK.keep.y - 28, r: 70 }, { x: FOLK.hall.x - 12, y: FOLK.hall.y - 8, r: 42 },
    { ...FOLK.ruins, r: 34 }, ...FOLK.houses.map(h => ({ x: h.x, y: h.y - 6, r: 16 })), { x: PLACES.study.at.x, y: PLACES.study.at.y + 10, r: 30 },
    { x: FOLK.town.x, y: FOLK.town.y, r: 44 }, { ...FOLK.windmill, r: 20 }, { ...FOLK.woodyard, r: 24 }, { ...FOLK.mine, r: 26 }, { x: FOLK.field.x + 26, y: FOLK.field.y + 10, r: 30 },
    ...MONSTER_SLOTS.map(m => ({ ...m, r: 8 })),
  ]
  scene.add(buildTerrain())
  const water = buildWater(); scene.add(water.group)
  scene.add(buildNature(models.kit, clearings))
  scene.add(buildTown(models.kit))
  const clouds = buildClouds(models.kit); scene.add(clouds)

  // five of the party walk the valley's roads, place to place, and set to work at each
  const stops = ['tavern', 'study', 'armory', 'cauldron', 'dungeon']
  const walkers = Object.entries(HERO).map(([cls, h], i) => {
    const r = rig(models, h.model, h.gear, h.tint, 5); scene.add(r.o)
    const spot = PLACES[stops[i]].spots[i % PLACES[stops[i]].spots.length]
    r.o.position.set(spot.x, height(spot.x, spot.y), spot.y)
    return { ...r, cls, at: stops[i], path: [], t: 0, rest: 1 + i * 1.5, phase: i, spot }
  })
  // skeletons guard the cavern, rising now and then
  const monsters = MONSTER_SLOTS.slice(0, 5).map((m, i) => {
    const r = rig(models, i % 2 ? 'Skeleton_Warrior' : 'Skeleton_Minion', [], undefined, 5)
    r.o.position.set(m.x, height(m.x, m.y), m.y); r.o.rotation.y = -Math.PI / 2 - .3 + hash(i, 1) * .6
    r.play(i % 2 ? 'Idle' : 'Skeletons_Awaken_Standing', 0); scene.add(r.o)
    return r
  })
  const plan = w => {
    const next = stops[(stops.indexOf(w.at) + 1 + Math.floor(hash(w.phase, w.t | 0) * 4)) % stops.length], spot = PLACES[next].spots[w.phase % PLACES[next].spots.length]
    w.path = [...way(w.at, next, 1), { x: spot.x, y: spot.y }]; w.to = next; w.spot = spot; w.t = 0; w.play('Walking_A')
  }
  const SPEED = 15

  // the camera: a three-quarter view over the valley; drag to pan, shift-drag to turn, wheel to zoom
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 3000)
  window.__valleyCamera = camera; window.__valleyHeight = height // for the page's tags
  const view = { x: W / 2, z: H / 2 + 10, dist: 640, tilt: .95, yaw: 0 }
  const aim = () => {
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
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = clamp(view.dist * Math.exp(e.deltaY * .0012), 70, 760); view.tilt = mix(.55, 1.02, (view.dist - 70) / 690) }, { passive: false })

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
    sun.intensity = 3.4 * day; sun.color.copy(C('#ffd9a8').lerp(C('#fff4e0'), smooth(.05, .5, elev)))
    sky.intensity = .2 + .7 * day; sky.color.copy(SKY.night).lerp(C('#cfe6ff'), day)
    const bg = SKY.night.clone().lerp(SKY.dusk, smooth(-.1, .1, elev)).lerp(SKY.day, smooth(.1, .35, elev))
    scene.background = bg; scene.fog.color.copy(bg)
    water.sea.color.set('#3f8fc0').lerp(C('#14233e'), 1 - day)

    for (const c of clouds.children) { c.position.x += c.userData.v * dt * (c.userData.seen ? .3 : 1); if (c.position.x > W + MARGIN) c.position.x = -MARGIN }
    for (const w of walkers) {
      w.mixer.update(dt)
      if (w.rest > 0) {
        w.rest -= dt
        if (w.rest <= 0) plan(w)
        continue
      }
      w.t += dt * SPEED
      const i = Math.min(w.path.length - 1, Math.floor(w.t)), p = w.path[i], q = w.path[Math.min(w.path.length - 1, i + 1)], f = w.t - Math.floor(w.t)
      const x = mix(p.x, q.x, f), z = mix(p.y, q.y, f)
      w.o.position.set(x, height(x, z), z)
      if (q !== p) w.o.rotation.y = Math.atan2(q.x - p.x, q.y - p.y)
      if (i >= w.path.length - 1) {
        // arrived: face the place and set to work, or sit at the tavern
        w.at = w.to; w.rest = 5 + hash(w.phase, now | 0) * 5
        const at = PLACES[w.at].at; w.o.rotation.y = Math.atan2(at.x - x, at.y - z)
        w.play(w.at === 'study' && w.cls === 'wizard' ? 'Spellcasting' : AT_PLACE[w.at])
      }
    }
    for (const m of monsters) m.mixer.update(dt)
    if (state.follow != null) { const h = walkers[state.follow].o.position; view.x = mix(view.x, h.x, .06); view.z = mix(view.z, h.z, .06) }
    // haze deepens with distance from the camera, not from the valley, so close views stay clear
    scene.fog.near = view.dist * .95; scene.fog.far = view.dist * 3.2
    aim()
    renderer.render(scene, camera)
  })
  return { walkers }
}
