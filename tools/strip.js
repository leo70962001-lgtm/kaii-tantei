// node tools/strip.js <out.png> <move...> [scale] — every frame of the named sprite moves in a row (one row per
// move) at the game's scale: figure + drawn effects, ground line (yellow), anchor (red), hit box (red outline).
'use strict';
const { Canvas } = require('./png');
require('../src/px.js'); require('../src/sprites-jk.js'); require('../src/sprite.js'); require('../src/jk-moves.js');
const PX = globalThis.PX, SPR = globalThis.SPR, A = globalThis.JKS.moves();
const out = process.argv[2] || 'strip.png';
const names = process.argv.slice(3).filter((a) => isNaN(+a));
const S = +(process.argv.slice(3).find((a) => !isNaN(+a)) || 2);
const rows = names.map((n) => { if (!A[n]) throw new Error('no move ' + n); return A[n].frames.map((fr) => ({ fr, img: fr.sprite ? SPR.frame(fr.sprite.tag, fr.sprite.i, { comp: fr.sprite.comp, crop: fr.sprite.crop }) : null })); });
const CW = 150, CH = 150, OX = 60, OY = 140;  // world px cell, origin (feet) inside it
const cols = Math.max(...rows.map((r) => r.length));
const cv = new Canvas(cols * (CW * S + 4) + 4, rows.length * (CH * S + 4) + 4, PX.hex('#7c96a3'));
rows.forEach((r, j) => r.forEach(({ fr, img }, i) => {
  const X = 4 + i * (CW * S + 4), Y = 4 + j * (CH * S + 4);
  cv.checker(X, Y, CW * S, CH * S, S * 8, fr.hb ? PX.hex('#88a0ac') : PX.hex('#7c96a3'), fr.hb ? PX.hex('#8ea6b2') : PX.hex('#829ba8'));
  const gy = Y + (OY - (fr.lift || 0)) * S;
  cv.rect(X, gy, CW * S, 1, PX.hex('#ffe64a'));
  if (img && !fr.pose.hidden) {
    const w = img.pw || img.w, h = img.ph || img.h, ds = img.ds || 1;   // pixel size; drawn at S·ds (ds 0.5 for the 164-px sheets)
    const buf = { w, h, c: new Uint32Array(w * h) };
    for (let k = 0; k < w * h; k++) buf.c[k] = img.fig[k] || (img.eff ? img.eff[k] : 0);
    const s2 = S * ds;
    if (s2 >= 1) cv.blit(buf, X + (OX - img.ox) * S, Y + (OY - (fr.lift || 0) - img.oy) * S, s2);
    else { const W2 = Math.round(w * s2), H2 = Math.round(h * s2), b2 = { w: W2, h: H2, c: new Uint32Array(W2 * H2) }; for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) b2.c[y * W2 + x] = buf.c[Math.floor(y / s2) * w + Math.floor(x / s2)]; cv.blit(b2, X + (OX - img.ox) * S, Y + (OY - (fr.lift || 0) - img.oy) * S, 1); }
    cv.rect(X + OX * S - 1, gy - 1, 3, 3, PX.hex('#ff3030'));
  }
  if (fr.hb) {
    const [bx0, by0, bx1, by1] = fr.hb, red = PX.rgba(230, 60, 60, 255);
    const px0 = X + (OX + bx0) * S, py0 = Y + (OY + by0 - (fr.lift || 0)) * S, px1 = X + (OX + bx1) * S, py1 = Y + (OY + by1 - (fr.lift || 0)) * S;
    cv.rect(px0, py0, px1 - px0, 1, red); cv.rect(px0, py1, px1 - px0, 1, red); cv.rect(px0, py0, 1, py1 - py0, red); cv.rect(px1, py0, 1, py1 - py0, red);
  }
}));
cv.save(out);
console.log('wrote', out, names.map((n, j) => n + ':' + rows[j].map((c) => (c.fr.sprite ? c.fr.sprite.tag + c.fr.sprite.i : '-') + '/' + c.fr.dur).join(' ')).join('  |  '));
