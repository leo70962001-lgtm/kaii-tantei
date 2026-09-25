// puppet.js — the JK as a cutout puppet: the standing picture's parts (src/jk-parts.js) bound to the rig's
// skeleton the way a Spine / three.js Bone rig binds sprites to bones. Every animation frame's pose is solved
// into joints by the rig (RIG.solve), each part is placed by the two joints it spans (rotated, stretched to
// the joint distance), and between frames the joints are interpolated so motions run at 60 fps instead of
// stepping. The far (skin) arm, the hands and the sword are drawn once by the rig's own pixel routines.
// PUPPET.place(...) returns {img, m} placements: m = [a, b, c, d, e, f] maps part pixels to pixels relative to
// the fighter's origin (feet), y down, facing +x; the renderers mirror / shear / translate them.
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG, CAST = root.CAST;
  if (!PX || !RIG || !CAST || !CAST.jkParts || typeof document === 'undefined') return;
  const rad = (a) => (a * Math.PI) / 180;

  function toCanvas(c32, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const id = ctx.createImageData(w, h);
    new Uint32Array(id.data.buffer).set(c32); ctx.putImageData(id, 0, 0); return cv;
  }
  const inkc = PX.rgba(6, 8, 24, 255), whitec = PX.rgba(255, 255, 255, 255);
  // a part = { w, h, px (Uint32Array), pivot, tip?, cv, dark, white, tint: {colour: canvas} }
  function makePart(w, h, px, pivot, tip, res) {
    const dark = new Uint32Array(px.length), white = new Uint32Array(px.length);
    for (let i = 0; i < px.length; i++) if (px[i]) { dark[i] = inkc; white[i] = whitec; }
    return { w, h, px, pivot, tip: tip || null, res: res || 1, cv: toCanvas(px, w, h), dark: toCanvas(dark, w, h), white: toCanvas(white, w, h), tints: {} };
  }
  function tinted(part, col) {
    if (!part.tints[col]) { const t = new Uint32Array(part.px.length), c = PX.hex(col); for (let i = 0; i < t.length; i++) if (part.px[i]) t[i] = c; part.tints[col] = toCanvas(t, part.w, part.h); }
    return part.tints[col];
  }
  function fromBuf(buf, pivot, tip, res) {
    // trim the buffer to its drawn pixels
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) if (buf.c[y * buf.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = buf.c[(y + y0) * buf.w + (x + x0)];
    return makePart(w, h, px, [pivot[0] - x0, pivot[1] - y0], tip ? [tip[0] - x0, tip[1] - y0] : null, res);
  }

  // ---------------------------------------------------------------- the JK's parts
  let parts = null;
  function build() {
    if (parts) return parts;
    const JK = root.JK, M = JK.M, SPEC = JK.castSpec;
    parts = {};
    for (const [name, p] of Object.entries(CAST.jkParts)) parts[name] = makePart(p.w, p.h, RIG.imgData(p), p.pivot, p.tip, p.res || 1);
    const res = (parts.torso && parts.torso.res) || 1;
    // shoes: the sheet's feet when it has them, else the rig's own shoe cut-outs, hanging from the ankle
    for (const [name, key] of [['footN', 'shoeN'], ['footF', 'shoeF']]) { if (parts[name]) continue; const s = CAST.jk[key]; parts[name] = makePart(s.w, s.h, RIG.imgData(s), s.ank, null, 1); }
    // the far arm: its sleeve from the sheet when cut, the skin forearm and hand as the rig draws them (at the parts' density)
    const seg = (len, r0, r1) => { const L = Math.round(len * res), b = new PX.Buf(L + 12 * res, 14 * res); RIG.cyl(b, M.skin, [6 * res, 7 * res], [6 * res + L, 7 * res], (t) => (r0 - t * (r0 - r1)) * res, { look: 'skin' }); PX.outline(b); return fromBuf(b, [6 * res, 7 * res], [6 * res + L, 7 * res], res); };
    if (!parts.uArmF) parts.uArmF = seg(SPEC.upper, 3.2, 2.8);
    if (!parts.fArmF) parts.fArmF = seg(SPEC.fore, 2.8, 2.5);
    if (!parts.handF) { const b = new PX.Buf(12 * res, 12 * res); RIG.ball(b, M.skin, [6 * res, 6 * res], 3 * res, 'skin'); PX.outline(b); parts.handF = fromBuf(b, [6 * res, 6 * res], null, res); }
    // the sword: hilt (red wrap), guard, a 60 px blade; pivot at the grip; a hilt-only variant for smear frames
    const sword = (bladeLen) => {
      const L = 14 + bladeLen, b = new PX.Buf(L + 6, 12);
      const Pt = new PX.Part(b, PX.MATS[1], { sep: false });
      const put = (x, y, col) => Pt.add(x, y, { col: PX.hex(col) });
      for (let x = 0; x < 12; x++) for (let y = 4; y <= 7; y++) put(x + 2, y, (x % 3 === 0) ? '#2a0d14' : (y === 4 ? '#b8323f' : y === 7 ? '#5c1520' : '#8a2230'));
      for (let y = 2; y <= 9; y++) put(14, y, y === 2 || y === 9 ? '#7a6a2a' : '#d8b24e'); put(15, 3, '#d8b24e'); put(15, 8, '#d8b24e');
      for (let x = 0; x < bladeLen; x++) {
        const X = 16 + x, tip = bladeLen - x;
        put(X, 5, tip <= 3 ? '#e8eef5' : '#f2f6fa'); put(X, 6, '#b9c4d2'); if (tip > 2) put(X, 7, '#6f7591'); if (tip > 5 && x > 2) put(X, 4, '#cfd8e2');
      }
      Pt.commit((i) => ({ col: i.col }));
      PX.outline(b);
      return fromBuf(b, [8, 6], [16 + bladeLen, 6]);
    };
    if (!parts.sword) { parts.sword = sword(60); parts.hilt = sword(0); parts.swordShort = sword(24); }
    return parts;
  }

  // ---------------------------------------------------------------- 2D affine helpers  m = [a, b, c, d, e, f]
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const R = (a) => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
  const S = (sx, sy) => [sx, 0, 0, sy, 0, 0];
  const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  // a part hung from joint A: rotated by `ang` about its pivot, optionally stretched along its rest axis
  function hang(part, A, ang, stretch) {
    const q = 1 / (part.res || 1);
    return mul(mul(mul(mul(T(A[0], A[1]), R(ang)), S(1, stretch || 1)), S(q, q)), T(-part.pivot[0], -part.pivot[1]));
  }
  // a limb part spanning joints A → B: its rest axis (pivot → tip) turned onto A → B, stretched to the distance
  function span(part, A, B) {
    const rx = part.tip[0] - part.pivot[0], ry = part.tip[1] - part.pivot[1];
    const vx = B[0] - A[0], vy = B[1] - A[1];
    const ang = Math.atan2(vy, vx) - Math.atan2(ry, rx);
    const q = 1 / (part.res || 1);
    const rl = (Math.hypot(rx, ry) || 1) * q, vl = Math.hypot(vx, vy);
    const k = 1;   // rigid parts: the picture's sizes are kept as drawn (the rig's IK keeps joint distances constant)
    // stretch along the rest axis: rotate into the axis frame, scale, rotate back
    const ra = Math.atan2(ry, rx);
    const st = mul(mul(R(ra), S(k, 1)), R(-ra));
    return mul(mul(mul(mul(T(A[0], A[1]), R(ang)), st), S(q, q)), T(-part.pivot[0], -part.pivot[1]));
  }

  // ---------------------------------------------------------------- posing
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  function lerpAng(a, b, t) { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * t; }
  function solveFrame(fr) {
    if (!fr._J) fr._J = root.JK.solve(fr.pose, [0, 0]);
    return fr._J;
  }
  const JOINTS = ['hip', 'hipN', 'hipF', 'shN', 'shF', 'neck', 'fN', 'fF', 'hN', 'hF', 'kN', 'kF', 'eN', 'eF'];
  // the interpolated skeleton for a fighter between its current frame and the next one
  function skeleton(an, fi, ft) {
    const fr = an.frames[fi], p = fr.pose;
    const J0 = solveFrame(fr);
    let nx = fi + 1 < an.frames.length ? an.frames[fi + 1] : (an.loop ? an.frames[0] : (an.loopFrom !== undefined ? an.frames[an.loopFrom] : null));
    let J = J0, q = p;
    if (nx && !nx.pose.full && !nx.pose.hidden && !p.full && !p.hidden) {
      const J1 = solveFrame(nx), u = Math.max(0, Math.min(1, ft / (fr.dur || 1)));
      const t = nx.hb ? u * u : u * u * (3 - 2 * u);   // accelerate into a hit, ease otherwise
      J = {}; for (const k of JOINTS) J[k] = lerpP(J0[k], J1[k], t);
      q = Object.assign({}, p, { sw: lerpAng(p.sw ?? 0, nx.pose.sw ?? p.sw ?? 0, t), lean: lerp(p.lean || 0, nx.pose.lean || 0, t), rot: lerpAng(p.rot || 0, nx.pose.rot || 0, t) });
      const h0 = p.hair || {}, h1 = nx.pose.hair || {};
      q.hair = { base: lerp(h0.base ?? 106, h1.base ?? 106, t), wave: lerp(h0.wave ?? 1, h1.wave ?? 1, t), phase: lerp(h0.phase ?? 0, h1.phase ?? 0, t) };
    }
    return { J, p: q };
  }
  // placements for a skeleton; variant: 'cv' | 'dark' | 'white' | a tint colour
  function place(J, p, variant, broken) {
    const P = build();
    const img = (part) => variant === 'cv' ? part.cv : variant === 'dark' ? part.dark : variant === 'white' ? part.white : tinted(part, variant);
    const out = [];
    const push = (part, m) => out.push({ img: img(part), m, w: part.w, h: part.h });
    const br = broken || {};
    const hair = p.hair || {};
    const lag = p.lag || 0;   // motion lag (rad): the hair and skirt trail behind when she moves
    const sway = rad(((hair.base ?? 106) - 106) * 0.35 + Math.sin((hair.phase || 0) * Math.PI * 2) * 3 * (hair.wave || 1));
    const headPart = p.face === 'hurt' ? P.headHurt : p.face === 'shout' ? P.headShout : P.head;
    const swordAng = rad(p.sw ?? 0);
    const swordPart = p.noBlade ? P.hilt : br.blade ? P.swordShort : P.sword;
    const drawSword = !(p.grip === 'S' || p.noSword);
    // back to front
    // back hair: the upper mass swings from the head, the lower one hangs from its tip and swings more
    const m1 = hang(P.hairB1, [J.neck[0] - 1, J.neck[1] + 1], sway * 0.6 + lag);
    push(P.hairB1, m1);
    push(P.hairB2, hang(P.hairB2, apply(m1, P.hairB1.tip), sway * 1.1 + lag * 1.7));
    push(P.uArmF, span(P.uArmF, J.shF, J.eF));
    push(P.fArmF, span(P.fArmF, J.eF, J.hF));
    push(P.handF, hang(P.handF, J.hF, 0));
    if (drawSword && p.swordLayer !== 'front') push(swordPart, hang(swordPart, J.hF, swordAng));
    push(P.thighF, span(P.thighF, J.hipF, J.kF));
    push(P.shinF, span(P.shinF, J.kF, J.fF));
    if (!br.leg) push(P.footF, hang(P.footF, J.fF, 0));
    push(P.thighN, span(P.thighN, J.hipN, J.kN));
    push(P.shinN, span(P.shinN, J.kN, J.fN));
    push(P.footN, hang(P.footN, J.fN, 0));
    // torso shears with the lean (the rig shifts rows above the hip); the skirt follows the hips
    const rq = 1 / (P.torso.res || 1), lean = p.lean || 0, k = -lean * (P.torso.res || 1) / Math.max(1, P.torso.pivot[1]);
    const swing = (p.skirtSwing || 0) * 0.02 + lag * 0.35;
    push(P.skirt, mul(mul(mul(mul(T(J.hip[0], J.hip[1]), R(swing)), [1, 0, k * 0.5, 1, 0, 0]), S(rq, rq)), T(-P.skirt.pivot[0], -P.skirt.pivot[1])));
    push(P.torso, mul(mul(mul(T(J.hip[0], J.hip[1]), [1, 0, k, 1, 0, 0]), S(rq, rq)), T(-P.torso.pivot[0], -P.torso.pivot[1])));
    const head = p.head || [0, 0];
    push(headPart, hang(headPart, [J.neck[0] + head[0], J.neck[1] + head[1]], rad(lean * 0.6)));
    if (P.hairF) push(P.hairF, hang(P.hairF, [J.neck[0] + head[0] - 5, J.neck[1] + head[1] - 2], sway * 0.5));
    push(P.uArmN, span(P.uArmN, J.shN, J.eN));
    if (!br.arm) {
      push(P.fArmN, span(P.fArmN, J.eN, J.hN));
      // the fist turns with the forearm
      const fa = Math.atan2(J.hN[1] - J.eN[1], J.hN[0] - J.eN[0]) - Math.atan2(P.fArmN.tip[1] - P.fArmN.pivot[1], P.fArmN.tip[0] - P.fArmN.pivot[0]);
      push(P.handN, hang(P.handN, J.hN, fa));
    }
    if (drawSword && p.swordLayer === 'front') push(swordPart, hang(swordPart, J.hF, swordAng));
    // knockdown spin: the rig turns the whole body about a point above the hip
    if (p.rot) {
      const cx = J.hip[0], cy = J.hip[1] - 16, Rm = mul(mul(T(cx, cy), R(rad(p.rot))), T(-cx, -cy));
      for (const it of out) it.m = mul(Rm, it.m);
    }
    return out;
  }
  root.PUPPET = { build, skeleton, place, mul, T, R, apply, parts: () => parts };
})(typeof window !== 'undefined' ? window : globalThis);
