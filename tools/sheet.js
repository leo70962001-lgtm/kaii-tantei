// node tools/sheet.js <out.png> [scale] [char] [poseFile.js] — renders poses for review, cropped to the
// union of the drawn pixels, on a checker. char = jk | vamp | maid | wolf. CROP=0 keeps the full frame.
'use strict';
const path = require('path');
const { Canvas } = require('./png');
require('../src/px.js');
require('../src/fx.js');
require('../src/rig.js');
for (const f of ['jk', 'vamp', 'maid', 'cast-data', 'cast', 'frames-jk', 'sheetfx']) { try { require('../src/' + f + '.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
const PX = globalThis.PX;
const CH = { jk: globalThis.JK, vamp: globalThis.VAMP, maid: globalThis.MAID, wolf: globalThis.WOLF };

const out = process.argv[2] || 'sheet.png';
const S = +(process.argv[3] || 6);
const C = CH[process.argv[4] || 'jk'];
if (!C) throw new Error('no such character');
let poses = [{}, { flip: true }];
if (process.argv[5]) poses = require(path.resolve(process.argv[5]));

const bufs = poses.map((p) => C.render(p, { flip: p.flip }));
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
for (const b of bufs) for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
  if (b.c[y * b.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
}
if (process.env.CROP === '0') { x0 = 0; y0 = 0; x1 = bufs[0].w - 1; y1 = bufs[0].h - 1; }
x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(bufs[0].w - 1, x1 + 2); y1 = Math.min(bufs[0].h - 1, y1 + 2);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const cols = Math.min(poses.length, +(process.env.SHEET_COLS || 8));
const rows = Math.ceil(poses.length / cols);
const cv = new Canvas(cols * (cw * S + 6) + 6, rows * (ch * S + 6) + 6, PX.hex('#cfcac1'));
bufs.forEach((b, i) => {
  const X = 6 + (i % cols) * (cw * S + 6), Y = 6 + Math.floor(i / cols) * (ch * S + 6);
  cv.checker(X, Y, cw * S, ch * S, S * 4, PX.hex('#ebe8e2'), PX.hex('#e1ddd5'));
  // ground line
  const gy = Y + (C.SIZE.oy - y0) * S;
  cv.rect(X, gy, cw * S, 1, PX.hex('#b9b2a6'));
  const crop = { w: cw, h: ch, c: new Uint32Array(cw * ch) };
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop.c[y * cw + x] = b.c[(y + y0) * b.w + (x + x0)];
  cv.blit(crop, X, Y, S);
});
cv.save(out);
console.log('wrote', out, cw + 'x' + ch, 'crop at', x0, y0);
