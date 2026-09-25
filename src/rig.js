// rig.js — shared skeleton for the hand-pixeled fighters (怪異探偵部), KOF scale (~110 px).
// A character supplies bitmaps (head, hands, feet), a material map for the torso and per-frame joints
// for hips, feet and hands; the rig places knees/elbows by IK, draws limbs as cylinder-shaded strokes,
// shears the torso for a lean, applies whole-body rotation, outline and hit flash, and reports
// hurt boxes (head / body / legs) so the game can resolve hits and part damage.
// Authored facing +x; the game flips the buffer to face left.
(function (root) {
  'use strict';
  const PX = root.PX;
  const { Part, limb, sprite, rad, clamp, lerp, lit, tone } = PX;

  const L = () => PX.LIGHT;
  const c = (pt) => [pt[0] + 0.5, pt[1] + 0.5];

  // material looks for the normal-lit shading (spec = highlight strength, rim = back-light)
  const LOOK = {
    cloth: { spec: 0, rim: 0.28, amb: 0.14 },
    white: { spec: 0.05, shine: 8, rim: 0.3, amb: 0.22 },
    skin: { spec: 0.08, shine: 10, rim: 0.26, amb: 0.2 },
    hair: { spec: 0.4, shine: 18, rim: 0.5, amb: 0.1 },
    metal: { spec: 1.0, shine: 40, rim: 0.55, amb: 0.1, dither: 0.03 },
    leather: { spec: 0.35, shine: 24, rim: 0.4, amb: 0.1 },
    fur: { spec: 0, rim: 0.4, amb: 0.14 },
    flat: { spec: 0, rim: 0, amb: 0.3, kd: 0.6 },
  };
  // shade from an in-plane normal → ramp index 0..4
  function sh(nx, ny, look, x, y, o = {}) {
    const v = lit(nx, ny, look) + (o.add || 0);
    return tone(v, x, y, { dither: look.dither || 0, noShine: !look.spec || o.noShine, shift: o.shift || 0 });
  }

  // a limb segment: capsule of radius r (or a profile function of t) with cylinder shading;
  // band(i) may return [mat, idx] to override (cuffs, plates), or { shift } to darken
  function cyl(buf, mat, a, b, r, opts = {}) {
    const look = LOOK[opts.look || 'cloth'] || LOOK.cloth;
    const part = new Part(buf, mat, opts.part || {});
    const rf = typeof r === 'function' ? r : () => r;
    limb(part, c(a), c(b), rf, {});
    part.commit((i) => {
      let shift = 0;
      if (opts.band) {
        const v = opts.band(i);
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object') shift = v.shift || 0;
      }
      return sh((i.nx || 0) * (opts.round ?? 0.92), (i.ny || 0) * (opts.round ?? 0.92), look, i.x, i.y, { shift, add: opts.add || 0 });
    });
    return part;
  }
  // the flat three-tone stroke (thin things)
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
  // a small round joint shaded as a sphere
  function ball(buf, mat, at, r, look = 'metal', opts = {}) {
    const part = new Part(buf, mat, opts.part || {});
    PX.disc(part, at[0] + 0.5, at[1] + 0.5, r);
    part.commit((i) => sh(i.dx / r, i.dy / r, LOOK[look], i.x, i.y, opts));
    return part;
  }
  // place a hand-drawn bitmap (rows/key) so that its pixel `anchor` lands on world point `at`
  function place(buf, mat, rows, key, at, anchor, opts = {}) {
    const part = new Part(buf, mat, opts.part || {});
    sprite(part, rows, key, at, anchor, !!opts.flip);
    part.commit(opts.colour || PX.spriteColour);
    return part;
  }

  // material map: rows of chars, mkey char → { m: material, look, shift, flat, round, sep }.
  // Every pixel is shaded from the map's own silhouette (a cylinder across each row, a slight fall-off
  // down each material) and each material is committed as its own Part, so seams between materials
  // get separation edges. Uppercase of a mapped lowercase char = the same material one step lighter.
  // '/' = a fold: the material of the pixel to its left, two steps darker. `at`/`anchor` as place().
  function matmap(buf, rows, mkey, at, anchor, opts = {}) {
    const h = rows.length;
    const bx = Math.round(at[0]) - anchor[0], by = Math.round(at[1]) - anchor[1];
    const lean = opts.lean || 0, pivot = opts.pivot ?? h - 1;
    const shiftAt = (j) => Math.round(lean * clamp(1 - j / pivot, 0, 1));
    const cells = [], ext = [];
    for (let j = 0; j < h; j++) {
      const row = rows[j];
      let mn = Infinity, mx = -Infinity;
      cells.push([]);
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        let k = null, shift = 0;
        if (ch === '.' || ch === ' ') { cells[j].push(null); continue; }
        if (ch === '/') {
          let p = i - 1; while (p >= 0 && (row[p] === '/' || row[p] === '.')) p--;
          const pc = p >= 0 ? row[p] : null;
          k = pc && (mkey[pc] ? pc : mkey[pc.toLowerCase()] ? pc.toLowerCase() : null);
          shift = 2;
        } else if (mkey[ch]) k = ch;
        else if (mkey[ch.toLowerCase()]) { k = ch.toLowerCase(); shift = -1; }
        if (!k) { cells[j].push(null); continue; }
        cells[j].push({ k, shift, ch });
        if (i < mn) mn = i; if (i > mx) mx = i;
      }
      ext.push([mn, mx]);
    }
    const vext = {};
    for (let j = 0; j < h; j++) for (const cl of cells[j]) if (cl) { const v = vext[cl.k] || (vext[cl.k] = [j, j]); v[0] = Math.min(v[0], j); v[1] = Math.max(v[1], j); }
    const order = opts.order || Object.keys(mkey);
    const parts = {};
    for (const k of order) parts[k] = new Part(buf, mkey[k].m, { sep: mkey[k].sep !== false });
    for (let j = 0; j < h; j++) {
      const [mn, mx] = ext[j];
      const cx = (mn + mx) / 2, hw = Math.max(1, (mx - mn) / 2);
      for (let i = 0; i < cells[j].length; i++) {
        const cl = cells[j][i];
        if (!cl || !parts[cl.k]) continue;
        const nx = clamp((i - cx) / hw, -1, 1);
        const v = vext[cl.k];
        const fy = v[1] > v[0] ? (j - v[0]) / (v[1] - v[0]) : 0.5;
        const ny = -0.25 + 0.55 * fy;
        parts[cl.k].add(bx + i + shiftAt(j), by + j, { nx: nx * (mkey[cl.k].round ?? 0.85), ny, shift: cl.shift + (mkey[cl.k].shift || 0), ch: cl.ch });
      }
    }
    for (const k of order) {
      const Mk = mkey[k];
      parts[k].commit((i) => (Mk.flat !== undefined ? clamp(Mk.flat + i.shift, 0, 4) : sh(i.nx, i.ny, LOOK[Mk.look || 'cloth'], i.x, i.y, { shift: i.shift, noShine: Mk.noShine })));
    }
    return parts;
  }

  // decode a CAST part (base64 RGBA, w, h) into little-endian RGBA uint32 once
  function imgData(part) {
    if (part.px) return part.px;
    const bin = typeof atob === 'function' ? atob(part.d) : Buffer.from(part.d, 'base64').toString('binary');
    const n = part.w * part.h, px = new Uint32Array(n);
    for (let i = 0; i < n; i++) { const a = bin.charCodeAt(i * 4 + 3); px[i] = a ? PX.rgba(bin.charCodeAt(i * 4), bin.charCodeAt(i * 4 + 1), bin.charCodeAt(i * 4 + 2), 255) : 0; }
    part.px = px;
    return px;
  }
  // draw an image part so that its pixel `anchor` lands on `at`; opts.lean shears rows above opts.pivot,
  // opts.flip mirrors, opts.rot (deg) rotates about the anchor (nearest neighbour). Pixels carry flag 1
  // (no outline ring) and belong to one Part so neighbours get separation edges.
  function blitImg(buf, part, at, anchor, opts = {}) {
    const px = imgData(part);
    const P = new Part(buf, opts.mat || PX.MATS[1] || null, { sep: opts.sep !== false, flag: 1 });
    const lean = opts.lean || 0, pivot = opts.pivot ?? part.h - 1;
    const ax = Math.round(at[0]), ay = Math.round(at[1]);
    const rot = opts.rot ? rad(opts.rot) : 0, cs = Math.cos(rot), sn = Math.sin(rot);
    for (let j = 0; j < part.h; j++) {
      const sh = lean ? Math.round(lean * clamp(1 - j / pivot, 0, 1)) : 0;
      for (let i = 0; i < part.w; i++) {
        const c = px[j * part.w + i];
        if (!c) continue;
        let dx = (opts.flip ? part.w - 1 - i : i) - anchor[0] + sh, dy = j - anchor[1];
        if (rot) { const rx = dx * cs - dy * sn, ry = dx * sn + dy * cs; dx = Math.round(rx); dy = Math.round(ry); }
        P.add(ax + dx, ay + dy, { col: c });
      }
    }
    P.commit((i) => ({ col: i.col }));
    return P;
  }
  function shear(rows, n, pivotRow) {
    const H = rows.length, pad = Math.abs(n), pr = pivotRow ?? H - 1;
    return rows.map((r, j) => {
      const s = Math.round(n * clamp(1 - j / pr, 0, 1));
      return '.'.repeat(pad + s) + r + '.'.repeat(pad - s);
    });
  }
  function tall(rows, dup) { const out = []; rows.forEach((r, j) => { out.push(r); if (dup.includes(j)) out.push(r); }); return out; }
  function variant(rows, edits) {
    const out = rows.map((r) => r.split(''));
    for (const [x, y, ch] of edits) if (out[y] && x < out[y].length) out[y][x] = ch;
    return out.map((r) => r.join(''));
  }
  function recolour(rows, map) { return rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch)); }

  // ---------------------------------------------------------------- skeleton
  function solve(p, spec, O) {
    const at = (pt) => [O[0] + pt[0], O[1] + pt[1]];
    const rel = (w) => [w[0] - O[0], w[1] - O[1]];
    const hip = at(p.hip);
    const lean = p.lean || 0;
    const rows = p.torsoRows || spec.torsoRows;
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
    return { O, at, rel, hip, hipN, hipF, lean, rows, tOrigin, shN, shF, neck, fN, fF, hN, hF, kN, kF, eN, eF, pivot: pr };
  }

  function boxes(J, spec, p) {
    const r = J.rel;
    const nk = r(J.neck), hp = r(J.hip);
    const hh = spec.headH || 24, hw = spec.headW || 20, bw = spec.bodyW || 11;
    const head = [nk[0] - hw / 2 + 2, nk[1] - hh, nk[0] + hw / 2 + 2, nk[1] + 2];
    const body = [Math.min(nk[0], hp[0]) - bw, nk[1], Math.max(nk[0], hp[0]) + bw, hp[1] + 5];
    const fy = Math.max(r(J.fN)[1], r(J.fF)[1]);
    const legs = [Math.min(r(J.fN)[0], r(J.fF)[0], hp[0]) - 5, hp[1] + 5, Math.max(r(J.fN)[0], r(J.fF)[0], hp[0]) + 5, fy + 2];
    if (p && p.rot) {
      const all = [Math.min(head[0], legs[0]) - 6, Math.min(head[1], body[1]) + 10, Math.max(head[2], legs[2]) + 6, legs[3]];
      return { head: all, body: all, legs: all };
    }
    return { head, body, legs };
  }

  function finish(buf, p, J, opts = {}) {
    if (p.rot) PX.rotateBuf(buf, J.hip[0], J.hip[1] - (opts.rotUp ?? 14), p.rot);
    PX.outline(buf);
    if (opts.rim ?? PX.PALE_RIM) {
      const pale = PX.hex(opts.rimCol || PX.PALE_RIM_COL || '#e6eef4');
      for (let i = 0; i < buf.c.length; i++) if ((buf.f[i] & 4) && !(buf.f[i] & 2)) buf.c[i] = pale;
    }
    if (p.flash) {
      const hi = PX.hex(opts.flashInk || '#9fb4ff'), wh = PX.hex('#ffffff');
      for (let i = 0; i < buf.c.length; i++) if (buf.c[i] && !(buf.f[i] & 2)) buf.c[i] = (buf.f[i] & 4) ? hi : wh;
    }
  }

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

  // a long flowing hair mass: ribbons hanging from rootPt, each with a width profile w0 -> w1 (pointed
  // tip), bending from angle `base` (deg, 90 = straight down) toward `droop`, waving with phase. Shaded by
  // the side toward the light, with strand grooves across the width and a sheen band near the top.
  function mane(buf, mat, rootPt, o) {
    const ribbons = o.ribbons || [{ off: [0, 0], w0: o.w0 ?? 10, w1: o.w1 ?? 3, len: o.len || 50, dA: 0 }];
    for (let k = ribbons.length - 1; k >= 0; k--) {
      const R = ribbons[k];
      const part = new Part(buf, mat, { sep: k === 0 });
      let prev = [rootPt[0] + R.off[0] + 0.5, rootPt[1] + R.off[1] + 0.5];
      const n = Math.max(2, Math.round(R.len / 2));
      const base = (o.base ?? 100) + (R.dA || 0);
      const groove = o.groove ?? 4;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const ph = (o.phase || 0) * PX.TAU - i * (o.freq || 0.4) - k * 1.1;
        const ang = rad(lerp(base, o.droop ?? 92, Math.pow(u, o.bendPow ?? 0.7)) + (o.wave ?? 1) * (2 + (o.waveGrow ?? 10) * u) * Math.sin(ph));
        const next = [prev[0] + Math.cos(ang) * 2, prev[1] + Math.sin(ang) * 2];
        const w = lerp(R.w0, R.w1, Math.pow(u, 0.75)) * (u > 0.9 ? ((1 - u) / 0.1) * 0.6 + 0.4 : 1);
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        const front = ny < 0 ? -1 : 1;
        for (let s = -w / 2; s <= w / 2; s += 0.5) {
          const q = (s * front) / (w / 2);
          const sheen = o.sheen !== false && u > (o.sheenAt ?? 0.12) && u < (o.sheenAt ?? 0.12) + 0.08 && q > -0.5;
          const strand = groove && Math.abs((((s * front + w / 2 + i * 0.15) % groove) + groove) % groove - groove / 2) < 0.3 && q < 0.8;
          let t;
          if (k > 0) t = q > 0.4 ? 3 : 4;
          else if (sheen) t = q > 0.1 ? 0 : 1;
          else if (strand) t = q > 0.3 ? 2 : 3;
          else t = q > 0.62 ? 1 : q < -0.45 ? 3 : 2;
          PX.line(prev[0] + nx * s, prev[1] + ny * s, next[0] + nx * s, next[1] + ny * s, (x, y) => { if (!part.has(x, y)) part.add(x, y, { tone: t, u, k, q }); });
        }
        prev = next;
      }
      part.commit((i) => (o.tone ? o.tone(i) : i.tone));
    }
  }

  root.RIG = { LOOK, sh, cyl, stroke, ball, place, matmap, imgData, blitImg, shear, tall, variant, recolour, solve, boxes, finish, smear, mane, c };
})(typeof window !== 'undefined' ? window : globalThis);
