// Guild Code: a medieval guild hall drawn over Claude's real work.
//
// Every tool call is placed in one room of the hall (see classify.ts):
//   Tavern Board          prompts, subagent dispatch, tasks
//   Wizard's Study        reading files, searching, docs and web
//   Dungeon               running tests; failing tests are monsters
//   Armory                edits, lint, format, diffs
//   Alchemist's Cauldron  builds, installs, bundlers, containers
// The main loop and each subagent are party members who walk between rooms;
// subagents out at the same time march as one team.
//
// Every session publishes its guild to the plugin's store (one JSON file shared by all
// sessions), so the pane can show every workspace open on this machine, and it reads
// the account's rate-limit windows from the engine as the guild's mana.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { GuildClass, GuildDungeon, GuildEntry, GuildMember, GuildOutcome, GuildPetition, GuildQuest, GuildQuota, GuildRealm, GuildSendMode, GuildXp } from '../types'
import { classifyTool, readBattle } from './classify'
import type { Placement } from './classify'
import { CLASSES, LANGS, LOCATIONS, ORDER, PROJECT_COLORS, TEAMS, classOf, classOfAgentType, windowLabel } from './lore'
import { describeMap, drawMap } from './map'
import { CATALOG, DEED_NAMES, NEW_TREASURY, REFUSALS, closeQuest, earn, isShopOrder, rankOf, trade, treasuryOf } from './treasury'
import type { Deed, ShopOrder, Treasury } from './treasury'
import { SEASONS, seasonOf } from './seasons'

const PANE = 'guild-hall'
const MAIN = 'main'
const CHRONICLE_MAX = 60

const NO_XP: GuildXp = { guildmaster: 0, wizard: 0, rogue: 0, dwarf: 0, alchemist: 0 }
const NEW_DUNGEON: GuildDungeon = { monsters: 0, slain: 0, isCleared: false, hasRun: false }
const GUILDMASTER: GuildMember = {
  id: MAIN,
  label: 'Guildmaster',
  location: 'tavern',
  activity: 'rests at the tavern',
  isBusy: false,
}

const party = atom({ plugin: 'guild-code', key: 'party' } as const, [GUILDMASTER])
const chronicle = atom({ plugin: 'guild-code', key: 'chronicle' } as const, [] as GuildEntry[])
const dungeon = atom({ plugin: 'guild-code', key: 'dungeon' } as const, NEW_DUNGEON)
const quests = atom({ plugin: 'guild-code', key: 'quests' } as const, [] as GuildQuest[])
const xp = atom({ plugin: 'guild-code', key: 'xp' } as const, NO_XP)
const quota = atom({ plugin: 'guild-code', key: 'quota' } as const, [] as GuildQuota[])
const realms = atom({ plugin: 'guild-code', key: 'realms' } as const, [] as GuildRealm[])
const teams = atom({ plugin: 'guild-code', key: 'teams' } as const, 0)
const hallUrl = atom({ plugin: 'guild-code', key: 'hall' } as const, '')
const treasury = atom({ plugin: 'guild-code', key: 'treasury' } as const, NEW_TREASURY as Treasury)
const spoiled = atom({ plugin: 'guild-code', key: 'spoiled' } as const, false)

// ───────────── the shared folder ─────────────
// Everything the sessions share lives in one folder per machine, ~/.claude/guild-code/realm:
// the purse and XP, each session's realm, the hall's live.json and its server, and the quests
// the hall files for each session. A folder, not the plugin's store, so a session sees the same
// island however it loaded the mod (installed, or from a folder with --plugin-dir).
let rootDir = ''

async function root($: EngineInterface): Promise<string> {
  if (!rootDir) {
    const { stdout } = await $.process.run(['printenv', 'HOME'])
    rootDir = `${stdout.trim()}/.claude/guild-code/realm`
  }
  return rootDir
}

/** A shared file read back: undefined when it is not there; rejects when it is there but unreadable. */
async function readShared($: EngineInterface, name: string): Promise<unknown> {
  const path = `${await root($)}/${name}`
  if (!(await $.fs.exists(path))) return undefined
  return JSON.parse(await $.fs.read(path))
}

let tmpSeq = 0
/** Write a shared file whole: written aside, then moved into place, so no one reads it half done. */
async function writeShared($: EngineInterface, name: string, body: unknown) {
  const path = `${await root($)}/${name}`
  const tmp = `${path}.${Math.random().toString(36).slice(2, 10)}-${(tmpSeq += 1)}.tmp`
  await $.fs.write(tmp, JSON.stringify(body))
  const moved = await $.process.run(['mv', '-f', tmp, path])
  if (moved.exitCode !== 0) throw new Error(`could not write ${name}`)
}

// ───────────── the treasury ─────────────
// One purse per machine, in the shared folder: each payment reads it fresh, adds to it and
// writes it back, so sessions never pay over one another for long.
const TREASURY_FILE = 'treasury.json'
const XP_FILE = 'xp.json'

async function readTreasury($: EngineInterface): Promise<Treasury> {
  const t = treasuryOf(await readShared($, TREASURY_FILE))
  await update($, treasury, cur => (JSON.stringify(cur) === JSON.stringify(t) ? cur : t))
  return t
}

async function keepTreasury($: EngineInterface, t: Treasury) {
  await writeShared($, TREASURY_FILE, t)
  await update($, treasury, () => t)
}

/** The first session on 0.4 brings the purse and XP it kept in the plugin's store into the shared folder. */
async function seedShared($: EngineInterface) {
  if ((await readShared($, TREASURY_FILE)) === undefined) await writeShared($, TREASURY_FILE, treasuryOf(await $.store.get('treasury').catch(() => undefined)))
  if ((await readShared($, XP_FILE)) === undefined) {
    const saved = (await $.store.get('xp').catch(() => undefined)) as Partial<GuildXp> | undefined
    await writeShared($, XP_FILE, { ...NO_XP, ...(saved && typeof saved === 'object' ? saved : {}) })
  }
}

/** Pay a deed into the treasury, `times` over: within the hour's cap, and the day's streak for a quest. */
async function pay($: EngineInterface, deed: Deed, times = 1) {
  if (times <= 0) return
  const at = await $.clock.now()
  const cur = await readTreasury($)
  if (deed === 'quest') {
    let t = cur
    const season = seasonOf(at)
    for (let i = 0; i < times; i++) {
      const r = closeQuest(t, at, season)
      t = r.treasury
      if (r.bonus) $.ui.toast(`👑 Day ${t.streak.count} of your streak: +${r.bonus} crowns.`)
      if (r.event && season) $.ui.toast(`👑 ${SEASONS[season].event.name} filled: +${r.event} crowns.`)
    }
    if (t !== cur) await keepTreasury($, t)
    return
  }
  const { treasury: t, paid } = earn(cur, deed, times, at, seasonOf(at))
  if (t !== cur) await keepTreasury($, t)
  if (paid > 0) {
    const before = rankOf(cur.earned), after = rankOf(t.earned)
    if (after.index > before.index) $.ui.toast(`👑 ${DEED_NAMES[deed]}: the realm grows to a ${after.name}! New wares at the merchant.`)
  }
}

/** A shop order from the Guild Hall page: buy or sell, against the purse as it stands now. */
async function shop($: EngineInterface, order: ShopOrder) {
  const cur = await readTreasury($)
  const done = trade(cur, order, seasonOf(await $.clock.now()))
  const ware = CATALOG.find(w => w.id === order.item)
  if ('refusal' in done) {
    $.ui.toast(`👑 ${ware?.name ?? 'That ware'}: ${REFUSALS[done.refusal]}`)
    return
  }
  await keepTreasury($, done.treasury)
  await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: order.action === 'buy' ? `👑 Bought ${ware!.name} for ${ware!.price} crowns` : `👑 Sold ${ware!.name} for ${Math.floor(ware!.price / 2)} crowns`, outcome: 'ok' })
}

/**
 * A quest from the Guild Hall page reaches Claude as a petition drafted into the prompt box
 * for the person to send, or, sealed, as a prompt submitted at once.
 */
async function petition($: EngineInterface, text: string, title: string, mode: GuildSendMode, asUser = false) {
  if (mode === 'seal') {
    await $.prompt.submit(asUser ? { text, asUser: true } : { text })
    $.ui.toast(`🔏 ${title}: sealed and sent.`)
    await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `🔏 Sealed: ${title}`, outcome: 'ok' })
    return
  }
  const drafted = await $.prompt.fill({ text })
  if (drafted.isFilled) {
    $.ui.toast(`📜 ${title}: the petition waits in your prompt box. Press Enter to send it.`)
    await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `📜 Petition drafted: ${title}`, outcome: 'ok' })
  } else {
    $.ui.toast(drafted.refusal === 'dialog' ? '📜 Close the open dialog, then send the quest again.' : '📜 No prompt box here to hold the petition.')
  }
}

const PUBLISH_MS = 4000
const STALE_MS = 2 * 60_000
// A session that has ended (or gone quiet) sleeps on the map until a day after its last work.
const FORGET_MS = 24 * 3600_000
// The map shows every live session, and the most recently used sleeping ones up to this many in all.
const RECENT_MAX = 5
// An open session unused this long sleeps on the map too, though it still takes quests.
const IDLE_MS = 3600_000
// Deeds older than this drop out of the chronicle the map and the page show.
const FRESH_MS = 3 * 3600_000
// How often a session looks again whether the hall's server is still there.
const SERVER_CHECK_MS = 30_000

const toQuota = (limits: readonly SessionRateLimit[]): GuildQuota[] =>
  limits.map(l => ({ kind: l.kind, label: windowLabel(l.kind), percentLeft: Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10), resetsAt: l.resetsAt }))

const HALL_PORT = 8790
// The hall's address: every *.localhost name reaches this machine, so it needs no setup.
const hallAddress = (port: number) => `http://guildmaster.localhost:${port}/`

let ticker: { cancel: () => void } | undefined
let published = ''
let publishedAt = 0
let activeAt = 0

/** This session just did real work: it counts as used, for the map's recent sessions. */
async function touch($: EngineInterface) {
  activeAt = await $.clock.now()
}

function ago(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
}

/** Only the deeds of the last few hours: an idle session's old work is no news. */
const fresh = (entries: readonly GuildEntry[] | undefined, at: number) => (entries ?? []).filter(e => at - e.at <= FRESH_MS)

/** When a realm last did real work. */
const lastUsed = (realm: GuildRealm) => (typeof realm.activeAt === 'number' ? realm.activeAt : realm.updatedAt)

/** A realm whose session has ended or gone idle: its Guildmaster sleeps at the tavern. */
function asleep(realm: GuildRealm, at: number, isClosed: boolean): GuildRealm {
  return { ...realm, isAsleep: true, isClosed, party: [{ ...GUILDMASTER, activity: `sleeps at the tavern · last active ${ago(at - lastUsed(realm))}` }] }
}

const isRealm = (r: unknown): r is GuildRealm => {
  const o = r as GuildRealm
  return !!o && typeof o === 'object' && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.updatedAt === 'number' && Array.isArray(o.party)
}

/**
 * The realms on the map, in one order every session agrees on: by name, then id. Sessions
 * open in the same folder share its name, so the later ones are numbered; each takes the
 * colour of its place in the order.
 */
function roster(list: readonly GuildRealm[]): (GuildRealm & { color: string })[] {
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const seen = new Map<string, number>()
  return sorted.map((r, i) => {
    const n = (seen.get(r.name) ?? 0) + 1
    seen.set(r.name, n)
    return { ...r, name: n > 1 ? `${r.name} #${n}` : r.name, color: PROJECT_COLORS[i % PROJECT_COLORS.length]! }
  })
}

let server: { port: number; version: string; pid: number } | undefined
let serverCheckedAt = -Infinity

/** The hall's server as server.json tells it, if its process is still there. */
async function readServer($: EngineInterface, force = false) {
  const at = await $.clock.now()
  if (!force && at - serverCheckedAt < SERVER_CHECK_MS) return server
  serverCheckedAt = at
  const s = (await readShared($, 'server.json').catch(() => undefined)) as typeof server
  const alive = !!s && typeof s.pid === 'number' && typeof s.port === 'number' && (await $.process.run(['kill', '-0', String(s.pid)]).then(r => r.exitCode === 0, () => false))
  server = alive ? s : undefined
  await update($, hallUrl, () => (server ? hallAddress(server.port) : ''))
  return server
}

/**
 * Write this session's realm to the shared folder, read every other recent one back, and
 * pick up the quests the hall filed for this session. One session (the scribe) keeps the
 * hall's live.json, takes the shop's orders and forgets old realms for everyone.
 */
async function share($: EngineInterface) {
  const id = await $.session.id()
  const cwd = await $.session.cwd()
  const at = await $.clock.now()
  const dir = await root($)
  const mine: Omit<GuildRealm, 'updatedAt'> = { id, name: cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests), chronicle: fresh(await read($, chronicle), at).slice(-20), quota: await read($, quota), activeAt: activeAt || at }
  const body = JSON.stringify(mine)
  if (body !== published || at - publishedAt > STALE_MS / 2) {
    await writeShared($, `realms/${id}.json`, { ...mine, updatedAt: at })
    published = body
    publishedAt = at
  }

  const live: GuildRealm[] = []
  const sleeping: GuildRealm[] = []
  const forgotten: string[] = []
  const open = [id]
  const entries = await $.fs.list(`${dir}/realms`).catch(() => [])
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json') || entry.name === `${id}.json`) continue
    const realm = await readShared($, `realms/${entry.name}`).catch(() => undefined)
    if (!isRealm(realm)) continue
    const isOpen = realm.endedAt === undefined && at - realm.updatedAt <= STALE_MS
    if (isOpen) open.push(realm.id)
    const idle = at - lastUsed(realm)
    const seen = { ...realm, chronicle: fresh(realm.chronicle, at) }
    if (isOpen && idle <= IDLE_MS) live.push(seen)
    else if (idle <= FORGET_MS) sleeping.push(asleep(seen, at, !isOpen))
    else if (!isOpen) forgotten.push(realm.id) // an open one keeps writing its own: it is only left off the map
  }
  // Every session at work shows; the most recently used sleeping ones fill the map up to RECENT_MAX.
  sleeping.sort((a, b) => lastUsed(b) - lastUsed(a))
  const others = [...live, ...sleeping.slice(0, Math.max(0, RECENT_MAX - 1 - live.length))]
  others.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  await update($, realms, cur => (JSON.stringify(cur) === JSON.stringify(others) ? cur : others))
  const view = { mine: { ...mine, updatedAt: at }, others, at }

  // Quests the hall filed for this session.
  for (const entry of await $.fs.list(`${dir}/inbox/${id}`).catch(() => [])) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    const p = await readShared($, `inbox/${id}/${entry.name}`).catch(() => undefined)
    await $.process.run(['rm', '-f', `${dir}/inbox/${id}/${entry.name}`])
    if (isPetition(p)) await petition($, p.text, p.title, p.mode, p.asUser)
  }

  // The scribe: the open session with the least id, the same one in every session's eyes.
  if (open.sort()[0] !== id) return view
  for (const gone of forgotten) await $.process.run(['rm', '-rf', `${dir}/realms/${gone}.json`, `${dir}/inbox/${gone}`])
  for (const entry of await $.fs.list(`${dir}/shop`).catch(() => [])) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    const order = await readShared($, `shop/${entry.name}`).catch(() => undefined)
    await $.process.run(['rm', '-f', `${dir}/shop/${entry.name}`])
    if (isShopOrder(order)) await shop($, order).catch(() => undefined)
  }
  if (await readServer($)) await writeLive($, view.mine, others, at)
  return view
}

// ───────────── the Guild Hall page ─────────────
// /guild opens the one Guild Hall on this machine, starting its server if none is running.
// The server outlives the session that started it; any open session keeps its live.json
// fresh, and the quests it posts back wait in the shared folder for their session.

const isPetition = (p: unknown): p is GuildPetition => {
  const o = p as GuildPetition
  return !!o && typeof o === 'object' && typeof o.realm === 'string' && typeof o.title === 'string' && typeof o.text === 'string' && !!o.text.trim() && (o.mode === 'seal' || o.mode === 'petition')
}

async function writeLive($: EngineInterface, mine: GuildRealm, others: GuildRealm[], at: number) {
  const list = roster([mine, ...others])
  // Mana is the account's: a session billed by API key has no windows, so the page takes the
  // freshest reading any open session has.
  const reading = [mine, ...others].filter(r => !r.isClosed).sort((a, b) => b.updatedAt - a.updatedAt).find(r => r.quota?.length)
  // The page's own session is the one at work most lately: the desk sends there unless told otherwise.
  const self = [mine, ...others].filter(r => !r.isClosed).sort((a, b) => lastUsed(b) - lastUsed(a))[0]?.id ?? mine.id
  const live = { at, self, realms: list, quota: reading?.quota ?? [], xp: await readXp($), treasury: await readTreasury($), season: seasonOf(at) }
  await writeShared($, 'live.json', live)
}

/** This build's version, which a running server must match or be replaced. */
async function version($: EngineInterface): Promise<string> {
  const manifest = JSON.parse(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: string }
  return manifest.version ?? '0'
}

/** The hall's port: the running server's, or a new one's, started in the background for every session. */
async function startHall($: EngineInterface): Promise<number> {
  const dir = await root($)
  const want = await version($)
  const running = await readServer($, true)
  if (running && running.version === want) return running.port
  // A server from another build serves another page: it makes way for this one.
  if (running) await $.process.run(['kill', String(running.pid)]).catch(() => undefined)
  const page = await $.fs.read(`${$.plugin.root}/demo/guild-hall.html`)
  // The flag that turns the dry run live goes first; the server fills in its token.
  const flag = `<script>window.GUILD_LIVE = { token: '__GUILD_TOKEN__' }</script>\n`
  const head = page.startsWith('<meta charset="utf-8">\n') ? '<meta charset="utf-8">\n'.length : 0
  await $.fs.write(`${dir}/index.html`, page.slice(0, head) + flag + page.slice(head))
  const started = await $.process.run(['python3', `${$.plugin.root}/hooks/hall-server.py`, dir, String(HALL_PORT), want], { timeoutMs: 15_000 })
  const port = (JSON.parse(started.stdout.trim().split('\n').pop() || '{}') as { ready?: number }).ready
  if (started.exitCode !== 0 || typeof port !== 'number') throw new Error(started.stderr.trim() || 'Is python3 installed?')
  await readServer($, true)
  // The scribe may be another session: write live.json now so the page has something to show at once.
  const view = await share($)
  await writeLive($, view.mine, view.others, view.at)
  return port
}

const BUILT_IN_BROWSER = 'mcp__Claude_Browser__preview_start'

/** Open the hall in the desktop app's own browser pane, where the session has one. */
async function openInBuiltInBrowser($: EngineInterface, url: string): Promise<boolean> {
  const tools = await $.tool.list().catch(() => [])
  if (!tools.some(t => t.name === BUILT_IN_BROWSER)) return false
  return $.tool.call({ tool: BUILT_IN_BROWSER, url }).then(r => !r.isError, () => false)
}

/** Open a page in the person's browser, whichever opener this system has. */
async function openInBrowser($: EngineInterface, url: string): Promise<boolean> {
  for (const argv of [['open', url], ['xdg-open', url], ['cmd', '/c', 'start', '', url]]) {
    const ok = await $.process.run(argv).then(r => r.exitCode === 0, () => false)
    if (ok) return true
  }
  return false
}

function bar(percent: number, cells = 10): string {
  const full = Math.round((Math.max(0, Math.min(100, percent)) / 100) * cells)
  return '▰'.repeat(full) + '▱'.repeat(cells - full)
}

function until(iso: string | undefined, now: number): string {
  const at = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(at)) return ''
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  return ` · resets in ${d ? `${d}d ${h}h` : `${h}h ${mins % 60}m`}`
}

let seq = 0
const nextId = (at: number) => `${at.toString(36)}-${(seq += 1)}`

async function log($: EngineInterface, entry: Omit<GuildEntry, 'id' | 'at'>): Promise<string> {
  const at = await $.clock.now().catch(() => 0)
  const id = nextId(at)
  await update($, chronicle, list => [...list, { ...entry, id, at }].slice(-CHRONICLE_MAX))
  return id
}

async function settle($: EngineInterface, id: string, outcome: GuildOutcome, text?: string) {
  await update($, chronicle, list =>
    list.map(e => (e.id === id ? { ...e, outcome, text: text ?? e.text } : e)),
  )
}

async function move($: EngineInterface, memberId: string, change: Partial<GuildMember>) {
  const at = await $.clock.now().catch(() => 0)
  await update($, party, list => list.map(m => {
    if (m.id !== memberId) return m
    // A change of place starts a walk along the roads, drawn by the map.
    const walks = change.location !== undefined && change.location !== m.location
    return { ...m, ...change, ...(walks ? { from: m.location, movedAt: at } : {}) }
  }))
}

// XP is the machine's, like the purse: each gain reads the shared file fresh, so sessions add to one another's.
async function readXp($: EngineInterface): Promise<GuildXp> {
  const saved = (await readShared($, XP_FILE)) as Partial<GuildXp> | undefined
  const total = { ...NO_XP, ...(saved && typeof saved === 'object' ? saved : {}) }
  await update($, xp, cur => (JSON.stringify(cur) === JSON.stringify(total) ? cur : total))
  return total
}

async function gainXp($: EngineInterface, cls: GuildClass, amount: number) {
  const cur = await readXp($)
  const total = { ...cur, [cls]: (cur[cls] ?? 0) + amount }
  await writeShared($, XP_FILE, total)
  await update($, xp, () => total)
}

/** A member now waits on the person: it raises its hand on the map, and the person is told. */
async function awaitPerson($: EngineInterface, memberId: string, what: string, notify: boolean) {
  const roster = await read($, party)
  const m = roster.find(one => one.id === memberId)
  if (!m || m.waiting === what) return
  await update($, party, list => list.map(one => (one.id === memberId ? { ...one, waiting: what } : one)))
  const who = m.fixedClass ? m.label : CLASSES[classOf(m)].name
  const where = LOCATIONS[m.location].name
  $.ui.toast(`❗ ${who} at the ${where} awaits your word: ${what}`)
  if (notify) void $.ui.notify(`${who} at the ${where} ${what}`, { title: '❗ The guild awaits your word' }).catch(() => undefined)
  await log($, { who, cls: classOf(m), location: m.location, text: `❗ awaits your word: ${what}`, outcome: 'running' })
}
async function answered($: EngineInterface, memberId: string) {
  await update($, party, list => (list.some(m => m.id === memberId && m.waiting) ? list.map(m => (m.id === memberId ? { ...m, waiting: undefined } : m)) : list))
}

function statusLine(m: GuildMember): string {
  const cls = CLASSES[classOf(m)]
  const crest = m.lang ? ` [${LANGS[m.lang].crest}]` : ''
  return `${cls.icon} ${cls.name} · ${LOCATIONS[m.location].name}${crest} · ${m.activity}`
}

function narrate(p: Placement, tool: string): string {
  switch (p.location) {
    case 'study':
      return tool === 'Bash' ? `consults ${p.detail}` : `reads ${p.detail}`
    case 'armory':
      return tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit'
        ? `forges ${p.detail}`
        : `hammers ${p.detail}`
    case 'dungeon':
      return `delves: ${p.detail}`
    case 'cauldron':
      return `brews ${p.detail}`
    case 'tavern':
      return tool === 'Agent' || tool === 'Task' ? `dispatches: ${p.detail}` : p.detail
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'guild', description: 'Open the Guild Hall in the browser: your party at work, live' })
    await $.command.register({ name: 'guild-map', description: 'Open the Guild Code map pane beside the conversation' })
    await $.command.register({ name: 'guild-stats', description: 'Show Guild Code XP per class, the dungeon record and the treasury' })
    await seedShared($).catch(() => undefined)
    await readXp($).catch(() => undefined)
    await readTreasury($).catch(() => undefined)
    try {
      const usage = await $.session.usage()
      await update($, quota, () => toQuota(usage.rateLimits))
    } catch {
      // No readings yet: the mana panel waits for the first response.
    }
    // An idle session used to be marked as waiting on the person; it rests now.
    await update($, party, list => (list.some(m => m.waiting === 'waits for your next quest') ? list.map(m => (m.waiting === 'waits for your next quest' ? { ...m, waiting: undefined, activity: 'rests at the tavern', isBusy: false } : m)) : list))
    // A reload or a resumed session keeps its last work time; a new one counts as used now.
    const prev = await readShared($, `realms/${await $.session.id()}.json`).catch(() => undefined)
    activeAt = isRealm(prev) && typeof prev.activeAt === 'number' ? prev.activeAt : await $.clock.now()
    published = ''
    ticker?.cancel()
    ticker = $.clock.every(PUBLISH_MS, () => void share($).catch(() => undefined))
    void share($).catch(() => undefined)
    return next(e)
  })

  // The account's rate-limit windows, pushed whenever one moves a whole point.
  on('session.measure', async ($, e, next) => {
    try {
      if (e.changed.includes('rateLimits')) await update($, quota, () => toQuota(e.rateLimits))
    } catch {
      // ignore
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    ticker?.cancel()
    try {
      // The realm stays, asleep, so the map still shows it among the recent sessions until it is forgotten.
      const name = `realms/${await $.session.id()}.json`
      const realm = await readShared($, name)
      if (isRealm(realm)) await writeShared($, name, { ...realm, activeAt: activeAt || realm.activeAt, endedAt: await $.clock.now() })
      published = ''
    } catch {
      // A quiet realm falls asleep in the others' view by itself.
    }
    return next(e)
  })

  // /guild opens the Guild Hall page and nothing else: the page is where the guild lives.
  on('command.run', { command: 'guild' }, async $ => {
    try {
      const port = await startHall($)
      const url = hallAddress(port)
      // A browser that does not resolve *.localhost still reaches it by number.
      const also = ` (also at http://127.0.0.1:${port}/)`
      if (await openInBuiltInBrowser($, url)) return { text: `🏰 The Guild Hall is open in the browser pane: ${url}${also}` }
      const opened = await openInBrowser($, url)
      return { text: opened ? `🏰 The Guild Hall is open in your browser: ${url}${also}` : `🏰 The Guild Hall is ready: open ${url}${also}` }
    } catch (err) {
      return { text: `🏰 The Guild Hall could not start: ${err instanceof Error ? err.message : String(err)}. /guild-map opens the map pane instead.` }
    }
  })

  // The map pane, for a surface without a browser (the terminal) or anyone who wants it beside the chat.
  on('command.run', { command: 'guild-map' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Guild Hall', focus: true })
    return { text: opened.isPlaced ? '🗺️ The Guild Code map is open.' : '🗺️ The map will show where this surface seats panes.' }
  })

  on('command.run', { command: 'guild-stats' }, async $ => {
    const points = await read($, xp)
    const d = await read($, dungeon)
    const rows = (Object.keys(CLASSES) as GuildClass[]).map(c => `${CLASSES[c].icon} ${CLASSES[c].name}: ${points[c] ?? 0} XP (level ${1 + Math.floor((points[c] ?? 0) / 50)})`)
    const t = await readTreasury($)
    const rank = rankOf(t.earned)
    const purse = `👑 Treasury: ${t.crowns} crowns · ${rank.name}${rank.next ? ` (${rank.next.at - t.earned} more to ${rank.next.name})` : ''} · streak ${t.streak.count} day${t.streak.count === 1 ? '' : 's'} · ${t.owned.length} of ${CATALOG.length} wares built`
    const record = d.hasRun ? `💀 Dungeon: ${d.monsters} monsters left, ${d.slain} slain${d.framework ? ` (${d.framework})` : ''}` : '💀 Dungeon: no trials yet this session'
    return { text: ['🏰 Guild record', ...rows, record, purse].join('\n') }
  })

  // An agent stuck on the person: a permission to grant, or a question to answer.
  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      const input = (e.tool_input ?? {}) as Record<string, unknown>
      const detail = typeof input.command === 'string' ? input.command : typeof input.file_path === 'string' ? input.file_path : typeof input.url === 'string' ? input.url : ''
      await awaitPerson($, e.agent_id ?? MAIN, `asks leave to use ${e.tool_name}${detail ? `: ${detail.length > 60 ? `${detail.slice(0, 59)}…` : detail}` : ''}`, true)
    } catch {
      // ignore
    }
    return next(e)
  })
  // Only a decision raises the call: a permission (above), a question (AskUserQuestion, below)
  // or a form to fill in. A session that is merely idle rests: it never asks for a quest.
  on('classic.Notification', async ($, e, next) => {
    try {
      if (/elicitation/.test(e.notification_type)) await awaitPerson($, e.agent_id ?? MAIN, 'asks you to choose', true)
    } catch {
      // ignore
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await touch($)
      await answered($, MAIN)
      const words = e.text.replace(/\s+/g, ' ').trim()
      if (words.length > 0 && !words.startsWith('/')) {
        const short = words.length > 48 ? `${words.slice(0, 47)}…` : words
        await move($, MAIN, { location: 'tavern', activity: `takes a quest: ${short}`, isBusy: true, lang: undefined })
        await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `📜 New quest: ${short}`, outcome: 'ok' })
      }
    } catch {
      // The map is decoration: never stand in the prompt's way.
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    try {
      if (ran.agentId !== undefined) {
        const fixedClass = classOfAgentType(e.subagentType)
        const label = fixedClass ? CLASSES[fixedClass].name : e.subagentType
        const member: GuildMember = {
          id: ran.agentId,
          label,
          fixedClass,
          location: 'tavern',
          activity: `joins the party: ${e.description}`,
          isBusy: true,
        }
        // A second subagent out at once makes a team of everyone who is out.
        const out = (await read($, party)).filter(m => m.id !== MAIN && m.id !== member.id)
        let team = out.find(m => m.team)?.team
        if (!team && out.length > 0) {
          const n = await update($, teams, c => c + 1)
          team = TEAMS[(n - 1) % TEAMS.length]!
          const names = [...out.map(m => m.label), label].join(', ')
          await update($, party, list => list.map(m => (m.id !== MAIN ? { ...m, team } : m)))
          await log($, { who: 'Guildmaster', cls: 'guildmaster', location: 'tavern', text: `🚩 The ${team.name} forms: ${names}`, outcome: 'ok' })
          await pay($, 'team')
        }
        if (team) member.team = team
        await update($, party, list => [...list.filter(m => m.id !== member.id), member])
        await log($, {
          who: label,
          cls: fixedClass ?? 'guildmaster',
          location: 'tavern',
          text: `⚔️ ${label} answers the call: ${e.description}`,
          outcome: 'ok',
        })
      }
    } catch {
      // ignore
    }
    return ran
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('tool.call', async ($, e, next) => {
    const memberId = e.agentId ?? MAIN
    const input = e as unknown as Record<string, unknown>
    let entryId: string | undefined
    let place: Placement | undefined
    let member: GuildMember | undefined
    try {
      await touch($)
      place = classifyTool(String(e.tool), input)
      const roster = await read($, party)
      member =
        roster.find(m => m.id === memberId) ??
        // A loop we never saw spawn (a workflow agent, a fork): it joins now.
        ({ id: memberId, label: 'Sellsword', location: place.location, activity: '', isBusy: true } satisfies GuildMember)
      if (!roster.some(m => m.id === memberId)) await update($, party, list => [...list, member!])
      const activity = narrate(place, String(e.tool))
      const moved = { ...member, location: place.location, activity, isBusy: true, lang: place.lang ?? member.lang }
      await move($, memberId, moved)
      const cls = classOf(moved)
      entryId = await log($, { who: moved.fixedClass ? moved.label : CLASSES[cls].name, cls, location: place.location, text: activity, lang: place.lang, outcome: 'running' })
      if (memberId === MAIN) $.ui.status(statusLine(moved))
    } catch {
      // ignore: the tool still runs
    }

    if (String(e.tool) === 'AskUserQuestion') await awaitPerson($, memberId, 'asks you a question', true).catch(() => undefined)
    const ran = await next(e)
    await answered($, memberId).catch(() => undefined) // whatever it waited on is settled once the tool returns

    try {
      if (place && entryId && member) {
        const failed = ran.deny !== undefined || ran.isError === true
        const cls = classOf({ fixedClass: member.fixedClass, location: place.location })
        let outcome: GuildOutcome = failed ? 'fail' : 'ok'
        let text: string | undefined

        if (place.location === 'dungeon' && (String(e.tool) === 'Bash' || String(e.tool) === 'PowerShell')) {
          const battle = readBattle(ran.text ?? '')
          const before = await read($, dungeon)
          if (battle) {
            outcome = battle.failed > 0 ? 'fail' : 'ok'
            text = battle.failed > 0
              ? `⚔️ ${place.detail}: ${battle.failed} monster${battle.failed === 1 ? '' : 's'} stand, ${battle.passed} slain`
              : `⚔️ ${place.detail}: all ${battle.passed} slain`
            await update($, dungeon, () => ({
              monsters: battle.failed,
              slain: battle.passed,
              lastCommand: place!.detail,
              framework: battle.framework ?? place!.framework,
              lang: place!.lang,
              isCleared: battle.failed === 0,
              hasRun: true,
            }))
            await gainXp($, cls, 2 + Math.max(0, before.monsters - battle.failed) * 5)
            await pay($, 'slay', Math.max(0, before.monsters - battle.failed))
            if (battle.failed === 0 && before.monsters > 0) {
              await pay($, 'clear')
              $.ui.toast(`🏆 Dungeon cleared! ${before.monsters} monster${before.monsters === 1 ? '' : 's'} vanquished.`)
            }
          } else {
            await update($, dungeon, d => ({ ...d, hasRun: true, lastCommand: place!.detail, lang: place!.lang ?? d.lang }))
          }
        } else if (!failed) {
          await gainXp($, cls, 1)
        }

        // Crowns for the forge and the cauldron: a clean check, a commit, a brew, a rescue.
        const command = typeof input.command === 'string' ? input.command : ''
        if (command && (String(e.tool) === 'Bash' || String(e.tool) === 'PowerShell')) {
          // A clean check tempers the blade; a commit is scribed; other git chores pay nothing.
          if (place.location === 'armory' && !failed) {
            if (/\bgit\s+commit\b/.test(command)) await pay($, 'commit')
            else if (!/\bgit\b/.test(command)) await pay($, 'temper')
          }
          if (place.location === 'cauldron') {
            const wasSpoiled = await read($, spoiled)
            if (failed) await update($, spoiled, () => true)
            else {
              await pay($, wasSpoiled ? 'rescue' : 'brew')
              if (wasSpoiled) await update($, spoiled, () => false)
            }
          }
        }

        // The Tavern's quest board follows the task list.
        if (!failed && e.tool === 'TaskCreate') {
          const id = (ran.text ?? '').match(/#(\d+)/)?.[1] ?? entryId
          const title = String(input.subject ?? 'A quest')
          await update($, quests, list => [...list.filter(q => q.id !== id), { id, title, isDone: false }])
        }
        if (!failed && e.tool === 'TaskUpdate') {
          const id = String(input.taskId ?? '')
          const status = String(input.status ?? '')
          const wasDone = (await read($, quests)).find(q => q.id === id)?.isDone ?? false
          if (status === 'deleted') await update($, quests, list => list.filter(q => q.id !== id))
          else if (status) await update($, quests, list => list.map(q => (q.id === id ? { ...q, isDone: status === 'completed', title: typeof input.subject === 'string' ? input.subject : q.title } : q)))
          if (status === 'completed') {
            await gainXp($, 'guildmaster', 10)
            if (!wasDone) await pay($, 'quest')
          }
        }
        if (!failed && e.tool === 'TodoWrite' && Array.isArray(input.todos)) {
          const todos = input.todos as { content?: string; status?: string }[]
          const doneBefore = new Set((await read($, quests)).filter(q => q.isDone).map(q => q.title))
          await pay($, 'quest', todos.filter(t => t.status === 'completed' && !doneBefore.has(String(t.content ?? 'A quest'))).length)
          await update($, quests, () => todos.map((t, i) => ({ id: `todo-${i}`, title: String(t.content ?? 'A quest'), isDone: t.status === 'completed' })))
        }

        await settle($, entryId, outcome, text)
      }
    } catch {
      // ignore: the result stands
    }
    return ran
  }).catch(($, e, next) => next(e)) // fail open: the guild never blocks real work

  on('turn.complete', async ($, e, next) => {
    try {
      if (e.agentId === undefined) {
        await move($, MAIN, { location: 'tavern', activity: e.isAborted ? 'called back to the tavern' : 'rests at the tavern', isBusy: false })
        $.ui.status(undefined)
      } else {
        const roster = await read($, party)
        const m = roster.find(one => one.id === e.agentId)
        if (m) {
          await log($, { who: m.label, cls: classOf(m), location: 'tavern', text: `🍺 ${m.label} returns with the spoils`, outcome: e.isAborted ? 'fail' : 'ok' })
          if (!e.isAborted) await pay($, 'return')
          await update($, party, list => list.filter(one => one.id !== e.agentId))
        }
      }
    } catch {
      // ignore
    }
    return next(e)
  })

  // The pane is the map alone: everything to act on lives on the Guild Hall page.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const here = (await $.session.cwd().catch(() => '')).split(/[\\/]/).filter(Boolean).pop() ?? 'this workspace'
    // Every workspace shares one map: this one from live state, the others from their last
    // published snapshots, each party in its project's colour.
    // The same order, names and colours as the Guild Hall page.
    const own: GuildRealm = { id: await $.session.id().catch(() => ''), name: here, updatedAt: 0, party: await read($, party), dungeon: await read($, dungeon), quests: await read($, quests) }
    const all = roster([own, ...(await read($, realms))])
    const multi = all.length > 1
    const members: GuildMember[] = all.flatMap(r =>
      r.party.map(m => ({ ...m, project: multi ? { name: r.name, color: r.color } : undefined })),
    )
    const d: GuildDungeon = {
      monsters: all.reduce((n, r) => n + r.dungeon.monsters, 0),
      slain: all.reduce((n, r) => n + r.dungeon.slain, 0),
      hasRun: all.some(r => r.dungeon.hasRun),
      isCleared: all.every(r => !r.dungeon.hasRun || r.dungeon.isCleared),
      framework: all.length === 1 ? all[0]!.dungeon.framework : undefined,
    }
    const board = all.flatMap(r => r.quests)
    const url = await read($, hallUrl)
    const now = await $.clock.now().catch(() => 0)

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const cols = Math.max(30, e.props.bodyColumns ?? 80)
      const half = Math.max(14, Math.floor((cols - 1) / 2))
      const glyph = (o: GuildOutcome) => (o === 'running' ? '…' : o === 'ok' ? '✓' : '✗')
      const tone = (o: GuildOutcome) => (o === 'running' ? 'warning' : o === 'ok' ? 'success' : 'error')
      const room = (loc: (typeof ORDER)[number], width: number) => {
        const info = LOCATIONS[loc]
        const there = members.filter(m => m.location === loc)
        const busy = there.some(m => m.isBusy)
        return (
          <Box key={loc} flexDirection="column" width={width} borderStyle="round" borderColor={busy ? info.color : 'inactive'} paddingX={1}>
            <Text bold color={busy ? info.color : undefined}>
              {info.icon} {info.name}
            </Text>
            {there.length === 0 && <Text dimColor>empty</Text>}
            {there.map(m => (
              <Text wrap="truncate-end">
                {m.waiting ? '❗ ' : ''}{m.project ? `[${m.project.name}] ` : ''}{CLASSES[classOf(m)].icon} {m.fixedClass ? m.label : CLASSES[classOf(m)].name}
                {m.lang ? ` [${LANGS[m.lang].crest}]` : ''} <Text dimColor>{m.activity}</Text>
              </Text>
            ))}
            {loc === 'dungeon' && (
              <Text color={d.monsters > 0 ? 'error' : d.hasRun ? 'success' : undefined} dimColor={!d.hasRun}>
                {`${'💀'.repeat(Math.min(d.monsters, 6))} ${d.monsters} lurk · ${d.slain} slain`}
              </Text>
            )}
            {loc === 'tavern' && (
              <Text dimColor>
                📜 {board.filter(q => !q.isDone).length} open · {board.filter(q => q.isDone).length} done
              </Text>
            )}
          </Box>
        )
      }
      const recent = (await read($, chronicle)).slice(-8).reverse()
      return (
        <Box flexDirection="column">
          <Box>
            {room('study', half)}
            {room('armory', half)}
          </Box>
          <Box>{room('tavern', half * 2)}</Box>
          <Box>
            {room('dungeon', half)}
            {room('cauldron', half)}
          </Box>
          <Box flexDirection="column" paddingX={1}>
            <Text bold>Chronicle</Text>
            {recent.length === 0 && <Text dimColor>The hall is quiet. Post a quest to begin.</Text>}
            {recent.map(entry => (
              <Text wrap="truncate-end">
                <Text color={tone(entry.outcome)}>{glyph(entry.outcome)}</Text> {CLASSES[entry.cls].icon} {entry.who}
                {entry.lang ? ` [${LANGS[entry.lang].crest}]` : ''} <Text dimColor>{entry.text}</Text>
              </Text>
            ))}
          </Box>
          <Text dimColor> {url ? `🏰 The full Guild Hall: ${url}` : '🏰 /guild opens the full Guild Hall in your browser.'}</Text>
        </Box>
      )
    }

    const { Box, Text, Svg, Link } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={drawMap(members, d, board, { hour: new Date(now).getHours(), now })} alt={describeMap(members, d)} />
        {url ? <Link href={url} label="🏰 Open the full Guild Hall ↗" /> : <Text dimColor>🏰 /guild opens the full Guild Hall in your browser.</Text>}
      </Box>
    )
  })
}
