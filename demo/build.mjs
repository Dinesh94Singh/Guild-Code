// Builds demo/guild-hall.html: the dry-run page with the mod's real classifier and world inlined.
//   node demo/build.mjs
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = execFileSync(
  'npx',
  ['-y', 'esbuild@0.24.0', 'hooks/classify.ts', '--bundle', '--format=iife', '--global-name=GuildClassify', '--target=es2019'],
  { cwd: root },
).toString()
const world = execFileSync(
  'npx',
  ['-y', 'esbuild@0.24.0', 'demo/world-entry.js', '--bundle', '--format=iife', '--global-name=GuildWorld', '--target=es2019'],
  { cwd: root },
).toString()
// Each theme pack's page side (demo/packs/*.js) registers itself in window.GuildPacks.
const packs = readdirSync(join(root, 'demo/packs')).filter(f => f.endsWith('.js')).sort().map(f => readFileSync(join(root, 'demo/packs', f), 'utf8')).join('\n')
const page = readFileSync(join(root, 'demo/src.html'), 'utf8').replace('/*__CLASSIFY__*/', () => `${bundle}\n${world}\nwindow.GuildPacks = window.GuildPacks || {};\n${packs}`)
writeFileSync(join(root, 'demo/guild-hall.html'), page)
console.log(`demo/guild-hall.html (${Math.round(page.length / 1024)} KB)`)
