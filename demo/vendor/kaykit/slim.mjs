// Slims the KayKit CC0 assets for the Guild Hall's 3D valley.
//   node slim.mjs <kaykit download dir> <output dir>
// Characters keep only the animations the valley plays; the buildings and nature we use are
// merged into one kit, one scene per model, sharing one texture. Everything is pruned,
// deduplicated and meshopt-compressed (EXT_meshopt_compression: three.js reads it with its MeshoptDecoder).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

process.on('uncaughtException', e => { console.error('ERROR:', e?.message ?? e, (e?.stack ?? '').split('\n').slice(1, 3).join(' ').slice(0, 200)); process.exit(1) })
process.on('unhandledRejection', e => { console.error('ERROR:', e?.message ?? e); process.exit(1) })
const [src, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const kb = f => `${Math.round(statSync(f).size / 1024)} KB`
// Disposing a clip or a mesh leaves its data behind: take the keyframes and vertices with it.
// (keyframe times are shared between clips, so the data itself is left to prune)
const dropClip = a => { for (const smp of a.listSamplers()) smp.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose() }
const dropMesh = m => { for (const p of m.listPrimitives()) { for (const acc of [...p.listAttributes(), p.getIndices()]) acc?.dispose(); p.dispose() } m.dispose() }

const KEEP = new Set(['Idle', 'Walking_A', 'Interact', 'Use_Item', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Chop', 'Spellcasting', 'Cheer', 'Sit_Floor_Idle', 'Death_A', 'Death_A_Pose', 'Hit_A',
  'Skeletons_Awaken_Standing', 'Skeletons_Idle', 'Skeletons_Walking', 'Skeletons_Death'])
const CHARACTERS = {
  'adv/addons/kaykit_character_pack_adventures/Characters/gltf': ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'],
  'skel/addons/kaykit_character_pack_skeletons/Characters/gltf': ['Skeleton_Minion', 'Skeleton_Warrior'],
}
// Every KayKit character shares one rig, so the animations travel once, in their own file:
// each character file is its mesh alone, and a clip plays on any of them by bone name.
for (const [dir, names] of Object.entries(CHARACTERS)) for (const name of names) {
  const doc = await io.read(join(src, dir, `${name}.glb`))
  for (const a of doc.getRoot().listAnimations()) dropClip(a)
  await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  const file = join(out, `${name}.glb`)
  await io.write(file, doc)
  console.log(`${name}: mesh · ${kb(file)}`)
}
for (const [file, from, keep] of [['animations.glb', 'adv/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb', KEEP], ['animations-skeletons.glb', 'skel/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Minion.glb', new Set(['Skeletons_Awaken_Standing'])]]) {
  const doc = await io.read(join(src, from))
  for (const a of doc.getRoot().listAnimations()) if (!keep.has(a.getName())) dropClip(a)
  for (const n of doc.getRoot().listNodes()) { n.setMesh(null); n.setSkin(null) }
  for (const m of doc.getRoot().listMeshes()) dropMesh(m)
  for (const t of doc.getRoot().listTextures()) t.dispose()
  await doc.transform(resample(), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  await io.write(join(out, file), doc)
  console.log(`${file}: ${doc.getRoot().listAnimations().map(a => a.getName()).join(', ')} · ${kb(join(out, file))}`)
}

// The kit: the buildings and nature the valley uses, one scene each, named for the model.
const HEX = 'hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf'
const KIT = [
  ...['tavern', 'castle', 'blacksmith', 'home_A', 'home_B', 'market', 'well', 'windmill', 'watermill', 'lumbermill', 'mine', 'church', 'tower_A', 'tower_B', 'barracks'].map(n => `buildings/red/building_${n}_red`),
  ...['tower_A', 'church', 'barracks', 'home_A'].map(n => `buildings/blue/building_${n}_blue`),
  ...['building_bridge_A', 'building_bridge_B', 'building_destroyed', 'building_grain', 'wall_straight', 'wall_straight_gate', 'wall_corner_A_outside', 'fence_wood_straight', 'fence_stone_straight'].map(n => `buildings/neutral/${n}`),
  ...['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small',
    'mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass', 'hills_A_trees', 'hills_B_trees', 'hills_C',
    'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'waterlily_A', 'waterplant_A', 'cloud_big', 'cloud_small'].map(n => `decoration/nature/${n}`),
]
const kit = await io.read(join(src, HEX, `${KIT[0]}.gltf`))
kit.getRoot().listScenes()[0].setName(KIT[0].split('/').pop())
for (const path of KIT.slice(1)) {
  const doc = await io.read(join(src, HEX, `${path}.gltf`))
  doc.getRoot().listScenes()[0].setName(path.split('/').pop())
  kit.merge(doc)
}
// one buffer for all
const buffer = kit.getRoot().listBuffers()[0]
for (const acc of kit.getRoot().listAccessors()) acc.setBuffer(buffer)
for (const b of kit.getRoot().listBuffers()) if (b !== buffer) b.dispose()
await kit.transform(dedup(), weld(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
const kitFile = join(out, 'valley-kit.glb')
await io.write(kitFile, kit)
console.log(`valley-kit: ${kit.getRoot().listScenes().length} models, ${kit.getRoot().listTextures().length} texture(s) · ${kb(kitFile)}`)
