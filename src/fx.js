// fx.js — pixel effects drawn into a frame after the figure: sword smears, dust, glints, speed lines
(function (root) {
  'use strict';
  const PX = root.PX;
  const { material, Part, rad, clamp, lerp, hash } = PX;

  const FM = {
    slash: material('fx_slash', ['#ffffff', '#e6fbff', '#b9ecfb', '#86cfee', '#5aa3d4'], '#1d3c6e'),
    fire: material('fx_red', ['#fff6e0', '#ffd0a0', '#ff7a5a', '#e0304a', '#901838'], '#40081c'),
    dust: material('fx_dust', ['#fbf7ee', '#e6dccb', '#c9b9a0', '#9d8c76', '#6f6252'], '#3d342b'),
    spark: material('fx_spark', ['#ffffff', '#fff7c0', '#ffd860', '#ff9a30', '#d0502a'], '#5a200a'),
    dark: material('fx_dark', ['#fff1e2', '#ffcfb0', '#ff9a78', '#e0544c', '#a42a3e'], '#1c0410'),
    steam: material('fx_steam', ['#ffffff', '#eef3fb', '#c9d3e8', '#98a5c6', '#6c789e'], '#2a3150'),
    crack: material('fx_crack', ['#ffe0a0', '#ff9a40', '#6a3a4a', '#2a1a2e', '#140c18'], '#0a0610'),
    ice: material('fx_ice', ['#ffffff', '#d8fbff', '#7fe3ff', '#35a8e6', '#1c5fb0'], '#0c2a5a'),
    ember: material('fx_ember', ['#fffbe0', '#ffd98a', '#ff8c3a', '#e2402e', '#8c1a2a'], '#2a0610'),
  };

  // normalise an angle difference into [-180, 180)
  const wrap = (d) => ((d + 540) % 360) - 180;

  // crescent swept by a blade tip around centre c: from angle a0 to a1 (deg, screen space, y down).
  // r0 = inner radius at the leading edge, r1 = outer radius; the tail thins to nothing.
  // flat pale crescent or ring swept around centre c from a0 (tail) to a1 (leading edge), in degrees;
  // thick at the leading edge, thinning to a point at the tail, the tail breaking into speed lines
  function arc(buf, o, f) {
    const mat = FM[f.mat || 'slash'];
    const part = new Part(buf, mat, { sep: false, flag: 2 | 8 });
    const cx = o[0] + f.c[0], cy = o[1] + f.c[1];
    const span = f.a1 - f.a0;
    const R = f.r1, x0 = Math.floor(cx - R - 2), x1 = Math.ceil(cx + R + 2), y0 = Math.floor(cy - R - 2), y1 = Math.ceil(cy + R + 2);
    const age = f.age || 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r > R + 0.5 || r < 1) continue;
      let d = (Math.atan2(dy, dx) * 180) / Math.PI - f.a0;
      if (span > 0) { while (d < 0) d += 360; while (d >= 360) d -= 360; } else { while (d > 0) d -= 360; while (d <= -360) d += 360; }
      const u = d / span;                       // 0 at the tail … 1 at the leading edge
      if (u < 0 || u > 1) continue;
      const th = (R - f.r0) * Math.pow(u, 0.8) * (1 - age * 0.6);
      if (r < R - th - 0.2) continue;
      const q = (R - r) / (R - f.r0 || 1);
      if (u < 0.5 + age * 0.3 && Math.floor(q * 9) % 2 === 1) continue;
      if (age > 0.6 && ((x + y) & 1)) continue;
      const e = (1 - u) * 0.55 + age * 0.9 + q * 0.3;
      part.add(x, y, { idx: r > R - 1.3 ? 0 : e < 0.3 ? 1 : e < 0.6 ? 2 : e < 0.85 ? 3 : 4 });
    }
    part.commit((i) => i.idx);
  }

  // puff of dust: a few round clumps, grows and breaks up with age
  function dust(buf, o, f) {
    const part = new Part(buf, FM.dust, { sep: false, flag: 2 });
    const age = f.age || 0;
    const n = f.n || 3;
    for (let k = 0; k < n; k++) {
      const dir = (f.dir || 0) + (k - (n - 1) / 2) * (f.spread || 0.9);
      const d = (f.r || 3) * (0.5 + age * 1.6);
      const cx = o[0] + f.x + Math.cos(dir) * d * (f.flat ? 1.4 : 1) * (f.side || 1) * (k % 2 ? 1 : -1) * (n === 1 ? 0 : 1);
      const cy = o[1] + f.y - age * (f.rise || 3) - Math.abs(Math.sin(dir)) * d * 0.3;
      const rr = (f.r || 3) * (1 - age * 0.55) * (0.8 + hash(k, 3, f.seed || 0) * 0.5);
      if (rr < 0.6) continue;
      const x0 = Math.floor(cx - rr - 1), x1 = Math.ceil(cx + rr + 1), y0 = Math.floor(cy - rr - 1), y1 = Math.ceil(cy + rr + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const q = Math.hypot(dx, dy) / rr;
        if (q > 1) continue;
        if (age > 0.55 && (x + y) % 2) continue;
        const lit = -dx * 0.3 - dy * 0.8;
        part.add(x, y, { idx: lit > 0.35 * rr ? 1 : q > 0.75 ? 3 : 2 });
      }
    }
    part.commit((i) => i.idx);
  }

  // four-point glint
  function glint(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'spark'], { sep: false, flag: 2 });
    const cx = Math.round(o[0] + f.x), cy = Math.round(o[1] + f.y);
    const s = f.s || 3;
    part.add(cx, cy, { idx: 0 });
    for (let k = 1; k <= s; k++) {
      const idx = k === 1 ? 0 : k < s ? 1 : 2;
      part.add(cx + k, cy, { idx }); part.add(cx - k, cy, { idx });
      part.add(cx, cy + k, { idx }); part.add(cx, cy - k, { idx });
    }
    if (s >= 3) { part.add(cx + 1, cy + 1, { idx: 1 }); part.add(cx - 1, cy - 1, { idx: 1 }); part.add(cx + 1, cy - 1, { idx: 1 }); part.add(cx - 1, cy + 1, { idx: 1 }); }
    part.commit((i) => i.idx);
  }

  // straight streaks (speed lines, the iai cut line)
  function streak(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'slash'], { sep: false, flag: 2 });
    const x0 = o[0] + f.x0, x1 = o[0] + f.x1, y = o[1] + f.y;
    const w = f.w || 1;
    for (let x = Math.floor(Math.min(x0, x1)); x <= Math.ceil(Math.max(x0, x1)); x++) {
      const u = (x - x0) / (x1 - x0 || 1);
      const ww = w * (f.taper ? Math.sin(clamp(u, 0, 1) * Math.PI) : 1);
      for (let dy = -Math.floor(ww); dy <= Math.floor(ww); dy++) {
        const idx = Math.abs(dy) === 0 ? 0 : Math.abs(dy) < ww - 0.5 ? 1 : 2;
        if (f.dither && (x + dy) % 2) continue;
        part.add(x, Math.round(y + dy), { idx });
      }
    }
    part.commit((i) => i.idx);
  }

  // flat ellipse ring on the ground (landing / impact)
  function ring(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'dust'], { sep: false, flag: 2 });
    const cx = o[0] + f.x, cy = o[1] + f.y;
    const rx = f.rx, ry = f.ry || f.rx * 0.28;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const q = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (q > 1 || q < 1 - (f.th || 0.25)) continue;
      if (f.age > 0.5 && (x + y) % 2) continue;
      part.add(x, y, { idx: y < cy ? 1 : 2 });
    }
    part.commit((i) => i.idx);
  }

  // flying chips / sparks: short 2-px dashes along directions
  function chips(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'spark'], { sep: false, flag: 2 });
    const n = f.n || 6;
    for (let k = 0; k < n; k++) {
      const a = rad((f.a0 ?? -170) + ((f.a1 ?? -10) - (f.a0 ?? -170)) * hash(k, 7, f.seed || 1));
      const d = (f.d || 10) * (0.5 + hash(k, 9, f.seed || 1) * 0.8) * (0.4 + (f.age || 0) * 0.9);
      const x = o[0] + f.x + Math.cos(a) * d, y = o[1] + f.y + Math.sin(a) * d + (f.age || 0) * (f.age || 0) * 6;
      part.add(Math.round(x), Math.round(y), { idx: 0 });
      part.add(Math.round(x - Math.cos(a)), Math.round(y - Math.sin(a)), { idx: 2 });
    }
    part.commit((i) => i.idx);
  }

  // steam: puffs rising and curling from a vent, thinning out with age
  function steam(buf, o, f) {
    const part = new Part(buf, FM.steam, { sep: false, flag: 2 });
    const n = f.n || 3;
    for (let k = 0; k < n; k++) {
      const a = ((f.age || 0) + k / n) % 1;               // each puff at its own point of the cycle
      const cx = o[0] + f.x + (f.dir || 0) * a * 10 + Math.sin(a * 6 + k) * 2.5 * (f.curl ?? 1);
      const cy = o[1] + f.y - a * (f.rise || 18);
      const r = (f.r || 3) * (0.6 + a * 0.9);
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const q = Math.hypot(dx, dy) / r;
        if (q > 1) continue;
        if (a > 0.45 && (x + y) % 2) continue;
        if (a > 0.8 && (x % 2 || y % 2)) continue;
        part.add(x, y, { idx: dy < -r * 0.3 ? 0 : q > 0.7 ? 3 : a > 0.6 ? 2 : 1 });
      }
    }
    part.commit((i) => i.idx);
  }

  // ground crack: jagged branches from the impact point, glowing at first
  function crack(buf, o, f) {
    const part = new Part(buf, FM.crack, { sep: false, flag: 2 });
    const age = f.age || 0;
    const branches = f.n || 6;
    for (let k = 0; k < branches; k++) {
      const side = k % 2 ? 1 : -1;
      let x = o[0] + f.x, y = o[1] + f.y;
      const L = (f.len || 26) * (0.6 + hash(k, 2, f.seed || 1) * 0.6);
      let ang = side > 0 ? rad(-8 + hash(k, 3, 1) * 20) : rad(188 - hash(k, 3, 1) * 20);
      for (let s = 0; s < L; s++) {
        ang += (hash(k, s, 7) - 0.5) * 0.9;
        x += Math.cos(ang); y += Math.sin(ang) * 0.3;
        const fr = s / L;
        const idx = age < 0.4 ? (fr < 0.4 ? 0 : fr < 0.7 ? 1 : 3) : (age < 0.8 ? 3 : 4);
        part.add(Math.round(x), Math.round(y), { idx });
        if (fr < 0.3) part.add(Math.round(x), Math.round(y) + 1, { idx: Math.min(4, idx + 2) });
      }
    }
    part.commit((i) => i.idx);
  }

  function sweep(buf, samples, o) {
    const mat = FM[o.mat || 'slash'];
    const part = new Part(buf, mat, { sep: false, flag: 2 | 8 });
    const N = samples.length - 1;
    const Lb = o.Lb, inner = o.inner ?? 0.34, age = o.age || 0, shape = o.shape || 'fan';
    const pts = samples.map((s) => [[s.h[0] + s.d[0] * Lb * inner, s.h[1] + s.d[1] * Lb * inner], [s.h[0] + s.d[0] * Lb * 1.06, s.h[1] + s.d[1] * Lb * 1.06], s.d, s.h]);
    for (let k = 0; k < N; k++) {
      const q = [pts[k][0], pts[k][1], pts[k + 1][1], pts[k + 1][0]];
      const ak = Math.atan2(pts[k][2][1], pts[k][2][0]), ak1 = Math.atan2(pts[k + 1][2][1], pts[k + 1][2][0]);
      let dA = ak1 - ak; if (dA > Math.PI) dA -= 2 * Math.PI; if (dA < -Math.PI) dA += 2 * Math.PI;
      const [x0, y0, x1, y1] = PX.bbox(q, 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!PX.inPoly(x + 0.5, y + 0.5, q)) continue;
        const h = pts[k][3], d = pts[k][2];
        let dp = Math.atan2(y + 0.5 - h[1], x + 0.5 - h[0]) - ak; if (dp > Math.PI) dp -= 2 * Math.PI; if (dp < -Math.PI) dp += 2 * Math.PI;
        const kAge = 1 - (k + clamp(Math.abs(dA) > 1e-4 ? dp / dA : 0.5, 0, 1)) / N; // 0 = where the blade is now
        const rf = clamp((((x + 0.5 - h[0]) * d[0] + (y + 0.5 - h[1]) * d[1]) / Lb - inner) / (1.06 - inner), 0, 1);
        let floor;
        if (shape === 'crescent') {
          // a leaf: pointed at both ends, thickest in the middle of the swing
          const th = Math.pow(Math.sin(Math.PI * clamp(1 - kAge, 0, 1)), 0.7) * 0.55 * (1 - age * 0.7);
          floor = 1 - th;
        } else {
          // a fan: full at the blade, thinning to the rim along the tail
          floor = Math.pow(kAge, 1.25) * 0.92 + age * 0.55;
        }
        if (rf < floor) continue;
        // the tail breaks up into speed lines along the swing
        if (kAge > 0.5 - age * 0.3 && (Math.floor(rf * 11) % 2 === 1)) continue;
        if (age > 0.6 && ((x + y) & 1)) continue;
        const e = kAge * 0.55 + age * 0.9 + (1 - rf) * 0.25;
        const rim = rf > 0.94 || (shape === 'fan' && kAge < 0.05);
        part.add(x, y, { idx: rim ? 0 : e < 0.3 ? 1 : e < 0.6 ? 2 : e < 0.85 ? 3 : 4 });
      }
    }
    part.commit((i) => i.idx);
  }

  // zigzag sparks: short jagged bolts flung out from a point (energy crackling off a cut)
  function bolt(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'slash'], { sep: false, flag: 2 | 8 });
    const n = f.n || 4, age = f.age || 0;
    for (let k = 0; k < n; k++) {
      const a = rad((f.a0 ?? -180) + ((f.a1 ?? 180) - (f.a0 ?? -180)) * hash(k, 21, f.seed || 1));
      const d0 = (f.r || 10) * (0.35 + age * 0.9), len = (f.len || 12) * (1 - age * 0.5);
      let x = o[0] + f.x + Math.cos(a) * d0, y = o[1] + f.y + Math.sin(a) * d0;
      const steps = Math.max(3, Math.round(len / 3));
      for (let s = 0; s < steps; s++) {
        const side = s % 2 ? 1 : -1;
        const nx = x + Math.cos(a) * 3 + Math.cos(a + Math.PI / 2) * side * 1.6;
        const ny = y + Math.sin(a) * 3 + Math.sin(a + Math.PI / 2) * side * 1.6;
        PX.line(x, y, nx, ny, (px, py) => part.add(px, py, { idx: age < 0.35 ? (s < 2 ? 0 : 1) : age < 0.7 ? 2 : 3 }));
        x = nx; y = ny;
      }
    }
    part.commit((i) => i.idx);
  }

  // ground eruption: jagged shards bursting up from an impact, then crumbling into bits
  function spikes(buf, o, f) {
    const mat = FM[f.mat || 'ice'];
    const part = new Part(buf, mat, { sep: false, flag: 2 });
    const n = f.n || 5, age = f.age || 0;
    const grow = age < 0.35 ? age / 0.35 : 1;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * (f.gap || 7) + (hash(k, 3, f.seed || 1) - 0.5) * 3;
      const H = (f.h || 30) * (1 - Math.abs(off) / ((n / 2 + 1) * (f.gap || 7))) * (0.7 + hash(k, 5, f.seed || 1) * 0.5) * grow;
      const W = (f.w || 5) * (0.7 + hash(k, 6, f.seed || 1) * 0.5);
      const lean = off * 0.35 + (f.dir || 0) * H * 0.3;
      const bx = o[0] + f.x + off, by = o[1] + f.y;
      const tip = [bx + lean, by - H];
      const poly = [[bx - W / 2, by], [bx + W / 2, by], tip];
      const [x0, y0, x1, y1] = PX.bbox(poly, 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!PX.inPoly(x + 0.5, y + 0.5, poly)) continue;
        const v = (by - y) / (H || 1);                         // 0 at the ground … 1 at the tip
        if (age > 0.55 && hash(x, y, 9) < (age - 0.55) * 2.2) continue; // crumbling
        const lit = (x + 0.5 - (bx + lean * v)) < 0;
        part.add(x, y, { idx: v > 0.8 ? 0 : lit ? 1 : v > 0.35 ? 2 : 3 });
      }
    }
    part.commit((i) => i.idx);
  }

  // hit mark (the tutorial's "creative hit effects"): a sharp diagonal cut with a few star sparks
  function hitmark(buf, o, f) {
    const part = new Part(buf, FM[f.mat || 'spark'], { sep: false, flag: 2 });
    const age = f.age || 0;
    const cx = o[0] + f.x, cy = o[1] + f.y;
    const L = (f.len || 8) * (1 - age * 0.35);
    const sl = f.slope ?? -0.7;
    for (let t = -1; t <= 1.0001; t += 0.04) {
      const x = cx + t * L, y = cy + t * L * sl;
      const th = (1 - Math.abs(t)) * (age < 0.4 ? 1.4 : 0.6);
      for (let k = -th; k <= th + 0.01; k += 0.5) part.add(Math.round(x), Math.round(y + k), { idx: Math.abs(k) < 0.6 ? 0 : 2 });
    }
    const n = f.n || 3;
    for (let s = 0; s < n; s++) {
      const a = hash(s, 13, f.seed || 1) * PX.TAU, d = (4 + hash(s, 14, f.seed || 1) * 5) * (0.6 + age * 0.8);
      const sx = Math.round(cx + Math.cos(a) * d), sy = Math.round(cy + Math.sin(a) * d);
      const r = age < 0.5 ? 2 : 1;
      part.add(sx, sy, { idx: 0 });
      for (let k = 1; k <= r; k++) { part.add(sx + k, sy, { idx: 1 }); part.add(sx - k, sy, { idx: 1 }); part.add(sx, sy + k, { idx: 1 }); part.add(sx, sy - k, { idx: 1 }); }
    }
    part.commit((i) => i.idx);
  }

  const DRAW = { arc, dust, glint, streak, ring, chips, steam, crack, bolt, spikes, hitmark };
  // layer 'under' draws only effects marked under (before the figure), 'over' the rest
  function draw(buf, origin, list, layer = 'over') {
    for (const f of list || []) {
      if (!!f.under !== (layer === 'under')) continue;
      const fn = DRAW[f.type];
      if (fn) fn(buf, origin, f);
    }
  }
  // outline only the effect pixels (flag 2) — keeps smears readable on light backgrounds
  function outlineFx(buf) {
    const { w, h, c, m, f } = buf;
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (c[j] && (f[j] & 2) && !(f[j] & 8)) { add.push([i, PX.MATS[m[j]].ink, m[j]]); break; }
      }
    }
    for (const [i, col, mm] of add) { c[i] = col; m[i] = mm; f[i] |= 2 | 4; }
  }

  root.FX = { FM, draw, outlineFx, sweep };
})(typeof window !== 'undefined' ? window : globalThis);
