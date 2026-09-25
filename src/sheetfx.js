// sheetfx.js — the Gemini action sheet's slash effects (src/frames-jk.js cells) as FX overlays for the
// rig-drawn JK: the effect pixels (cell minus figure) are upscaled ×3 with Scale3x so their diagonals stay
// clean at the 111 px sheet scale, then drawn at the cell's anchor offsets. FX entry:
//   { type: 'sheet', char: 'jk', cell: i, x, y, age }   (x, y shift in px; age > 0.5 dithers the effect away)
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG, FX = root.FX, FRAMES = root.FRAMES;
  if (!FX || !FRAMES) return;
  const S = 3;
  const cache = new Map();

  function scale3x(px, w, h) {
    const W = w * S, out = new Uint32Array(W * h * S);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : px[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      let e = [E, E, E, E, E, E, E, E, E];
      if (B !== H && D !== F) {
        e = [
          D === B ? D : E,
          (D === B && E !== C) || (B === F && E !== A) ? B : E,
          B === F ? F : E,
          (D === B && E !== G) || (D === H && E !== A) ? D : E,
          E,
          (B === F && E !== I) || (H === F && E !== C) ? F : E,
          D === H ? D : E,
          (D === H && E !== I) || (H === F && E !== G) ? H : E,
          H === F ? F : E,
        ];
      }
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) out[(y * S + j) * W + x * S + i] = e[j * 3 + i];
    }
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
  // effect-only pixels of a cell (full minus figure) — or the whole cell — upscaled ×3 (Scale3x) or ×2 (Scale2x)
  function effect(char, i, o = {}) {
    const sc = o.sc || S, whole = !!o.whole;
    const key = char + ':' + i + ':' + sc + ':' + (whole ? 'w' : 'e');
    if (cache.has(key)) return cache.get(key);
    const cell = FRAMES[char][i];
    const full = RIG.imgData({ w: cell.w, h: cell.h, d: cell.d });
    let eff = full;
    if (!whole) {
      const fig = RIG.imgData({ w: cell.w, h: cell.h, d: cell.f });
      eff = new Uint32Array(full.length);
      for (let k = 0; k < full.length; k++) if (full[k] && !fig[k]) eff[k] = full[k];
    }
    const px = sc === 2 ? scale2x(eff, cell.w, cell.h) : scale3x(eff, cell.w, cell.h);
    const part = { w: cell.w * sc, h: cell.h * sc, px, ax: cell.ax * sc + 1, ay: cell.ay * sc + 1 };
    cache.set(key, part);
    return part;
  }
  function draw(buf, o, f) {
    const part = effect(f.char || 'jk', f.cell, { whole: f.whole, sc: f.sc });
    const age = f.age || 0;
    const ax = Math.round(o[0] + (f.x || 0)), ay = Math.round(o[1] + (f.y || 0));
    const P = new PX.Part(buf, PX.MATS[1], { sep: false, flag: 2 | 8 });
    const flip = !!f.flip;
    for (let j = 0; j < part.h; j++) for (let i = 0; i < part.w; i++) {
      const c = part.px[j * part.w + i];
      if (!c) continue;
      if (age > 0.35 && ((i + j) & 1)) continue;
      if (age > 0.7 && ((i & 1) || (j & 1))) continue;
      const x = ax + (flip ? part.ax - i : i - part.ax), y = ay + j - part.ay;
      P.add(x, y, { col: c });
    }
    P.commit((i) => ({ col: i.col }));
  }
  FX.DRAW = FX.DRAW || {};
  FX.sheet = draw;
  // register with the effect dispatcher
  const origDraw = FX.draw;
  FX.draw = function (buf, origin, list, layer = 'over') {
    const rest = [];
    for (const f of list || []) {
      if (f.type === 'sheet') { if (!!f.under === (layer === 'under')) draw(buf, origin, f); }
      else rest.push(f);
    }
    return origDraw(buf, origin, rest, layer);
  };
  // hit box of a cell's effect at the sheet scale (×2.78 = 111 px standing / 40 px action figure), relative to the feet
  const R = 2.78;
  FX.sheetBox = function (char, i, o = {}) {
    let [x0, y0, x1, y1] = FRAMES[char][i].eff;
    if (o.flip) [x0, x1] = [-x1, -x0];
    return [Math.round(x0 * R + (o.x || 0)), Math.round(y0 * R + (o.y || 0)), Math.round(x1 * R + (o.x || 0)), Math.round(y1 * R + (o.y || 0))];
  };
  FX.sheetPart = (char, i, o) => effect(char, i, o || {});
  FX.sheetScale = R;
})(typeof window !== 'undefined' ? window : globalThis);
