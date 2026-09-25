// cast.js — the three club members drawn from the Gemini pixel sheet (src/cast-data.js) instead of the
// code-drawn bodies: head, hair, torso and skirt are the sheet's own pixels (arms masked out), shoes and
// the laptop are cut from it too; arms and legs stay rig-driven cylinders in the sheet's colours so every
// move still animates. The wolf form keeps its code-drawn renderer. Overrides root.JK / VAMP / MAID.
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG, CAST = root.CAST;
  if (!CAST) return;
  const { material, Part, rad } = PX;
  const SIZE = { w: 232, h: 204, ox: 108, oy: 194 };
  const dummyRows = (n) => new Array(n).fill('');
  const FIST = ['..ssS..', '.sSSSt.', 'sSSSSSt', 'sSStSSt', 'SSSSStt', '.SttTt.', '..TTT..'];
  const HAND = ['..sSS..', '.sSSSSt', 'sSSSSSt', 'sSSSSSt', '.SSSStt', '.tSSTt.', '..TTT..'];

  function bodyPart(buf, C, J, p) {
    RIG.blitImg(buf, C.body, J.hip, C.body.hip, { lean: J.lean, pivot: C.body.hip[1] });
  }
  function shoe(buf, part, foot) { RIG.blitImg(buf, part, [foot[0], foot[1]], part.ank); }
  function boxesOf(DEF, SPEC) { return (pose) => { const p = Object.assign({}, DEF, pose); const J = RIG.solve(p, SPEC, [0, 0]); return RIG.boxes(J, SPEC, p); }; }
  function specOf(C, o) {
    return Object.assign({ hipTorso: C.body.hip, sh: { N: C.body.shN, F: C.body.shF, neck: C.body.neck }, torsoRows: dummyRows(C.body.h), torsoPivot: C.body.hip[1], kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 5 }, o);
  }
  // HUD portrait: the head box of the body image
  function portraitOf(C) {
    return function (buf) {
      const [x0, y0, x1, y1] = C.body.headBox;
      const part = { w: x1 - x0 + 1, h: y1 - y0 + 1, d: null, px: null };
      const src = RIG.imgData(C.body);
      part.px = new Uint32Array(part.w * part.h);
      for (let j = 0; j < part.h; j++) for (let i = 0; i < part.w; i++) part.px[j * part.w + i] = src[(y0 + j) * C.body.w + (x0 + i)];
      RIG.blitImg(buf, part, [Math.floor(buf.w / 2), buf.h - 2], [Math.floor(part.w / 2), part.h - 1], { sep: false });
    };
  }

  // ================================================================ JK
  (function () {
    const R = root.JK, C = CAST.jk;
    if (!R || !C) return;
    const M = R.M;
    M.chrome = material('jk_chrome', ['#ffffff', '#dfe9f2', '#a9b3c4', '#6f7591', '#4a4868'], '#12162a', { softInk: '#6f7591' });
    M.stocking = material('jk_stock', ['#6a6d80', '#41434f', '#2c2e38', '#1d1e26', '#111117'], '#050610', { softInk: '#1d1e26' });
    const KEY = R.KEY;
    const SPEC = specOf(C, { thigh: 34, shin: 24, upper: 13, fore: 13, headH: 26, headW: 22, bodyW: 12 });
    const DEF = Object.assign({}, R.DEF, { hip: [0, -61], fN: [-13, -3], fF: [15, -3], hN: [2, -52], hF: [18, -66], blade: 46 });
    function render(pose, opts = {}) {
      const p = Object.assign({}, DEF, pose);
      const br = p.broken || {};
      const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
      const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
      const J = RIG.solve(p, SPEC, O);
      if (!p.hidden) {
        // far arm: skin (the sleeve puff is part of the body), a fist or an open hand
        RIG.cyl(buf, M.skin, J.shF, J.eF, (t) => 3.2 - t * 0.4, { look: 'skin' });
        RIG.cyl(buf, M.skin, J.eF, J.hF, (t) => 2.8 - t * 0.3, { look: 'skin' });
        RIG.place(buf, M.skin, p.grip === 'S' || p.noSword ? HAND : FIST, KEY, J.hF, [3, 3]);
        if (p.swordLayer === 'back') sword(buf, J.hF, p, br);
        // far leg: the chrome prosthetic (plates, a knee ring), its boot from the sheet
        chromeLeg(buf, J.hipF, J.kF, J.fF, br.leg);
        // near leg: the black thigh-high, the loafer from the sheet
        RIG.cyl(buf, M.stocking, J.hipN, J.kN, (t) => 4.4 - t * 0.9, { look: 'leather' });
        RIG.cyl(buf, M.stocking, J.kN, [J.fN[0], J.fN[1] - 2], (t) => 3.5 - t * 0.5, { look: 'leather' });
        shoe(buf, C.shoeN, J.fN);
        bodyPart(buf, C, J, p);
        // near arm: the prosthetic under a short sleeve, a 7 px steel fist
        steelArm(buf, J, p, br.arm);
        if (p.swordLayer === 'front') sword(buf, J.hF, p, br);
        RIG.finish(buf, p, J, { rotUp: 16 });
      }
      if (p.smear) RIG.smear(buf, O, p, p.smear, (br.blade ? 20 : p.blade) + 6, ['hF', 'sw']);
      if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
      return opts.flip ? PX.flipX(buf) : buf;
    }
    function steelArm(buf, J, p, broken) {
      RIG.cyl(buf, M.chrome, J.shN, J.eN, (t) => 3.6 - t * 0.5, { look: 'metal', band: (i) => (i.t < 0.42 ? [M.white, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.white, i.x, i.y)] : Math.abs(i.t - 0.7) < 0.05 ? { shift: 2 } : null) });
      RIG.ball(buf, M.joint, J.eN, 2.6, 'metal');
      if (broken) {
        const d = [J.hN[0] - J.eN[0], J.hN[1] - J.eN[1]], L = Math.hypot(d[0], d[1]) || 1, u = [d[0] / L, d[1] / L];
        const stump = [Math.round(J.eN[0] + u[0] * 6), Math.round(J.eN[1] + u[1] * 6)];
        RIG.cyl(buf, M.joint, J.eN, stump, 2.4, { look: 'metal', add: -0.2 });
        const w = new Part(buf, M.wire, { sep: false });
        for (const [dx, dy, t] of [[3, 0, 1], [5, 1, 0], [2, -3, 2], [4, 3, 1], [6, -1, 0]]) w.add(stump[0] + Math.round(u[0] * dx - u[1] * dy), stump[1] + Math.round(u[1] * dx + u[0] * dy), { t });
        w.commit((i) => i.t);
        return;
      }
      RIG.cyl(buf, M.chrome, J.eN, J.hN, (t) => 3.8 - t * 0.6, { look: 'metal', band: (i) => (Math.abs(i.t - 0.4) < 0.045 ? { shift: 2 } : i.t > 0.86 ? [M.joint, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.metal, i.x, i.y, { shift: 1 })] : null) });
      RIG.place(buf, M.chrome, ['..IIIi.', '.IiiiiJ', 'IiiiiiJ', 'IiigiiJ', 'iiiiijJ', '.iijjJ.', '..GGG..'], KEY, J.hN, [3, 3]);
    }
    function chromeLeg(buf, hip, knee, foot, broken) {
      RIG.cyl(buf, M.chrome, hip, knee, (t) => 4.4 - t * 0.8, { look: 'metal', band: (i) => (Math.abs(i.t - 0.5) < 0.04 ? { shift: 2 } : null) });
      const ank = [foot[0], foot[1] - 2];
      if (broken) {
        RIG.cyl(buf, M.joint, knee, ank, 1.8, { look: 'metal', add: -0.25 });
        const w = new Part(buf, M.wire, { sep: false });
        const mid = [Math.round((knee[0] + ank[0]) / 2), Math.round((knee[1] + ank[1]) / 2)];
        for (const [dx, dy, t] of [[2, 0, 1], [3, 5, 2], [-2, 8, 0], [2, -6, 1]]) w.add(mid[0] + dx, mid[1] + dy, { t });
        w.commit((i) => i.t);
      } else {
        RIG.cyl(buf, M.chrome, knee, ank, (t) => 3.5 - t * 0.4, { look: 'metal', band: (i) => (Math.abs(i.t - 0.62) < 0.04 ? { shift: 2 } : null) });
      }
      RIG.ball(buf, broken ? M.joint : M.chrome, knee, 2.8, 'metal');
      shoe(buf, C.shoeF, foot);
    }
    function sword(buf, h, p, br) {
      if (p.grip === 'S' || p.noSword) return;
      const a = rad(p.sw), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
      const g = [h[0] + 0.5, h[1] + 0.5];
      const hilt = new Part(buf, M.red);
      for (let s = -1; s <= 1; s++) PX.line(g[0] - d[0] * 10 + n[0] * s, g[1] - d[1] * 10 + n[1] * s, g[0] + n[0] * s, g[1] + n[1] * s, (x, y, i) => hilt.add(x, y, { i, s }));
      hilt.commit((i) => (i.s === -1 ? 2 : (i.i >> 1) % 2 ? 3 : 4));
      if (!p.noBlade) {
        const L = br.blade ? 19 : p.blade;
        const bl = new Part(buf, M.blade);
        const t0 = [g[0] + d[0] * 4, g[1] + d[1] * 4];
        const tip = [t0[0] + d[0] * L, t0[1] + d[1] * L];
        const side = n[1] > 0 ? 1 : -1;
        for (let s = -1; s <= 1; s++) {
          const shorten = s === -side ? 5 : s === 0 ? 2 : 0;
          PX.line(t0[0] + n[0] * s, t0[1] + n[1] * s, tip[0] - d[0] * shorten + n[0] * s, tip[1] - d[1] * shorten + n[1] * s, (x, y) => { if (!bl.has(x, y)) bl.add(x, y, { s: s * side }); });
        }
        bl.commit((i) => (i.s === -1 ? 1 : i.s === 0 ? 3 : 4));
      }
      const ts = new Part(buf, M.gold);
      const tc = [g[0] + d[0] * 2.5, g[1] + d[1] * 2.5];
      for (let s = -2.5; s <= 2.5; s += 0.5) PX.line(tc[0] + n[0] * s - d[0] * 0.5, tc[1] + n[1] * s - d[1] * 0.5, tc[0] + n[0] * s + d[0] * 0.5, tc[1] + n[1] * s + d[1] * 0.5, (x, y) => ts.add(x, y, { s }));
      ts.commit((i) => (i.s < -1 ? 0 : i.s > 1.5 ? 3 : 1));
    }
    Object.assign(R, { SIZE, SPEC, DEF, render, boxes: boxesOf(DEF, SPEC), portrait: portraitOf(C), fromSheet: true,
      anchors(pose) { const p = Object.assign({}, DEF, pose); const J = RIG.solve(p, SPEC, [0, 0]); return { arm: J.eN, leg: [(J.kF[0] + J.fF[0]) / 2, (J.kF[1] + J.fF[1]) / 2], blade: [J.hF[0] + Math.cos(rad(p.sw)) * 22, J.hF[1] + Math.sin(rad(p.sw)) * 22], uniform: [J.neck[0] + 4, J.neck[1] + 8] }; } });
  })();

  // ================================================================ vampire
  (function () {
    const R = root.VAMP, C = CAST.vamp;
    if (!R || !C) return;
    const M = R.M, KEY = R.KEY;
    const SPEC = specOf(C, { thigh: 22, shin: 16, upper: 10, fore: 10, headH: 34, headW: 36, bodyW: 12 });
    const DEF = Object.assign({}, R.DEF, { hip: [0, -37], fN: [-11, -3], fF: [13, -3], hN: [12, -42], hF: [16, -41], bat: [-28, -62] });
    function laptop(buf, h, p, br) {
      if (p.noLap) return;
      if (br.laptop) {
        // a cracked half: the sheet's laptop cut short with a jagged edge
        const part = { w: 18, h: C.laptop.h, px: null, d: null };
        const src = RIG.imgData(C.laptop); part.px = new Uint32Array(part.w * part.h);
        for (let j = 0; j < part.h; j++) for (let i = 0; i < part.w; i++) if (i < 15 + (j % 3)) part.px[j * part.w + i] = src[j * C.laptop.w + i];
        RIG.blitImg(buf, part, h, C.laptop.grip, { rot: p.la || 0 });
        return;
      }
      RIG.blitImg(buf, C.laptop, h, C.laptop.grip, { rot: p.la || 0 });
      if (p.lapOpen) {
        const a = rad(p.la ?? 0), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
        const g = [h[0] + 0.5, h[1] + 0.5];
        const sc = new Part(buf, M.screen, { sep: false });
        for (let k = 0; k <= 14; k++) for (let s = 0; s <= 24; s++) {
          const x = Math.floor(g[0] + d[0] * (s - 3) - n[0] * (k + 2)), y = Math.floor(g[1] + d[1] * (s - 3) - n[1] * (k + 2));
          sc.add(x, y, { k, s, edge: k === 14 || k === 0 || s === 0 || s === 24 });
        }
        sc.commit((i) => (i.edge ? [M.lap, 3] : ((i.k >= 4 && i.k <= 9 && i.s >= 9 && i.s <= 15 && ((i.k === 5 && (i.s === 10 || i.s === 14)) || (i.k === 8 && i.s >= 11 && i.s <= 13) || (i.k === 6 && (i.s === 11 || i.s === 13)))) ? 0 : (i.k + i.s) % 4 === 0 ? 1 : 2)));
      }
    }
    function arm(buf, sh, el, hd, open) {
      const stripe = (i) => (Math.abs(i.u - 0.1) < 0.24 ? [M.white, i.nx > 0.3 ? 0 : 1] : null);
      RIG.cyl(buf, M.red, sh, el, (t) => 3.4 - t * 0.4, { look: 'cloth', band: stripe });
      RIG.cyl(buf, M.red, el, hd, (t) => 3.1 - t * 0.5, { look: 'cloth', band: (i) => (i.t > 0.84 ? { shift: 2 } : stripe(i)) });
      RIG.place(buf, M.skin, open ? HAND : FIST, KEY, hd, [3, 3]);
    }
    function leg(buf, hip, knee, foot, part, bare) {
      const stripe = (i) => (Math.abs(i.u - 0.05) < 0.22 ? [M.white, i.nx > 0.3 ? 0 : 1] : null);
      RIG.cyl(buf, M.red, hip, knee, (t) => 4.4 - t * 0.6, { look: 'cloth', band: stripe });
      RIG.cyl(buf, M.red, knee, [foot[0], foot[1] - 2], (t) => 3.9 - t * 0.3, { look: 'cloth', band: stripe });
      if (bare) RIG.place(buf, M.skin, R.FOOT.bare, KEY, foot, [4, 0]); else shoe(buf, part, foot);
    }
    function render(pose, opts = {}) {
      const p = Object.assign({}, DEF, pose);
      const br = p.broken || {};
      const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
      const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
      const J = RIG.solve(p, SPEC, O);
      if (p.bat && !p.noBat) R.bat(buf, [O[0] + p.bat[0], O[1] + p.bat[1]], p.flap, { angry: !!br.laptop });
      if (!p.hidden) {
        arm(buf, J.shF, J.eF, J.hF, p.grip === 'O');
        if (p.lapLayer === 'back') laptop(buf, J.hN, p, br);
        leg(buf, J.hipF, J.kF, J.fF, C.shoeF, br.slippers);
        leg(buf, J.hipN, J.kN, J.fN, C.shoeN, br.slippers);
        bodyPart(buf, C, J, p);
        arm(buf, J.shN, J.eN, J.hN, p.grip === 'O');
        if (p.lapLayer === 'front') laptop(buf, J.hN, p, br);
        RIG.finish(buf, p, J, { rotUp: 12 });
      }
      if (p.smear) RIG.smear(buf, O, p, p.smear, (br.laptop ? 13 : 24), ['hN', 'la']);
      if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
      return opts.flip ? PX.flipX(buf) : buf;
    }
    Object.assign(R, { SIZE, SPEC, DEF, render, boxes: boxesOf(DEF, SPEC), portrait: portraitOf(C), fromSheet: true,
      anchors(pose) { const p = Object.assign({}, DEF, pose); const J = RIG.solve(p, SPEC, [0, 0]); return { glasses: [J.neck[0] + 3, J.neck[1] - 8], laptop: [J.hN[0] + 8, J.hN[1]], slippers: [J.fN[0], J.fN[1]], ahoge: [J.neck[0] - 4, J.neck[1] - 30] }; } });
  })();

  // ================================================================ maid (the wolf keeps the drawn renderer)
  (function () {
    const R = root.MAID, C = CAST.maid;
    if (!R || !C) return;
    const M = R.M, KEY = R.KEY;
    M.sleeve = material('md_sleeve', ['#5c5a72', '#3a3849', '#26243a', '#181724', '#0e0d16'], '#050408', { softInk: '#181724' });
    const SPEC = specOf(C, { thigh: 30, shin: 20, upper: 11, fore: 11, headH: 30, headW: 28, bodyW: 12 });
    const DEF = Object.assign({}, R.DEF, { hip: [0, -49], fN: [-11, -3], fF: [12, -3], hN: [-4, -56], hF: [12, -58] });
    const baseRender = R.render, baseBoxes = R.boxes;
    function arm(buf, sh, el, hd, open) {
      RIG.cyl(buf, M.sleeve, sh, el, (t) => 3.4 - t * 0.5, { look: 'cloth' });
      RIG.cyl(buf, M.sleeve, el, hd, (t) => 3.0 - t * 0.3, { look: 'cloth', band: (i) => (i.t > 0.74 ? [M.white, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.white, i.x, i.y)] : null) });
      RIG.place(buf, M.skin, open ? HAND : FIST, KEY, hd, [3, 3]);
    }
    function leg(buf, hip, knee, foot, part, bare) {
      RIG.cyl(buf, M.tights, hip, knee, (t) => 4.0 - t * 0.8, { look: 'white' });
      RIG.cyl(buf, M.tights, knee, [foot[0], foot[1] - 2], (t) => 3.3 - t * 0.5, { look: 'white' });
      if (bare) RIG.place(buf, M.tights, R.FOOT.tights, KEY, foot, [4, 0]); else shoe(buf, part, foot);
    }
    function render(pose, opts = {}) {
      if (pose.form === 'wolf') return baseRender(pose, opts);
      const p = Object.assign({}, DEF, pose);
      const br = p.broken || {};
      const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
      const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
      const J = RIG.solve(p, SPEC, O);
      if (!p.hidden) {
        arm(buf, J.shF, J.eF, J.hF, p.grip !== 'F');
        leg(buf, J.hipF, J.kF, J.fF, C.shoeF, br.shoes);
        leg(buf, J.hipN, J.kN, J.fN, C.shoeN, br.shoes);
        bodyPart(buf, C, J, p);
        if (br.headdress) { // the frills go: paint the top rows out with hair... simplest: cover with a dark band
          const hd = new Part(buf, M.hair, { sep: false });
          for (let i = 8; i <= 24; i++) for (let j = 0; j < 3; j++) { const x = J.neck[0] - C.body.neck[0] + i, y = J.neck[1] - C.body.neck[1] + j; if (buf.get(x, y)) hd.add(x, y, {}); }
          hd.commit(() => 2);
        }
        if (br.ribbon) { const rb = new Part(buf, M.skin, { sep: false }); for (let i = 17; i <= 25; i++) for (let j = 22; j <= 23; j++) { const x = J.neck[0] - C.body.neck[0] + i, y = J.neck[1] - C.body.neck[1] + j; if (buf.get(x, y)) rb.add(x, y, {}); } rb.commit(() => 2); }
        arm(buf, J.shN, J.eN, J.hN, p.grip !== 'F');
        RIG.finish(buf, p, J, { rotUp: 14 });
      }
      if (p.smear) RIG.smear(buf, O, p, p.smear, p.reach || 16, p.smearKeys || ['hF', 'la']);
      if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
      return opts.flip ? PX.flipX(buf) : buf;
    }
    const mb = boxesOf(DEF, SPEC);
    Object.assign(R, { SIZE, SPEC, DEF, render, portrait: portraitOf(C), fromSheet: true,
      boxes(pose) { return pose.form === 'wolf' ? baseBoxes(pose) : mb(pose); },
      anchors(pose) { const p = Object.assign({}, DEF, pose); const J = RIG.solve(p, SPEC, [0, 0]); return { headdress: [J.neck[0], J.neck[1] - 28], apron: [J.hip[0] + 4, J.hip[1] - 6], ribbon: [J.neck[0] + 4, J.neck[1] - 4], shoes: [J.fN[0], J.fN[1]] }; } });
  })();

  // ================================================================ sheet scale: render big, shrink by SM
  const SM = 0.36, UP = 1 / SM;
  const JOINTS = ['hip', 'kN', 'kF', 'bat', 'hN', 'hF', 'eN', 'eF', 'fN', 'fF'];
  function upPose(p) {
    const o = Object.assign({}, p);
    for (const k of JOINTS) if (Array.isArray(o[k])) o[k] = [Math.round(o[k][0] * UP), Math.round(o[k][1] * UP)];
    if (typeof o.skirtSwing === 'number') o.skirtSwing = Math.round(o.skirtSwing * UP);
    if (o.smear) { const sm = Object.assign({}, o.smear); for (const w of ['from', 'to']) if (sm[w]) { sm[w] = Object.assign({}, sm[w]); for (const k of JOINTS) if (Array.isArray(sm[w][k])) sm[w][k] = [Math.round(sm[w][k][0] * UP), Math.round(sm[w][k][1] * UP)]; } o.smear = sm; }
    if (o.fx) o.fx = o.fx.map((f) => { const g = Object.assign({}, f); for (const k of ['x', 'y', 'x0', 'x1', 'r', 'r0', 'r1', 'len', 'd', 'rx', 'ry', 'h', 'gap', 'w']) if (typeof g[k] === 'number') g[k] = g[k] * UP; if (Array.isArray(g.c)) g.c = [g.c[0] * UP, g.c[1] * UP]; return g; });
    return o;
  }
  // area-average shrink with alpha coverage, colours snapped to the buffer's own palette
  function shrink(big, w, h, ox, oy) {
    const out = new PX.Buf(w, h);
    const pal = new Map();
    for (let i = 0; i < big.c.length; i++) if (big.c[i]) pal.set(big.c[i], (pal.get(big.c[i]) || 0) + 1);
    const cols = [...pal.keys()].map((c) => [c, ...PX.unpack(c)]);
    const fx = big.w / w, fy = big.h / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0, tot = 0, fl = 0;
      const x0 = Math.floor(x * fx), x1 = Math.floor((x + 1) * fx), y0 = Math.floor(y * fy), y1 = Math.floor((y + 1) * fy);
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { tot++; const c = big.c[yy * big.w + xx]; if (!c) continue; n++; const u = PX.unpack(c); r += u[0]; g += u[1]; b += u[2]; fl |= big.f[yy * big.w + xx]; }
      if (!n || n * 2 < tot) continue;
      r /= n; g /= n; b /= n;
      let best = null, bd = 1e9;
      for (const c of cols) { const d = (c[1] - r) ** 2 + (c[2] - g) ** 2 + (c[3] - b) ** 2; if (d < bd) { bd = d; best = c[0]; } }
      const i = y * w + x; out.c[i] = best; out.f[i] = fl & 2; out.m[i] = 0;
    }
    return out;
  }
  for (const R of [root.VAMP, root.MAID]) {
    if (!R || R.shrunk) continue;
    const bigRender = R.render, bigBoxes = R.boxes, bigAnchors = R.anchors, bigSize = R.SIZE;
    const SIZE = { w: Math.round(bigSize.w * SM), h: Math.round(bigSize.h * SM), ox: Math.round(bigSize.ox * SM), oy: Math.round(bigSize.oy * SM) };
    const scaleBox = (b) => b.map((v) => Math.round(v * SM));
    Object.assign(R, {
      SIZE, shrunk: true, bigRender,
      render(pose, opts = {}) { const big = bigRender(upPose(pose), {}); const small = shrink(big, SIZE.w, SIZE.h); return opts.flip ? PX.flipX(small) : small; },
      boxes(pose) { const b = bigBoxes(upPose(pose)); return { head: scaleBox(b.head), body: scaleBox(b.body), legs: scaleBox(b.legs) }; },
      anchors(pose) { const a = bigAnchors(upPose(pose)); const o = {}; for (const k of Object.keys(a)) o[k] = [a[k][0] * SM, a[k][1] * SM]; return o; },
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
