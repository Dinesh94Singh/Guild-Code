// The pane's side column, drawn in the realm's own pixel art: the Guildmaster's Desk and the
// mana flasks. The pressable parts (the quest scroll's field, the decrees) are the surface's
// own elements under these pictures, since a picture cannot be pressed.
import type { GuildClass, GuildQuota, GuildSendMode } from '../types'
import { CLASSES, SUMMONS } from './lore'
import { Recorder, member } from './pixelart.js'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
const FONT = `font-family="monospace" font-weight="bold"`

function parchment(w: number, h: number): string {
  return `<path d="M3 0h${w - 6}v3h3v${h - 6}h-3v3h${-(w - 6)}v-3h-3v${-(h - 6)}h3z" fill="#1b1424"/>` +
    `<path d="M4 2h${w - 8}v2h2v${h - 8}h-2v2h${-(w - 8)}v-2h-2v${-(h - 8)}h2z" fill="#e9d6a8"/>` +
    `<path d="M6 4h${w - 12}v${h - 8}h${-(w - 12)}z" fill="#efe0b8"/>` +
    `<path d="M6 ${h - 7}h${w - 12}v3h${-(w - 12)}z" fill="#d9c08f"/>`
}
function banner(w: number, text: string, color = '#b8323f'): string {
  const bw = text.length * 6 + 24, x = (w - bw) / 2
  return `<path d="M${x - 6} 6h8v12h-8l3 -6z" fill="#6a1a22"/><path d="M${x + bw - 2} 6h8l-3 6l3 6h-8z" fill="#6a1a22"/>` +
    `<path d="M${x} 2h${bw}v14h${-bw}z" fill="#1b1424"/><path d="M${x + 1} 3h${bw - 2}v12h${-(bw - 2)}z" fill="${color}"/>` +
    `<text x="${w / 2}" y="12.5" font-size="8" ${FONT} text-anchor="middle" fill="#fff3d0">${esc(text)}</text>`
}

const portraits = new Map<string, string>()
function portrait(cls: GuildClass): string {
  let svg = portraits.get(cls)
  if (!svg) { const r = new Recorder(); member(r, cls, 0); svg = r.toSvg(); portraits.set(cls, svg) }
  return svg
}

/** The desk: who the quest scroll summons, and whether quests go as petitions or sealed. */
export function deskArt(summon: GuildClass, mode: GuildSendMode, openQuests: number): string {
  const w = 240, h = 112
  const SHORT: Record<GuildClass, string> = { guildmaster: 'MASTER', wizard: 'WIZARD', rogue: 'ROGUE', dwarf: 'DWARF', alchemist: 'ALCHEMIST' }
  const roster = Object.keys(CLASSES) as GuildClass[]
  const cells = roster.map((c, i) => {
    const x = 16 + i * 44, picked = c === summon
    return `<g transform="translate(${x} 26)">` +
      (picked ? `<path d="M-4 30h28v4h-28z" fill="#f2b84b"/><path d="M-3 -3h26v33h-26z" fill="#f2b84b" opacity=".25"><animate attributeName="opacity" values=".25;.45;.25" dur="1.6s" repeatCount="indefinite"/></path>` : `<path d="M-2 30h24v3h-24z" fill="#b9a77e"/>`) +
      `<g transform="translate(1 2) scale(1.5)"${picked ? '' : ' opacity=".55"'}>${portrait(c)}</g>` +
      `<text x="10" y="44" font-size="6" ${FONT} text-anchor="middle" fill="${picked ? '#6a1a22' : '#8a6a44'}">${SHORT[c]}</text></g>`
  }).join('')
  const sealed = mode === 'seal'
  const seal = `<g transform="translate(${w - 30} ${h - 30})"><circle cx="10" cy="10" r="10" fill="#1b1424"/><circle cx="10" cy="10" r="9" fill="${sealed ? '#b8323f' : '#8a6a44'}"/><circle cx="10" cy="10" r="6" fill="none" stroke="${sealed ? '#e8606f' : '#b9a77e'}" stroke-width="1"/><text x="10" y="13" font-size="8" ${FONT} text-anchor="middle" fill="#fff3d0">${sealed ? '⚜' : '✎'}</text></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges">` +
    parchment(w, h) + banner(w, "GUILDMASTER'S DESK") + cells +
    `<text x="12" y="${h - 14}" font-size="6.5" ${FONT} fill="#5a3720">${esc(clip(`${CLASSES[summon].name}: ${SUMMONS[summon]}`, 40))}</text>` +
    `<text x="12" y="${h - 6}" font-size="6" ${FONT} fill="#8a6a44">${sealed ? 'SEALED: QUESTS GO AT ONCE' : 'PETITIONS: YOU SEND EACH'} · ${openQuests} ON BOARD</text>` +
    seal + `</svg>`
}

/** Mana: each rate-limit window a flask, filled with what is left of it. */
export function manaArt(quota: GuildQuota[], now: number): string {
  const shown = quota.slice(0, 4)
  const w = 240, h = 120
  const until = (iso?: string) => {
    const at = iso ? Date.parse(iso) : NaN
    if (!Number.isFinite(at) || !now) return ''
    const mins = Math.max(0, Math.round((at - now) / 60000)), d = Math.floor(mins / 1440), hr = Math.floor((mins % 1440) / 60)
    return d ? `${d}d ${hr}h` : `${hr}h ${mins % 60}m`
  }
  const flask = (q: GuildQuota | undefined, i: number, n: number) => {
    const slot = (w - 24) / n, cx = 12 + slot * i + slot / 2
    const left = q ? Math.max(0, Math.min(100, q.percentLeft)) : 0
    const color = !q ? '#6a6478' : left < 20 ? '#e8606f' : left < 50 ? '#f2b84b' : '#5fd3f3'
    const top = 34, body = 40, fill = Math.round(body * left / 100)
    const label = q ? clip(q.label.replace('window', '').trim().toUpperCase(), 12) : 'NO READING'
    return `<g transform="translate(${cx} 0)">` +
      `<path d="M-4 ${top - 12}h8v4h-8z" fill="#8a5a34"/><path d="M-3 ${top - 8}h6v8h-6z" fill="#1b1424"/><path d="M-2 ${top - 8}h4v8h-4z" fill="#c9d4e4" opacity=".6"/>` +
      `<path d="M-14 ${top}h28v${body}h-28z" fill="#1b1424"/><path d="M-13 ${top + 1}h26v${body - 2}h-26z" fill="#2a2236"/>` +
      (fill > 0 ? `<path d="M-13 ${top + body - 1 - fill}h26v${fill}h-26z" fill="${color}"/><path d="M-13 ${top + body - 1 - fill}h26v2h-26z" fill="#fff" opacity=".35"/>` : '') +
      (fill > 4 ? [0, 1].map(k => `<rect x="${-6 + k * 8}" y="${top + body - 4}" width="2" height="2" fill="#fff" opacity=".7"><animate attributeName="y" values="${top + body - 4};${top + body - fill}" dur="${1.8 + k * 0.5}s" begin="${-k}s" repeatCount="indefinite"/></rect>`).join('') : '') +
      `<path d="M-11 ${top + 3}h2v${body - 8}h-2z" fill="#fff" opacity=".25"/>` +
      `<text x="0" y="${top + body + 11}" font-size="9" ${FONT} text-anchor="middle" fill="${color}">${q ? `${Math.round(left)}%` : '?'}</text>` +
      `<text x="0" y="${top + body + 19}" font-size="5.5" ${FONT} text-anchor="middle" fill="#a898b6">${esc(label)}</text>` +
      (q?.resetsAt ? `<text x="0" y="${top + body + 26}" font-size="5" ${FONT} text-anchor="middle" fill="#6a6478">↻ ${esc(until(q.resetsAt))}</text>` : '') +
      `</g>`
  }
  const flasks = shown.length ? shown.map((q, i) => flask(q, i, shown.length)).join('') : flask(undefined, 0, 1)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges">` +
    `<path d="M0 0h${w}v${h}h${-w}z" fill="#1a1422"/><path d="M1 1h${w - 2}v${h - 2}h${-(w - 2)}z" fill="none" stroke="#3d2f4c" stroke-width="2"/>` +
    banner(w, 'MANA', '#3b5fa8') + flasks +
    (shown.length ? '' : `<text x="${w / 2}" y="${h - 10}" font-size="6" ${FONT} text-anchor="middle" fill="#a898b6">READ FROM YOUR ACCOUNT AFTER CLAUDE'S FIRST REPLY</text>`) +
    `</svg>`
}

const PLACE_ROWS: [string, string, string, string][] = [
  ['TAVERN', '#f2b84b', 'Your prompts arrive as quests; subagents are hired at its door.', 'prompts · Agent · tasks'],
  ["WIZARD'S STUDY", '#a593ff', 'Reading, searching and research.', 'Read · Grep · Glob · WebFetch'],
  ['ARMORY', '#a9b6c6', 'Edits are forged; linters and formatters hammer them true.', 'Edit · Write · lint · format · diff'],
  ['CAULDRON', '#84d488', 'Builds, installs, bundlers and containers bubble here.', 'install · build · cmake · docker'],
  ['DUNGEON', '#e8606f', 'Test runs. Failing tests crawl out as monsters.', 'cargo test · pytest · jest · ctest'],
]
/** The legend: what each place is for, and what the marks on the map mean. */
export function legendArt(): string {
  const w = 300, rowH = 22, top = 24, h = top + PLACE_ROWS.length * rowH + 118
  const rows = PLACE_ROWS.map(([name, color, blurb, tools], i) => {
    const y = top + i * rowH
    return `<path d="M10 ${y}h6v14h-6z" fill="${color}"/><text x="22" y="${y + 6}" font-size="7" ${FONT} fill="${color}">${esc(name)}</text>` +
      `<text x="22" y="${y + 13}" font-size="5.5" font-family="monospace" fill="#efe6d2">${esc(blurb)}</text>` +
      `<text x="${w - 10}" y="${y + 6}" font-size="5" font-family="monospace" text-anchor="end" fill="#a898b6">${esc(tools)}</text>`
  }).join('')
  const y0 = top + PLACE_ROWS.length * rowH + 6
  const classes: [GuildClass, string][] = [['guildmaster', 'the main loop'], ['wizard', 'researches'], ['rogue', 'hunts bugs'], ['dwarf', 'lints, tidies'], ['alchemist', 'builds']]
  const people = classes.map(([c, role], i) => `<g transform="translate(${16 + i * 56} ${y0})"><g transform="translate(14 0)">${portrait(c)}</g><text x="20" y="25" font-size="6" ${FONT} text-anchor="middle" fill="#f3e6c0">${esc(CLASSES[c].name.toUpperCase())}</text><text x="20" y="32" font-size="5" font-family="monospace" text-anchor="middle" fill="#a898b6">${esc(role)}</text></g>`).join('')
  const y1 = y0 + 44
  const sym = (i: number, art: string, label: string) => { const x = 12 + (i % 3) * 96, y = y1 + Math.floor(i / 3) * 22; return `<g transform="translate(${x} ${y})">${art}<text x="18" y="9" font-size="5.5" font-family="monospace" fill="#efe6d2">${esc(label)}</text></g>` }
  const marks = [
    sym(0, `<path d="M2 3h8v6h-8z" fill="#d1495b"/><path d="M3 2h6v1h-6z" fill="#d1495b"/><rect x="4" y="4" width="1" height="1" fill="#fff"/><rect x="7" y="4" width="1" height="1" fill="#fff"/>`, 'a failing test'),
    sym(1, `<path d="M1 3h12v8h-12z" fill="#8a5a34"/><path d="M1 6h12v1h-12z" fill="#ffd27a"/>`, 'chest: all tests pass'),
    sym(2, `<path d="M2 0h10v10h-3l-2 3l-2 -3h-3z" fill="#e8606f"/><text x="7" y="8" font-size="8" ${FONT} text-anchor="middle" fill="#fff3d0">!</text>`, 'waits on you'),
    sym(3, `<path d="M1 0v12" stroke="#3a2414"/><path d="M2 0h9l-3 3l3 3h-9z" fill="#e0a030"/>`, 'a team of subagents'),
    sym(4, `<path d="M0 6h14" stroke="#a593ff" stroke-width="2" stroke-dasharray="2 2"/>`, 'road to work under way'),
    sym(5, `<path d="M0 3h14v6h-14z" fill="#1b1424"/><path d="M1 4h12v4h-12z" fill="#f2b84b" opacity=".5"/>`, 'a busy place glows'),
  ].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges">` +
    `<path d="M0 0h${w}v${h}h${-w}z" fill="#1a1422"/><path d="M1 1h${w - 2}v${h - 2}h${-(w - 2)}z" fill="none" stroke="#3d2f4c" stroke-width="2"/>` +
    banner(w, 'LEGEND OF THE REALM', '#8a5a34') + rows + people + marks + `</svg>`
}

/** The call for attention: who waits on the person, and for what. */
export function alertArt(waiting: { who: string; where: string; what: string }[]): string {
  const w = 240, h = 26 + waiting.length * 18
  const rows = waiting.slice(0, 4).map((x, i) => {
    const y = 24 + i * 18
    return `<text x="12" y="${y}" font-size="6.5" ${FONT} fill="#fff3d0">${esc(clip(`${x.who} at the ${x.where}`, 44))}</text><text x="12" y="${y + 8}" font-size="5.5" font-family="monospace" fill="#ffd6d6">${esc(clip(x.what, 56))}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" shape-rendering="crispEdges">` +
    `<path d="M0 0h${w}v${h}h${-w}z" fill="#6a1a22"/><path d="M1 1h${w - 2}v${h - 2}h${-(w - 2)}z" fill="none" stroke="#e8606f" stroke-width="2"><animate attributeName="stroke-opacity" values="1;.3;1" dur="1s" repeatCount="indefinite"/></path>` +
    `<text x="12" y="12" font-size="8" ${FONT} fill="#ffd27a">! ${waiting.length === 1 ? 'AN AGENT AWAITS YOUR WORD' : `${waiting.length} AGENTS AWAIT YOUR WORD`}</text>` + rows + `</svg>`
}
