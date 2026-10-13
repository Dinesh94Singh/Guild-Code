// Pixel art shared by the dry run and the mod. Every function draws onto anything with a
// \`fillStyle\` and a \`fillRect\`: a canvas in the dry run, a Recorder in the mod, which turns
// what was drawn into SVG paths. Places a drawing marks (windows, lamps, the tower's top) are
// collected in \`marks\` so lights and animations can find them.

export const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = c => Math.max(0, Math.min(255, Math.round(c + amt))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
export const px = (b, c, x, y, w = 1, h = 1) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
export const SEASON = { snow: false, crops: true };
const OAK = ['#1d3b1c', '#2f6a2c', '#43893a', '#62a84c'], DARK_OAK = ['#14301a', '#24552a', '#336f34', '#4a8a42'], WILLOW = ['#16261a', '#2e4a2a', '#3c5e34', '#557a46'];
export const PALETTES = { OAK, DARK_OAK, WILLOW };
export const marks = { windows: [], chimneys: [], vents: [], lamps: [], torches: [], tower: null, windmill: null, skull: null, hut: null, forge: null, anvil: null, board: null, volcano: null };
export function resetMarks() { for (const k of ['windows', 'chimneys', 'vents', 'lamps', 'torches']) marks[k].length = 0; }

/** Records fillRect calls as pixels; the last colour drawn on a pixel wins, a translucent one only fills an empty pixel. */
export class Recorder {
  constructor() { this.fillStyle = '#000'; this.pix = new Map(); }
  fillRect(x, y, w, h) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    const c = this.fillStyle, soft = c.startsWith('rgba');
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j + 2048) * 8192 + (i + 2048); if (soft && this.pix.has(k)) continue; this.pix.set(k, c); }
  }
  /** One path per colour, each pixel row a run: crisp pixel art in a few paths. */
  toSvg() {
    const rows = new Map();
    for (const [k, c] of this.pix) { const y = Math.floor(k / 8192) - 2048, x = (k % 8192) - 2048; let r = rows.get(c); if (!r) rows.set(c, r = []); r.push(y * 100000 + x); }
    let out = '';
    for (const [c, list] of rows) {
      list.sort((a, b) => a - b);
      let d = '', i = 0;
      while (i < list.length) {
        const y = Math.floor((list[i] + 50000) / 100000), x0 = list[i] - y * 100000; let n = 1;
        while (i + n < list.length && list[i + n] === list[i] + n) n++;
        d += `M${x0} ${y}h${n}v1h${-n}z`; i += n;
      }
      const m = c.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
      out += m ? `<path fill="rgb(${m[1]},${m[2]},${m[3]})" fill-opacity="${m[4]}" d="${d}"/>` : `<path fill="${c}" d="${d}"/>`;
    }
    return out;
  }
}

export const shadow = (b, x, y, w) => px(b, 'rgba(0,0,0,.28)', x - (w >> 1), y - 1, w, 3);
export function pine(b, x, y, h, snowy = SEASON.snow) {
  shadow(b, x + 1, y, 11);
  px(b, '#3a2414', x - 1, y - 3, 3, 3);
  const half = i => { let w = Math.max(0, Math.round((h - i) * 0.38)); if (i % 4 === 0 && i > 1) w += 1; return w; };
  px(b, '#14301c', x, y - 4 - h, 1, 1);
  for (let i = 0; i < h; i++) { const w = half(i); px(b, '#14301c', x - w - 1, y - 3 - i, w * 2 + 3, 1); }
  for (let i = 0; i < h; i++) {
    const w = half(i), yy = y - 3 - i;
    px(b, '#2e6a3a', x - w, yy, w + 1, 1); if (w) px(b, '#22502c', x + 1, yy, w, 1);
    if (i % 4 === 1 && w > 1) px(b, snowy ? '#f4f8fc' : '#4a8f4f', x - w, yy, Math.max(1, snowy ? w : w >> 1), 1);
  }
}
export function oak(b, x, y, r, pal, trunk = 5) {
  pal = pal ?? OAK;
  shadow(b, x + 1, y, r * 2 + 2);
  if (trunk) { px(b, '#3a2414', x - 1, y - trunk, 3, trunk); px(b, '#5a3a20', x - 1, y - trunk, 1, trunk); }
  const cy = y - trunk - r;
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const d = Math.hypot(dx, dy * 1.1); if (d > r + 0.6) continue;
    let c = d > r - 0.5 ? pal[0] : dx + dy < -r * 0.6 ? pal[3] : dx + dy > r * 0.5 ? pal[1] : pal[2];
    if (c !== pal[0] && hash(x + dx, y + dy) > 0.84) c = pal[1];
    px(b, c, x + dx, cy + dy);
  }
}
export function willow(b, x, y) {
  oak(b, x, y, 6, WILLOW, 6);
  for (let k = -5; k <= 5; k += 2) { const len = 3 + Math.floor(hash(x + k, y) * 4); px(b, '#2e4a2a', x + k, y - 9, 1, len); }
}
export function deadTree(b, x, y) {
  shadow(b, x, y, 8);
  px(b, '#2a201a', x - 1, y - 12, 3, 12); px(b, '#4a3a2e', x - 1, y - 12, 1, 12);
  px(b, '#2a201a', x - 5, y - 11, 4, 1); px(b, '#2a201a', x - 6, y - 13, 1, 2);
  px(b, '#2a201a', x + 2, y - 8, 4, 1); px(b, '#2a201a', x + 5, y - 11, 1, 3); px(b, '#2a201a', x, y - 15, 1, 3);
}
export function palm(b, x, y) {
  shadow(b, x + 2, y, 9);
  for (let i = 0; i < 14; i++) px(b, i % 3 ? '#8a5a34' : '#6b4426', x + Math.round(Math.sin(i / 14 * 1.3) * 3), y - i, 2, 1);
  const tx = x + 3, ty = y - 15;
  for (const [dx, dy] of [[-1, 0], [1, 0], [-0.7, 0.5], [0.7, 0.5], [0, -0.6]]) for (let s = 1; s < 6; s++) px(b, s > 3 ? '#2f6a2c' : '#43893a', tx + Math.round(dx * s), ty + Math.round(dy * s + (s > 3 ? 1 : 0)), 2, 1);
  px(b, '#6b4426', tx, ty + 1, 2, 2);
}
export function rock(b, x, y, s, light = '#9a938a', dark = '#6e675e') {
  px(b, '#1b1424', x - s - 1, y - s - 1, s * 2 + 3, s + 2); px(b, dark, x - s, y - s, s * 2 + 1, s + 1);
  px(b, light, x - s, y - s, s + 1, Math.max(1, s >> 1) + 1); px(b, '#c4bdb2', x - s + 1, y - s, 1, 1);
}
export function gravestone(b, x, y, cross) {
  shadow(b, x, y, 8);
  if (cross) { px(b, '#1b1424', x - 1, y - 10, 3, 10); px(b, '#1b1424', x - 3, y - 8, 7, 3); px(b, '#a8a8b4', x, y - 9, 1, 9); px(b, '#a8a8b4', x - 2, y - 7, 5, 1); return; }
  px(b, '#1b1424', x - 3, y - 8, 7, 8); px(b, '#1b1424', x - 2, y - 9, 5, 1);
  px(b, '#8a8a96', x - 2, y - 8, 5, 8); px(b, '#a8a8b4', x - 2, y - 8, 1, 7); px(b, '#5e5e6a', x - 1, y - 6, 3, 1);
}
export function mushroom(b, x, y, cap = '#c0392b') { px(b, '#efe6d2', x, y - 2, 1, 2); px(b, '#1b1424', x - 2, y - 4, 5, 2); px(b, cap, x - 1, y - 4, 3, 1); px(b, '#fff', x, y - 4, 1, 1); }
export function reeds(b, x, y) { for (let k = 0; k < 4; k++) { const hgt = 4 + Math.floor(hash(x + k, y) * 4); px(b, '#5e7a3a', x + k * 2 - 3, y - hgt, 1, hgt); if (k % 2) px(b, '#6b4426', x + k * 2 - 3, y - hgt - 1, 1, 2); } }
export function tuft(b, x, y, c = '#3f7a2c') { px(b, c, x, y - 2, 1, 2); px(b, c, x + 2, y - 3, 1, 3); px(b, c, x + 1, y - 1, 1, 1); }
export function flowers(b, x, y) { const cs = ['#fff3d0', '#f7dd5b', '#e88aa8', '#8ab4f0']; for (let k = 0; k < 3; k++) px(b, cs[Math.floor(hash(x + k, y) * 4)], x + Math.floor(hash(x, y + k) * 6) - 3, y + Math.floor(hash(x + k * 3, y) * 4) - 2); }
export function mountain(b, x, y, w, h, snow = 0.42) {
  px(b, '#2f2a26', x, y - h - 1, 1, 1);
  for (let i = 0; i <= h; i++) { const hw = Math.round(i / h * w / 2); px(b, '#2f2a26', x - hw - 1, y - h + i, hw * 2 + 3, 1); }
  for (let i = 1; i <= h; i++) {
    const yy = y - h + i, hw = Math.round(i / h * w / 2), ridge = Math.round(Math.sin(i * 0.7 + x) * 1.2);
    const cap = i < h * snow + Math.floor(hash(x, i) * 3);
    px(b, cap ? '#f4f4f8' : '#9a9184', x - hw, yy, Math.max(0, hw + ridge), 1);
    px(b, cap ? '#b9c0d0' : '#6d665c', x + ridge, yy, Math.max(0, hw - ridge + 1), 1);
  }
  for (let k = 0; k < w / 6; k++) { const sx = x - w / 3 + Math.floor(hash(x + k, y) * w * 0.66), sy = y - 2 - Math.floor(hash(k, x) * h * 0.55); px(b, '#5a544b', sx, sy, 1, 3); }
}
export function wall(b, L, T, w, h, beams) {
  px(b, '#1b1424', L - 1, T - 1, w + 2, h + 1);
  px(b, '#e8d8b0', L, T, w, h); px(b, '#cdbb90', L + w - 3, T, 3, h);
  if (!beams) return;
  px(b, '#5a3720', L, T, w, 2);
  for (let bx = L; bx < L + w - 2; bx += 10) px(b, '#5a3720', bx, T, 2, h);
  px(b, '#5a3720', L + w - 2, T, 2, h);
  if (h > 14) px(b, '#5a3720', L, T + (h >> 1) - 1, w, 2);
}
export function roof(b, x, top, w, rows, a, dark) {
  const L = x - (w >> 1);
  for (let i = 0; i < rows; i++) {
    const yy = top - 1 - i, inset = Math.round(i * (w / 2 + 3) / (rows + 2)), l = L - 3 + inset, r = L + w + 3 - inset;
    px(b, '#1b1424', l - 1, yy, r - l + 2, 1);
    px(b, i % 3 === 0 ? dark : a, l, yy, r - l, 1);
    px(b, i % 3 === 0 ? shade(dark, -14) : dark, x + Math.floor((r - x) * 0.45), yy, Math.ceil((r - x) * 0.55), 1);
  }
  const inset = Math.round(rows * (w / 2 + 3) / (rows + 2));
  px(b, '#1b1424', L - 4 + inset, top - 1 - rows, w + 8 - inset * 2, 1);
  px(b, 'rgba(0,0,0,.28)', L, top, w, 2);
}
export function window_(b, x, y) { marks.windows.push({ x: x + 2, y: y + 2 }); px(b, '#1b1424', x - 1, y - 1, 6, 6); px(b, '#ffd27a', x, y, 4, 4); px(b, '#fff3c0', x, y, 2, 2); px(b, '#5a3720', x + 2, y, 1, 4); }
export function door(b, x, y) { px(b, '#1b1424', x - 4, y - 11, 8, 11); px(b, '#6b4426', x - 3, y - 10, 6, 10); px(b, '#4a2f1d', x, y - 10, 1, 10); px(b, '#f2b84b', x + 1, y - 5, 1, 1); }
export function house(b, x, y, w, wallH, rows, a, dark, chimney) {
  const L = x - (w >> 1);
  px(b, 'rgba(0,0,0,.3)', L + 2, y, w, 4);
  wall(b, L, y - wallH, w, wallH, true);
  for (let wx = L + 5; wx < L + w - 6; wx += 10) if (Math.abs(wx + 2 - x) > 6) window_(b, wx, y - wallH + 5);
  door(b, x, y);
  if (chimney) { const cx = x + Math.round(w / 4), cy = y - wallH - rows + 2; px(b, '#1b1424', cx - 1, cy - 7, 7, 8); px(b, '#8a4a3a', cx, cy - 6, 5, 7); px(b, '#6a3a2a', cx + 3, cy - 6, 2, 7); marks.chimneys.push({ x: cx + 2, y: cy - 8 }); }
  roof(b, x, y - wallH, w, rows, a, dark);
}

// ───────────────────────── the valley's landmarks ─────────────────────────
// Laid stone: courses with staggered joints, lit from the left.
export function masonry(b, L, T, w, h, light = '#b3aa9b', mid = '#9a9184', dark = '#7d766a', seam = '#5e574d') {
  px(b, '#1b1424', L - 1, T - 1, w + 2, h + 1);
  for (let yy = T; yy < T + h; yy++) for (let xx = 0; xx < w; xx++) {
    const row = Math.floor((yy - T) / 4), joint = (yy - T) % 4 === 0 || (xx + (row % 2) * 3) % 6 === 0;
    px(b, joint ? seam : xx < 2 ? light : xx > w - 3 ? dark : mid, L + xx, yy);
  }
}
// A row of merlons along a wall's top.
export function battlements(b, L, T, w, light = '#b3aa9b', dark = '#7d766a') {
  for (let xx = 0; xx < w; xx += 4) { px(b, '#1b1424', L + xx - 1, T - 4, 4, 4); px(b, xx < 4 ? light : dark, L + xx, T - 3, 2, 3); }
}
// A round tower with a pointed roof: the keep's corners and its great tower.
export function turret(b, x, y, w, h, roofA = '#b8503a', roofD = '#8e3a2a', flag) {
  const L = x - (w >> 1), T = y - h;
  masonry(b, L, T, w, h);
  for (let wy = T + 6; wy < y - 8; wy += 12) { px(b, '#1b1424', x - 1, wy, 3, 5); px(b, '#ffd27a', x, wy + 1, 1, 3); marks.windows.push({ x, y: wy + 2 }); }
  const rows = Math.round(w * 1.1);
  for (let i = 0; i < rows; i++) {
    const hw = Math.max(0, Math.round((rows - i) / rows * (w / 2 + 2)));
    px(b, '#1b1424', x - hw - 1, T - 1 - i, hw * 2 + 2, 1); px(b, i % 3 ? roofA : roofD, x - hw, T - 1 - i, hw, 1); px(b, roofD, x, T - 1 - i, hw, 1);
  }
  if (flag) { px(b, '#3a2414', x, T - rows - 7, 1, 7); px(b, '#1b1424', x + 1, T - rows - 7, 6, 4); px(b, flag, x + 1, T - rows - 6, 5, 2); }
}
// The castle keep above the town: a curtain wall with a gatehouse, halls behind it and towers.
export function keep(b, x, y) {
  shadow(b, x + 4, y + 1, 130);
  // the halls and the great tower behind the wall
  for (const [dx, w, h, rows] of [[-36, 34, 26, 12], [30, 38, 30, 13]]) {
    const L = x + dx - (w >> 1);
    masonry(b, L, y - 18 - h, w, h, '#c9bfae', '#b3aa9b', '#968d7e');
    for (let wx = L + 4; wx < L + w - 4; wx += 8) window_(b, wx, y - 18 - h + 6);
    roof(b, x + dx, y - 18 - h, w, rows, '#b8503a', '#8e3a2a');
  }
  turret(b, x - 4, y - 18, 22, 58, '#b8503a', '#8e3a2a', '#f2b84b');
  // the curtain wall, its gate and the corner towers
  const L = x - 64, T = y - 22;
  masonry(b, L, T, 128, 22); battlements(b, L, T, 128);
  px(b, '#1b1424', x - 9, y - 16, 18, 16); px(b, '#2a1f18', x - 8, y - 15, 16, 15);
  for (let k = -7; k <= 7; k += 3) px(b, '#5a5048', x + k, y - 15, 1, 15);
  px(b, '#1b1424', x - 11, y - 20, 22, 3); px(b, '#9a9184', x - 10, y - 19, 20, 1);
  for (const lx of [x - 13, x + 12]) { px(b, '#ffd27a', lx, y - 12, 2, 2); marks.torches.push({ x: lx + 1, y: y - 11 }); }
  for (const tx of [x - 64, x + 64]) turret(b, tx, y + 2, 16, 40, '#b8503a', '#8e3a2a', tx < x ? '#b8323f' : undefined);
  turret(b, x - 30, y - 20, 12, 26); turret(b, x + 36, y - 22, 12, 30);
}
// The old ruins above the falls: broken walls, a lone arch, toppled columns and moss.
export function ruins(b, x, y) {
  shadow(b, x, y + 1, 60);
  const grey = ['#a7a196', '#8f897e', '#6f6a61', '#55504a'];
  masonry(b, x - 30, y - 16, 14, 16, ...grey); masonry(b, x - 30, y - 24, 6, 8, ...grey);
  masonry(b, x + 14, y - 22, 16, 22, ...grey); masonry(b, x + 24, y - 30, 6, 8, ...grey);
  // an arch still standing
  masonry(b, x - 10, y - 30, 4, 30, ...grey); masonry(b, x + 4, y - 30, 4, 30, ...grey); masonry(b, x - 10, y - 34, 18, 5, ...grey);
  // toppled columns and rubble
  px(b, '#1b1424', x - 44, y - 5, 16, 5); px(b, grey[0], x - 43, y - 4, 14, 2); px(b, grey[2], x - 43, y - 2, 14, 1);
  for (let k = 0; k < 9; k++) rock(b, x - 40 + Math.floor(hash(x + k, y) * 80), y + 1 + Math.floor(hash(k, x) * 6), 1 + Math.floor(hash(k, y) * 2), grey[0], grey[2]);
  for (let k = 0; k < 14; k++) px(b, hash(k, x) > .5 ? '#4f8a3c' : '#3f7431', x - 32 + Math.floor(hash(x, k) * 64), y - 2 - Math.floor(hash(k * 3, y) * 30), 2, 1);
}
// A rocky crag, sheer below and grassy on top: the tower stands on it. Its outline is ragged
// and its face falls in shadowed ledges.
export function crag(b, x, y, w, h) {
  const edge = i => Math.round(w / 2 * (0.62 + 0.38 * (i / h)) + (hash(x, i >> 1) - .5) * 5)
  for (let i = 0; i <= h; i++) {
    const yy = y - h + i, hl = edge(i), hr = edge(i + 97)
    px(b, '#1b1424', x - hl - 1, yy, hl + hr + 2, 1)
    for (let xx = -hl; xx < hr; xx++) {
      const ledge = (i + Math.floor(hash((x + xx) >> 3, 5) * 6)) % 8 === 0, crack = hash(x + xx, i >> 2) > .93
      px(b, ledge || crack ? '#3e3a35' : xx < -hl * 0.45 ? '#8a8276' : xx < hr * 0.2 ? '#6e675d' : '#55504a', x + xx, yy)
    }
  }
  const top = y - h, tw = edge(0)
  for (let xx = -tw; xx < tw; xx++) { const d = 2 + Math.floor(hash(xx, x) * 4); px(b, '#447f30', x + xx, top - 1, 1, d); px(b, '#5c9e3e', x + xx, top - 1, 1, 1) }
  for (let k = 0; k < 7; k++) tuft(b, x - tw + Math.floor(hash(k, x) * tw * 2), top + 6 + Math.floor(hash(x, k) * h * 0.7), '#4f8a3c')
}
// The guild hall: a long timbered hall under blue roofs, with the guild's banners.
export function guildHall(b, x, y) {
  const w = 64, wallH = 24, L = x - (w >> 1);
  px(b, 'rgba(0,0,0,.3)', L + 3, y, w, 5);
  wall(b, L, y - wallH, w, wallH, true);
  for (let wx = L + 5; wx < L + w - 6; wx += 10) { window_(b, wx, y - wallH + 4); if (Math.abs(wx + 2 - x) > 8) window_(b, wx, y - 12); }
  px(b, '#1b1424', x - 6, y - 13, 12, 13); px(b, '#5a3720', x - 5, y - 12, 10, 12); px(b, '#f2b84b', x + 1, y - 6, 1, 1);
  roof(b, x, y - wallH, w, 20, '#3b5fa8', '#2c4a85');
  turret(b, L + 4, y, 12, 34, '#3b5fa8', '#2c4a85', '#f2b84b');
  for (const bx of [x - 18, x + 14]) { px(b, '#1b1424', bx, y - wallH + 2, 5, 12); px(b, '#3b5fa8', bx + 1, y - wallH + 3, 3, 9); px(b, '#f2b84b', bx + 2, y - wallH + 6, 1, 3); }
}
// A wooden pier running out to sea on posts, with a landing at its end.
export function pier(b, x, y, len, wide = 10) {
  for (let i = 4; i < len; i += 7) for (const px_ of [x - 2, x + wide]) { px(b, '#1b1424', px_, y + i, 2, 7); px(b, '#3a2414', px_, y + i + 4, 2, 3) }
  px(b, '#1b1424', x - 1, y - 1, wide + 2, len + 2)
  for (let i = 0; i < len; i++) px(b, i % 3 === 0 ? '#7a4f2c' : i % 3 === 1 ? '#b8834e' : '#a3723f', x, y + i, wide, 1)
  px(b, '#1b1424', x - 7, y + len - 7, wide + 14, 9)
  for (let i = 0; i < 7; i++) px(b, i % 3 === 0 ? '#7a4f2c' : '#b8834e', x - 6, y + len - 6 + i, wide + 12, 1)
  px(b, 'rgba(0,0,0,.3)', x - 6, y + len + 2, wide + 12, 2)
}
// A small boat moored by a pier, sail furled or set.
export function boat(b, x, y, sail = '#efe6d2', hull = '#7a4a2a') {
  px(b, '#1b1424', x - 9, y - 4, 19, 5); px(b, hull, x - 8, y - 3, 17, 3); px(b, shade(hull, -24), x - 6, y - 1, 13, 1);
  px(b, 'rgba(255,255,255,.35)', x - 10, y + 1, 21, 1);
  px(b, '#3a2414', x, y - 22, 1, 18);
  for (let i = 0; i < 14; i++) { const w = Math.round((14 - i) * 0.6) + 1; px(b, '#1b1424', x + 1, y - 7 - i, w + 1, 1); px(b, sail, x + 1, y - 7 - i, w, 1); }
}

// ───────────────────────── landmarks ─────────────────────────
export function tavern(b, x, y) {
  // The guild's great hall: two storeys under a broad roof, a sign, lanterns and barrels.
  const w = 84, wallH = 32, L = x - (w >> 1)
  px(b, 'rgba(0,0,0,.3)', L + 3, y, w, 5);
  wall(b, L, y - wallH, w, wallH, true);
  for (let wx = L + 5; wx < L + w - 6; wx += 10) { window_(b, wx, y - wallH + 4); if (Math.abs(wx + 2 - x) > 8) window_(b, wx, y - 13); }
  // a wide double door under a porch
  px(b, '#1b1424', x - 7, y - 13, 14, 13); px(b, '#6b4426', x - 6, y - 12, 12, 12); px(b, '#4a2f1d', x, y - 12, 1, 12); px(b, '#f2b84b', x - 2, y - 6, 1, 1); px(b, '#f2b84b', x + 2, y - 6, 1, 1);
  px(b, '#1b1424', x - 11, y - 16, 22, 3); px(b, '#8e3a2a', x - 10, y - 15, 20, 1);
  for (const cx of [x - 26, x + 22]) { px(b, '#1b1424', cx - 1, y - wallH - 30, 7, 10); px(b, '#8a4a3a', cx, y - wallH - 29, 5, 9); px(b, '#6a3a2a', cx + 3, y - wallH - 29, 2, 9); marks.chimneys.push({ x: cx + 2, y: y - wallH - 31 }); }
  roof(b, x, y - wallH, w, 26, '#b8503a', '#8e3a2a');
  // a dormer and the guild's banner on the roof
  px(b, '#1b1424', x - 7, y - wallH - 17, 14, 10); px(b, '#e8d8b0', x - 6, y - wallH - 16, 12, 9); window_(b, x - 2, y - wallH - 14);
  px(b, '#3a2414', x, y - wallH - 34, 1, 14); px(b, '#1b1424', x + 1, y - wallH - 34, 9, 7); px(b, '#f2b84b', x + 1, y - wallH - 33, 8, 5); px(b, '#b8323f', x + 4, y - wallH - 32, 2, 3);
  // hanging sign with a mug
  px(b, '#3a2414', x + 42, y - 24, 9, 2); px(b, '#3a2414', x + 49, y - 24, 1, 4);
  px(b, '#1b1424', x + 44, y - 21, 11, 9); px(b, '#8a5a34', x + 45, y - 20, 9, 7);
  px(b, '#f2b84b', x + 47, y - 19, 4, 5); px(b, '#fff3d0', x + 47, y - 19, 4, 1); px(b, '#f2b84b', x + 51, y - 18, 1, 3);
  // lanterns by the door and barrels along the wall
  for (const lx of [x - 10, x + 9]) { px(b, '#1b1424', lx, y - 12, 2, 3); px(b, '#ffd27a', lx, y - 11, 2, 1); marks.lamps.push({ x: lx + 1, y: y - 11 }); }
  for (const bx of [x - 34, x - 27, x + 24]) { px(b, '#1b1424', bx - 1, y - 9, 7, 9); px(b, '#7a4a2a', bx, y - 8, 5, 8); px(b, '#4a2f1d', bx, y - 6, 5, 1); px(b, '#4a2f1d', bx, y - 3, 5, 1); }
}
export function questBoard(b, x, y) {
  marks.board = { x, y };
  shadow(b, x + 16, y + 28, 30);
  px(b, '#3a2316', x + 3, y + 18, 3, 10); px(b, '#3a2316', x + 26, y + 18, 3, 10);
  px(b, '#1b1424', x - 1, y + 1, 34, 22); px(b, '#8a5a34', x, y + 2, 32, 20); px(b, '#6b4426', x, y + 20, 32, 2);
  px(b, '#1b1424', x - 2, y - 1, 36, 3); px(b, '#b8503a', x - 1, y, 34, 1);
}
export function well(b, x, y) {
  shadow(b, x, y, 16);
  px(b, '#1b1424', x - 7, y - 8, 14, 8); px(b, '#9a938a', x - 6, y - 7, 12, 6); px(b, '#7a7266', x - 6, y - 3, 12, 1); px(b, '#2a5f9a', x - 4, y - 7, 8, 2);
  px(b, '#5a3720', x - 6, y - 17, 2, 10); px(b, '#5a3720', x + 4, y - 17, 2, 10); px(b, '#3a2414', x - 4, y - 14, 8, 1);
  px(b, '#1b1424', x - 9, y - 20, 18, 4); px(b, '#b8503a', x - 8, y - 19, 16, 2);
}
export function stall(b, x, y) {
  shadow(b, x, y, 26);
  px(b, '#3a2414', x - 11, y - 16, 2, 16); px(b, '#3a2414', x + 9, y - 16, 2, 16);
  px(b, '#1b1424', x - 12, y - 7, 24, 7); px(b, '#8a5a34', x - 11, y - 6, 22, 5);
  const goods = ['#e8606f', '#f2b84b', '#84d488', '#e39a4d'];
  for (let i = 0; i < 5; i++) px(b, goods[i % 4], x - 9 + i * 4, y - 9, 3, 3);
  for (let i = 0; i < 26; i += 2) { px(b, '#1b1424', x - 13 + i, y - 21, 2, 6); px(b, (i / 2) % 2 ? '#fff3d0' : '#b8323f', x - 13 + i, y - 20, 2, 4); }
}
export function lamp(b, x, y) { shadow(b, x, y, 5); px(b, '#1b1424', x, y - 12, 1, 12); px(b, '#1b1424', x - 1, y - 15, 3, 4); px(b, '#ffd27a', x, y - 14, 1, 2); marks.lamps.push({ x, y: y - 13 }); }
export function windmill(b, x, y) {
  shadow(b, x, y, 18);
  for (let i = 0; i < 26; i++) { const hw = 7 - Math.round(i * 3 / 26); px(b, '#1b1424', x - hw - 1, y - i, hw * 2 + 2, 1); px(b, '#e2d6bc', x - hw, y - i, hw, 1); px(b, '#c4b896', x, y - i, hw, 1); }
  px(b, '#1b1424', x - 6, y - 32, 12, 7); px(b, '#8e3a2a', x - 5, y - 31, 10, 5); px(b, '#b8503a', x - 5, y - 31, 4, 2);
  px(b, '#5a3720', x - 2, y - 7, 4, 7); px(b, '#1b1424', x - 1, y - 18, 2, 3);
  marks.windmill = { x, y: y - 27 };
}
export function field(b, f) {
  px(b, '#5e4428', f.x, f.y, f.w, f.h);
  for (let yy = f.y + 2; yy < f.y + f.h - 1; yy += 4) {
    px(b, '#7f5e36', f.x + 1, yy, f.w - 2, 2);
    for (let xx = f.x + 2; xx < f.x + f.w - 2; xx += 3) {
      if (!SEASON.crops) { px(b, '#f4f8fc', xx, yy - 1, 3, 2); }
      else if (f.crop === 'wheat') { px(b, hash(xx, yy) > 0.25 ? '#e0c050' : '#c9a33a', xx, yy - 2, 2, 3); px(b, '#f2dc7a', xx, yy - 2, 1, 1); }
      else { px(b, '#2f6a2c', xx, yy - 1, 3, 2); px(b, '#84d488', xx + 1, yy - 1, 1, 1); }
    }
  }
  for (let xx = f.x - 2; xx <= f.x + f.w + 1; xx += 6) { px(b, '#4a2f1d', xx, f.y - 4, 2, 5); px(b, '#4a2f1d', xx, f.y + f.h - 1, 2, 5); }
  px(b, '#6b4426', f.x - 2, f.y - 3, f.w + 4, 1); px(b, '#6b4426', f.x - 2, f.y + f.h, f.w + 4, 1);
}
export function wizardTower(b, x, y) {
  shadow(b, x + 4, y, 34);
  // a small library annex beside the tower
  wall(b, x + 10, y - 14, 20, 14, false); px(b, '#9a93a8', x + 10, y - 14, 20, 14); px(b, '#7d768c', x + 26, y - 14, 4, 14);
  window_(b, x + 16, y - 10); roof(b, x + 20, y - 14, 20, 9, '#3b5fa8', '#2c4a85');
  const top = y - 60, w = 22, L = x - 11;
  px(b, '#1b1424', L - 1, top - 1, w + 2, y - top + 1);
  for (let yy = top; yy < y; yy++) for (let xx = 0; xx < w; xx++) {
    const row = Math.floor((yy - top) / 5), seam = (yy - top) % 5 === 0 || (xx + (row % 2) * 3) % 7 === 0;
    px(b, seam ? '#4a4458' : xx < 4 ? '#a59eb2' : xx < 14 ? '#857e94' : '#665f77', L + xx, yy);
  }
  px(b, '#1b1424', L - 4, top - 5, w + 8, 6); px(b, '#8a839a', L - 3, top - 4, w + 6, 4); px(b, '#a59eb2', L - 3, top - 4, w + 6, 1);
  for (let k = 0; k < 7; k++) px(b, '#1b1424', L - 3 + k * 4 + 2, top - 4, 1, 2);
  for (let i = 0; i < 32; i++) {
    const yy = top - 5 - i, hw = Math.round((32 - i) / 32 * 16);
    px(b, '#1b1424', x - hw - 1, yy, hw * 2 + 2, 1); px(b, i % 6 < 1 ? '#7a5fd9' : '#6a4fc9', x - hw, yy, hw, 1); px(b, '#45318c', x, yy, hw, 1);
  }
  px(b, '#1b1424', x - 1, top - 41, 3, 5); px(b, '#f7dd5b', x, top - 40, 1, 4);
  door(b, x, y);
  const TOWER = marks.tower = { x, y, top, windows: [{ x: x - 3, y: y - 30 }, { x: x + 2, y: y - 48 }], tip: { x, y: top - 41 } };
  for (const wdw of TOWER.windows) { px(b, '#1b1424', wdw.x - 1, wdw.y - 1, 5, 8); px(b, '#2a1d45', wdw.x, wdw.y, 3, 6); }
}
export function forgeHall(b, x, y, inTown = false) {
  if (!inTown) { mountain(b, x - 34, y - 26, 74, 50, 0.3); mountain(b, x + 38, y - 22, 70, 54, 0.3); mountain(b, x + 2, y - 36, 92, 66, 0.34); }
  const L = x - 26, T = y - 44;
  px(b, '#1b1424', L - 1, T - 1, 54, 46);
  for (let yy = T; yy < y; yy++) for (let xx = 0; xx < 52; xx++) {
    const row = Math.floor((yy - T) / 6), seam = (yy - T) % 6 === 0 || (xx + (row % 2) * 6) % 12 === 0;
    px(b, seam ? '#5e574d' : xx < 4 ? '#b3aa9b' : xx > 46 ? '#7d766a' : '#9a9184', L + xx, yy);
  }
  px(b, '#1b1424', L - 5, T - 7, 62, 8); px(b, '#7d766a', L - 4, T - 6, 60, 6); px(b, '#b3aa9b', L - 4, T - 6, 60, 1);
  for (let i = 0; i < 7; i++) { const rx = L + 3 + i * 7; px(b, '#f2b84b', rx, T - 4, 3, 1); px(b, '#f2b84b', rx + 1, T - 4, 1, 3); }
  for (let i = 0; i < 30; i++) {
    const yy = y - 30 + i, hw = i < 8 ? Math.round(Math.sqrt(Math.max(0, 64 - (8 - i) ** 2)) * 11 / 8) : 11;
    px(b, '#1b1424', x - hw - 1, yy, hw * 2 + 2, 1); px(b, '#120c10', x - hw, yy, hw * 2, 1);
  }
  for (let k = -9; k <= 9; k += 3) px(b, '#4a4458', x + k, y - 29 + (Math.abs(k) > 6 ? 3 : 0), 1, 4);
  for (const bx of [L + 4, L + 44]) { px(b, '#1b1424', bx - 1, T + 3, 6, 18); px(b, '#b8323f', bx, T + 4, 4, 15); px(b, '#f2b84b', bx + 1, T + 9, 2, 4); px(b, '#1b1424', bx, T + 19, 1, 2); px(b, '#1b1424', bx + 3, T + 19, 1, 2); }
  px(b, '#6d665c', x - 17, y - 2, 34, 3); px(b, '#8a8276', x - 15, y - 2, 30, 1);
  // anvil and a weapon rack out front
  const A = marks.anvil = { x: x + 46, y: y + 20 };
  shadow(b, A.x, A.y + 8, 18);
  px(b, '#1b1424', A.x - 9, A.y - 4, 18, 10); px(b, '#5b6470', A.x - 8, A.y - 3, 16, 4); px(b, '#7b8694', A.x - 8, A.y - 3, 16, 1);
  px(b, '#3d444e', A.x - 4, A.y + 1, 8, 5); px(b, '#5a3720', A.x - 6, A.y + 6, 12, 3);
  const rx = x - 52, ry = y + 12;
  px(b, '#4a2f1d', rx - 12, ry - 3, 26, 3);
  for (let i = 0; i < 4; i++) { const sx = rx - 9 + i * 6; px(b, '#c9d2dc', sx, ry - 16, 2, 13); px(b, '#f2f6fa', sx, ry - 16, 1, 10); px(b, '#6b4426', sx - 1, ry - 5, 4, 2); }
  px(b, '#4a2f1d', rx - 12, ry - 3, 2, 6); px(b, '#4a2f1d', rx + 12, ry - 3, 2, 6);
  const vents = [{ x: x - 34, y: y - 70 }, { x: x + 36, y: y - 70 }];
  marks.vents.push(...vents);
  for (const v of vents) { px(b, '#1b1424', v.x - 3, v.y, 7, 9); px(b, '#4a4458', v.x - 2, v.y + 1, 5, 8); px(b, '#6a6478', v.x - 2, v.y + 1, 1, 8); }
  marks.forge = { x, y: y - 12 };
}
export function dungeonCave(b, x, y) {
  for (let i = 0; i < 54; i++) {
    const yy = y - 54 + i, hw = Math.round(12 + i * 0.95 + Math.sin(i * 0.7) * 2);
    px(b, '#1b1424', x - hw - 1, yy, hw * 2 + 2, 1); px(b, '#5a534c', x - hw, yy, hw, 1); px(b, '#433d38', x, yy, hw, 1);
    if (i % 6 === 2) px(b, '#6e665d', x - hw + 2, yy, Math.max(1, hw - 7), 1);
  }
  const sy = y - 28;
  for (let dy = -17; dy <= 17; dy++) for (let dx = -18; dx <= 18; dx++) {
    const dome = (r) => dy <= 2 && Math.hypot(dx, dy * 1.05) <= r;
    const jaw = (r) => dy > 0 && dy <= 13 + (r - 16) && Math.abs(dx) <= r - 5 - Math.max(0, dy - 9);
    if (dome(16.5) || jaw(16.5)) px(b, '#1b1424', x + dx, sy + dy);
    if (dome(15.4) || jaw(15.4)) px(b, dx < -7 ? '#ece5d5' : dx > 6 ? '#b3a990' : '#d6cfc0', x + dx, sy + dy);
  }
  for (const ex of [-7, 7]) { px(b, '#1b1424', x + ex - 4, sy - 5, 8, 7); px(b, '#1b1424', x + ex - 3, sy - 6, 6, 9); }
  px(b, '#1b1424', x - 1, sy + 4, 3, 3); px(b, '#1b1424', x, sy + 7, 1, 1);
  px(b, '#120c10', x - 8, sy + 9, 16, y - sy - 9); px(b, '#1b1424', x - 9, sy + 9, 1, y - sy - 9); px(b, '#1b1424', x + 8, sy + 9, 1, y - sy - 9);
  for (let k = -7; k <= 5; k += 3) { px(b, '#1b1424', x + k - 1, sy + 9, 3, 4); px(b, '#efe6d2', x + k, sy + 9, 2, 3); }
  for (const [bx, by] of [[x + 16, y + 3], [x - 18, y + 5], [x + 26, y - 4]]) { px(b, '#d6cfc0', bx, by, 6, 2); px(b, '#d6cfc0', bx - 1, by - 1, 2, 4); px(b, '#d6cfc0', bx + 5, by - 1, 2, 4); }
  marks.skull = { x, eyes: [{ x: x - 7, y: sy - 2 }, { x: x + 7, y: sy - 2 }], mouth: { x, y: y - 6 } };
  const torches = [{ x: x - 26, y: y - 10 }, { x: x + 26, y: y - 10 }];
  marks.torches.push(...torches);
  for (const t of torches) { px(b, '#1b1424', t.x - 1, t.y, 3, 12); px(b, '#4a2f1d', t.x, t.y, 1, 11); }
}
export function alchemistHut(b, x, y) {
  for (let dy = -9; dy <= 9; dy++) for (let dx = -32; dx <= 32; dx++) {
    const e = (dx / 32) ** 2 + (dy / 9) ** 2; if (e > 1) continue;
    px(b, e > 0.8 ? '#3a4c2c' : hash(x + dx, y + dy) > 0.93 ? '#3d6150' : '#2f4b3e', x + dx, y + 2 + dy);
  }
  for (const sx of [-15, -6, 5, 14]) { px(b, '#1b1424', sx + x - 1, y - 11, 3, 15); px(b, '#5a3720', x + sx, y - 10, 1, 13); }
  px(b, '#1b1424', x - 21, y - 14, 42, 5); px(b, '#8a5a34', x - 20, y - 13, 40, 2); px(b, '#5a3720', x - 20, y - 11, 40, 1);
  for (let r = 0; r < 4; r++) px(b, '#6b4426', x - 26, y - 10 + r * 3, 5, 1);
  px(b, '#4a2f1d', x - 26, y - 12, 1, 14); px(b, '#4a2f1d', x - 22, y - 12, 1, 14);
  px(b, '#1b1424', x - 15, y - 33, 30, 20);
  for (let xx = 0; xx < 28; xx++) px(b, xx % 4 === 0 ? '#5a3720' : xx > 22 ? '#6b4426' : '#8a5a34', x - 14 + xx, y - 32, 1, 18);
  door(b, x - 5, y - 14);
  px(b, '#1b1424', x + 4, y - 28, 7, 7); px(b, '#3a6b3a', x + 5, y - 27, 5, 5);
  for (let dy = -16; dy <= 0; dy++) for (let dx = -24; dx <= 24; dx++) {
    const e = (dx / 23) ** 2 + (dy / 16) ** 2; if (e > 1) continue;
    let c = e > 0.86 ? '#1b1424' : dx < -8 && dy < -7 ? '#e05a48' : dx > 9 ? '#8e2a20' : '#c0392b';
    for (const [sx, sy, r] of [[-11, -8, 2.2], [3, -12, 2.6], [12, -5, 1.8], [-3, -4, 1.6], [-16, -3, 1.4]]) if (e <= 0.86 && Math.hypot(dx - sx, dy - sy) < r) c = '#fff3d0';
    px(b, c, x + dx, y - 33 + dy);
  }
  px(b, '#1b1424', x - 23, y - 34, 46, 2); px(b, '#e9d6a8', x - 22, y - 34, 44, 1);
  px(b, '#1b1424', x + 12, y - 58, 5, 12); px(b, '#5b6470', x + 13, y - 57, 3, 11); px(b, '#1b1424', x + 14, y - 61, 6, 4); px(b, '#7b8694', x + 15, y - 60, 4, 2);
  marks.chimneys.push({ x: x + 17, y: y - 62, magic: true });
  for (const [bx, by, c] of [[x + 20, y - 16, '#a593ff'], [x + 24, y - 16, '#84d488'], [x - 18, y - 16, '#e8606f']]) { px(b, '#1b1424', bx - 1, by - 5, 4, 5); px(b, c, bx, by - 3, 2, 3); px(b, '#e8e2d6', bx, by - 4, 2, 1); }
  marks.hut = { window: { x: x + 7, y: y - 25 } };
}

export function mineEntrance(b, x, y) {
  mountain(b, x + 2, y - 8, 70, 50, 0.45); // the hill it is dug into
  for (let i = 0; i < 20; i++) { const hw = 13 + i; px(b, '#1b1424', x - hw - 1, y - 20 + i, hw * 2 + 2, 1); px(b, '#8a8276', x - hw, y - 20 + i, hw, 1); px(b, '#6d665c', x, y - 20 + i, hw, 1); }
  px(b, '#120c10', x - 7, y - 15, 14, 15);
  px(b, '#3a2414', x - 10, y - 18, 20, 4); px(b, '#8a5a34', x - 10, y - 18, 20, 2);
  px(b, '#3a2414', x - 10, y - 15, 3, 15); px(b, '#8a5a34', x - 10, y - 15, 2, 15);
  px(b, '#3a2414', x + 7, y - 15, 3, 15); px(b, '#6b4426', x + 8, y - 15, 2, 15);
  // a sign over the door with a crossed pick
  px(b, '#1b1424', x - 6, y - 25, 12, 7); px(b, '#8a5a34', x - 5, y - 24, 10, 5); px(b, '#c9d2dc', x - 3, y - 23, 6, 1); px(b, '#5a3720', x, y - 23, 1, 4);
  // rails out to the ore heap
  for (let i = 0; i <= 36; i += 3) { const rx = x + Math.round(i * 0.95), ry = y + Math.round(i * 0.4); px(b, '#5a3720', rx - 1, ry - 1, 3, 4); }
  for (let i = 0; i <= 36; i++) { const rx = x + Math.round(i * 0.95), ry = y + Math.round(i * 0.4); px(b, '#7b8694', rx - 2, ry, 1, 1); px(b, '#7b8694', rx + 2, ry + 1, 1, 1); }
  // the ore heap and a rock face being worked
  const hx = x + 40, hy = y + 18;
  for (let dy = -6; dy <= 0; dy++) for (let dx = -9; dx <= 9; dx++) if (Math.abs(dx) <= 9 + dy * 1.4) px(b, hash(dx + 40, dy) > .75 ? '#e39a4d' : hash(dx, dy + 9) > .5 ? '#7d7568' : '#5f584e', hx + dx, hy + dy);
  rock(b, x - 22, y + 4, 5, '#9a938a', '#6e675e'); rock(b, x - 28, y + 2, 3);
  marks.lamps.push({ x: x + 12, y: y - 12 });
  px(b, '#1b1424', x + 11, y - 15, 3, 4); px(b, '#ffd27a', x + 12, y - 14, 1, 2);
}
export function woodyard(b, x, y) {
  // a stump, a chopping log and a stack of split wood
  px(b, 'rgba(0,0,0,.28)', x - 6, y, 13, 3); px(b, '#1b1424', x - 5, y - 6, 11, 6); px(b, '#7a4a2a', x - 4, y - 5, 9, 5); px(b, '#c9a86e', x - 4, y - 6, 9, 2); px(b, '#8a5a34', x - 2, y - 6, 1, 1);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const lx = x + 14 + i * 5 + row * 2, ly = y - 2 - row * 4; px(b, '#1b1424', lx - 1, ly - 3, 6, 5); px(b, '#8a5a34', lx, ly - 2, 4, 3); px(b, '#e0c08a', lx, ly - 2, 1, 3); }
}
export function cookfire(b, x, y) {
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rock(b, Math.round(x + Math.cos(a) * 7), Math.round(y + Math.sin(a) * 3), 1, '#8d857a', '#5f584e'); }
  px(b, '#3a2414', x - 7, y - 16, 1, 15); px(b, '#3a2414', x + 7, y - 16, 1, 15); px(b, '#3a2414', x - 7, y - 16, 15, 1); // the spit over the fire
  px(b, '#5a3720', x - 12, y + 6, 8, 3); px(b, '#5a3720', x + 6, y + 6, 8, 3); // two benches
}
export function washingLine(b, x, y) {
  px(b, '#3a2414', x, y - 12, 1, 12); px(b, '#3a2414', x + 24, y - 12, 1, 12);
}


// ── the folk: party members, villagers, monsters and the dragon ──
export const BASE = { k: '#1b1424', s: '#f1c49b', e: '#2b1b14', w: '#eeeae0', y: '#f2b84b', n: '#6b4426', b: '#7a4a2a', m: '#9c4a3a' };
export const BODIES = {
  wizard: { pal: { p: '#6a4fc9', q: '#45318c', y: '#f7dd5b', L: '#45318c' }, rows: [
    '....kkk.....', '...kpppk....', '...kppypk...', '..kppppppk..', '.kkkkkkkkkk.', '..kssssssk..', '..ksessesk..',
    '..kwwwwwwk..', '.kpkwwwwkpk.', 'kppkwwwwkppk', 'kspppwwpppsk', '.kppppppppk.', '.kqqqqqqqqk.'] },
  rogue: { pal: { g: '#3f8f4f', G: '#2c6b3a', c: '#3a3346', m: '#1e1c26', d: '#d6dde6', L: '#2a2533' }, rows: [
    '....kkkk....', '...kggggk...', '..kggggggk..', '..kgGkkGgk..', '..kGsssskk..', '..kGesseGk..', '..kGmmmmGk..',
    '.kcGGmmGGck.', 'kcccGGGGccck', 'kcckccccdcck', 'ksccccccccsk', '.kccbbbbcck.', '.kcccccccck.'] },
  dwarf: { pal: { h: '#b8c0c8', w: '#efe8d8', r: '#d9772b', a: '#4f6d8f', b: '#f2b84b', L: '#6b4426' }, rows: [
    '............', '...kkkkkk...', '..khhhhhhk..', '.kwhhhhhhwk.', '..khkkkkhk..', '..ksessesk..', '.krrssssrrk.',
    '.krrrrrrrrk.', 'karrrrrrrrak', 'kaarrrrrraak', 'ksaaabbaaask', '.kaaaaaaaak.', '.kaaaaaaaak.'] },
  alchemist: { pal: { t: '#2f9c8c', T: '#1f6e63', o: '#f29b38', A: '#d9c08f', L: '#1f6e63' }, rows: [
    '....kkkk....', '...kttttk...', '..kttttttk..', '..kssssssk..', '..kookkook..', '..kssssssk..', '..kkssssk...',
    '.kttAAAAttk.', 'kttkAAAAkttk', 'ksskAAAAkssk', '.kttAAAAttk.', '.kttttttttk.', '.kTTTTTTTTk.'] },
  guildmaster: { pal: { R: '#b8323f', u: '#3b5fa8', L: '#3a2a1e' }, rows: [
    '..k.k.k.k...', '..kykykykk..', '..kyyyyyyk..', '..knnnnnnk..', '..knssssnk..', '..ksessesk..', '..kssmmssk..',
    '.kRkuuuukRk.', 'kRRuuyyuuRRk', 'kRsuuuuuusRk', 'kRRuuuuuuRRk', '.kRuuuuuuRk.', '.kRRuuuuRRk.'] },
};
BODIES.sellsword = { pal: { g: '#7d7f8c', G: '#5a5c68', c: '#4a4250', m: '#1e1c26', d: '#d6dde6', L: '#2a2533' }, rows: BODIES.rogue.rows };
export const LEGS = [
  ['...kLk.kLk..', '...kLk.kLk..', '..kkk..kkk..'],
  ['...kLk.kLk..', '..kLk...kLk.', '..kk.....kk.'],
  ['...kLkkLk...', '....kLLk....', '....kkkk....'],
];
/** Draws a 12×16 party member (frame 0 standing, 1 and 2 walking) with its top-left at (x, y). */
export function member(b, cls, frame, x = 0, y = 0, flip = false, cape) {
  const def = BODIES[cls], pal = { ...BASE, ...def.pal, ...(cape ? { R: cape } : {}) };
  [...def.rows, ...LEGS[frame]].forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; const c = pal[ch]; if (c) px(b, c, x + (flip ? 11 - i : i), y + j) }));
}
export const SLIME = ['...kkkk...', '.kkggggkk.', 'kgggggggGk', 'kgwkggwkGk', 'kggggggggk', 'kgggmmgggk', '.kggggggk.', '..kkkkkk..'];
export function slime(b, kind, frame, x = 0, y = 0) {
  const [g, G] = [['#d1495b', '#9e2f3f'], ['#9b59d0', '#6d3a99'], ['#e07a2f', '#a8541c']][kind % 3];
  SLIME.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '.') return; px(b, { k: '#1b1424', g, G, w: '#fff', m: '#2b1b14' }[ch], x + i, y + j + (frame && j < 2 ? 1 : 0)) }));
}
/** A townsperson, feet at (x, y). */
export function villager(b, x, y, shirt, hair, step = 0) {
  px(b, 'rgba(0,0,0,.35)', x - 3, y - 1, 7, 2);
  px(b, '#1b1424', x - 3, y - 11, 6, 9); px(b, hair, x - 2, y - 11, 4, 2); px(b, '#f1c49b', x - 2, y - 9, 4, 2);
  px(b, shirt, x - 2, y - 7, 4, 4); px(b, '#2b2433', x - 2 + step, y - 3, 1, 3); px(b, '#2b2433', x + 1 - step, y - 3, 1, 3);
}
function tri(b, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx)), minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (!area) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area, w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
    if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) px(b, color, x, y);
  }
}
/** The dragon facing right, its body's centre at (0, 0): wings up (1), down (0) or folded (-1). */
export function dragon(b, up) {
  const y = 0;
  if (up === 1) { tri(b, -3, y - 4, 6, y - 4, -10, y - 20, '#6a1a22'); tri(b, -10, y - 20, 6, y - 4, 2, y - 18, '#6a1a22'); }
  else if (up === 0) { tri(b, -3, y - 3, 6, y - 3, -8, y + 10, '#6a1a22'); tri(b, -8, y + 10, 6, y - 3, 3, y + 8, '#6a1a22'); }
  for (let i = 0; i < 9; i++) px(b, '#1b1424', -9 - i, y - 2 + Math.round(Math.sin(i * .7) * 1.5) + (i >> 2), 2, 3);
  for (let i = 0; i < 9; i++) px(b, '#8e2a20', -9 - i, y - 1 + Math.round(Math.sin(i * .7) * 1.5) + (i >> 2), 2, 1);
  px(b, '#1b1424', -20, y - 1, 3, 3); px(b, '#e8606f', -19, y, 1, 1);
  px(b, '#1b1424', -10, y - 6, 20, 9); px(b, '#b8323f', -9, y - 5, 18, 6); px(b, '#e39a4d', -7, y - 1, 14, 2); px(b, '#d1495b', -9, y - 5, 18, 1);
  for (let i = -8; i < 8; i += 3) px(b, '#f2b84b', i, y - 7, 2, 2);
  px(b, '#1b1424', -6, y + 2, 3, 3); px(b, '#1b1424', 4, y + 2, 3, 3);
  px(b, '#1b1424', 8, y - 10, 5, 7); px(b, '#b8323f', 9, y - 9, 3, 6);
  px(b, '#1b1424', 10, y - 14, 9, 6); px(b, '#b8323f', 11, y - 13, 7, 4); px(b, '#e39a4d', 15, y - 11, 4, 2);
  px(b, '#f7dd5b', 13, y - 13, 1, 1); px(b, '#1b1424', 11, y - 17, 1, 3); px(b, '#f3e6c0', 12, y - 17, 1, 2);
  const wing = tips => { for (let i = 0; i < tips.length - 1; i++) tri(b, -1, y - 5, tips[i][0], tips[i][1], tips[i + 1][0], tips[i + 1][1], '#1b1424'); for (let i = 0; i < tips.length - 1; i++) { const a = tips[i], c = tips[i + 1]; tri(b, 0, y - 5, a[0] * .9, y - 5 + (a[1] - y + 5) * .9, c[0] * .9, y - 5 + (c[1] - y + 5) * .9, '#d1495b'); } };
  if (up === 1) wing([[8, y - 6], [6, y - 22], [-4, y - 28], [-14, y - 20], [-8, y - 6]]);
  else if (up === 0) wing([[8, y - 4], [6, y + 10], [-2, y + 15], [-12, y + 9], [-8, y - 4]]);
  else tri(b, -6, y - 6, 6, y - 6, -10, y - 12, '#6a1a22');
}

/** The fire mountain: a basalt cone, a crater of lava and glowing rivulets down its flanks. */
export function volcano(b, x, y, w = 96, h = 74) {
  px(b, 'rgba(0,0,0,.3)', x - (w >> 1), y - 1, w, 4);
  const crater = 9;
  for (let i = 0; i <= h; i++) {
    const yy = y - h + i, hw = Math.round(crater + (i / h) ** 0.85 * (w / 2 - crater)), ridge = Math.round(Math.sin(i * 0.5 + x) * 1.5);
    px(b, '#1b1414', x - hw - 1, yy, hw * 2 + 3, 1);
    px(b, i % 7 === 3 ? '#4a3a36' : '#3a2c2a', x - hw, yy, hw + ridge, 1);
    px(b, i % 9 === 4 ? '#2a1e1e' : '#2e2222', x + ridge, yy, hw - ridge + 1, 1);
  }
  // the crater's lip and its lava
  px(b, '#1b1414', x - crater - 2, y - h - 2, crater * 2 + 5, 4); px(b, '#ff7a2a', x - crater, y - h - 1, crater * 2 + 1, 2); px(b, '#ffd27a', x - crater + 3, y - h - 1, crater * 2 - 5, 1);
  // lava running down: each rivulet wanders as it falls
  for (const [sx, len, dir] of [[-4, 0.7, -1], [3, 0.95, 1], [0, 0.5, 0], [-7, 0.4, -1]]) {
    let lx = x + sx
    for (let i = 0; i < h * len; i++) {
      lx += (hash(i + sx * 7, x) - 0.5 + dir * 0.18) * 1.2
      const yy = y - h + 1 + i
      px(b, i % 6 < 4 ? '#ff7a2a' : '#c0392b', Math.round(lx), yy, 2, 1); if (i % 5 === 0) px(b, '#ffd27a', Math.round(lx), yy, 1, 1)
    }
  }
  // cooled lava rocks at its foot
  for (let k = 0; k < 10; k++) { const rx = x - w / 2 + 6 + hash(k, x) * (w - 12), ry = y - 2 - hash(x, k) * 5; px(b, '#1b1414', Math.round(rx) - 2, Math.round(ry) - 2, 5, 3); px(b, '#4a3a36', Math.round(rx) - 1, Math.round(ry) - 2, 3, 2); if (k % 3 === 0) px(b, '#ff7a2a', Math.round(rx), Math.round(ry), 1, 1) }
  marks.volcano = { x, y: y - h - 1, foot: y };
}
/** A crack in the badlands with lava showing through. */
export function lavaCrack(b, x, y) {
  let lx = x
  for (let i = 0; i < 8; i++) { lx += hash(i, x + y) > 0.5 ? 1 : 0; px(b, '#1b1414', lx - 1, y + (i >> 1), 3, 1); px(b, i % 3 ? '#ff7a2a' : '#ffd27a', lx, y + (i >> 1), 1, 1); x++ }
}
