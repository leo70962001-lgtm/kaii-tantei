// node tools/anim.js <out.png> <char> <anim...> [scale] — every frame of the named animations in a row
// (one row per animation), cropped to the union of the drawn pixels. char = jk | vamp | maid | wolf.
// BROKEN=arm,leg marks parts as broken. Frame durations are printed under each cell in the log.
'use strict';
const { Canvas } = require('./png');
require('../src/px.js'); require('../src/fx.js'); require('../src/rig.js');
require('../src/jk.js'); require('../src/vamp.js'); require('../src/maid.js'); require('../src/anims.js');
const PX = globalThis.PX, A = globalThis.ANIMS;
const CH = { jk: [globalThis.JK, A.jk], vamp: [globalThis.VAMP, A.vamp], maid: [globalThis.MAID, A.maid], wolf: [globalThis.MAID, A.wolf] };
const out = process.argv[2] || 'anim.png';
const [C, build] = CH[process.argv[3] || 'jk'];
const anims = build();
const names = process.argv.slice(4).filter((a) => isNaN(+a));
const S = +(process.argv.slice(4).find((a) => !isNaN(+a)) || 5);
const broken = {};
for (const b of (process.env.BROKEN || '').split(',').filter(Boolean)) broken[b] = 1;
const rows = names.map((n) => { if (!anims[n]) throw new Error('no anim ' + n); return anims[n].frames.map((fr) => ({ fr, buf: C.render(Object.assign({}, fr.pose, { broken }), {}) })); });
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
for (const r of rows) for (const { buf: b } of r) for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.c[y * b.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(C.SIZE.w - 1, x1 + 2); y1 = Math.min(C.SIZE.h - 1, y1 + 2);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const cols = Math.max(...rows.map((r) => r.length));
const cv = new Canvas(cols * (cw * S + 4) + 4, rows.length * (ch * S + 4) + 4, PX.hex('#cfcac1'));
rows.forEach((r, j) => r.forEach(({ fr, buf: b }, i) => {
  const X = 4 + i * (cw * S + 4), Y = 4 + j * (ch * S + 4);
  cv.checker(X, Y, cw * S, ch * S, S * 4, fr.hb ? PX.hex('#f3e3e0') : PX.hex('#ebe8e2'), fr.hb ? PX.hex('#eed6d2') : PX.hex('#e1ddd5'));
  const gy = Y + (C.SIZE.oy - y0 - (fr.lift || 0)) * S;
  cv.rect(X, gy, cw * S, 1, PX.hex('#b9b2a6'));
  if (fr.hb) { // hit box outline in authored coords
    const [bx0, by0, bx1, by1] = fr.hb;
    const px0 = X + (C.SIZE.ox + bx0 - x0) * S, py0 = Y + (C.SIZE.oy + by0 - y0 - (fr.lift || 0)) * S, px1 = X + (C.SIZE.ox + bx1 - x0) * S, py1 = Y + (C.SIZE.oy + by1 - y0 - (fr.lift || 0)) * S;
    const red = PX.rgba(230, 60, 60, 255);
    cv.rect(px0, py0, px1 - px0, 1, red); cv.rect(px0, py1, px1 - px0, 1, red); cv.rect(px0, py0, 1, py1 - py0, red); cv.rect(px1, py0, 1, py1 - py0, red);
  }
  const crop = { w: cw, h: ch, c: new Uint32Array(cw * ch) };
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop.c[y * cw + x] = b.c[(y + y0) * b.w + (x + x0)];
  cv.blit(crop, X, Y - (fr.lift || 0) * S, S);
}));
cv.save(out);
console.log('wrote', out, names.map((n, j) => n + ':' + rows[j].map((c) => c.fr.dur).join('/')).join('  '));
