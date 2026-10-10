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

/** What each place is for, shown when it is inspected. */
export const PLACE_INFO: Record<GuildLocation, { blurb: string; tools: string }> = {
  tavern: { blurb: 'Prompts arrive as quests. Subagents are hired at the door and come back with their spoils; the task list hangs on the board.', tools: 'prompts · Agent · TaskCreate · TaskUpdate · TodoWrite' },
  study: { blurb: 'Reading, searching and research.', tools: 'Read · Grep · Glob · WebFetch · WebSearch · git log · ls' },
  dungeon: { blurb: 'Test runs. Every failing test is a monster; passing tests are monsters slain.', tools: 'cargo test · pytest · jest · vitest · mvn test · ctest · …' },
  armory: { blurb: 'Edits are forged here; linters, formatters and type checkers hammer them true.', tools: 'Edit · Write · eslint · ruff · clippy · tsc · git diff · …' },
  cauldron: { blurb: 'Builds, installs, bundlers, compilers and containers.', tools: 'npm install · cargo build · uv sync · cmake · docker · …' },
}

/** What each class is summoned for from the quest scroll. */
export const SUMMONS: Record<GuildClass, string> = {
  guildmaster: 'the main loop decides',
  wizard: 'research and reading',
  rogue: 'failing tests and bugs',
  dwarf: 'formatting, linting and types',
  alchemist: 'builds and dependencies',
}

/** A quest from the scroll: the person's words, and the guild class to send on it. */
export function questText(text: string, summon: GuildClass): string {
  const quest = text.trim()
  if (summon === 'guildmaster') return quest
  return `${quest}\n\nSend the guild-code:${summon} subagent (the ${CLASSES[summon].name}) on this quest.`
}

/** Each workspace's colour on the shared map: this one first, the others in name order. */
export const PROJECT_COLORS = ['#ff8a5c', '#5fd3f3', '#f7dd5b', '#c9f27a', '#ff7ad9', '#a593ff']

/** Teams form when two or more subagents are out at once; each takes the next name. */
export const TEAMS: { name: string; color: string }[] = [
  { name: 'Vanguard', color: '#e0a030' },
  { name: 'Lantern Company', color: '#2aa198' },
  { name: 'Iron Wardens', color: '#d1495b' },
  { name: 'Night Watch', color: '#6c5ce7' },
  { name: 'Silver Hand', color: '#7f8c8d' },
  { name: 'Ember Guard', color: '#e67e22' },
]

const WINDOWS: Record<string, string> = { five_hour: '5-hour window', seven_day: 'Weekly', spend_limit: 'Spend limit' }
const MODEL_NAMES: Record<string, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable' }

/** A readable name for a rate-limit window: `seven_day_opus` reads "Weekly · Opus". */
export function windowLabel(kind: string): string {
  const base = Object.keys(WINDOWS).find(k => kind === k || kind.startsWith(`${k}_`))
  const model = Object.keys(MODEL_NAMES).find(m => kind.includes(m))
  const head = base ? (WINDOWS[base] ?? base) : kind.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  return model ? `${head} · ${MODEL_NAMES[model]}` : head
}
