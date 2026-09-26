// sprite.js — runtime of the sprite-driven fighter (the rebuilt architecture): the JK is animated straight from
// the cells of her Gemini action sheets (src/sprites-jk.js, cut by ref/cells.py). Each cell is decoded once,
// upscaled to the game's scale with Scale3x (sheets A, B: 4 px cells → ×3) or Scale2x twice (sheet C, whose
// figures are drawn smaller → ×4) so every sheet lands at the same ~120 px standing height, companion cells
// (a smear cut apart from its kick) are composed back at their sheet offsets, and per-cell canvases are cached:
//   R / L   figure (facing right / left)      FR / FL  drawn effects only (bloom source)
//   SR / SL silhouette ink (ground shadow)    GR / GL  tint (afterimages)      WR / WL  white (hit flash)
// A frame references a cell as { tag: 'A', i: 6 }; SPR.frame() returns the canvases with the cell's anchor
// (ox, oy = ground centre in canvas px; oxL for the flipped image) and the figure / effect boxes in world px.
(function (root) {
  'use strict';
  const SHEETS = root.SPRITES && root.SPRITES.jk;
  if (!SHEETS) return;
  // the small pixel-art scale: cells are drawn at their native size (a standing figure is 41 px; ref/pixelize.py
  // brings sheet C to the same size) and shown at an integer ×2, nearest-neighbour, so every sprite pixel is a
  // crisp 2×2 world-pixel block like the references at zoom
  // cell px → world px. A/B/C/V = the sheets' own pixels (ref/refine2.py raw: 164-px cells) drawn at 0.5, which is
  // 1:1 on the 2× (960×540) canvas; H = hand-drawn 41-px frames ×2. A scale < 1 keeps the canvases at cell size and
  // the drawers size them (frame.w/h in world px, frame.ds = the draw scale).
  // The loaded sheet file says its resolution: res 4 = 164-px cells (the sheet's own pixels) drawn at 0.5 world scale;
  // res 2 = 82-px cells (src/sprites-jk-82.js, ref/pixelclean.py) drawn 1:1 on the stage's pixel grid.
  const R = (SHEETS && SHEETS.res) || 4, SC = R === 2 ? 1 : 0.5;
  const SCALE = { A: SC, B: SC, C: SC, V: SC, H: 2 };
  const RES = { A: R, B: R, C: R, V: R, H: 1 };     // cell px per 41-px-scale unit (offsets authored at the 41 scale)
  const HEAD_H = 27;   // (picture-head overlay; inactive unless the sheet data carries 'heads')
  const hasDoc = typeof document !== 'undefined';

  function decode(b64, w, h, enc) {
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const out = new Uint32Array(w * h);
    if (enc === 'prle' || enc === 'prla') {
      // palette + run-length (ref/refine2.py prle()): [npal][r g b (a) × npal][count index]... ; index 0 = transparent;
      // 'prla' palette entries carry alpha (the un-blended anti-aliased rims)
      const e = enc === 'prla' ? 4 : 3, n = bin.charCodeAt(0), pal = new Uint32Array(n + 1);
      for (let k = 0; k < n; k++) pal[k + 1] = ((e === 4 ? bin.charCodeAt(1 + k * e + 3) : 255) << 24 | bin.charCodeAt(1 + k * e + 2) << 16 | bin.charCodeAt(1 + k * e + 1) << 8 | bin.charCodeAt(1 + k * e)) >>> 0;
      let p = 1 + n * e, o = 0;
      while (p + 1 < bin.length && o < out.length) { const run = bin.charCodeAt(p), idx = bin.charCodeAt(p + 1); p += 2; const v = pal[idx]; for (let r = 0; r < run && o < out.length; r++) out[o++] = v; }
      return out;
    }
    const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    // fully transparent pixels must be 0 (they compare as "empty" everywhere)
    for (let i = 0; i < out.length; i++) if (!(out[i] >>> 24)) out[i] = 0;
    return out;
  }
  function scale2x(px, w, h) {
    const W = w * 2, out = new Uint32Array(W * h * 2);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : px[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const E = at(x, y), B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== H && D !== F) { if (D === B) e0 = D; if (B === F) e1 = F; if (D === H) e2 = D; if (H === F) e3 = F; }
      out[(y * 2) * W + x * 2] = e0; out[(y * 2) * W + x * 2 + 1] = e1; out[(y * 2 + 1) * W + x * 2] = e2; out[(y * 2 + 1) * W + x * 2 + 1] = e3;
    }
    return out;
  }
  function scale3x(px, w, h) {
    const W = w * 3, out = new Uint32Array(W * h * 3);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : px[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      let e = [E, E, E, E, E, E, E, E, E];
      if (B !== H && D !== F) {
        e = [D === B ? D : E, (D === B && E !== C) || (B === F && E !== A) ? B : E, B === F ? F : E,
          (D === B && E !== G) || (D === H && E !== A) ? D : E, E, (B === F && E !== I) || (H === F && E !== C) ? F : E,
          D === H ? D : E, (D === H && E !== I) || (H === F && E !== G) ? H : E, H === F ? F : E];
      }
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out[(y * 3 + j) * W + x * 3 + i] = e[j * 3 + i];
    }
    return out;
  }
  function nearest(px, w, h, W, H) {
    const out = new Uint32Array(W * H);
    for (let y = 0; y < H; y++) { const sy = Math.min(h - 1, Math.floor(y * h / H)); for (let x = 0; x < W; x++) out[y * W + x] = px[sy * w + Math.min(w - 1, Math.floor(x * w / W))]; }
    return out;
  }
  // upscale by a fractional factor: the nearest integer smoothing scale (Scale2x / Scale3x / Scale2x²), then a
  // nearest-neighbour resample to the exact size
  // plain integer upscale (nearest): the hand-refined pixels stay square; the smoothing scalers are kept for effects
  function up(px, w, h, s) {
    const W = Math.round(w * s), H = Math.round(h * s);
    return nearest(px, w, h, W, H);
  }
  // the standing picture's head (normal / hurt / shout faces), scaled to HEAD_H, chin point kept
  const HEADS = {};
  if (SHEETS.heads) for (const [name, hd] of Object.entries(SHEETS.heads)) {
    const s = HEAD_H / hd.h, W = Math.round(hd.w * s), H = HEAD_H;
    HEADS[name] = { w: W, h: H, px: nearest(decode(hd.d, hd.w, hd.h), hd.w, hd.h, W, H), chin: [Math.round(hd.chin[0] * s), Math.round(hd.chin[1] * s)] };
  }
  // a copy of the cell with the sheet's small head erased and the picture's head drawn at the chin point
  function withHead(c, face) {
    const H = HEADS[face] || HEADS.normal; if (!H || !c.head) return c;
    const k = c.k, pad = 16, w = c.w + pad * 2, h = c.h + pad * 2, Rd = Math.round;
    const fig = new Uint32Array(w * h), eff = c.eff ? new Uint32Array(w * h) : null;
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) { fig[(y + pad) * w + x + pad] = c.fig[y * c.w + x]; if (eff) eff[(y + pad) * w + x + pad] = c.eff[y * c.w + x]; }
    const ax = c.ax + pad, ay = c.ay + pad, b = c.head.box;
    const bx0 = ax + Rd(b[0] * k), by0 = ay + Rd(b[1] * k), bx1 = ax + Rd((b[2] + 1) * k), by1 = ay + Rd((b[3] + 1) * k);
    for (let y = Math.max(0, by0); y < Math.min(h, by1); y++) for (let x = Math.max(0, bx0); x < Math.min(w, bx1); x++) fig[y * w + x] = 0;
    const dcx = ax + Rd((c.head.chin[0] + 0.5) * k), dcy = ay + Rd((c.head.chin[1] + 1) * k) - 1;
    const ox = dcx - H.chin[0], oy = dcy - H.chin[1];
    for (let y = 0; y < H.h; y++) for (let x = 0; x < H.w; x++) { const v = H.px[y * H.w + x]; if (!v) continue; const X = ox + x, Y = oy + y; if (X >= 0 && Y >= 0 && X < w && Y < h) fig[Y * w + X] = v; }
    const fb = c.figBox ? [Math.min(c.figBox[0], ox - ax), Math.min(c.figBox[1], oy - ay), Math.max(c.figBox[2], ox + H.w - ax), c.figBox[3]] : null;
    return Object.assign({}, c, { w, h, fig, eff, ax, ay, figBox: fb, head: null });
  }
  // a decoded, upscaled cell: { w, h, k, fig, eff, ax, ay, figBox, effBox } (boxes in world px relative to the anchor)
  const cells = new Map();
  function cell(tag, i) {
    const key = tag + i;
    if (cells.has(key)) return cells.get(key);
    const c = SHEETS[tag][i], k0 = SCALE[tag], ds = k0 < 1 ? k0 : 1, k = k0 < 1 ? 1 : k0;   // ds: drawn smaller than the pixels
    const w = Math.round(c.w * k), h = Math.round(c.h * k);
    const fig = up(decode(c.f, c.w, c.h, c.enc), c.w, c.h, k);
    const eff = c.e ? up(decode(c.e, c.w, c.h, c.enc), c.w, c.h, k) : null;
    const Rd = Math.round;
    const o = { tag, i, w, h, k, ds, fig, eff, ax: Rd((c.ax + 0.5) * k), ay: Rd((c.ay + 1) * k) - 1, sX: c.sX, sY: c.sY, head: c.head || null,
      figBox: c.fig ? [Rd(c.fig[0] * k), Rd(c.fig[1] * k), Rd((c.fig[2] + 1) * k), Rd((c.fig[3] + 1) * k)] : null,
      effBox: c.eff ? [Rd(c.eff[0] * k), Rd(c.eff[1] * k), Rd((c.eff[2] + 1) * k), Rd((c.eff[3] + 1) * k)] : null };
    cells.set(key, o);
    return o;
  }
  // a cell with companions (cells cut apart from the same drawing) composed at their sheet offsets
  function composed(main, comps) {
    const parts = [{ c: main, dx: 0, dy: 0 }];
    for (const q of comps) { const c = cell(q.tag, q.i); parts.push({ c, dx: Math.round((c.sX - main.sX) * main.k), dy: Math.round((c.sY - main.sY) * main.k) }); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of parts) { x0 = Math.min(x0, p.dx - p.c.ax); y0 = Math.min(y0, p.dy - p.c.ay); x1 = Math.max(x1, p.dx - p.c.ax + p.c.w); y1 = Math.max(y1, p.dy - p.c.ay + p.c.h); }
    const w = x1 - x0, h = y1 - y0, fig = new Uint32Array(w * h), eff = new Uint32Array(w * h); let anyEff = false;
    for (const p of parts) {
      const ox = p.dx - p.c.ax - x0, oy = p.dy - p.c.ay - y0;
      for (let y = 0; y < p.c.h; y++) for (let x = 0; x < p.c.w; x++) {
        const v = p.c.fig[y * p.c.w + x]; if (v) fig[(y + oy) * w + x + ox] = v;
        if (p.c.eff) { const e = p.c.eff[y * p.c.w + x]; if (e) { eff[(y + oy) * w + x + ox] = e; anyEff = true; } }
      }
    }
    const union = (key) => { let b = null; for (const p of parts) { const q = p.c[key]; if (!q) continue; const r = [q[0] + p.dx, q[1] + p.dy, q[2] + p.dx, q[3] + p.dy]; b = b ? [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])] : r; } return b; };
    return { tag: main.tag, i: main.i, w, h, k: main.k, ds: main.ds, fig, eff: anyEff ? eff : null, ax: -x0, ay: -y0, sX: main.sX, sY: main.sY, figBox: union('figBox'), effBox: union('effBox') };
  }
  // a sub-rectangle of a cell (cell px), re-anchored at the bottom centre of what it holds
  function cropped(c, box) {
    const k = c.k, x0 = Math.round(box[0] * k), y0 = Math.round(box[1] * k), x1 = Math.round((box[2] + 1) * k), y1 = Math.round((box[3] + 1) * k);
    const w = x1 - x0, h = y1 - y0, fig = new Uint32Array(w * h), eff = new Uint32Array(w * h); let anyEff = false;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x + x0, sy = y + y0; if (sx < 0 || sy < 0 || sx >= c.w || sy >= c.h) continue;
      const v = c.fig[sy * c.w + sx]; if (v) { fig[y * w + x] = v; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
      if (c.eff) { const e = c.eff[sy * c.w + sx]; if (e) { eff[y * w + x] = e; anyEff = true; } }
    }
    if (bx1 < 0) { bx0 = 0; by0 = 0; bx1 = w - 1; by1 = h - 1; }
    const ax = Math.round((bx0 + bx1) / 2), ay = by1;
    return { tag: c.tag, i: c.i, w, h, k, ds: c.ds, fig, eff: anyEff ? eff : null, ax, ay, sX: c.sX, sY: c.sY, figBox: [bx0 - ax, by0 - ay, bx1 + 1 - ax, by1 + 1 - ay], effBox: null };
  }
  function toCanvas(c32, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const id = ctx.createImageData(w, h);
    new Uint32Array(id.data.buffer).set(c32); ctx.putImageData(id, 0, 0); return cv;
  }
  const flipped = (px, w, h) => { const o = new Uint32Array(px.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + (w - 1 - x)] = px[y * w + x]; return o; };
  const hexColor = (s) => { const n = parseInt(s.replace('#', ''), 16); return (255 << 24 | (n & 255) << 16 | (n >> 8 & 255) << 8 | (n >> 16 & 255)) >>> 0; };
  const INK = (255 << 24 | 24 << 16 | 8 << 8 | 6) >>> 0, WHITE = 0xffffffff;
  // the per-frame canvases; opts: { comp: [{tag,i}], tint: '#rrggbb', flash: bool }
  const frames = new Map();
  function frame(tag, i, opts = {}) {
    const key = tag + i + (opts.comp ? ':' + opts.comp.map((q) => q.tag + q.i).join('+') : '') + (opts.crop ? ':c' + opts.crop.join(',') : '') + ':' + (opts.face || '') + ':' + (opts.tint || '');
    if (frames.has(key)) return frames.get(key);
    let c = cell(tag, i);
    if (opts.crop) c = cropped(c, opts.crop);
    if (opts.comp && opts.comp.length) c = composed(c, opts.comp);
    if (opts.face !== 'none') c = withHead(c, opts.face || 'normal');
    const { w, h } = c;
    const tint = hexColor(opts.tint || '#ff5a6e');
    const sil = new Uint32Array(w * h), ink = new Uint32Array(w * h), white = new Uint32Array(w * h);
    for (let k = 0; k < w * h; k++) if (c.fig[k]) { sil[k] = tint; ink[k] = INK; white[k] = WHITE; }
    const e = hasDoc ? {
      R: toCanvas(c.fig, w, h), L: toCanvas(flipped(c.fig, w, h), w, h),
      FR: c.eff ? toCanvas(c.eff, w, h) : null, FL: c.eff ? toCanvas(flipped(c.eff, w, h), w, h) : null,
      SR: toCanvas(ink, w, h), SL: toCanvas(flipped(ink, w, h), w, h),
      GR: toCanvas(sil, w, h), GL: toCanvas(flipped(sil, w, h), w, h),
      WR: toCanvas(white, w, h), WL: toCanvas(flipped(white, w, h), w, h),
    } : { fig: c.fig, eff: c.eff };
    // world-px metrics: the canvases stay at cell size, drawn at ds (1 for the H sheet, 0.5 for the 164-px sheets)
    const ds = c.ds || 1, sc = (b) => b ? b.map((v) => v * ds) : null;
    Object.assign(e, { w: w * ds, h: h * ds, ox: c.ax * ds, oy: c.ay * ds, oxL: (w - 1 - c.ax) * ds, figBox: sc(c.figBox), effBox: sc(c.effBox), k: c.k, ds, pw: w, ph: h });
    frames.set(key, e);
    return e;
  }
  // the katana as a prop (knocked out of her hand): the blade and hilt of the long thrust cell, grip at the left
  let swordCv = null;
  function sword() {
    if (swordCv || !hasDoc) return swordCv;
    const c = cell('A', 3), k = c.k * RES.A;   // cell px per 41-px-scale unit (the offsets below are authored at 41)
    const x0 = c.ax + 6 * k, y0 = c.ay - 26 * k, x1 = c.w, y1 = c.ay - 13 * k;
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (c.fig[y * c.w + x]) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    const w = bx1 - bx0 + 1, h = by1 - by0 + 1, px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = c.fig[(y + by0) * c.w + x + bx0];
    const ds = c.ds || 1;   // the prop canvas is at cell size; the game draws it through a matrix scaled by ds
    swordCv = { cv: toCanvas(px, w, h), w: w * ds, h: h * ds, pivot: [4 / ds, Math.round(h / 2)], ds };
    return swordCv;
  }
  root.SPR = { SCALE, sheets: SHEETS, cell, frame, sword, decode, up, toCanvas, HEADS };
})(typeof window !== 'undefined' ? window : globalThis);
