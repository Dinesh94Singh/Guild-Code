// The guild realm drawn as one SVG, for the surfaces that draw pictures
// (desktop, VS Code, mobile). The terminal gets a text map instead.
//
// The realm is an island: the guild town and its Tavern Board in the middle, roads
// out to the Wizard's tower in the forest, the dwarven Armory in the mountains, the
// Dungeon in the badlands and the Alchemist's hut in the swamp. Everything that does
// not depend on the party is drawn once and reused.
import type { GuildDungeon, GuildLocation, GuildMember, GuildQuest, GuildQuota } from '../types'
import { CLASSES, LANGS, LOCATIONS, PLACE_INFO, classOf } from './lore'

export type MapOptions = {
  /** The workspace's name, drawn as the map's title. */
  realm?: string
  /** The place being inspected, ringed in gold. */
  selected?: GuildLocation | ''
  /** Rate-limit windows, drawn as mana gauges. */
  quota?: GuildQuota[]
  /** The local hour: after dark the realm dims and its windows light up. */
  hour?: number
}

const W = 640
const H = 372

type Pt = [number, number]

/** Where each place sits: its landmark, its name plate, where the party stands, and its caption. */
const PLACES: Record<GuildLocation, { at: Pt; tag: Pt; party: Pt; caption: Pt }> = {
  study: { at: [112, 100], tag: [112, 20], party: [146, 126], caption: [112, 156] },
  armory: { at: [534, 98], tag: [534, 36], party: [548, 124], caption: [534, 152] },
  tavern: { at: [320, 176], tag: [320, 126], party: [320, 214], caption: [320, 240] },
  dungeon: { at: [104, 282], tag: [104, 222], party: [150, 294], caption: [104, 326] },
  cauldron: { at: [548, 284], tag: [548, 232], party: [516, 306], caption: [548, 334] },
}

// The same roads and river as the pixel-art dry run, scaled from its 960×540 world.
const s = (x: number, y: number): Pt => [x * (2 / 3), y * (2 / 3) + 6]
const ROADS: Record<Exclude<GuildLocation, 'tavern'>, Pt[]> = {
  study: [s(480, 300), s(446, 290), s(400, 266), s(348, 250), s(300, 230), s(258, 204), s(222, 178), s(198, 164)],
  armory: [s(480, 300), s(524, 286), s(570, 262), s(612, 238), s(660, 214), s(712, 196), s(756, 182), s(794, 168)],
  dungeon: [s(480, 300), s(444, 322), s(400, 350), s(346, 372), s(294, 392), s(254, 414), s(228, 430)],
  cauldron: [s(480, 300), s(526, 322), s(574, 350), s(622, 378), s(672, 404), s(716, 428), s(750, 448)],
}
const RIVER: Pt[] = [s(592, -12), s(600, 60), s(586, 120), s(600, 180), s(618, 240), s(598, 300), s(614, 360), s(644, 420), s(626, 480), s(634, 552)]

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

const r1 = (n: number) => Math.round(n * 10) / 10

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** A smooth curve through points (Catmull-Rom, as cubic Béziers). */
function curve(pts: Pt[], closed = false): string {
  const n = pts.length
  const at = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])!
  const first = at(0)
  let d = `M${r1(first[0])} ${r1(first[1])}`
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return closed ? `${d}Z` : d
}

/** An irregular blob around a centre, for coastlines and biome patches. */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wobble = 0.12, n = 40): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 7 + seed * 2.3) * 0.3 + (hash(i, seed) - 0.5) * 0.5)
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
  }
  return pts
}

const ROAD_SAMPLES: Pt[] = Object.values(ROADS).flat()
const nearRoad = (x: number, y: number, r: number) => ROAD_SAMPLES.some(([px, py]) => Math.hypot(x - px, y - py) < r)
const nearPlace = (x: number, y: number, r: number) =>
  Object.values(PLACES).some(p => Math.hypot(x - p.at[0], y - (p.at[1] - 14)) < r) || Math.hypot(x - 320, y - 196) < 70
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1

function scatter(step: number, keep: (x: number, y: number, r: number) => boolean): Pt[] {
  const out: Pt[] = []
  for (let y = 10; y < H; y += step) {
    for (let x = 10; x < W; x += step) {
      const jx = x + (hash(x, y) - 0.5) * step
      const jy = y + (hash(y, x) - 0.5) * step
      if (keep(jx, jy, hash(Math.round(jx * 7), Math.round(jy * 13)))) out.push([r1(jx), r1(jy)])
    }
  }
  return out.sort((a, b) => a[1] - b[1])
}

function pines(pts: Pt[]): string {
  return pts
    .map(([x, y]) => {
      const h = 9 + hash(Math.round(x), Math.round(y)) * 6
      return `<path d="M${x} ${r1(y - h)}L${r1(x + h * 0.42)} ${y}H${r1(x - h * 0.42)}Z" fill="#2e6a3a" stroke="#14301c" stroke-width="0.8"/><path d="M${x} ${r1(y - h)}L${r1(x + h * 0.42)} ${y}H${x}Z" fill="#22502c"/>`
    })
    .join('')
}

function oaks(pts: Pt[]): string {
  return pts
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y + 1}" rx="5" ry="1.6" fill="#000" opacity="0.2"/><rect x="${x - 0.8}" y="${y - 4}" width="1.6" height="4" fill="#3a2414"/><circle cx="${x}" cy="${y - 7}" r="4.6" fill="#43893a" stroke="#1d3b1c" stroke-width="0.8"/><circle cx="${x - 1.4}" cy="${y - 8.4}" r="1.8" fill="#62a84c"/>`)
    .join('')
}

function mountain(x: number, y: number, w: number, h: number): string {
  const cap = 0.36
  const lx = x - (w / 2) * cap
  const rx = x + (w / 2) * cap
  const cy = y - h + h * cap
  return (
    `<path d="M${x - w / 2} ${y}L${x} ${y - h}L${x + w / 2} ${y}Z" fill="#9a9184" stroke="#2f2a26" stroke-width="1"/>` +
    `<path d="M${x} ${y - h}L${x + w / 2} ${y}H${x + 3}Z" fill="#6d665c"/>` +
    `<path d="M${lx} ${cy}L${x} ${y - h}L${rx} ${cy}L${x + 3} ${cy - 3}L${x - 2} ${cy + 1}Z" fill="#f4f4f8"/>`
  )
}

/** Everything that never changes: sea, island, biomes, river, scenery and buildings. */
function drawScenery(): string {
  const out: string[] = []
  const island = curve(blob(320, 188, 304, 170, 1.7, 0.1, 56), true)
  const forest = blob(118, 104, 112, 82, 4.1, 0.16)
  const badlands = blob(100, 298, 104, 68, 2.2, 0.16)
  const swamp = blob(552, 300, 102, 62, 5.3, 0.16)
  const peaks = blob(560, 50, 132, 62, 3.4, 0.14)

  out.push(
    `<path d="${island}" fill="#62b4d6" stroke="#62b4d6" stroke-width="22" stroke-linejoin="round" opacity="0.55"/>`,
    `<path d="${island}" fill="none" stroke="#e8f6ff" stroke-width="9" stroke-dasharray="3 7" stroke-linejoin="round" opacity="0.45"><animate attributeName="stroke-dashoffset" from="0" to="20" dur="4s" repeatCount="indefinite"/></path>`,
    `<path d="${island}" fill="#dcc893" stroke="#8a6a44" stroke-width="2"/>`,
    `<clipPath id="isle"><path d="${island}" transform="translate(320 188) scale(0.975) translate(-320 -188)"/></clipPath>`,
    `<g clip-path="url(#isle)">`,
    `<rect width="${W}" height="${H}" fill="url(#grass)"/>`,
    `<path d="${curve(peaks, true)}" fill="#7c7467"/>`,
    `<path d="${curve(forest, true)}" fill="#3f7431"/>`,
    `<path d="${curve(badlands, true)}" fill="#6e6450"/>`,
    `<path d="${curve(swamp, true)}" fill="#4d6239"/>`,
    `<ellipse cx="212" cy="84" rx="23" ry="12" fill="#3f97c9" stroke="#8f7c58" stroke-width="2"/>`,
  )
  // swamp pools
  for (const [x, y, rx, ry] of [[512, 276, 14, 5], [590, 318, 18, 6], [574, 270, 10, 4], [520, 326, 12, 4], [600, 290, 9, 3]]) {
    out.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#2f4b3e"/>`)
  }
  out.push(`</g>`)
  // river, then roads with bridges where they cross it
  out.push(`<path d="${curve(RIVER)}" fill="none" stroke="#8f7c58" stroke-width="11" stroke-linecap="round"/>`)
  out.push(`<path d="${curve(RIVER)}" fill="none" stroke="#3f97c9" stroke-width="7" stroke-linecap="round"/>`)
  out.push(`<path d="${curve(RIVER)}" fill="none" stroke="#8fd0ee" stroke-width="1.2" stroke-dasharray="4 10"><animate attributeName="stroke-dashoffset" from="28" to="0" dur="2s" repeatCount="indefinite"/></path>`)
  for (const r of Object.values(ROADS)) {
    out.push(`<path d="${curve(r)}" fill="none" stroke="#7f6440" stroke-width="7" stroke-linecap="round"/>`)
    out.push(`<path d="${curve(r)}" fill="none" stroke="#c9a86e" stroke-width="4.5" stroke-linecap="round"/>`)
  }
  for (const [x, y, a] of [[409, 166, -32], [410, 251, 28]]) {
    out.push(`<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-8" y="-4" width="16" height="8" fill="#9a6a3c" stroke="#3a2414" stroke-width="1.2"/><path d="M-4 -4V4M0 -4V4M4 -4V4" stroke="#5a3720" stroke-width="0.8"/></g>`)
  }
  // town square and fields
  out.push(
    `<ellipse cx="320" cy="207" rx="40" ry="23" fill="#a39a8c" stroke="#5a5248" stroke-width="2"/>`,
    `<ellipse cx="320" cy="207" rx="40" ry="23" fill="url(#cobble)"/>`,
    `<rect x="226" y="128" width="30" height="16" fill="#e0c050" stroke="#4a2f1d" stroke-width="1.2"/><path d="M226 133H256M226 138H256" stroke="#c9a33a" stroke-width="1.4"/>`,
    `<rect x="238" y="272" width="34" height="17" fill="#2f6a2c" stroke="#4a2f1d" stroke-width="1.2"/><path d="M238 277H272M238 282H272" stroke="#84d488" stroke-width="1.2" stroke-dasharray="2 2"/>`,
  )
  // scenery, back to front
  const farm = (x: number, y: number) => x > 200 && x < 262 && y > 100 && y < 150
  const forestPts = scatter(9, (x, y, r) => r < 0.75 && !farm(x, y) && inEllipse(x, y, 118, 104, 104, 74) && !nearRoad(x, y, 10) && !nearPlace(x, y, 26) && !inEllipse(x, y, 212, 84, 28, 16))
  const oakPts = scatter(16, (x, y, r) => r < 0.32 && !farm(x, y) && inEllipse(x, y, 320, 188, 280, 150) && !inEllipse(x, y, 118, 104, 112, 82) && !inEllipse(x, y, 560, 50, 140, 70) && !inEllipse(x, y, 100, 298, 104, 68) && !inEllipse(x, y, 552, 300, 102, 62) && !nearRoad(x, y, 10) && !nearPlace(x, y, 34) && Math.abs(x - (408 + (y - 186) * 0.06)) > 12)
  out.push(`<g clip-path="url(#isle)">`, oaks(oakPts), pines(forestPts))
  // badlands: graves and dead trees
  for (const [x, y] of scatter(13, (x, y, r) => r < 0.45 && inEllipse(x, y, 100, 298, 94, 60) && !nearRoad(x, y, 9) && !nearPlace(x, y, 30))) {
    out.push(hash(Math.round(x), Math.round(y)) > 0.75
      ? `<path d="M${x} ${y}V${y - 9}M${x - 3} ${y - 6}L${x} ${y - 4}L${x + 4} ${y - 8}" stroke="#2a201a" stroke-width="1.4" fill="none"/>`
      : `<path d="M${x - 2.5} ${y}V${y - 5}A2.5 2.5 0 0 1 ${x + 2.5} ${y - 5}V${y}Z" fill="#8a8a96" stroke="#1b1424" stroke-width="0.8"/>`)
  }
  // swamp: willows and mushrooms
  for (const [x, y] of scatter(14, (x, y, r) => r < 0.4 && inEllipse(x, y, 552, 300, 94, 56) && !nearRoad(x, y, 9) && !nearPlace(x, y, 30))) {
    out.push(`<rect x="${x - 0.8}" y="${y - 5}" width="1.6" height="5" fill="#3a3020"/><ellipse cx="${x}" cy="${y - 7}" rx="5" ry="4" fill="#3c5e34" stroke="#16261a" stroke-width="0.8"/><path d="M${x - 3} ${y - 5}v4M${x} ${y - 4}v3M${x + 3} ${y - 5}v4" stroke="#2e4a2a" stroke-width="0.8"/>`)
  }
  const ranges: string[] = []
  for (const [x, y, w, h] of [[470, 66, 44, 34], [508, 48, 52, 42], [600, 54, 50, 40], [560, 34, 58, 44], [626, 84, 40, 32], [450, 92, 36, 26], [586, 92, 46, 34], [490, 92, 34, 24]] as const) ranges.push(mountain(x, y, w, h))
  out.push(`</g>`, ranges.join(''), drawLandmarks())
  return out.join('')
}

function house(x: number, y: number, w: number, h: number, roof: string): string {
  return (
    `<ellipse cx="${x}" cy="${y + 1}" rx="${w / 2 + 2}" ry="2" fill="#000" opacity="0.25"/>` +
    `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="#e8d8b0" stroke="#1b1424" stroke-width="1"/>` +
    `<path d="M${x - w / 2} ${y - h / 2}H${x + w / 2}" stroke="#5a3720" stroke-width="1"/>` +
    `<path d="M${x - w / 2 - 3} ${y - h}L${x - w / 4} ${y - h - h * 0.9}H${x + w / 4}L${x + w / 2 + 3} ${y - h}Z" fill="${roof}" stroke="#1b1424" stroke-width="1"/>` +
    `<rect x="${x - 2}" y="${y - 6}" width="4" height="6" fill="#6b4426"/>`
  )
}

function drawLandmarks(): string {
  const out: string[] = []
  // Guild town
  out.push(house(268, 166, 20, 10, '#3b5fa8'), house(372, 166, 20, 10, '#3f8f4f'), house(262, 214, 18, 10, '#b8503a'), house(376, 214, 18, 10, '#3b5fa8'), house(320, 248, 20, 10, '#7a4fc9'))
  out.push(
    house(320, 180, 44, 16, '#b8503a'),
    `<rect x="330" y="160" width="4" height="7" fill="#8a4a3a" stroke="#1b1424" stroke-width="0.8"/>`,
    `<rect x="296" y="174" width="5" height="4" fill="#ffd27a"/><rect x="339" y="174" width="5" height="4" fill="#ffd27a"/>`,
    `<rect x="291" y="190" width="20" height="13" fill="#8a5a34" stroke="#1b1424" stroke-width="1"/><rect x="294" y="193" width="5" height="4" fill="#f3e6c0"/><rect x="302" y="193" width="5" height="4" fill="#f3e6c0"/>`,
    // windmill
    `<path d="M209 144L211 124H217L219 144Z" fill="#e2d6bc" stroke="#1b1424" stroke-width="1"/><g transform="translate(214 124)"><g><path d="M0 0L0 -11M0 0L11 0M0 0L0 11M0 0L-11 0" stroke="#efe6d2" stroke-width="3"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite"/></g></g>`,
  )
  // Wizard's tower with its library
  const [tx, ty] = PLACES.study.at
  out.push(
    `<ellipse cx="${tx + 4}" cy="${ty + 1}" rx="18" ry="3" fill="#000" opacity="0.3"/>`,
    house(tx + 14, ty, 14, 9, '#3b5fa8'),
    `<rect x="${tx - 7}" y="${ty - 42}" width="14" height="42" fill="#857e94" stroke="#1b1424" stroke-width="1"/>`,
    `<rect x="${tx - 7}" y="${ty - 42}" width="3" height="42" fill="#a59eb2"/><rect x="${tx + 3}" y="${ty - 42}" width="4" height="42" fill="#665f77"/>`,
    `<path d="M${tx - 7} ${ty - 30}H${tx + 7}M${tx - 7} ${ty - 18}H${tx + 7}" stroke="#4a4458" stroke-width="0.8"/>`,
    `<rect x="${tx - 9}" y="${ty - 46}" width="18" height="4" fill="#8a839a" stroke="#1b1424" stroke-width="1"/>`,
    `<path d="M${tx - 11} ${ty - 46}L${tx} ${ty - 70}L${tx + 11} ${ty - 46}Z" fill="#6a4fc9" stroke="#1b1424" stroke-width="1"/><path d="M${tx} ${ty - 70}L${tx + 11} ${ty - 46}H${tx}Z" fill="#45318c"/>`,
    `<circle cx="${tx}" cy="${ty - 71}" r="1.6" fill="#f7dd5b"/>`,
    `<rect x="${tx - 2}" y="${ty - 36}" width="3" height="5" rx="1.5" fill="#a593ff"><animate attributeName="opacity" values="1;0.5;1" dur="2.4s" repeatCount="indefinite"/></rect>`,
    `<rect x="${tx - 2.5}" y="${ty - 7}" width="5" height="7" fill="#6b4426"/>`,
    `<g><path d="M0 -3L2 0L0 3L-2 0Z" fill="#7fe0ff" stroke="#1b1424" stroke-width="0.6"/><animateMotion dur="5s" repeatCount="indefinite" path="M${tx + 15} ${ty - 56}A15 4 0 1 1 ${tx - 15} ${ty - 56}A15 4 0 1 1 ${tx + 15} ${ty - 56}"/></g>`,
  )
  // Dwarven armory carved into the mountain
  const [ax, ay] = PLACES.armory.at
  out.push(
    mountain(ax - 22, ay - 16, 50, 36),
    mountain(ax + 24, ay - 14, 48, 38),
    `<rect x="${ax - 18}" y="${ay - 30}" width="36" height="30" fill="#9a9184" stroke="#1b1424" stroke-width="1"/>`,
    `<path d="M${ax - 18} ${ay - 22}H${ax + 18}M${ax - 18} ${ay - 14}H${ax + 18}M${ax - 18} ${ay - 6}H${ax + 18}" stroke="#5e574d" stroke-width="0.7"/>`,
    `<rect x="${ax - 21}" y="${ay - 35}" width="42" height="6" fill="#7d766a" stroke="#1b1424" stroke-width="1"/>`,
    `<path d="M${ax - 8} ${ay}V${ay - 14}A8 8 0 0 1 ${ax + 8} ${ay - 14}V${ay}Z" fill="#120c10" stroke="#1b1424" stroke-width="1"/>`,
    `<ellipse cx="${ax}" cy="${ay - 4}" rx="6" ry="4" fill="#ff7a2a"><animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.9s" repeatCount="indefinite"/></ellipse>`,
    `<rect x="${ax - 15}" y="${ay - 28}" width="4" height="12" fill="#b8323f"/><rect x="${ax + 11}" y="${ay - 28}" width="4" height="12" fill="#b8323f"/>`,
    `<rect x="${ax + 24}" y="${ay + 2}" width="12" height="4" fill="#5b6470" stroke="#1b1424" stroke-width="0.8"/><rect x="${ax + 27}" y="${ay + 6}" width="6" height="4" fill="#3d444e"/>`,
  )
  // The dungeon: a skull in a crag
  const [dx, dy] = PLACES.dungeon.at
  out.push(
    `<path d="M${dx - 34} ${dy}L${dx - 16} ${dy - 34}L${dx} ${dy - 38}L${dx + 18} ${dy - 32}L${dx + 34} ${dy}Z" fill="#5a534c" stroke="#1b1424" stroke-width="1"/>`,
    `<path d="M${dx} ${dy - 38}L${dx + 18} ${dy - 32}L${dx + 34} ${dy}H${dx}Z" fill="#433d38"/>`,
    `<path d="M${dx - 11} ${dy - 8}V${dy - 20}A11 11 0 0 1 ${dx + 11} ${dy - 20}V${dy - 8}H${dx + 7}V${dy}H${dx - 7}V${dy - 8}Z" fill="#d6cfc0" stroke="#1b1424" stroke-width="1"/>`,
    `<circle cx="${dx - 5}" cy="${dy - 20}" r="3" fill="#1b1424"/><circle cx="${dx + 5}" cy="${dy - 20}" r="3" fill="#1b1424"/>`,
    `<rect x="${dx - 5}" y="${dy - 9}" width="10" height="9" fill="#120c10"/><path d="M${dx - 4} ${dy - 9}V${dy - 7}M${dx - 1} ${dy - 9}V${dy - 7}M${dx + 2} ${dy - 9}V${dy - 7}" stroke="#efe6d2" stroke-width="1.4"/>`,
  )
  for (const t of [-18, 18]) out.push(`<rect x="${dx + t - 0.8}" y="${dy - 8}" width="1.6" height="8" fill="#4a2f1d"/><circle cx="${dx + t}" cy="${dy - 9}" r="2" fill="#ffb347"><animate attributeName="r" values="2;2.6;2" dur="0.7s" repeatCount="indefinite"/></circle>`)
  // The alchemist's mushroom hut on stilts
  const [hx, hy] = PLACES.cauldron.at
  out.push(
    `<ellipse cx="${hx}" cy="${hy + 2}" rx="22" ry="6" fill="#2f4b3e" stroke="#3a4c2c" stroke-width="1"/>`,
    `<path d="M${hx - 10} ${hy + 2}V${hy - 8}M${hx - 3} ${hy + 3}V${hy - 8}M${hx + 4} ${hy + 3}V${hy - 8}M${hx + 10} ${hy + 2}V${hy - 8}" stroke="#3a2414" stroke-width="1.6"/>`,
    `<rect x="${hx - 14}" y="${hy - 10}" width="28" height="3" fill="#8a5a34" stroke="#1b1424" stroke-width="0.8"/>`,
    `<rect x="${hx - 10}" y="${hy - 23}" width="20" height="13" fill="#8a5a34" stroke="#1b1424" stroke-width="1"/>`,
    `<rect x="${hx - 6}" y="${hy - 18}" width="4" height="8" fill="#6b4426"/><circle cx="${hx + 4}" cy="${hy - 17}" r="2.2" fill="#9be89f"/>`,
    `<path d="M${hx - 17} ${hy - 22}A17 13 0 0 1 ${hx + 17} ${hy - 22}Z" fill="#c0392b" stroke="#1b1424" stroke-width="1"/>`,
    `<circle cx="${hx - 7}" cy="${hy - 28}" r="2" fill="#fff3d0"/><circle cx="${hx + 3}" cy="${hy - 32}" r="2.3" fill="#fff3d0"/><circle cx="${hx + 10}" cy="${hy - 26}" r="1.6" fill="#fff3d0"/>`,
    `<path d="M${hx - 34} ${hy + 10}A7 5 0 0 1 ${hx - 20} ${hy + 10}Z" fill="#2e2a36" stroke="#1b1424" stroke-width="1"/><ellipse cx="${hx - 27}" cy="${hy + 6}" rx="6" ry="1.6" fill="#4fbf5a"/>`,
  )
  for (let i = 0; i < 3; i += 1) out.push(`<circle cx="${hx - 27 + (i - 1) * 3}" cy="${hy + 4}" r="1.2" fill="#9be89f"><animate attributeName="cy" values="${hy + 4};${hy - 10}" dur="${1.4 + i * 0.3}s" begin="${i * 0.4}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="${1.4 + i * 0.3}s" begin="${i * 0.4}s" repeatCount="indefinite"/></circle>`)
  return out.join('')
}

let scenery: string | undefined

export function drawMap(party: GuildMember[], dungeon: GuildDungeon, quests: GuildQuest[], opts: MapOptions = {}): string {
  scenery ??= drawScenery()
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif">`,
    `<defs>`,
    `<pattern id="waves" width="28" height="14" patternUnits="userSpaceOnUse"><rect width="28" height="14" fill="#2a68a0"/><path d="M2 9q3 -3 6 0M16 3q3 -3 6 0" stroke="#4a8fc4" stroke-width="1.2" fill="none"/></pattern>`,
    `<pattern id="grass" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#5c9e3e"/><path d="M3 5v2M4 4v3M12 13v2M13 12v3" stroke="#447f30" stroke-width="0.8"/><circle cx="9" cy="8" r="0.7" fill="#74b54e"/></pattern>`,
    `<pattern id="cobble" width="8" height="5" patternUnits="userSpaceOnUse"><path d="M0 0H8M4 0V2.5M0 2.5H8M0 2.5V5M8 2.5V5" stroke="#6a6258" stroke-width="0.7"/></pattern>`,
    `<radialGradient id="glow" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="fog" r="0.5"><stop offset="0" stop-color="#0c0814" stop-opacity="0.92"/><stop offset="0.7" stop-color="#0c0814" stop-opacity="0.8"/><stop offset="1" stop-color="#0c0814" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="vignette" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" rx="10" fill="url(#waves)"/>`,
    scenery,
  )

  // After dark: the land dims and every window, torch and the forge glows.
  if (opts.hour !== undefined && (opts.hour >= 19 || opts.hour < 6)) {
    out.push(`<rect width="${W}" height="${H}" rx="10" fill="#0a0e2c" opacity="0.45"/>`)
    for (const [x, y, r, c] of [[296, 176, 10, '#ffd27a'], [342, 176, 10, '#ffd27a'], [268, 162, 7, '#ffd27a'], [372, 162, 7, '#ffd27a'], [262, 210, 7, '#ffd27a'], [376, 210, 7, '#ffd27a'], [320, 244, 7, '#ffd27a'], [112, 66, 12, '#a593ff'], [534, 92, 22, '#ff7a2a'], [86, 273, 10, '#ffb347'], [122, 273, 10, '#ffb347'], [552, 267, 10, '#9be89f'], [521, 290, 14, '#ff8c3a']] as const) {
      out.push(`<g opacity="0.85"><circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="${c}" opacity="0.14"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.22"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${c}" opacity="0.5"/><animate attributeName="opacity" values="0.85;0.6;0.85" dur="${2 + (x % 3)}s" repeatCount="indefinite"/></g>`)
    }
  }

  // Roads light up and march toward a place while someone works there.
  for (const loc of ['study', 'armory', 'dungeon', 'cauldron'] as const) {
    if (!party.some(m => m.location === loc && m.isBusy && !m.isDim)) continue
    const color = LOCATIONS[loc].color
    out.push(
      `<path d="${curve(ROADS[loc])}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"><animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite"/></path>`,
    )
  }

  // The dungeon: fog until the first test run, then the monsters that still stand.
  const [dx, dy] = PLACES.dungeon.at
  if (!dungeon.hasRun) {
    out.push(`<ellipse cx="${dx + 4}" cy="${dy - 6}" rx="96" ry="66" fill="url(#fog)"/>`)
  } else {
    const shown = Math.min(dungeon.monsters, 8)
    for (let i = 0; i < shown; i += 1) {
      const mx = dx + 22 + (i % 4) * 10
      const my = dy - 2 + Math.floor(i / 4) * 10 - (i % 2) * 3
      out.push(
        `<g><path d="M${mx - 5} ${my}Q${mx - 5} ${my - 7} ${mx} ${my - 7}Q${mx + 5} ${my - 7} ${mx + 5} ${my}Z" fill="${['#d1495b', '#9b59d0', '#e07a2f'][i % 3]}" stroke="#1b1424" stroke-width="1"/><circle cx="${mx - 1.8}" cy="${my - 4}" r="1" fill="#fff"/><circle cx="${mx + 1.8}" cy="${my - 4}" r="1" fill="#fff"/>` +
          `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="${0.8 + (i % 3) * 0.15}s" repeatCount="indefinite"/></g>`,
      )
    }
  }

  // Each place: a glow while busy, its name plate, the party standing there, and what they do.
  for (const loc of ['study', 'armory', 'dungeon', 'cauldron', 'tavern'] as const) {
    const p = PLACES[loc]
    const info = LOCATIONS[loc]
    // Highlighted members first, so the faint ones are the ones folded into "+N".
    const here = party.filter(m => m.location === loc).sort((a, b) => Number(!!a.isDim) - Number(!!b.isDim))
    const busy = here.some(m => m.isBusy && !m.isDim)
    if (busy) {
      out.push(`<circle cx="${p.party[0]}" cy="${p.party[1]}" r="38" fill="url(#glow)"><animate attributeName="opacity" values="1;0.5;1" dur="1.6s" repeatCount="indefinite"/></circle>`)
    }
    if (opts.selected === loc) {
      out.push(`<circle cx="${p.at[0]}" cy="${p.at[1] - 16}" r="44" fill="none" stroke="#f2b84b" stroke-width="2.5" stroke-dasharray="7 5"><animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.2s" repeatCount="indefinite"/></circle>`)
    }
    // Hovering a place names it and what lands there.
    out.push(`<circle cx="${p.at[0]}" cy="${p.at[1] - 16}" r="40" fill="#fff" fill-opacity="0"><title>${esc(`${info.name} · ${here.length} here\n${PLACE_INFO[loc].blurb}\n${PLACE_INFO[loc].tools}`)}</title></circle>`)
    const name = `${info.icon} ${info.name}`
    const pw = name.length * 6.6 + 14
    const [tx, ty] = p.tag
    const px = Math.max(4, Math.min(W - pw - 4, tx - pw / 2))
    out.push(
      `<rect x="${r1(px)}" y="${ty - 10}" width="${r1(pw)}" height="19" rx="4" fill="#1b1424" fill-opacity="0.88" stroke="${busy ? info.color : '#6b5536'}" stroke-width="${busy ? 2.5 : 1.5}">` +
        (busy ? `<animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite"/>` : '') +
        `</rect>`,
      `<text x="${r1(px + pw / 2)}" y="${ty + 4}" font-size="12" font-weight="bold" text-anchor="middle" fill="#fff8e7">${esc(name)}</text>`,
    )

    const [cx, cy] = p.party
    const count = Math.min(here.length, 3)
    here.slice(0, 3).forEach((m, i) => {
      const cls = classOf(m)
      const mx = cx + (i - (count - 1) / 2) * (here.some(o => o.project) ? 38 : 30)
      if (m.isDim) out.push(`<g opacity="0.4">`)
      out.push(
        `<ellipse cx="${mx}" cy="${cy + 13}" rx="10" ry="2.5" fill="#000" opacity="0.3"/>`,
        m.team ? `<circle cx="${mx}" cy="${cy}" r="15.5" fill="none" stroke="${m.team.color}" stroke-width="3"/>` : '',
        `<circle cx="${mx}" cy="${cy}" r="12" fill="#fff8e7" stroke="${m.isBusy ? info.color : '#8a7350'}" stroke-width="2.5"><title>${esc(`${m.fixedClass ? m.label : CLASSES[cls].name}${m.team ? ` · ${m.team.name}` : ''}: ${m.activity}`)}</title></circle>`,
        `<text x="${mx}" y="${cy + 5}" font-size="13" text-anchor="middle">${CLASSES[cls].icon}</text>`,
      )
      if (m.isBusy) {
        out.push(`<circle cx="${mx}" cy="${cy}" r="12" fill="none" stroke="${info.color}" stroke-width="2"><animate attributeName="r" values="12;18;12" dur="1.4s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.9;0;0.9" dur="1.4s" repeatCount="indefinite"/></circle>`)
      }
      if (m.lang) {
        out.push(
          `<rect x="${mx + 5}" y="${cy - 19}" width="22" height="11" rx="2" fill="#3b2a1a"/>`,
          `<text x="${mx + 16}" y="${cy - 10.5}" font-size="8" font-weight="bold" text-anchor="middle" fill="#ffd27a">${esc(LANGS[m.lang].crest)}</text>`,
        )
      }
      // On the shared map each member carries its project's name in its colour.
      if (m.project) {
        const label = clip(m.project.name, 8)
        const w = Math.min(36, label.length * 4.4 + 6)
        out.push(
          `<rect x="${r1(mx - w / 2)}" y="${cy + 11}" width="${r1(w)}" height="9" rx="2" fill="${m.project.color}" stroke="#1b1424" stroke-width="0.8"/>`,
          `<text x="${mx}" y="${cy + 18}" font-size="7" font-weight="bold" text-anchor="middle" fill="#1b1424">${esc(label)}</text>`,
        )
      }
      if (m.isDim) out.push(`</g>`)
    })
    if (here.length > 3) {
      out.push(`<text x="${cx + 52}" y="${cy + 4}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff8e7" stroke="#1b1424" stroke-width="2.5" paint-order="stroke">+${here.length - 3}</text>`)
    }

    const lines: string[] = []
    const lead = here.find(m => m.isBusy && !m.isDim) ?? here.find(m => !m.isDim)
    if (lead) lines.push(clip(`${lead.project ? `${lead.project.name}: ` : ''}${lead.fixedClass ? lead.label : CLASSES[classOf(lead)].name} ${lead.activity}`, 38))
    if (loc === 'dungeon') {
      lines.push(!dungeon.hasRun
        ? 'Unexplored'
        : dungeon.monsters > 0
          ? `${dungeon.monsters} monster${dungeon.monsters === 1 ? '' : 's'} lurk · ${dungeon.slain} slain`
          : `Cleared ✨ · ${dungeon.slain} slain`)
    }
    if (loc === 'tavern') {
      const open = quests.filter(q => !q.isDone).length
      lines.push(`📜 ${open} open · ${quests.length - open} done`)
    }
    lines.forEach((line, i) => {
      const [lx, ly] = p.caption
      const lw = line.length * 5.4 + 12
      const bx = Math.max(4, Math.min(W - lw - 4, lx - lw / 2))
      out.push(
        `<rect x="${r1(bx)}" y="${ly - 9 + i * 15}" width="${r1(lw)}" height="13" rx="3" fill="#f1e2bd" fill-opacity="0.92" stroke="#6b5536" stroke-width="1"/>`,
        `<text x="${r1(bx + lw / 2)}" y="${ly + 1 + i * 15}" font-size="10" text-anchor="middle" fill="#3b2a1a">${esc(line)}</text>`,
      )
    })
  }

  // Teams in the field fly their banners along the south shore.
  const flying = new Map<string, { color: string; n: number }>()
  for (const m of party) if (m.team && !m.isDim) flying.set(m.team.name, { color: m.team.color, n: (flying.get(m.team.name)?.n ?? 0) + 1 })
  let bx = 320 - ([...flying.keys()].reduce((w, n) => w + n.length * 6.2 + 52, 0)) / 2
  for (const [name, t] of flying) {
    const w = name.length * 6.2 + 44
    out.push(
      `<path d="M${r1(bx)} 366V344" stroke="#3a2414" stroke-width="1.6"/>`,
      `<path d="M${r1(bx + 1)} 344H${r1(bx + w)}L${r1(bx + w - 6)} 350.5L${r1(bx + w)} 357H${r1(bx + 1)}Z" fill="${t.color}" stroke="#1b1424" stroke-width="1"><animate attributeName="d" values="M${r1(bx + 1)} 344H${r1(bx + w)}L${r1(bx + w - 6)} 350.5L${r1(bx + w)} 357H${r1(bx + 1)}Z;M${r1(bx + 1)} 345H${r1(bx + w)}L${r1(bx + w - 6)} 351.5L${r1(bx + w)} 358H${r1(bx + 1)}Z;M${r1(bx + 1)} 344H${r1(bx + w)}L${r1(bx + w - 6)} 350.5L${r1(bx + w)} 357H${r1(bx + 1)}Z" dur="1.2s" repeatCount="indefinite"/></path>`,
      `<text x="${r1(bx + 5)}" y="354" font-size="9" font-weight="bold" fill="#1b1424">🚩 ${esc(name)} ×${t.n}</text>`,
    )
    bx += w + 8
  }

  // The workspace's name and its mana: the account's rate-limit windows, as what is left.
  if (opts.realm) {
    const t = `🏰 ${opts.realm}`
    const w = t.length * 7 + 16
    out.push(`<rect x="${r1(320 - w / 2)}" y="4" width="${r1(w)}" height="18" rx="4" fill="#1b1424" fill-opacity="0.88" stroke="#f2b84b" stroke-width="1.2"/><text x="320" y="17" font-size="11.5" font-weight="bold" text-anchor="middle" fill="#ffd27a">${esc(t)}</text>`)
  }
  const mana = (opts.quota ?? []).slice(0, 4)
  mana.forEach((q, i) => {
    const y = 26 + i * 15
    const left = Math.max(0, Math.min(100, q.percentLeft))
    const color = left < 20 ? '#e8606f' : left < 50 ? '#f2b84b' : '#4fc7b5'
    out.push(
      `<rect x="246" y="${y}" width="148" height="13" rx="3" fill="#1b1424" fill-opacity="0.85"/>`,
      `<text x="251" y="${y + 9.5}" font-size="8.5" fill="#efe6d2">🔮 ${esc(clip(q.label, 16))}</text>`,
      `<rect x="334" y="${y + 3}" width="40" height="7" rx="2" fill="#3a2f4c"/><rect x="334" y="${y + 3}" width="${r1(left * 0.4)}" height="7" rx="2" fill="${color}"/>`,
      `<text x="390" y="${y + 9.5}" font-size="8" text-anchor="end" fill="${color}">${Math.round(left)}%</text>`,
    )
  })

  out.push(`<rect width="${W}" height="${H}" rx="10" fill="url(#vignette)" pointer-events="none"/>`)
  out.push(`</svg>`)
  return out.join('')
}

export function describeMap(party: GuildMember[], dungeon: GuildDungeon): string {
  const where = party.map(m => `${CLASSES[classOf(m)].name} in the ${LOCATIONS[m.location].name}: ${m.activity}`)
  const d = dungeon.hasRun ? `Dungeon: ${dungeon.monsters} failing, ${dungeon.slain} passing.` : 'Dungeon unexplored.'
  return `Guild realm map, an island with the guild town at its heart. ${where.join('. ')}. ${d}`
}
