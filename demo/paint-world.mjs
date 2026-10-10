// Paints the realm (hooks/world.js) and writes it for the mod as hooks/world-art.ts: the world
// as a small 8-bit PNG, and the marks (lamps, windows, the tower's top) its overlays light up.
//   node demo/paint-world.mjs [--preview out.png]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import zlib from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(mkdtempSync(join(tmpdir(), 'guild-world-')), 'world.mjs')
execFileSync('npx', ['-y', 'esbuild@0.24.0', 'hooks/world.js', '--bundle', '--format=esm', '--platform=node', `--outfile=${tmp}`, '--log-level=error'], { cwd: root })
const { paintWorld } = await import(pathToFileURL(tmp).href)
const world = paintWorld()

// An indexed PNG: pixel art keeps to a few hundred colours, so 256 of them are plenty.
function png8(w, h, rgba) {
  const count = new Map()
  for (let i = 0; i < rgba.length; i += 4) { const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]; count.set(k, (count.get(k) ?? 0) + 1) }
  const pal = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(e => e[0])
  const exact = new Map(pal.map((p, i) => [p, i]))
  const nearest = k => {
    if (exact.has(k)) return exact.get(k)
    let best = 0, bd = Infinity
    pal.forEach((p, i) => { const d = ((k >> 16) - (p >> 16)) ** 2 + (((k >> 8) & 255) - ((p >> 8) & 255)) ** 2 + ((k & 255) - (p & 255)) ** 2; if (d < bd) { bd = d; best = i } })
    exact.set(k, best)
    return best
  }
  const raw = Buffer.alloc((w + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; raw[y * (w + 1) + 1 + x] = nearest((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3
  const plte = Buffer.alloc(pal.length * 3); pal.forEach((p, i) => { plte[i * 3] = p >> 16; plte[i * 3 + 1] = (p >> 8) & 255; plte[i * 3 + 2] = p & 255 })
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const png = png8(world.width, world.height, world.data)
const uri = `data:image/png;base64,${png.toString('base64')}`
writeFileSync(join(root, 'hooks/world-art.ts'), `// Written by demo/paint-world.mjs from hooks/world.js: do not edit by hand.
// The realm painted once, as the mod's map draws it under its live overlays.
export const WORLD_ART = ${JSON.stringify(uri)}
export const WORLD_MARKS = ${JSON.stringify(world.marks)} as const
export const WORLD_FOAM = ${JSON.stringify(world.foam.filter((_, i) => i % 3 === 0))} as const
`)
const preview = process.argv.indexOf('--preview')
if (preview > 0) writeFileSync(process.argv[preview + 1], png)
console.log(`hooks/world-art.ts: the world is ${world.width}×${world.height}, ${Math.round(uri.length / 1024)} KB as a data URI`)
