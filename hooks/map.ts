// The guild hall drawn as one SVG, for the surfaces that draw pictures
// (desktop, VS Code, mobile). The terminal gets a text map instead.
import type { GuildDungeon, GuildLocation, GuildMember, GuildQuest } from '../types'
import { CLASSES, LANGS, LOCATIONS, classOf } from './lore'

const W = 640
const H = 372

const ROOMS: Record<GuildLocation, { x: number; y: number; w: number; h: number }> = {
  study: { x: 16, y: 16, w: 196, h: 150 },
  armory: { x: 428, y: 16, w: 196, h: 150 },
  tavern: { x: 222, y: 108, w: 196, h: 156 },
  dungeon: { x: 16, y: 206, w: 196, h: 150 },
  cauldron: { x: 428, y: 206, w: 196, h: 150 },
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function drawMap(party: GuildMember[], dungeon: GuildDungeon, quests: GuildQuest[]): string {
  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Georgia, 'Times New Roman', serif">`,
    `<defs>`,
    `<pattern id="stone" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#2a2420"/><path d="M0 0H24M0 6H24M12 0V6M0 6V12M24 6V12" stroke="#1d1916" stroke-width="1"/></pattern>`,
    `<radialGradient id="torch" r="0.6"><stop offset="0" stop-color="#ffb347" stop-opacity="0.35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" rx="10" fill="url(#stone)"/>`,
  )

  // Corridors from the tavern to each room.
  const t = ROOMS.tavern
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  for (const loc of ['study', 'armory', 'dungeon', 'cauldron'] as const) {
    const r = ROOMS[loc]
    const busy = party.some(m => m.location === loc && m.isBusy)
    out.push(
      `<line x1="${cx}" y1="${cy}" x2="${r.x + r.w / 2}" y2="${r.y + r.h / 2}" stroke="${busy ? '#e0b04a' : '#5a4a3a'}" stroke-width="${busy ? 4 : 3}" stroke-dasharray="6 6" stroke-linecap="round">` +
        (busy ? `<animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite"/>` : '') +
        `</line>`,
    )
  }

  for (const loc of ['study', 'armory', 'dungeon', 'cauldron', 'tavern'] as const) {
    const r = ROOMS[loc]
    const info = LOCATIONS[loc]
    const here = party.filter(m => m.location === loc)
    const busy = here.some(m => m.isBusy)
    out.push(`<g>`)
    out.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="#f1e2bd" stroke="${busy ? info.color : '#6b5536'}" stroke-width="${busy ? 4 : 2}">` +
        (busy ? `<animate attributeName="stroke-opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite"/>` : '') +
        `</rect>`,
    )
    if (busy) out.push(`<circle cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="${r.w / 2}" fill="url(#torch)"/>`)
    out.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="26" rx="8" fill="${info.color}"/>`,
      `<rect x="${r.x}" y="${r.y + 16}" width="${r.w}" height="10" fill="${info.color}"/>`,
      `<text x="${r.x + 10}" y="${r.y + 18}" font-size="13" font-weight="bold" fill="#fff8e7">${info.icon} ${esc(info.name)}</text>`,
    )

    if (loc === 'dungeon') {
      const skulls = Math.min(dungeon.monsters, 8)
      const label = !dungeon.hasRun
        ? 'Unexplored'
        : dungeon.monsters > 0
          ? `${dungeon.monsters} monster${dungeon.monsters === 1 ? '' : 's'} lurk`
          : 'Cleared ✨'
      out.push(`<text x="${r.x + 10}" y="${r.y + r.h - 12}" font-size="11" fill="#5b1a12">${esc(label)} · ${dungeon.slain} slain</text>`)
      for (let i = 0; i < skulls; i += 1) {
        out.push(`<text x="${r.x + r.w - 22 - i * 18}" y="${r.y + 46}" font-size="15">💀</text>`)
      }
    }
    if (loc === 'tavern') {
      const open = quests.filter(q => !q.isDone).length
      const done = quests.length - open
      out.push(`<text x="${r.x + 10}" y="${r.y + r.h - 12}" font-size="11" fill="#5a3a12">📜 ${open} open · ${done} done</text>`)
    }

    // The party members in this room, side by side.
    here.slice(0, 3).forEach((m, i) => {
      const cls = classOf(m)
      const px = r.x + 30 + i * 62
      const py = r.y + 68
      out.push(
        `<circle cx="${px}" cy="${py}" r="20" fill="#fff8e7" stroke="${m.isBusy ? info.color : '#8a7350'}" stroke-width="3"/>`,
        `<text x="${px}" y="${py + 7}" font-size="20" text-anchor="middle">${CLASSES[cls].icon}</text>`,
      )
      if (m.isBusy) {
        out.push(`<circle cx="${px}" cy="${py}" r="20" fill="none" stroke="${info.color}" stroke-width="2"><animate attributeName="r" values="20;27;20" dur="1.4s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.9;0;0.9" dur="1.4s" repeatCount="indefinite"/></circle>`)
      }
      if (m.lang) {
        out.push(
          `<rect x="${px + 8}" y="${py - 26}" width="28" height="14" rx="3" fill="#3b2a1a"/>`,
          `<text x="${px + 22}" y="${py - 15}" font-size="9" font-weight="bold" text-anchor="middle" fill="#ffd27a">${esc(LANGS[m.lang].crest)}</text>`,
        )
      }
      out.push(`<text x="${px}" y="${py + 34}" font-size="10" text-anchor="middle" fill="#3b2a1a">${esc(clip(m.fixedClass ? m.label : CLASSES[cls].name, 11))}</text>`)
    })
    if (here.length > 3) {
      out.push(`<text x="${r.x + r.w - 12}" y="${r.y + 72}" font-size="11" text-anchor="end" fill="#3b2a1a">+${here.length - 3}</text>`)
    }
    const lead = here.find(m => m.isBusy) ?? here[0]
    if (lead && loc !== 'dungeon' && loc !== 'tavern') {
      out.push(`<text x="${r.x + 10}" y="${r.y + r.h - 12}" font-size="10" fill="#3b2a1a">${esc(clip(lead.activity, 32))}</text>`)
    } else if (lead && (loc === 'dungeon' || loc === 'tavern')) {
      out.push(`<text x="${r.x + 10}" y="${r.y + r.h - 28}" font-size="10" fill="#3b2a1a">${esc(clip(lead.activity, 32))}</text>`)
    }
    out.push(`</g>`)
  }

  out.push(`</svg>`)
  return out.join('')
}

export function describeMap(party: GuildMember[], dungeon: GuildDungeon): string {
  const where = party.map(m => `${CLASSES[classOf(m)].name} in the ${LOCATIONS[m.location].name}: ${m.activity}`)
  const d = dungeon.hasRun ? `Dungeon: ${dungeon.monsters} failing, ${dungeon.slain} passing.` : 'Dungeon unexplored.'
  return `Guild hall map. ${where.join('. ')}. ${d}`
}
