// The prototype page's wiring: the scene, the place tags over it and the controls under it.
import * as THREE from 'three'
import { start } from './diorama.js'
import { PLACES } from '../../hooks/world.js'

const NAMES = { study: ["Wizard's Study", '★'], tavern: ['Riverside Tavern', '☕'], armory: ['Blacksmith & Armory', '⚒'], cauldron: ['Forest Cave', '⚗'], dungeon: ['Cavern Entrance', '☠'] }
const tags = Object.entries(NAMES).map(([k, [name, icon]]) => {
  const el = document.createElement('div'); el.className = 'tag'; el.innerHTML = `<i>${icon}</i>${name}`; document.getElementById('tags').append(el)
  return { el, at: PLACES[k].at }
})
const canvas = document.getElementById('valley')
let camera = null
start(canvas, ({ state }) => {
  const tod = document.getElementById('tod'), pause = document.getElementById('pause')
  let speed = state.speed
  tod.value = state.tod
  tod.addEventListener('input', () => { state.tod = +tod.value })
  pause.addEventListener('click', () => { const p = pause.getAttribute('aria-pressed') !== 'true'; pause.setAttribute('aria-pressed', String(p)); state.speed = p ? 0 : speed })
  document.querySelectorAll('[data-follow]').forEach(b => b.addEventListener('click', () => {
    state.follow = +b.dataset.follow < 0 ? null : +b.dataset.follow
    document.querySelectorAll('[data-follow]').forEach(o => o.setAttribute('aria-pressed', String(o === b)))
  }))
  setInterval(() => { if (state.speed) tod.value = state.tod }, 500)
})
// The tags follow the places on screen: found from the renderer's camera each frame.
const v = new THREE.Vector3()
function follow() {
  camera ??= window.__valleyCamera
  if (camera) for (const t of tags) {
    v.set(t.at.x, (window.__valleyHeight?.(t.at.x, t.at.y) ?? 0) + 30, t.at.y).project(camera)
    t.el.style.left = `${(v.x + 1) / 2 * innerWidth}px`; t.el.style.top = `${(1 - v.y) / 2 * innerHeight}px`; t.el.style.display = v.z < 1 ? '' : 'none'
  }
  requestAnimationFrame(follow)
}
follow()
