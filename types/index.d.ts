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
  /** Set when two or more subagents are out at once: they march as one team. */
  team?: GuildTeam
  /** Set while drawing every workspace on one map: whose party this member belongs to. */
  project?: GuildProject
  /** Set while drawing: another workspace is highlighted, so this member is drawn faint. */
  isDim?: boolean
}

export type GuildProject = { name: string; color: string }

export type GuildTeam = { name: string; color: string }

/** One rate-limit window as the engine reports it, turned into what is left. */
export type GuildQuota = {
  kind: string
  label: string
  /** 0 to 100: how much of the window is still available. */
  percentLeft: number
  resetsAt?: string
}

/** Another workspace's guild, as its own session last published it to the shared store. */
export type GuildRealm = {
  id: string
  name: string
  updatedAt: number
  party: GuildMember[]
  dungeon: GuildDungeon
  quests: GuildQuest[]
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
      quota: GuildQuota[]
      realms: GuildRealm[]
      /** The workspace highlighted on the shared map: '' for none (all alike), 'self' for this one, else another's id. */
      viewing: string
      /** The place the inspector shows, or '' for none. */
      selected: GuildLocation | ''
      teams: number
    }
  }
}
