// rig.js — shared skeleton for the small hand-pixeled fighters (怪異探偵部).
// A character supplies bitmaps (head, torso, skirt/legs, feet) and per-frame joints for
// hips, feet and hands; the rig places knees/elbows by IK, draws limbs as pixel strokes,
// shears the torso for a lean, applies whole-body rotation, outline and hit flash, and
// reports hurt boxes (head / body / legs) so the game can resolve hits and part damage.
// Authored facing +x; the game flips the buffer to face left.
(function (root) {
  'use strict';
  const PX = root.PX;
  const { Part, limb, sprite, rad, clamp, lerp } = PX;

  const L = () => PX.LIGHT;
  const c = (pt) => [pt[0] + 0.5, pt[1] + 0.5];

  // a limb segment: capsule stroke of radius r, three tones by the side toward the light
  function stroke(buf, mat, a, b, r, opts = {}) {
    const part = new Part(buf, mat, opts.part || {});
    limb(part, c(a), c(b), () => r, {});
    part.commit((i) => {
      if (opts.band) { const v = opts.band(i); if (v !== null && v !== undefined) return v; }
      const k = (i.nx || 0) * L()[0] + (i.ny || 0) * L()[1];
      return k > 0.35 ? (opts.hi ?? 1) : k < -0.35 ? (opts.lo ?? 3) : (opts.mid ?? 2);
    });
    return part;
  }
  // a fist: 2x2 (size 2) or 3x3 (size 3) block, lit corner light
  function hand(buf, mat, h, size = 2, tone) {
    const part = new Part(buf, mat);
    const o = size === 3 ? 1 : 0;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) part.add(h[0] + i - o, h[1] + j - o, { i, j });
    part.commit((i) => (tone ? tone(i) : i.i === 0 && i.j === 0 ? 1 : i.i === size - 1 || i.j === size - 1 ? 3 : 2));
    return part;
  }
  // place a hand-drawn bitmap (rows/key) so that its pixel `anchor` lands on world point `at`
  function place(buf, mat, rows, key, at, anchor, opts = {}) {
    const part = new Part(buf, mat, opts.part || {});
    sprite(part, rows, key, at, anchor, !!opts.flip);
    part.commit(opts.colour || PX.spriteColour);
    return part;
  }
  // lean: shift rows above the pivot row by up to n px (+ forward, - back), padded so the anchor keeps its column
  function shear(rows, n, pivotRow) {
    const H = rows.length, pad = Math.abs(n), pr = pivotRow ?? H - 1;
    return rows.map((r, j) => {
      const s = Math.round(n * clamp(1 - j / pr, 0, 1));
      return '.'.repeat(pad + s) + r + '.'.repeat(pad - s);
    });
  }
  // duplicate the given rows (a longer torso without redrawing it)
  function tall(rows, dup) { const out = []; rows.forEach((r, j) => { out.push(r); if (dup.includes(j)) out.push(r); }); return out; }
  function variant(rows, edits) {
    const out = rows.map((r) => r.split(''));
    for (const [x, y, ch] of edits) if (out[y] && x < out[y].length) out[y][x] = ch;
    return out.map((r) => r.join(''));
  }
  // replace characters through a map (e.g. a torn uniform, closed eyes)
  function recolour(rows, map) { return rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch)); }

  // ---------------------------------------------------------------- skeleton
  // spec: { hipTorso:[x,y] bitmap pixel over the hip, sh:{N,F,neck}, torsoRows, torsoPivot,
  //         thigh, shin, upper, fore, kneeBend, elbowN, elbowF, hipSpread }
  function solve(p, spec, O) {
    const at = (pt) => [O[0] + pt[0], O[1] + pt[1]];
    const rel = (w) => [w[0] - O[0], w[1] - O[1]];
    const hip = at(p.hip);
    const lean = p.lean || 0;
    const pad = Math.abs(lean);
    const rows = p.torsoRows || spec.torsoRows;
    const tb = lean ? shear(rows, lean, spec.torsoPivot) : rows;
    const tAnchor = [spec.hipTorso[0] + pad, spec.hipTorso[1]];
    const tOrigin = [hip[0] - spec.hipTorso[0], hip[1] - spec.hipTorso[1]];
    const pr = spec.torsoPivot ?? rows.length - 1;
    const shiftAt = (row) => Math.round(lean * clamp(1 - row / pr, 0, 1));
    const shN = [tOrigin[0] + spec.sh.N[0] + shiftAt(spec.sh.N[1]), tOrigin[1] + spec.sh.N[1]];
    const shF = [tOrigin[0] + spec.sh.F[0] + shiftAt(spec.sh.F[1]), tOrigin[1] + spec.sh.F[1]];
    const head = p.head || [0, 0];
    const neck = [tOrigin[0] + spec.sh.neck[0] + shiftAt(spec.sh.neck[1]) + head[0], tOrigin[1] + spec.sh.neck[1] + head[1]];
    const bendTo = (a, t, l1, l2, s) => { const r = PX.ik(a, t, l1, l2, s); return [Math.round(r.mid[0]), Math.round(r.mid[1])]; };
    const hs = spec.hipSpread ?? 2;
    const hipN = [hip[0] - hs, hip[1]], hipF = [hip[0] + hs, hip[1]];
    const fN = at(p.fN), fF = at(p.fF), hN = at(p.hN), hF = at(p.hF);
    const kN = p.kN ? at(p.kN) : bendTo(hipN, fN, spec.thigh, spec.shin, p.kneeN ?? spec.kneeBend ?? -1);
    const kF = p.kF ? at(p.kF) : bendTo(hipF, fF, spec.thigh, spec.shin, p.kneeF ?? spec.kneeBend ?? -1);
    const eN = p.eN ? at(p.eN) : bendTo(shN, hN, spec.upper, spec.fore, p.elbowN ?? spec.elbowN ?? 1);
    const eF = p.eF ? at(p.eF) : bendTo(shF, hF, spec.upper, spec.fore, p.elbowF ?? spec.elbowF ?? 1);
    return { O, at, rel, hip, hipN, hipF, lean, pad, tb, tAnchor, tOrigin, shN, shF, neck, fN, fF, hN, hF, kN, kF, eN, eF };
  }

  // hurt boxes in authored coordinates (relative to the origin, +x forward, y up is negative)
  function boxes(J, spec, p) {
    const r = J.rel;
    const nk = r(J.neck), hp = r(J.hip);
    const hh = spec.headH || 14, hw = spec.headW || 12;
    const head = [nk[0] - hw / 2 + 1, nk[1] - hh, nk[0] + hw / 2 + 1, nk[1] + 1];
    const body = [Math.min(nk[0], hp[0]) - 6, nk[1], Math.max(nk[0], hp[0]) + 6, hp[1] + 3];
    const fy = Math.max(r(J.fN)[1], r(J.fF)[1]);
    const legs = [Math.min(r(J.fN)[0], r(J.fF)[0], hp[0]) - 3, hp[1] + 3, Math.max(r(J.fN)[0], r(J.fF)[0], hp[0]) + 3, fy + 1];
    if (p && p.rot) {
      // a spinning or fallen body: one box around everything
      const all = [Math.min(head[0], legs[0]) - 4, Math.min(head[1], body[1]) + 6, Math.max(head[2], legs[2]) + 4, legs[3]];
      return { head: all, body: all, legs: all };
    }
    return { head, body, legs };
  }

  // finishing: whole-body rotation about a point above the hip, outline, hit flash
  function finish(buf, p, J, opts = {}) {
    if (p.rot) PX.rotateBuf(buf, J.hip[0], J.hip[1] - (opts.rotUp ?? 8), p.rot);
    PX.outline(buf);
    if (opts.rim ?? PX.PALE_RIM) {
      // optional pale ring around the whole silhouette (D Ahruon's sheets)
      const pale = PX.hex(opts.rimCol || PX.PALE_RIM_COL || '#e6eef4');
      for (let i = 0; i < buf.c.length; i++) if ((buf.f[i] & 4) && !(buf.f[i] & 2)) buf.c[i] = pale;
    }
    if (p.flash) {
      const hi = PX.hex(opts.flashInk || '#9fb4ff'), wh = PX.hex('#ffffff');
      for (let i = 0; i < buf.c.length; i++) if (buf.c[i] && !(buf.f[i] & 2)) buf.c[i] = (buf.f[i] & 4) ? hi : wh;
    }
  }

  // weapon smear between the previous and current pose (hand key + angle key), drawn through FX.sweep
  function smear(buf, O, p, S, blade, keys) {
    if (!root.FX) return;
    const N = 30, samples = [];
    const [hk, ak] = keys || ['hF', 'sw'];
    const h0 = S.from[hk] || p[hk], h1 = (S.to && S.to[hk]) || p[hk];
    const a0 = S.from[ak] ?? p[ak], a1 = (S.to && S.to[ak]) ?? p[ak];
    for (let k = 0; k <= N; k++) {
      const t = k / N, ang = rad(lerp(a0, a1, t));
      samples.push({ h: [O[0] + lerp(h0[0], h1[0], t) + 0.5, O[1] + lerp(h0[1], h1[1], t) + 0.5], d: [Math.cos(ang), Math.sin(ang)] });
    }
    root.FX.sweep(buf, samples, { Lb: blade, inner: S.inner ?? 0.3, age: S.age, shape: S.shape, mat: S.mat || 'slash' });
  }

  // a long flowing hair mass: one ribbon hanging from rootPt (world px) with a width profile
  // w0 -> w1, bending from angle `base` (deg, screen, 90 = straight down) toward `droop`, waving with
  // phase. Shaded by the side toward the light (front edge light, back edge dark) with a sheen band
  // near the top; a thinner second ribbon behind it gives volume. Drawn back to front.
  function mane(buf, mat, rootPt, o) {
    const ribbons = o.ribbons || [{ off: [0, 0], w0: o.w0 ?? 6, w1: o.w1 ?? 2.5, len: o.len || 30, dA: 0 }];
    for (let k = ribbons.length - 1; k >= 0; k--) {
      const R = ribbons[k];
      const part = new Part(buf, mat, { sep: k === 0 });
      let prev = [rootPt[0] + R.off[0] + 0.5, rootPt[1] + R.off[1] + 0.5];
      const n = Math.max(2, Math.round(R.len / 2));
      const base = (o.base ?? 100) + (R.dA || 0);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const ph = (o.phase || 0) * PX.TAU - i * (o.freq || 0.45) - k * 1.1;
        const ang = rad(lerp(base, o.droop ?? 92, Math.pow(u, o.bendPow ?? 0.7)) + (o.wave ?? 1) * (2 + (o.waveGrow ?? 10) * u) * Math.sin(ph));
        const next = [prev[0] + Math.cos(ang) * 2, prev[1] + Math.sin(ang) * 2];
        const w = lerp(R.w0, R.w1, Math.pow(u, 0.8));
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        // +s runs along the left normal; when hanging down that is the back of the ribbon
        const front = ny < 0 ? -1 : 1; // sign of s that faces +x
        for (let s = -w / 2; s <= w / 2; s += 0.5) {
          const q = (s * front) / (w / 2); // -1 back edge .. +1 front edge
          const sheen = o.sheen !== false && u > (o.sheenAt ?? 0.14) && u < (o.sheenAt ?? 0.14) + 0.09 && q > -0.6;
          const tone = k > 0 ? (q > 0.4 ? 3 : 4) : sheen ? (q > 0.2 ? 0 : 1) : q > 0.55 ? 1 : q < -0.5 ? 3 : 2;
          PX.line(prev[0] + nx * s, prev[1] + ny * s, next[0] + nx * s, next[1] + ny * s, (x, y) => { if (!part.has(x, y)) part.add(x, y, { tone, u, k, q }); });
        }
        prev = next;
      }
      part.commit((i) => (o.tone ? o.tone(i) : i.tone));
    }
  }

  root.RIG = { stroke, hand, place, shear, variant, recolour, tall, solve, boxes, finish, smear, mane, c };
})(typeof window !== 'undefined' ? window : globalThis);
