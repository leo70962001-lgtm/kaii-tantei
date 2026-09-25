// jk-frames.js — the cyborg JK drawn straight from her Gemini action sheet (src/frames-jk.js):
// every game frame is one sheet cell (figure + baked slash effect) or its figure-only version,
// placed by the cell's ground anchor. Hurt boxes come from the figure box, hit boxes from the
// effect box. Overrides root.JK's renderer; parts, name and colours stay.
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG, F = root.FRAMES && root.FRAMES.jk, R = root.JK;
  if (!F || !R) return;
  const SIZE = { w: 160, h: 120, ox: 80, oy: 100 };
  function part(cell, figOnly) {
    const k = figOnly ? '_pf' : '_pc';
    if (!cell[k]) cell[k] = { w: cell.w, h: cell.h, d: figOnly ? cell.f : cell.d };
    return cell[k];
  }
  function render(pose, opts = {}) {
    const p = pose || {};
    const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
    const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
    const cell = F[p.cell ?? 3];
    if (!p.hidden && cell) {
      RIG.blitImg(buf, part(cell, !!p.fig), [O[0] + (p.dx || 0), O[1] + (p.dy || 0)], [cell.ax, cell.ay], { sep: false });
      if (p.rot) PX.rotateBuf(buf, O[0], O[1] - 14, p.rot);
      if (p.flash) { const wh = PX.hex('#ffffff'); for (let i = 0; i < buf.c.length; i++) if (buf.c[i]) buf.c[i] = wh; }
      // broken parts: sparks where the prosthetics are, a stub of blade
      const br = p.broken || {};
      if (root.FX && (br.arm || br.leg)) {
        const fx = [];
        if (br.arm) fx.push({ type: 'bolt', x: 8, y: -22, r: 2, len: 4, n: 2, a0: -180, a1: 180, age: 0.3 + ((p.cell || 0) % 3) * 0.2, seed: 3 + (p.cell || 0), mat: 'ice' });
        if (br.leg) fx.push({ type: 'bolt', x: 4, y: -8, r: 2, len: 3, n: 2, a0: -180, a1: 180, age: 0.4, seed: 7 + (p.cell || 0), mat: 'ice' });
        root.FX.draw(buf, O, fx, 'over');
      }
    }
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  function boxes(pose) {
    const cell = F[(pose && pose.cell) ?? 3];
    const [x0, y0, x1, y1] = cell.fig;
    const h = y1 - y0;
    if (pose && pose.rot) { const all = [x0 - 8, y0 + Math.round(h * 0.35), x1 + 8, y1 + 1]; return { head: all, body: all, legs: all }; }
    return { head: [x0 + 2, y0, x1 - 2, y0 + Math.round(h * 0.3)], body: [x0, y0 + Math.round(h * 0.3), x1, y0 + Math.round(h * 0.68)], legs: [x0 + 1, y0 + Math.round(h * 0.68), x1 - 1, y1 + 1] };
  }
  function anchors(pose) {
    const cell = F[(pose && pose.cell) ?? 3];
    const [x0, y0, x1, y1] = cell.fig, w = x1 - x0, h = y1 - y0;
    return { arm: [x0 + w * 0.7, y0 + h * 0.45], leg: [x0 + w * 0.6, y0 + h * 0.85], blade: [x1 + 6, y0 + h * 0.4], uniform: [x0 + w / 2, y0 + h * 0.45] };
  }
  Object.assign(R, { SIZE, render, boxes, anchors, DEF: { cell: 3, fig: true }, fromFrames: true, cells: F });
})(typeof window !== 'undefined' ? window : globalThis);
