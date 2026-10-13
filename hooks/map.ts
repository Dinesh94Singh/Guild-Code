// The guild realm as one SVG, for the surfaces that draw pictures (desktop, VS Code, mobile).
// The terminal gets a text map instead.
//
// The world itself is painted once (hooks/world.js, the same painter the dry run uses) and
// embedded as a small pixel-art image; over it go the party, the monsters and the life of
// the realm as pixel sprites, animated with SMIL since the surface runs no script.
import type { GuildDungeon, GuildLocation, GuildMember, GuildQuest, GuildQuota } from '../types'
import { CLASSES, LANGS, LOCATIONS, PLACE_INFO, classOf } from './lore'
import { Recorder, dragon, member, slime, villager } from './pixelart.js'
import type { Pen } from './pixelart.js'
import { BOARD, CAULDRON, CHEST, FOLK, HUB, MONSTER_SLOTS, PLACES, VOLCANO, W, H, way } from './world.js'
import { WORLD_ART, WORLD_FOAM, WORLD_MARKS } from './world-art'

export type MapOptions = {
  /** The place being inspected, ringed in gold. */
  selected?: GuildLocation | ''
  /** Kept for callers that pass them; the pane draws these beside the map. */
  realm?: string
  quota?: GuildQuota[]
  /** The local hour: after dark the realm dims and its windows light up. */
  hour?: number
  /** Now, in ms: how far along the road a member who just moved has walked. */
  now?: number
}

const WALK_SPEED = 70 // world pixels a second
const NAMES: Record<GuildLocation, string> = { tavern: 'TAVERN', study: "WIZARD'S STUDY", armory: 'ARMORY', cauldron: 'CAULDRON', dungeon: 'DUNGEON' }
const PLACE_COLOR: Record<GuildLocation, string> = { tavern: '#f2b84b', study: '#a593ff', armory: '#a9b6c6', cauldron: '#84d488', dungeon: '#e8606f' }

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
const r1 = (n: number) => Math.round(n * 10) / 10
const pts = (list: readonly { x: number; y: number }[]) => list.map(p => `${r1(p.x)},${r1(p.y)}`).join(' ')

// ── sprites, drawn once into <defs> as needed ──
const art = new Map<string, string>()
function sprite(id: string, draw: (b: Pen) => void): string {
  if (!art.has(id)) { const b = new Recorder(); draw(b); art.set(id, b.toSvg()) }
  return id
}
const memberSprite = (cls: string, frame: number) => sprite(`m-${cls}-${frame}`, b => member(b, cls, frame, -6, -16, false, cls === 'guildmaster' ? 'currentColor' : undefined))

/** The road from one place to another: the shortest way along the valley's roads. */
function route(from: GuildLocation, to: GuildLocation, end: { x: number; y: number }) {
  return from === to ? [end] : [...way(from, to, 2), end]
}
const length = (list: { x: number; y: number }[]) => list.reduce((n, p, i) => (i ? n + Math.hypot(p.x - list[i - 1]!.x, p.y - list[i - 1]!.y) : 0), 0)

/** The life of the realm that does not depend on the party: smoke, fire, water, folk and the dragon. */
function ambient(night: boolean): string {
  const M = WORLD_MARKS
  const o: string[] = []
  const smoke = (x: number, y: number, color: string, i: number) =>
    [0, 1].map(k => `<circle cx="${x}" cy="${y}" r="1.5" fill="${color}"><animate attributeName="cy" values="${y};${y - 16}" dur="3s" begin="${-(i * 0.7 + k * 1.5)}s" repeatCount="indefinite"/><animate attributeName="cx" values="${x};${x + 6}" dur="3s" begin="${-(i * 0.7 + k * 1.5)}s" repeatCount="indefinite"/><animate attributeName="r" values="1.5;3.5" dur="3s" begin="${-(i * 0.7 + k * 1.5)}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="3s" begin="${-(i * 0.7 + k * 1.5)}s" repeatCount="indefinite"/></circle>`).join('')
  M.chimneys.forEach((c, i) => o.push(smoke(c.x, c.y, 'magic' in c ? (i % 2 ? '#a593ff' : '#84d488') : '#e1e1e6', i)))
  M.vents.forEach((v, i) => o.push(smoke(v.x, v.y, '#5a5660', i + 3)))
  o.push(smoke(FOLK.cookfire.x, FOLK.cookfire.y - 12, '#f0f0f0', 7))
  // the windmill's sails
  const wm = M.windmill
  if (wm) o.push(`<g transform="translate(${wm.x} ${wm.y})"><g><path d="M-1 -14h2v28h-2zM-14 -1h28v2h-28z" fill="#3a2414"/><path d="M1 -14h3v9h-3zM5 1h9v3h-9zM-4 5h3v9h-3zM-14 -4h9v3h-9z" fill="#efe6d2"/><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/></g><rect x="-1" y="-1" width="3" height="3" fill="#1b1424"/></g>`)
  // fire: torches, the forge, the cauldrons
  const flame = (x: number, y: number, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-1" y="-3" width="3" height="3" fill="#ff9a3a"><animate attributeName="fill" values="#ffd27a;#ff9a3a;#ffd27a" dur=".5s" repeatCount="indefinite"/></rect><rect x="0" y="-2" width="1" height="1" fill="#fff3c0"/></g>`
  M.torches.forEach(t => o.push(flame(t.x, t.y)))
  if (M.forge) o.push(`<ellipse cx="${M.forge.x}" cy="${M.forge.y + 8}" rx="7" ry="3" fill="#ff7a2a"><animate attributeName="opacity" values="1;.55;1" dur=".8s" repeatCount="indefinite"/></ellipse>`)
  const pot = (x: number, y: number, liquid: string) => `<rect x="${x - 6}" y="${y + 3}" width="12" height="3" fill="#ff7a2a"><animate attributeName="height" values="3;4;3" dur=".4s" repeatCount="indefinite"/></rect><path d="M${x - 9} ${y - 7}h18v11h-18z" fill="#1b1424"/><path d="M${x - 8} ${y - 6}h16v9h-16z" fill="#2e2a36"/><rect x="${x - 7}" y="${y - 7}" width="14" height="2" fill="${liquid}"/>${[0, 1, 2].map(k => `<circle cx="${x - 3 + k * 3}" cy="${y - 8}" r="1" fill="#d6ffd8"><animate attributeName="cy" values="${y - 8};${y - 18}" dur="${1.4 + k * 0.3}s" begin="${-k * 0.5}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="${1.4 + k * 0.3}s" begin="${-k * 0.5}s" repeatCount="indefinite"/></circle>`).join('')}`
  o.push(pot(CAULDRON.x, CAULDRON.y, '#4fbf5a'))
  o.push(`<g>${flame(FOLK.cookfire.x, FOLK.cookfire.y + 1, 1.4)}<path d="M${FOLK.cookfire.x - 3} ${FOLK.cookfire.y - 10}h7v5h-7z" fill="#3d444e"/></g>`)
  // eyes, windows and the tower's crystal
  if (M.skull) for (const e of M.skull.eyes) o.push(`<rect x="${e.x - 1}" y="${e.y - 1}" width="2" height="2" fill="#ff5a6a"><animate attributeName="opacity" values="1;.3;1" dur="2s" repeatCount="indefinite"/></rect>`)
  if (M.tower) {
    for (const w of M.tower.windows) o.push(`<rect x="${w.x}" y="${w.y}" width="3" height="6" fill="#c8bfff"><animate attributeName="opacity" values="1;.55;1" dur="2.4s" repeatCount="indefinite"/></rect>`)
    o.push(`<path d="M0 -3l2 3l-2 3l-2 -3z" fill="#7fe0ff" stroke="#1b1424" stroke-width=".6"><animateMotion dur="5s" repeatCount="indefinite" path="M${M.tower.x + 18} ${M.tower.top - 16}a18 4 0 1 1 -36 0a18 4 0 1 1 36 0"/></path>`)
  }
  if (M.hut) o.push(`<rect x="${M.hut.window.x - 1}" y="${M.hut.window.y - 1}" width="3" height="3" fill="#9be89f"><animate attributeName="opacity" values="1;.5;1" dur="2s" repeatCount="indefinite"/></rect>`)
  // the sea: glints on the water, and the ship working the coast
  WORLD_FOAM.slice(0, 40).forEach((f, i) => { if (i % 2) o.push(`<rect x="${f.x}" y="${f.y + 2}" width="2" height="1" fill="#e8f6ff" opacity="0"><animate attributeName="opacity" values="0;.9;0" dur="2.6s" begin="${-(i * 0.37) % 2.6}s" repeatCount="indefinite"/></rect>`) })
  o.push(`<g><path d="M-8 -4h16v5h-16z" fill="#1b1424"/><path d="M-7 -4h14v3h-14z" fill="#7a4a2a"/><rect x="0" y="-16" width="1" height="12" fill="#3a2414"/><path d="M-4 -15h9v9h-9z" fill="#1b1424"/><path d="M-3 -14h7v7h-7z" fill="#fff3d0"/><rect x="-3" y="-11" width="7" height="2" fill="#b8323f"/><animateMotion dur="40s" repeatCount="indefinite" path="M${FOLK.ship.from} ${FOLK.ship.y}L${FOLK.ship.to} ${FOLK.ship.y + 2}L${FOLK.ship.from} ${FOLK.ship.y}"/></g>`)
  // townsfolk at their chores
  const folk = (id: string, shirt: string, hair: string) => sprite(id, b => villager(b, 0, 0, shirt, hair))
  const walker = (id: string, path: string, dur: number, begin: number) => `<use href="#${id}"><animateMotion dur="${dur}s" begin="${-begin}s" repeatCount="indefinite" path="${path}"/></use>`
  const T = FOLK.town
  o.push(walker(folk('v1', '#b8323f', '#6b4426'), `M${T.x - 30} ${T.y + 4}L${T.x + 26} ${T.y - 4}L${T.x + 10} ${T.y + 18}L${T.x - 30} ${T.y + 4}`, 22, 0))
  o.push(walker(folk('v2', '#3b5fa8', '#2b1b14'), `M${T.x + 30} ${T.y + 14}L${T.x - 16} ${T.y + 20}L${T.x - 10} ${T.y - 6}L${T.x + 30} ${T.y + 14}`, 26, 9))
  o.push(walker(folk('v3', '#84d488', '#c9a86e'), `M${HUB.x - 50} ${HUB.y + 8}L${T.x + 50} ${T.y - 2}L${HUB.x - 50} ${HUB.y + 8}`, 30, 4))
  const swing = (x: number, y: number, id: string, tool: string) => `<g transform="translate(${x} ${y})"><use href="#${id}"/><g><path d="${tool}" fill="#c9d2dc"/><animateTransform attributeName="transform" type="rotate" values="-40 1 -8;30 1 -8;-40 1 -8" dur=".9s" repeatCount="indefinite"/></g></g>`
  const pick = 'M1 -8h1v-7h-1zM-2 -16h7v1h-7z'
  o.push(swing(FOLK.mine.x - 16, FOLK.mine.y + 8, folk('miner', '#5b6470', '#f2b84b'), pick))
  o.push(swing(FOLK.woodyard.x - 8, FOLK.woodyard.y + 1, folk('wood', '#3f8f4f', '#6b4426'), 'M1 -8h1v-7h-1zM2 -16h3v3h-3z'))
  o.push(`<g transform="translate(${FOLK.cookfire.x + 10} ${FOLK.cookfire.y + 2})"><use href="#${folk('cook', '#f3e6c0', '#efe6d2')}"/></g>`)
  const cart = `<g><path d="M-5 -7h11v6h-11z" fill="#1b1424"/><path d="M-4 -6h9v4h-9z" fill="#5b6470"/><rect x="-3" y="-8" width="3" height="2" fill="#e39a4d"/><rect x="-4" y="-1" width="2" height="2" fill="#1b1424"/><rect x="3" y="-1" width="2" height="2" fill="#1b1424"/><animateMotion dur="12s" repeatCount="indefinite" keyPoints="0;1;1;0;0" keyTimes="0;.4;.5;.9;1" calcMode="linear" path="M${FOLK.mine.x} ${FOLK.mine.y}l34 14"/></g>`
  o.push(cart)
  o.push(walker(folk('farmer', '#a8683a', '#d9c08f'), `M${FOLK.field.x + 4} ${FOLK.field.y + 8}h${FOLK.field.w - 8}v6h${-(FOLK.field.w - 8)}z`, 24, 0))
  // the fisherman, his float bobbing
  const fx = FOLK.fishing.x, fy = FOLK.fishing.y
  o.push(`<use href="#${folk('fisher', '#4f6d8f', '#3b5fa8')}" x="${fx}" y="${fy}"/><path d="M${fx - 1} ${fy - 8}L${fx - 5} ${fy - 22}L${fx - 10} ${fy - 15}" fill="none" stroke="#3a2414" stroke-width=".8"/><rect x="${fx - 11}" y="${fy - 16}" width="2" height="2" fill="#e8606f"><animate attributeName="y" values="${fy - 16};${fy - 15};${fy - 16}" dur="1.6s" repeatCount="indefinite"/></rect>`)
  // the flock in its pen, and its dog
  const pen = FOLK.pen
  o.push(`<ellipse cx="${pen.x}" cy="${pen.y}" rx="${pen.rx + 5}" ry="${pen.ry + 5}" fill="none" stroke="#6b4426" stroke-width="1" stroke-dasharray="2 3"/>`)
  for (let i = 0; i < 4; i++) {
    const sx = pen.x - 12 + i * 8, sy = pen.y - 3 + (i % 2) * 5
    o.push(`<g><path d="M${sx - 4} ${sy - 5}h8v4h-8z" fill="#1b1424"/><path d="M${sx - 3} ${sy - 5}h6v3h-6z" fill="#f4f1e8"/><rect x="${sx + 3}" y="${sy - 5}" width="3" height="3" fill="#2b2433"/><animateTransform attributeName="transform" type="translate" values="0 0;${i % 2 ? 3 : -3} 0;0 0" dur="${7 + i}s" repeatCount="indefinite"/></g>`)
  }
  o.push(`<g><path d="M-4 -6h9v5h-9z" fill="#1b1424"/><path d="M-3 -5h7v3h-7z" fill="#efe6d2"/><path d="M3 -8h4v4h-4z" fill="#1b1424"/><animateMotion dur="9s" repeatCount="indefinite" path="M${pen.x - pen.rx - 10} ${pen.y}a${pen.rx + 10} ${pen.ry + 9} 0 1 1 ${2 * (pen.rx + 10)} 0a${pen.rx + 10} ${pen.ry + 9} 0 1 1 ${-2 * (pen.rx + 10)} 0"/></g>`)
  // the fire mountain: a glowing crater, a column of smoke, and now and then an eruption
  const V = M.volcano ?? { x: VOLCANO.x, y: VOLCANO.y - 75 }
  o.push(`<ellipse cx="${V.x}" cy="${V.y}" rx="12" ry="5" fill="#ff7a2a" opacity=".6"><animate attributeName="opacity" values=".35;.8;.35" dur="1.4s" repeatCount="indefinite"/></ellipse>`)
  for (let k = 0; k < 4; k++) o.push(`<circle cx="${V.x}" cy="${V.y - 4}" r="3" fill="#4a3a3a" opacity="0"><animate attributeName="cy" values="${V.y - 4};${V.y - 44}" dur="5s" begin="${-k * 1.25}s" repeatCount="indefinite"/><animate attributeName="cx" values="${V.x};${V.x - 14}" dur="5s" begin="${-k * 1.25}s" repeatCount="indefinite"/><animate attributeName="r" values="3;9" dur="5s" begin="${-k * 1.25}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="5s" begin="${-k * 1.25}s" repeatCount="indefinite"/></circle>`)
  // an eruption every 9s: lava bombs arc out of the crater and the mountain flares
  const bombs: [number, number][] = [[-22, -34], [-12, -46], [4, -52], [16, -40], [26, -30], [-30, -22], [8, -36], [20, -50]]
  bombs.forEach(([dx, up], k) => {
    const d = `M${V.x} ${V.y - 2}Q${V.x + dx * 0.6} ${V.y + up} ${V.x + dx} ${V.y + 16 + (k % 3) * 6}`
    o.push(`<rect x="-1" y="-1" width="${k % 2 ? 2 : 3}" height="${k % 2 ? 2 : 3}" fill="${k % 3 ? '#ff9a3a' : '#ffd27a'}" opacity="0"><animateMotion dur="9s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;.06;.3;1" calcMode="linear" begin="${-(k % 4) * 0.1}s" path="${d}"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.06;.26;.32;1" dur="9s" repeatCount="indefinite"/></rect>`)
  })
  o.push(`<circle cx="${V.x}" cy="${V.y}" r="26" fill="url(#lamp-fire)" opacity="0"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.3;1" dur="9s" repeatCount="indefinite"/></circle>`)

  // clouds and their shadows, birds, and the dragon over the badlands
  const cloud = (y: number, dur: number, begin: number, k: number) =>
    `<g opacity="${night ? 0.35 : 0.8}"><path d="M8 4h20v4h6v6h-34v-6h8z" fill="#fff" transform="scale(${1 + k * 0.4})"/><animateTransform attributeName="transform" type="translate" values="-60 ${y};${W + 20} ${y}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/></g><g opacity=".12"><path d="M8 4h20v4h6v6h-34v-6h8z" fill="#000" transform="scale(${1 + k * 0.4})"/><animateTransform attributeName="transform" type="translate" values="-40 ${y + 40};${W + 40} ${y + 40}" dur="${dur}s" begin="${-begin}s" repeatCount="indefinite"/></g>`
  o.push(cloud(36, 90, 20, 0), cloud(128, 120, 70, 1), cloud(220, 100, 5, 0.5))
  o.push(`<g fill="#1b1424"><path d="M0 0h2v1h-2zM3 0h2v1h-2zM2 1h1v1h-1zM-9 4h2v1h-2zM-6 4h2v1h-2zM-7 5h1v1h-1zM-17 1h2v1h-2zM-14 1h2v1h-2zM-15 2h1v1h-1z"/><animateMotion dur="34s" repeatCount="indefinite" path="M-20 150Q${W / 2} 60 ${W + 20} 120"/></g>`)
  const d0 = sprite('dragon-up', b => dragon(b, 1)), d1 = sprite('dragon-down', b => dragon(b, 0))
  const C = { x: PLACES.dungeon.at.x - 10, y: PLACES.dungeon.at.y - 46 }
  const loop = `M${C.x - 80} ${C.y}a80 30 0 1 0 160 0a80 30 0 1 0 -160 0`
  o.push(`<ellipse rx="14" ry="3" fill="#000" opacity=".22"><animateMotion dur="26s" repeatCount="indefinite" path="M${C.x - 80} ${C.y + 54}a80 30 0 1 0 160 0a80 30 0 1 0 -160 0"/></ellipse>`)
  const wings = `<use href="#${d0}"><animate attributeName="opacity" values="1;0" dur=".5s" calcMode="discrete" repeatCount="indefinite"/></use><use href="#${d1}"><animate attributeName="opacity" values="0;1" dur=".5s" calcMode="discrete" repeatCount="indefinite"/></use>`
  // The loop runs along its bottom half to the right, then back along its top half to the left.
  o.push(`<g><g transform="scale(1.4)">${wings}<animateTransform attributeName="transform" type="scale" values="1.4 1.4;-1.4 1.4" keyTimes="0;.5" dur="26s" calcMode="discrete" repeatCount="indefinite"/></g><animateMotion dur="26s" repeatCount="indefinite" path="${loop}"/></g>`)
  return o.join('')
}

/** The lights after dark: every lamp, window, torch and fire glows through the gloom. */
function nightLights(): string {
  const M = WORLD_MARKS
  const glow = (x: number, y: number, r: number, c: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#lamp-${c})"/>`
  return [
    `<rect width="${W}" height="${H}" fill="#0a0e2c" opacity=".5"/>`,
    ...M.windows.map(w => glow(w.x, w.y, 9, 'warm')),
    ...M.lamps.map(l => glow(l.x, l.y, 16, 'warm')),
    ...M.torches.map(t => glow(t.x, t.y, 20, 'fire')),
    M.forge ? glow(M.forge.x, M.forge.y + 6, 30, 'fire') : '',
    glow(CAULDRON.x, CAULDRON.y, 22, 'fire'),
    glow(FOLK.cookfire.x, FOLK.cookfire.y, 20, 'fire'),
    ...(M.tower ? M.tower.windows.map(w => glow(w.x + 1, w.y + 3, 12, 'arcane')) : []),
    M.hut ? glow(M.hut.window.x, M.hut.window.y, 12, 'arcane') : '',
    ...M.windows.map(w => `<rect x="${w.x - 2}" y="${w.y - 2}" width="4" height="4" fill="#ffd27a"/>`),
  ].join('')
}

export function drawMap(party: GuildMember[], dungeon: GuildDungeon, quests: GuildQuest[], opts: MapOptions = {}): string {
  const now = opts.now ?? 0
  const night = opts.hour !== undefined && (opts.hour >= 19 || opts.hour < 6)
  art.clear()
  const scene: string[] = []
  const life = ambient(night)
  scene.push(life)

  // Busy places glow; the road to one lights up and marches toward it.
  const busyAt = (loc: GuildLocation) => party.some(m => m.location === loc && m.isBusy && !m.isDim)
  for (const loc of Object.keys(PLACES) as GuildLocation[]) {
    if (!busyAt(loc)) continue
    const s = PLACES[loc].spots[0]!
    scene.push(`<circle cx="${s.x}" cy="${s.y - 6}" r="30" fill="url(#busy-${loc})"><animate attributeName="opacity" values="1;.55;1" dur="1.6s" repeatCount="indefinite"/></circle>`)
    if (loc !== 'tavern') scene.push(`<polyline points="${pts(way('tavern', loc, 2).filter((_, i) => i % 3 === 0))}" fill="none" stroke="${PLACE_COLOR[loc]}" stroke-width="1.5" stroke-dasharray="2 4" stroke-linecap="round" opacity=".9"><animate attributeName="stroke-dashoffset" from="12" to="0" dur=".8s" repeatCount="indefinite"/></polyline>`)
  }
  if (opts.selected) {
    const p = PLACES[opts.selected]
    scene.push(`<ellipse cx="${p.at.x}" cy="${p.at.y - 12}" rx="44" ry="30" fill="none" stroke="#f2b84b" stroke-width="1.5" stroke-dasharray="5 4"><animate attributeName="stroke-dashoffset" from="0" to="18" dur="1.2s" repeatCount="indefinite"/></ellipse>`)
  }

  // Quest notes on the board.
  quests.slice(0, 6).forEach((q, i) => {
    const x = BOARD.x + 3 + (i % 3) * 10, y = BOARD.y + 4 + Math.floor(i / 3) * 9
    scene.push(`<path d="M${x} ${y}h8v7h-8z" fill="${q.isDone ? '#b9a77e' : '#f3e6c0'}"/><rect x="${x + 3}" y="${y}" width="2" height="1" fill="#b8323f"/><path d="${q.isDone ? `M${x + 2} ${y + 4}h1v1h-1zM${x + 3} ${y + 5}h1v1h-1zM${x + 4} ${y + 3}h1v2h-1zM${x + 5} ${y + 2}h1v1h-1z` : `M${x + 1} ${y + 3}h6v1h-6zM${x + 1} ${y + 5}h4v1h-4z`}" fill="${q.isDone ? '#4f9c5a' : '#6b5a3a'}"/>`)
  })

  // The Dungeon: its monsters, and its treasure once they are all slain.
  const cleared = dungeon.hasRun && dungeon.monsters === 0 && dungeon.slain > 0
  scene.push(`<path d="M${CHEST.x - 6} ${CHEST.y - 7}h13v8h-13z" fill="#1b1424"/><path d="M${CHEST.x - 5} ${CHEST.y - 6}h11v6h-11z" fill="#8a5a34"/><rect x="${CHEST.x - 5}" y="${CHEST.y - 4}" width="11" height="1" fill="#f2b84b"/>`)
  scene.push(cleared
    ? `<path d="M${CHEST.x - 6} ${CHEST.y - 12}h13v5h-13z" fill="#1b1424"/><path d="M${CHEST.x - 4} ${CHEST.y - 7}h9v2h-9z" fill="#ffd27a"><animate attributeName="fill" values="#ffd27a;#fff3c0;#ffd27a" dur="1s" repeatCount="indefinite"/></path>`
    : `<path d="M${CHEST.x - 6} ${CHEST.y - 10}h13v4h-13z" fill="#1b1424"/><path d="M${CHEST.x - 5} ${CHEST.y - 9}h11v2h-11z" fill="#7a4a2a"/>`)
  const foes: { y: number; svg: string }[] = []
  for (let i = 0; i < Math.min(dungeon.monsters, MONSTER_SLOTS.length); i++) {
    const s = MONSTER_SLOTS[i]!
    const a = sprite(`slime-${i % 3}-0`, b => slime(b, i % 3, 0, -5, -8)), b2 = sprite(`slime-${i % 3}-1`, b => slime(b, i % 3, 1, -5, -8))
    foes.push({ y: s.y, svg: `<g transform="translate(${s.x} ${s.y})"><ellipse cx="0" cy="0" rx="5" ry="1.5" fill="#000" opacity=".35"/><use href="#${a}"><animate attributeName="href" values="#${a};#${b2}" dur="${0.6 + (i % 3) * 0.1}s" calcMode="discrete" repeatCount="indefinite"/></use></g>` })
  }

  // The party: each member at a spot of its place, walking there along the roads if it just moved.
  const crowd = new Map<GuildLocation, number>()
  const people: { y: number; svg: string }[] = [...foes]
  for (const m of party) {
    const here = PLACES[m.location]
    const n = crowd.get(m.location) ?? 0
    crowd.set(m.location, n + 1)
    const base = here.spots[n % here.spots.length]!
    const spot = n < here.spots.length ? base : { x: base.x + ((n * 7) % 13) - 6, y: base.y + ((n * 5) % 9) - 4 }
    const cls = m.fixedClass ?? (m.id === 'main' && m.location === 'tavern' ? 'guildmaster' : classOf(m))
    const look = m.fixedClass ?? (m.label === 'Sellsword' ? 'sellsword' : cls)
    const project = m.project?.color ?? '#f2b84b'
    const crest = m.lang ? LANGS[m.lang].crest : ''
    const ring = `<path d="M-6 -1h13v1h-13zM-5 0h11v1h-11z" fill="${m.team?.color ?? project}"/>`
    // Nothing written over the folk: what each is doing shows on hover, and in full when picked beside the map.
    // One that waits on the person raises a pulsing call for attention.
    // Idle: it dozes, z's drifting up over its head.
    const zzz = !m.waiting && !m.isBusy ? [0, 1, 2].map(k => `<text x="4" y="-18" font-size="${k === 2 ? 8 : 6}" font-family="monospace" font-weight="bold" fill="#e0d7ff" stroke="#1b1424" stroke-width="1.6" paint-order="stroke" opacity="0">z<animate attributeName="opacity" values="0;1;0" dur="3s" begin="${-k}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 0;6 -12" dur="3s" begin="${-k}s" repeatCount="indefinite"/></text>`).join('') : ''
    const tag = zzz + (m.waiting ? `<g><path d="M-5 -34h10v12h-3l-2 3l-2 -3h-3z" fill="#e8606f" stroke="#1b1424" stroke-width=".8"/><text x="0" y="-25" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#fff3d0">!</text><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur=".7s" repeatCount="indefinite"/></g><circle cx="0" cy="-8" r="10" fill="none" stroke="#e8606f" stroke-width="1.2"><animate attributeName="r" values="8;16;8" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite"/></circle>` : '')
    const title = `<title>${esc(`${m.project ? `${m.project.name} · ` : ''}${m.fixedClass ? m.label : CLASSES[classOf(m)].name}${crest ? ` [${crest}]` : ''}${m.team ? ` · ${m.team.name}` : ''}: ${m.waiting ? `waits on you: ${m.waiting}` : m.activity}`)}</title>`
    const still = memberSprite(look, 0), step1 = memberSprite(look, 1), step2 = memberSprite(look, 2)
    const fade = m.isDim ? ' opacity=".4"' : ''
    // Walking: from where it was, along the roads, to its spot; started as long ago as it moved.
    const elapsed = m.movedAt && now ? (now - m.movedAt) / 1000 : Infinity
    const path = m.from && m.from !== m.location ? route(m.from, m.location, spot) : []
    const dur = path.length ? length(path) / WALK_SPEED : 0
    if (path.length && elapsed < dur) {
      const d = `M${path.map(p => `${r1(p.x)} ${r1(p.y)}`).join('L')}`
      people.push({ y: spot.y, svg: `<g${fade} color="${project}">${title}<g>${ring}<use href="#${step1}"><animate attributeName="href" values="#${step1};#${step2}" dur=".35s" calcMode="discrete" repeatCount="indefinite"/></use>${tag}<animateMotion dur="${r1(dur)}s" begin="${r1(-elapsed)}s" fill="freeze" path="${d}"/></g></g>` })
      continue
    }
    const bob = m.isBusy ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur=".5s" repeatCount="indefinite"/>` : ''
    people.push({ y: spot.y, svg: `<g transform="translate(${spot.x} ${spot.y})"${fade} color="${project}">${title}${ring}<g>${bob}<use href="#${still}"/></g>${tag}${m.team ? `<path d="M-8 -22v9" stroke="#3a2414" stroke-width="1"/><path d="M-7 -22h4v3h-4z" fill="${m.team.color}"/>` : ''}</g>` })
  }
  people.sort((a, b) => a.y - b.y)
  scene.push(...people.map(p => p.svg))
  if (night) scene.push(nightLights())

  // Name plates over each place; busy ones lit in their colour, the inspected one in gold.
  const plates: string[] = []
  for (const loc of Object.keys(PLACES) as GuildLocation[]) {
    const { tag } = PLACES[loc]
    const name = NAMES[loc], w = name.length * 5.2 + 12, x = tag.x - w / 2
    const waits = party.some(m => m.location === loc && m.waiting && !m.isDim)
    const edge = waits ? '#e8606f' : opts.selected === loc ? '#f2b84b' : busyAt(loc) ? PLACE_COLOR[loc] : '#3d2f4c'
    const here = party.filter(m => m.location === loc && !m.isDim).length
    plates.push(`<g><title>${esc(`${LOCATIONS[loc].name} · ${here} here\n${PLACE_INFO[loc].blurb}`)}</title><path d="M${r1(x - 1)} ${tag.y - 7}h${r1(w + 2)}v14h${-r1(w + 2)}z" fill="#000"/><path d="M${r1(x)} ${tag.y - 6}h${r1(w)}v12h${-r1(w)}z" fill="${edge}"/><path d="M${r1(x + 1)} ${tag.y - 5}h${r1(w - 2)}v10h${-r1(w - 2)}z" fill="#1b1424"/><text x="${tag.x}" y="${tag.y + 2.6}" font-size="7.5" font-family="monospace" font-weight="bold" text-anchor="middle" fill="${PLACE_COLOR[loc]}">${esc(name)}</text>${waits ? `<path d="M${r1(x - 1)} ${tag.y - 7}h${r1(w + 2)}v14h${-r1(w + 2)}z" fill="none" stroke="#e8606f" stroke-width="1.5"><animate attributeName="opacity" values="1;.2;1" dur=".9s" repeatCount="indefinite"/></path><path d="M${r1(x + 4)} ${tag.y + 8}h${r1(w - 8)}v8h${-r1(w - 8)}z" fill="#e8606f"/><text x="${tag.x}" y="${tag.y + 14}" font-size="5.5" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#fff3d0">AWAITS YOU</text>` : ''}${here ? `<path d="M${r1(x + w - 4)} ${tag.y - 10}h9v8h-9z" fill="${PLACE_COLOR[loc]}"/><text x="${r1(x + w + 0.5)}" y="${tag.y - 3.6}" font-size="6" font-family="monospace" font-weight="bold" text-anchor="middle" fill="#1b1424">${here}</text>` : ''}</g>`)
  }
  // Teams in the field fly their banners along the shore.
  const flying = new Map<string, { color: string; n: number }>()
  for (const m of party) if (m.team && !m.isDim) flying.set(m.team.name, { color: m.team.color, n: (flying.get(m.team.name)?.n ?? 0) + 1 })
  let fx = 12
  for (const [name, t] of flying) {
    const label = `${name} ×${t.n}`, w = label.length * 4.4 + 10
    plates.push(`<path d="M${fx} 316V296" stroke="#3a2414" stroke-width="1.2"/><path d="M${fx + 1} 296h${r1(w)}l-4 5l4 5h${-r1(w)}z" fill="${t.color}" stroke="#1b1424" stroke-width=".7"/><text x="${fx + 4}" y="303.4" font-size="6" font-family="monospace" font-weight="bold" fill="#1b1424">${esc(label)}</text>`)
    fx += w + 10
  }

  const lamp = (id: string, c: string) => `<radialGradient id="lamp-${id}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
  const defs = [
    ...[...art.entries()].map(([id, body]) => `<g id="${id}">${body}</g>`),
    ...(Object.keys(PLACES) as GuildLocation[]).map(loc => `<radialGradient id="busy-${loc}"><stop offset="0" stop-color="${PLACE_COLOR[loc]}" stop-opacity=".45"/><stop offset="1" stop-color="${PLACE_COLOR[loc]}" stop-opacity="0"/></radialGradient>`),
    lamp('warm', '#ffd27a'), lamp('fire', '#ff8a3a'), lamp('arcane', '#a593ff'),
    `<radialGradient id="vignette" r=".75"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>`,
  ]
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" shape-rendering="crispEdges">`,
    `<defs>${defs.join('')}</defs>`,
    `<image href="${WORLD_ART}" width="${W}" height="${H}" style="image-rendering:pixelated"/>`,
    ...scene,
    ...plates,
    `<rect width="${W}" height="${H}" fill="url(#vignette)" pointer-events="none"/>`,
    `</svg>`,
  ].join('')
  // The surface takes at most 131072 characters: a crowded realm gives up its ambient life first.
  return svg.length > 130000 ? svg.replace(life, '') : svg
}

export function describeMap(party: GuildMember[], dungeon: GuildDungeon): string {
  const where = party.map(m => `${m.project ? `${m.project.name}: ` : ''}${CLASSES[classOf(m)].name} in the ${LOCATIONS[m.location].name}, ${m.activity}`)
  const d = dungeon.hasRun ? `The Dungeon holds ${dungeon.monsters} failing tests; ${dungeon.slain} have passed.` : 'No tests have run yet.'
  return `The guild realm: a town in the west, the Wizard's tower in the forest, the Armory in the snowy mountains, the Alchemist's swamp and the Dungeon on the cliffs. ${where.join('. ')}. ${d}`
}
