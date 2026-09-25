// px.js — tiny pixel-art renderer: shapes are rasterised at 1x with no anti-aliasing,
// shaded from material ramps, separated by darker edges and outlined at the end.
// Works in the browser (window.PX) and in node (globalThis.PX).
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // colours are stored as little-endian RGBA uint32 so a Uint32Array view over ImageData works as is
  function rgba(r, g, b, a = 255) { return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; }
  function hex(s) {
    s = s.replace('#', '');
    const n = parseInt(s, 16);
    return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
  }
  function unpack(c) { return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24]; }
  function mix(c1, c2, t) {
    const a = unpack(c1), b = unpack(c2);
    return rgba(Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t)), 255);
  }

  // ---------------------------------------------------------------- materials
  // ramp: [shine, light, base, shadow, deep] light → dark, ink = outline colour
  const MATS = [null];
  const MAT = {};
  function material(name, ramp, ink, opts = {}) {
    const m = {
      id: MATS.length, name,
      ramp: ramp.map(hex), ink: hex(ink),
      edge: hex(opts.edge || ramp[4]),       // colour of a separation line drawn on this material
      softInk: hex(opts.softInk || ramp[3]), // outline on the lit side (sel-out: the material's own shadow tone)
      glow: !!opts.glow,
    };
    MATS.push(m);
    MAT[name] = m;
    return m;
  }

  // ---------------------------------------------------------------- buffer
  class Buf {
    constructor(w, h) {
      this.w = w; this.h = h;
      const n = w * h;
      this.c = new Uint32Array(n);   // colour
      this.m = new Uint8Array(n);    // material id
      this.p = new Uint16Array(n);   // part serial (0 = none)
      this.f = new Uint8Array(n);    // flags: 1 = no outline, 2 = effect
      this.serial = 0;
    }
    idx(x, y) { return y * this.w + x; }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    clear() { this.c.fill(0); this.m.fill(0); this.p.fill(0); this.f.fill(0); this.serial = 0; }
    set(x, y, col, mat = 0, part = 0, flag = 0) {
      if (!this.inside(x, y)) return;
      const i = y * this.w + x;
      this.c[i] = col; this.m[i] = mat; this.p[i] = part; this.f[i] = flag;
    }
    get(x, y) { return this.inside(x, y) ? this.c[y * this.w + x] : 0; }
  }

  // ---------------------------------------------------------------- parts
  // A part collects a mask first (so shading can look at its own silhouette),
  // then commits: darker edges are drawn on whatever it covers, then its pixels.
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  class Part {
    constructor(buf, mat, opts = {}) {
      this.buf = buf;
      this.mat = typeof mat === 'string' ? MAT[mat] : mat;
      this.opts = opts;
      this.px = new Map();        // key → {x, y, a, b, t, s, ...}
      this.light = opts.light || PX.LIGHT;
    }
    key(x, y) { return (y + 512) * 2048 + (x + 512); }
    has(x, y) { return this.px.has(this.key(x, y)); }
    add(x, y, info) {
      if (!this.buf.inside(x, y)) return;
      const k = this.key(x, y);
      const old = this.px.get(k);
      if (old && info && old.z !== undefined && info.z !== undefined && old.z > info.z) return;
      this.px.set(k, Object.assign({ x, y }, info || {}));
    }
    remove(x, y) { this.px.delete(this.key(x, y)); }
    // distance (in px steps toward the light) to leave the mask; 0 = interior (beyond n)
    litEdge(x, y, n = 2) {
      const [lx, ly] = this.light;
      for (let k = 1; k <= n; k++) {
        if (!this.has(x + Math.round(lx * k), y + Math.round(ly * k))) return k;
      }
      return 0;
    }
    darkEdge(x, y, n = 2) {
      const [lx, ly] = this.light;
      for (let k = 1; k <= n; k++) {
        if (!this.has(x - Math.round(lx * k), y - Math.round(ly * k))) return k;
      }
      return 0;
    }
    // colour(info, part) returns a ramp index of this part's material, or [material, index], or null to skip
    commit(colour) {
      const buf = this.buf;
      const serial = ++buf.serial;
      const sep = this.opts.sep !== false;
      const out = [];
      for (const info of this.px.values()) {
        let r = colour ? colour(info, this) : 2;
        if (r === null || r === undefined) continue;
        let mat = this.mat, col;
        if (Array.isArray(r)) { mat = typeof r[0] === 'string' ? MAT[r[0]] : r[0]; r = r[1]; }
        if (typeof r === 'number') col = mat.ramp[clamp(r | 0, 0, 4)];
        else if (r === 'ink') col = mat.ink;
        else if (r === 'edge') col = mat.edge;
        else col = r.col; // {col}
        out.push([info.x, info.y, col, mat.id]);
      }
      if (sep) {
        const mine = new Set(out.map((o) => this.key(o[0], o[1])));
        for (const o of out) {
          for (const [dx, dy] of N4) {
            const nx = o[0] + dx, ny = o[1] + dy;
            if (!buf.inside(nx, ny) || mine.has(this.key(nx, ny))) continue;
            const i = ny * buf.w + nx;
            if (buf.c[i] && buf.p[i] && !(buf.f[i] & 2) && buf.p[i] !== serial) {
              const m = MATS[buf.m[i]];
              if (m && this.opts.sepSkip !== buf.m[i]) buf.c[i] = this.opts.sepInk ? m.ink : m.edge;
            }
          }
        }
      }
      for (const o of out) {
        const i = o[1] * buf.w + o[0];
        buf.c[i] = o[2]; buf.m[i] = o[3]; buf.p[i] = serial; buf.f[i] = this.opts.flag || 0;
      }
      return this;
    }
  }

  // ---------------------------------------------------------------- rasterisers
  // All take world coordinates (floats); pixel (x, y) is tested at its centre.
  function bbox(pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
  }

  // tapered capsule a→b with radii ra→rb; info: t (0..1 along), s (signed side offset, + = left of a→b), d
  function capsule(part, a, b, ra, rb, extra) {
    const [x0, y0, x1, y1] = bbox([a, b], Math.max(ra, rb) + 1);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1e-6;
    const L = Math.sqrt(L2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L2;
      const tc = clamp(t, 0, 1);
      const cx = a[0] + dx * tc, cy = a[1] + dy * tc;
      const ex = px - cx, ey = py - cy;
      const d = Math.hypot(ex, ey);
      const r = lerp(ra, rb, tc);
      if (d <= r) {
        const s = (dx * ey - dy * ex) / L; // cross: which side of the axis
        part.add(x, y, Object.assign({ t: tc, tu: t * L, s, d, r, nx: ex / (r || 1), ny: ey / (r || 1) }, extra));
      }
    }
  }

  // limb with a radius profile rf(t) (t = 0 at a, 1 at b); info adds u = signed offset / radius
  function limb(part, a, b, rf, extra) {
    let rmax = 0;
    for (let k = 0; k <= 8; k++) rmax = Math.max(rmax, rf(k / 8));
    const [x0, y0, x1, y1] = bbox([a, b], rmax + 1);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1e-6;
    const L = Math.sqrt(L2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = ((px - a[0]) * dx + (py - a[1]) * dy) / L2;
      const tc = clamp(t, 0, 1);
      const cx = a[0] + dx * tc, cy = a[1] + dy * tc;
      const ex = px - cx, ey = py - cy;
      const d = Math.hypot(ex, ey);
      const r = rf(tc);
      if (d <= r) {
        const s = (dx * ey - dy * ex) / L;
        part.add(x, y, Object.assign({ t: tc, tu: t * L, s, u: s / (r || 1), d, r, nx: ex / (r || 1), ny: ey / (r || 1) }, extra));
      }
    }
  }

  // ---------------------------------------------------------------- lighting
  // authoring space: +x forward, +y down, +z toward the viewer
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const KEY = norm3([0.45, -0.62, 0.64]);
  const RIM = norm3([-0.9, -0.3, -0.15]);
  const HALF = norm3([KEY[0], KEY[1], KEY[2] + 1]);
  // n = [nx, ny] in-plane (length ≤ 1); nz fills the rest toward the viewer
  function lit(nx, ny, o = {}) {
    let nz = 1 - nx * nx - ny * ny;
    nz = nz > 0 ? Math.sqrt(nz) : 0;
    if (o.flat) nz = Math.max(nz, o.flat);
    const n = norm3([nx, ny, nz]);
    const d = Math.max(0, n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);
    const h = Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]);
    const r = Math.max(0, n[0] * RIM[0] + n[1] * RIM[1] + n[2] * RIM[2]);
    const amb = o.amb ?? 0.12;
    const spec = (o.spec || 0) * Math.pow(h, o.shine || 24);
    const rim = (o.rim ?? 0.35) * r * r;
    return amb + (o.kd ?? 0.9) * d + spec + rim;
  }
  // brightness → ramp index, with an optional ordered dither across each threshold
  const TH = [1.02, 0.74, 0.5, 0.3];
  function tone(v, x, y, o = {}) {
    const th = o.th || TH;
    const dw = o.dither || 0;
    const bias = dw ? ((((x + y) & 1) ? 1 : -1) * dw) : 0;
    const w = v + bias;
    let i = 4;
    if (w >= th[3]) i = 3;
    if (w >= th[2]) i = 2;
    if (w >= th[1]) i = 1;
    if (w >= th[0] && !o.noShine) i = 0;
    return i + (o.shift || 0);
  }

  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function poly(part, pts, extra) {
    const [x0, y0, x1, y1] = bbox(pts, 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (inPoly(x + 0.5, y + 0.5, pts)) part.add(x, y, extra ? Object.assign({}, extra) : undefined);
    }
  }

  // A local frame: origin o, axis ax (along "a"), ay (along "b"); maps world ↔ local
  function frame(o, angle, sx = 1, sy = 1) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      o, c, s, sx, sy,
      // local (a, b) → world; a along (c, s), b along (-s, c) i.e. rotated +90° (downwards when angle = 0)
      w(a, b) { return [o[0] + (a * c - b * s) * sx, o[1] + (a * s + b * c) * sy]; },
      l(x, y) { const dx = (x - o[0]) / sx, dy = (y - o[1]) / sy; return [dx * c + dy * s, -dx * s + dy * c]; },
    };
  }
  // rasterise fn(a, b) → info|null over a local rectangle [a0,a1]×[b0,b1] of frame F
  function region(part, F, a0, a1, b0, b1, fn) {
    const pts = [F.w(a0, b0), F.w(a1, b0), F.w(a1, b1), F.w(a0, b1)];
    const [x0, y0, x1, y1] = bbox(pts, 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const [a, b] = F.l(x + 0.5, y + 0.5);
      if (a < a0 || a > a1 || b < b0 || b > b1) continue;
      const info = fn(a, b, x, y);
      if (info) part.add(x, y, info === true ? { a, b } : Object.assign({ a, b }, info));
    }
  }

  function disc(part, cx, cy, r, extra) {
    const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) part.add(x, y, Object.assign({ dx, dy, rr: Math.hypot(dx, dy) / (r || 1) }, extra));
    }
  }

  // Bresenham line through pixel centres
  function line(x0, y0, x1, y1, cb) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, n = 0;
    for (;;) {
      cb(x0, y0, n++);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // hand-drawn bitmap: rows of chars; key maps char → [material, rampIndex] | 'skip'
  // anchor [ax, ay] is placed at world point p; flip mirrors horizontally
  function sprite(part, rows, key, p, anchor, flip = false) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const bx = Math.round(p[0]) - (flip ? w - 1 - anchor[0] : anchor[0]);
    const by = Math.round(p[1]) - anchor[1];
    for (let j = 0; j < h; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const k = key[ch];
        if (!k) continue;
        const x = bx + (flip ? w - 1 - i : i), y = by + j;
        part.add(x, y, { ch, key: k, i, j });
      }
    }
  }
  const spriteColour = (info) => info.key;

  // ---------------------------------------------------------------- finishing passes
  // outline every empty pixel that touches the figure (4-neighbourhood → clean 1 px ring)
  function outline(buf, opts = {}) {
    const { w, h, c, m, f } = buf;
    const add = [];
    const light = opts.light || PX.LIGHT;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c[i]) continue;
      let best = -1, lit = false;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (c[j] && !(f[j] & 1)) {
          if (best < 0 || m[j] > 0) best = j;
          // the neighbour sits on the far side from the light → this outline faces the light
          if (dx === -Math.sign(Math.round(light[0])) && dy === 0) lit = true;
          if (dy === -Math.sign(Math.round(light[1])) && dx === 0) lit = true;
        }
      }
      if (best >= 0) {
        const mat = MATS[m[best]];
        const col = mat ? (lit && mat.softInk && opts.soft !== false ? mat.softInk : mat.ink) : hex('#140f1c');
        add.push([i, col, m[best]]);
      }
    }
    for (const [i, col, mm] of add) { c[i] = col; m[i] = mm; f[i] |= 4; }
  }

  // rim light: figure pixels on the side away from the key light that touch the outline
  // take a bright colour — a dark silhouette lit from behind
  function rimLight(buf, col, opts = {}) {
    const { w, h, c, f } = buf;
    const dirs = opts.dirs || [[-1, 0], [0, 1]]; // back and underside while authoring (light comes from +x, -y)
    const mark = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!c[i] || (f[i] & (2 | 4))) continue;
      for (const [dx, dy] of dirs) {
        const j = (y + dy) * w + (x + dx);
        if (f[j] & 4) { mark.push(i); break; }
      }
    }
    for (const i of mark) c[i] = col;
  }

  // ---------------------------------------------------------------- output
  function flipX(buf) {
    const out = new Buf(buf.w, buf.h);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x, j = y * buf.w + (buf.w - 1 - x);
      out.c[j] = buf.c[i]; out.m[j] = buf.m[i]; out.p[j] = buf.p[i]; out.f[j] = buf.f[i];
    }
    return out;
  }

  // rotate everything drawn so far about (cx, cy) by deg (nearest neighbour; used for flips and spins)
  function rotateBuf(buf, cx, cy, deg) {
    const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
    const src = { c: buf.c.slice(), m: buf.m.slice(), p: buf.p.slice(), f: buf.f.slice() };
    buf.c.fill(0); buf.m.fill(0); buf.p.fill(0); buf.f.fill(0);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const sx = Math.floor(cx + dx * c + dy * s), sy = Math.floor(cy - dx * s + dy * c);
      if (sx < 0 || sy < 0 || sx >= buf.w || sy >= buf.h) continue;
      const j = sy * buf.w + sx;
      if (!src.c[j]) continue;
      const i = y * buf.w + x;
      buf.c[i] = src.c[j]; buf.m[i] = src.m[j]; buf.p[i] = src.p[j]; buf.f[i] = src.f[j];
    }
  }

  // simple easing helpers for keyframed motion
  const ease = {
    lin: (t) => t,
    in: (t) => t * t,
    out: (t) => 1 - (1 - t) * (1 - t),
    io: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
    hold: () => 0,
    snap: (t) => (t < 0.5 ? 0 : 1),
    back: (t) => { const s = 1.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  };

  // blend two pose objects (numbers and arrays of numbers interpolate, everything else snaps at t ≥ 0.5)
  function blend(a, b, t) {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const va = a[k], vb = b[k];
      if (va === undefined) { out[k] = vb; continue; }
      if (vb === undefined) { out[k] = va; continue; }
      if (typeof va === 'number' && typeof vb === 'number') out[k] = lerp(va, vb, t);
      else if (Array.isArray(va) && Array.isArray(vb) && va.every((v) => typeof v === 'number') && vb.every((v) => typeof v === 'number') && va.length === vb.length)
        out[k] = va.map((v, i) => lerp(v, vb[i], t));
      else if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va) && !Array.isArray(vb)) out[k] = blend(va, vb, t);
      else out[k] = t < 0.5 ? va : vb;
    }
    return out;
  }

  // timeline of keys [{f: frame, p: pose, e: easing to next}], returns pose at integer frame n
  function timeline(keys, base = {}) {
    const ks = keys.map((k) => ({ f: k.f, p: Object.assign({}, base, k.p), e: k.e || 'io' }));
    // carry values forward so later keys only need to name what changes
    for (let i = 1; i < ks.length; i++) ks[i].p = Object.assign({}, ks[i - 1].p, keys[i].p);
    return function (n) {
      if (n <= ks[0].f) return ks[0].p;
      for (let i = 0; i < ks.length - 1; i++) {
        const A = ks[i], B = ks[i + 1];
        if (n >= A.f && n < B.f) {
          const t = (n - A.f) / (B.f - A.f);
          return blend(A.p, B.p, ease[A.e](t));
        }
      }
      return ks[ks.length - 1].p;
    };
  }

  // two-bone IK: from joint a toward target t, lengths l1, l2; bend = +1 / -1 picks the side
  function ik(a, t, l1, l2, bend) {
    let dx = t[0] - a[0], dy = t[1] - a[1];
    let d = Math.hypot(dx, dy) || 1e-6;
    const maxd = l1 + l2 - 0.001, mind = Math.abs(l1 - l2) + 0.001;
    let tx = t[0], ty = t[1];
    if (d > maxd) { tx = a[0] + (dx / d) * maxd; ty = a[1] + (dy / d) * maxd; d = maxd; }
    if (d < mind) { tx = a[0] + (dx / d) * mind; ty = a[1] + (dy / d) * mind; d = mind; }
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const A = Math.acos(cosA);
    const base = Math.atan2(ty - a[1], tx - a[0]);
    const ang = base + bend * A;
    return { mid: [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1], end: [tx, ty] };
  }

  // deterministic hash noise
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  const PX = {
    TAU, rad, clamp, lerp, rgba, hex, unpack, mix,
    MATS, MAT, material, Buf, Part, capsule, limb, poly, frame, region, disc, line, sprite, spriteColour,
    lit, tone, KEY, RIM, norm3,
    outline, rimLight, flipX, rotateBuf, ease, blend, timeline, ik, hash, inPoly, bbox,
    LIGHT: [0.55, -0.83], // towards the light: top-front (front = +x while authoring)
  };
  root.PX = PX;
})(typeof window !== 'undefined' ? window : globalThis);
