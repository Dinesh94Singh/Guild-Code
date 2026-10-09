export type GuildLocation = 'tavern' | 'study' | 'dungeon' | 'armory' | 'cauldron'
export type GuildClass = 'guildmaster' | 'wizard' | 'rogue' | 'dwarf' | 'alchemist'
export type GuildLang = 'javascript' | 'python' | 'java' | 'cpp' | 'rust'
export type GuildOutcome = 'running' | 'ok' | 'fail'

/** One loop at work: the main loop, or a subagent. */
export type GuildMember = {
  id: string
  label: string
  /** Set for the guild's own subagent classes; else the room's resident class is shown. */
  fixedClass?: GuildClass
  location: GuildLocation
  activity: string
  lang?: GuildLang
  isBusy: boolean
}

export type GuildEntry = {
  id: string
  at: number
  who: string
  cls: GuildClass
  location: GuildLocation
  text: string
  lang?: GuildLang
  outcome: GuildOutcome
}

export type GuildDungeon = {
  monsters: number
  slain: number
  lastCommand?: string
  framework?: string
  lang?: GuildLang
  isCleared: boolean
  hasRun: boolean
}

export type GuildQuest = { id: string; title: string; isDone: boolean }

export type GuildXp = Record<GuildClass, number>

declare module 'claude-code' {
  interface PluginState {
    'guild-code': {
      party: GuildMember[]
      chronicle: GuildEntry[]
      dungeon: GuildDungeon
      quests: GuildQuest[]
      xp: GuildXp
    }
  }
}
