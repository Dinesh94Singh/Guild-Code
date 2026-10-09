import type { GuildClass, GuildLang, GuildLocation } from '../types'

export const LOCATIONS: Record<
  GuildLocation,
  { name: string; icon: string; resident: GuildClass; verb: string; color: string }
> = {
  tavern: { name: 'Tavern Board', icon: '📜', resident: 'guildmaster', verb: 'posts at the board', color: '#c8893b' },
  study: { name: "Wizard's Study", icon: '📚', resident: 'wizard', verb: 'studies', color: '#6c5ce7' },
  dungeon: { name: 'Dungeon', icon: '💀', resident: 'rogue', verb: 'delves', color: '#c0392b' },
  armory: { name: 'Armory', icon: '🛡️', resident: 'dwarf', verb: 'forges', color: '#7f8c8d' },
  cauldron: { name: "Alchemist's Cauldron", icon: '⚗️', resident: 'alchemist', verb: 'brews', color: '#27ae60' },
}

export const CLASSES: Record<GuildClass, { name: string; icon: string }> = {
  guildmaster: { name: 'Guildmaster', icon: '👑' },
  wizard: { name: 'Wizard', icon: '🧙' },
  rogue: { name: 'Rogue', icon: '🗡️' },
  dwarf: { name: 'Dwarf', icon: '⚒️' },
  alchemist: { name: 'Alchemist', icon: '🧪' },
}

export const LANGS: Record<GuildLang, { name: string; crest: string }> = {
  javascript: { name: 'JavaScript', crest: 'JS' },
  python: { name: 'Python', crest: 'PY' },
  java: { name: 'Java', crest: 'JV' },
  cpp: { name: 'C++', crest: 'C++' },
  rust: { name: 'Rust', crest: 'RS' },
}

export const ORDER: GuildLocation[] = ['study', 'armory', 'tavern', 'dungeon', 'cauldron']

/** The subagent types this mod ships, by the class they play. */
export function classOfAgentType(type: string): GuildClass | undefined {
  const name = type.replace(/^guild-code:/, '')
  if (name === 'wizard' || name === 'rogue' || name === 'dwarf' || name === 'alchemist') return name
  return undefined
}

export function classOf(member: { fixedClass?: GuildClass; location: GuildLocation }): GuildClass {
  return member.fixedClass ?? LOCATIONS[member.location].resident
}
