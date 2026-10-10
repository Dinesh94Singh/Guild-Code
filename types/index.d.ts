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
  /** Where the member was before its latest move, and when it moved: the map walks it along the roads. */
  from?: GuildLocation
  movedAt?: number
  /** Set while the member waits on the person: a permission to grant, a question to answer, a prompt to give. */
  waiting?: string
  /** Set while drawing every workspace on one map: whose party this member belongs to. */
  project?: GuildProject
  /** Set while drawing: another workspace is highlighted, so this member is drawn faint. */
  isDim?: boolean
}

export type GuildProject = { name: string; color: string }

export type GuildTeam = { name: string; color: string }

export type GuildSendMode = 'petition' | 'seal'

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
  /** Its latest deeds, for the Guild Hall page's chronicle. */
  chronicle?: GuildEntry[]
}

/** A quest the Guild Hall page sends to a session: drafted into its prompt box, or sealed and sent. */
export type GuildPetition = {
  /** The session it goes to: its realm id. */
  realm: string
  title: string
  text: string
  mode: GuildSendMode
  /** Sent as the person's own words (a quest scroll), not as a decree. */
  asUser?: boolean
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
      teams: number
      /** The Guild Hall page this session serves, once its server is up; '' before. */
      hall: string
    }
  }
}
