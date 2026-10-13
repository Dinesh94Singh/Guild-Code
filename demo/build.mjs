// Builds demo/guild-hall.html: the dry-run page with the mod's real classifier and world inlined.
//   node demo/build.mjs [--stand-in]   (--stand-in: with local stand-in art, to demo/guild-hall.stand-in.html)
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
// Each skin (demo/skins/*.json) brings its painted map, the first of its art files that exists,
// inlined as a data URI so the page needs nothing but itself. A skin with no art is left out.
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
const skins = {}
for (const f of readdirSync(join(root, 'demo/skins')).filter(f => f.endsWith('.json'))) {
  const skin = JSON.parse(readFileSync(join(root, 'demo/skins', f), 'utf8'))
  // Stand-in art is for trying a skin locally (node demo/build.mjs --stand-in); the page that is
  // committed and served never carries it.
  const art = skin.art.find(a => existsSync(join(root, 'demo/skins', a.file)) && (!a.file.includes('.placeholder.') || process.argv.includes('--stand-in')))
  if (!art) continue
  const data = readFileSync(join(root, 'demo/skins', art.file)).toString('base64'), ext = art.file.split('.').pop()
  skins[f.replace(/\.json$/, '')] = { name: skin.name, image: `data:${MIME[ext]};base64,${data}`, crop: art.crop ?? null, dest: art.dest ?? null, sea: art.sea ?? null, stand: art.file.includes('.placeholder.') }
  console.log(`skin ${f}: ${art.file} (${Math.round(data.length / 1024)} KB)`)
}
const page = readFileSync(join(root, 'demo/src.html'), 'utf8').replace('/*__CLASSIFY__*/', () => `${bundle}\n${world}\nwindow.GuildPacks = window.GuildPacks || {};\n${packs}\nwindow.GuildSkins = ${JSON.stringify(skins)};`)
// A stand-in build is for trying it here: it goes to its own file, which git ignores.
const out = process.argv.includes('--stand-in') ? 'demo/guild-hall.stand-in.html' : 'demo/guild-hall.html'
writeFileSync(join(root, out), page)
console.log(`${out} (${Math.round(page.length / 1024)} KB)`)
