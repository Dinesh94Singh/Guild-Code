// Builds demo/diorama.html: the 3D prototype of the GHIBLI style, three.js and the mod's own
// world bundled in, so the page needs nothing but itself.
//   node demo/build-diorama.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = execFileSync('npx', ['-y', 'esbuild@0.24.0', 'demo/diorama/entry.js', '--bundle', '--format=iife', '--target=es2020', '--minify',
  `--alias:three=./demo/vendor/three/three.module.min.js`], { cwd: root, maxBuffer: 64 << 20 }).toString()
const page = readFileSync(join(root, 'demo/diorama/diorama.src.html'), 'utf8').replace('/*__DIORAMA__*/', () => bundle)
writeFileSync(join(root, 'demo/diorama.html'), page)
console.log(`demo/diorama.html (${Math.round(page.length / 1024)} KB)`)
