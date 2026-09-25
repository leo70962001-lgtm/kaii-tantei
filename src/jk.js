// jk.js — 改造人間の女子高生 (the cyborg schoolgirl), a small hand-pixeled fighter (~60 px).
// Head, sailor top, skirt and shoes are hand-typed bitmaps; the long hair is a flowing mane;
// arms and legs are pixel strokes: near arm = steel prosthetic, far leg = steel prosthetic,
// far arm = skin with a short sleeve, near leg = black thigh-high. The odachi rides in the far hand.
// Breakable parts: arm (forearm blown off), leg (shin armour stripped to its frame), blade
// (snapped short) and uniform (scarf and collar torn away, exposing the stitches).
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('jk_hair', ['#8e9ac4', '#4a5478', '#262c48', '#161a30', '#0c0e1c'], '#05060c', { softInk: '#161a30' }),
    streak: material('jk_streak', ['#ffffff', '#f6f7ff', '#c9cee6', '#8f97b8', '#5e6588'], '#2a2f4a', { softInk: '#8f97b8' }),
    skin: material('jk_skin', ['#fff3e8', '#ffe0cc', '#f2b89c', '#c98470', '#8f5650'], '#3a1a22', { softInk: '#c98470' }),
    white: material('jk_white', ['#ffffff', '#f7f8fc', '#d3d8e8', '#9aa3c2', '#66708f'], '#232848', { softInk: '#9aa3c2' }),
    collar: material('jk_collar', ['#c9d6f2', '#8fa4d0', '#5d74a8', '#3e5079', '#293552'], '#151c30', { softInk: '#3e5079' }),
    red: material('jk_red', ['#ffb0a0', '#ff6a5c', '#d8343c', '#8e1f30', '#5a1426'], '#2a0812', { softInk: '#8e1f30' }),
    skirt: material('jk_skirt', ['#9cc2ff', '#5d8fe8', '#3462bd', '#224285', '#162c5a'], '#0b1530', { softInk: '#224285' }),
    sock: material('jk_sock', ['#6a6f8c', '#41455e', '#2a2d42', '#1b1d2e', '#101120'], '#050610', { softInk: '#1b1d2e' }),
    steel: material('jk_steel', ['#ffffff', '#e4ebf5', '#a9b5cc', '#6a7590', '#414a62'], '#12162a', { softInk: '#6a7590' }),
    joint: material('jk_joint', ['#9aa0b8', '#5c6178', '#3b3f52', '#25283a', '#171924'], '#08090f'),
    shoe: material('jk_shoe', ['#8d93ad', '#585d78', '#353950', '#22243a', '#141525'], '#07080f', { softInk: '#22243a' }),
    blade: material('jk_blade', ['#ffffff', '#d9e0ee', '#7a8398', '#2f3446', '#181b28'], '#07080e', { softInk: '#2f3446' }),
    gold: material('jk_gold', ['#fff2a0', '#ffd04a', '#e8962e', '#b05a26', '#7a3620'], '#2a0e08'),
    eye: material('jk_eye', ['#ffc0b0', '#ff5a5a', '#e0202c', '#8a1028', '#4a0818'], '#1d030e'),
    wire: material('jk_wire', ['#fff0a0', '#ff9a3a', '#c8482a', '#5a2a30', '#2a1420'], '#120608'),
  };

  const KEY = {
    a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], d: [M.hair, 4],
    W: [M.streak, 1], w: [M.streak, 2], u: [M.streak, 3],
    s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3],
    k: [M.hair, 'ink'], r: [M.eye, 2], m: [M.red, 4], y: [M.red, 3],
    V: [M.collar, 1], v: [M.collar, 2], x: [M.collar, 3],
    R: [M.red, 1], E: [M.red, 2], F: [M.red, 3],
    T: [M.white, 1], h: [M.white, 2], H: [M.white, 3],
    P: [M.skirt, 1], p: [M.skirt, 2], n: [M.skirt, 3], N: [M.skirt, 4],
    B: [M.shoe, 1], o: [M.shoe, 2], O: [M.shoe, 3],
    q: [M.red, 3], X: [M.streak, 0],
    I: [M.steel, 1], i: [M.steel, 2], j: [M.steel, 3], J: [M.joint, 3],
  };

  // ---------------------------------------------------------------- head (3/4 view, facing +x)
  const HEAD = {
    normal: [
      '.......bbbbbbb.....',
      '.....bbbaaabbbb....',
      '....bbbaabbbbbbb...',
      '....bbbabbbbbbbbb..',
      '...cbbbbbbbbbbbbbb.',
      '...cbbbbbbbbWbbbbb.',
      '...cbbbbbbbbWbcbbb.',
      '..ccbbbbbbbbWsSScb.',
      '..cbbbbbbbbcWSSSSS.',
      '..cbbbbbbbbcWkkSkS.',
      '..ccbbbbbbbcWrSSrSs',
      '..ccbbbbbbbcwSSSSS.',
      '...cbbbbbbbcwSSSmS.',
      '...cbbbbbbbcwtSSS..',
      '...ccbbbbbbcu.tSS..',
      '....cbbbbbb..qqXq..',
      '....cbbbbbb...SS...',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  HEAD.shout = fv([[13, 9, 'k'], [14, 9, 'S'], [16, 9, 'k'], [17, 9, 'S'], [16, 12, 'm'], [17, 12, 'm'], [16, 13, 'm']]);
  HEAD.hurt = fv([[13, 10, 'k'], [14, 10, 'k'], [16, 10, 'k'], [17, 10, 'S'], [13, 9, 'S'], [14, 9, 'S'], [16, 9, 'S'], [16, 12, 'm'], [16, 13, 'm']]);
  HEAD.calm = fv([[13, 10, 'k'], [14, 10, 'k'], [16, 10, 'k'], [17, 10, 'S'], [13, 9, 'S'], [14, 9, 'S'], [16, 9, 'S']]);
  HEAD.grin = fv([[15, 12, 'm'], [16, 12, 'm'], [17, 12, 'm']]);
  const HEAD_NECK = [14, 16];
  const HAIR_ROOT = [6, 13];  // the nape: the mane hangs from here
  // the near side lock: hangs from the cheek down over the shoulder, drawn after the torso
  const SIDELOCK = ['wu', 'wu', '.wu', '.wu', '.wu', '..wu', '..w', '..u'];

  // ---------------------------------------------------------------- torso: sailor top, bare midriff, waistband
  const TORSO = {
    up: [
      '.....vvvv.....',
      '...vvvvvvvvv..',
      '..vvVVvvvvvRR.',
      '..hTTvvvvvRRE.',
      '.hTTTTTvvvREEh',
      '.hTTTTTTvvEEhh',
      '.hTTTTTTTTEhhh',
      '.hhTTTTTTThhhh',
      '..hhTTTTTThhH.',
      '..HhhhhhhhhH..',
      '...sSSSSSSs...',
      '...SSSSySSs...',
      '...tSSSSSSs...',
      '..PpPPPPPPPp..',
      '..pppPPPPppp..',
    ],
  };
  TORSO.torn = RIG.recolour(TORSO.up, { R: 'v', E: 'x', V: 'x', T: 'h' }).map((r, j) => (j === 3 ? r.replace('vvvvv', 'vxvvx') : j === 11 ? r.replace('ySS', 'yyS') : r));
  const TORSO_HIP = [7, 14];
  const TORSO_SH = { N: [3, 3], F: [11, 3], neck: [7, 0] };

  // pleated skirt generated with a swing: alternate light/base columns, darker toward the back and the hem
  function skirtRows(swing = 0, flare = 0) {
    const rows = [];
    const H = 9;
    for (let j = 0; j < H; j++) {
      const w = 10 + Math.round(j * (1 + flare * 0.4));
      const left = Math.round(9 - w / 2 + swing * (j / (H - 1)));
      let r = '';
      for (let i = 0; i < 20; i++) {
        const q = i - left;
        if (q < 0 || q >= w) { r += '.'; continue; }
        const back = q < w * 0.3;
        if (j === H - 1) r += back ? 'N' : 'n';
        else if (j === H - 2) r += ((q + (j >> 1)) % 3 === 0) ? 'N' : back ? 'n' : 'p';
        else r += ((q + (j >> 1)) % 3 === 0) ? (back ? 'n' : 'p') : back ? 'p' : 'P';
      }
      rows.push(r);
    }
    return rows;
  }
  const SKIRT_HIP = [9, 0];

  const FOOT = {
    flat: [
      '.oBB...',
      'oBBBBB.',
      'oBBBBBB',
      'OOOOOOO',
    ],
    toe: [
      '.oB....',
      'oBBB...',
      'oBBBB..',
      'OOOOO..',
    ],
  };
  const FOOT_ANK = [2, 0];

  // ---------------------------------------------------------------- parts that can be broken
  const PARTS = [
    { id: 'arm', label: '義手', en: 'ARM', hp: 55, zone: 'body', icon: 'arm' },
    { id: 'leg', label: '義足', en: 'LEG', hp: 55, zone: 'legs', icon: 'leg' },
    { id: 'blade', label: '刀', en: 'BLADE', hp: 45, zone: 'body', attacking: true, icon: 'blade' },
    { id: 'uniform', label: '制服', en: 'UNIFORM', hp: 40, zone: 'body', icon: 'cloth' },
  ];

  const SIZE = { w: 128, h: 108, ox: 60, oy: 100 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 13, thigh: 13, shin: 13, upper: 7, fore: 7, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 2, headH: 15, headW: 13 };
  const DEF = {
    hip: [0, -27], lean: 0, face: 'normal', head: [0, 0],
    fN: [-8, -2], fF: [8, -2], feetN: 'flat', feetF: 'flat',
    hN: [-4, -27], hF: [11, -28],
    sw: 25, blade: 26, grip: 'F', swordLayer: 'back',
    hair: { base: 106, droop: 92, wave: 1, phase: 0, len: 32 },
    broken: {},
  };

  function render(pose, opts = {}) {
    const p = Object.assign({}, DEF, pose);
    p.hair = Object.assign({}, DEF.hair, pose.hair || {});
    const br = p.broken || {};
    const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
    const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
    const spec = Object.assign({}, SPEC, { torsoRows: br.uniform ? TORSO.torn : TORSO.up });
    const J = RIG.solve(p, spec, O);
    const headO = [J.neck[0] - HEAD_NECK[0], J.neck[1] - HEAD_NECK[1]];
    const hairRoot = [headO[0] + HAIR_ROOT[0], headO[1] + HAIR_ROOT[1]];

    if (!p.hidden) {
      // 1. the mane, behind everything
      const H = p.hair;
      RIG.mane(buf, M.hair, hairRoot, { ribbons: [{ off: [0, 0], w0: 5, w1: 2, len: H.len, dA: 0 }, { off: [-2, -1], w0: 3.5, w1: 1.5, len: H.len - 6, dA: 8 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, freq: 0.4, waveGrow: 8 });
      // 2. far arm (skin, short white sleeve) and the sword behind the body
      farArm(buf, J, p);
      if (p.swordLayer === 'back') sword(buf, J.hF, p, br);
      // 3. legs: far (steel) then near (stocking)
      steelLeg(buf, J.hipF, J.kF, J.fF, p.feetF, br.leg);
      sockLeg(buf, J.hipN, J.kN, J.fN, p.feetN);
      // 4. skirt over the thighs, then the torso
      RIG.place(buf, M.skirt, skirtRows(p.skirtSwing || 0, p.skirtFlare || 0), KEY, [J.hip[0], J.hip[1] + 1], SKIRT_HIP);
      RIG.place(buf, M.white, J.tb, KEY, J.hip, J.tAnchor);
      // 5. head and the near side lock
      RIG.place(buf, M.hair, HEAD[p.face] || HEAD.normal, KEY, J.neck, HEAD_NECK);
      RIG.place(buf, M.streak, SIDELOCK, KEY, [headO[0] + 11, headO[1] + 14], [0, 0]);
      // 6. near arm: the prosthetic
      steelArm(buf, J, p, br.arm);
      if (p.swordLayer === 'front') sword(buf, J.hF, p, br);
      RIG.finish(buf, p, J, { rotUp: 10 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, (br.blade ? 11 : p.blade) + 4, ['hF', 'sw']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }

  function farArm(buf, J, p) {
    RIG.stroke(buf, M.white, J.shF, J.eF, 1.5);
    RIG.stroke(buf, M.skin, J.eF, J.hF, 1.1);
    RIG.hand(buf, M.skin, J.hF, 2);
  }
  // the steel arm: plated upper arm, a dark elbow joint, a heavy forearm with a seam, a 3x3 fist
  function steelArm(buf, J, p, broken) {
    RIG.stroke(buf, M.steel, J.shN, J.eN, 1.4, { band: (i) => (i.t < 0.22 ? [M.joint, 2] : Math.abs(i.t - 0.6) < 0.08 ? [M.steel, 3] : null) });
    const el = new Part(buf, M.joint);
    el.add(J.eN[0], J.eN[1], {}); el.add(J.eN[0] + 1, J.eN[1], {}); el.add(J.eN[0], J.eN[1] + 1, {}); el.add(J.eN[0] + 1, J.eN[1] + 1, {});
    el.commit((i) => (i.x === J.eN[0] && i.y === J.eN[1] ? 1 : 3));
    if (broken) {
      // the forearm is gone: a ragged stump of frame and wires past the elbow
      const d = [J.hN[0] - J.eN[0], J.hN[1] - J.eN[1]], L = Math.hypot(d[0], d[1]) || 1;
      const u = [d[0] / L, d[1] / L];
      const stump = [Math.round(J.eN[0] + u[0] * 3), Math.round(J.eN[1] + u[1] * 3)];
      RIG.stroke(buf, M.joint, J.eN, stump, 1.2, { hi: 2, mid: 3, lo: 4 });
      const w = new Part(buf, M.wire, { sep: false });
      w.add(stump[0] + Math.round(u[0] * 2), stump[1] + Math.round(u[1] * 2), { t: 1 });
      w.add(stump[0] + Math.round(u[0]) - Math.round(u[1]), stump[1] + Math.round(u[1]) + Math.round(u[0]), { t: 2 });
      w.add(stump[0] + Math.round(u[0] * 2) + Math.round(u[1]), stump[1] + Math.round(u[1] * 2) - Math.round(u[0]), { t: 0 });
      w.commit((i) => i.t);
      return;
    }
    RIG.stroke(buf, M.steel, J.eN, J.hN, 1.5, { band: (i) => (Math.abs(i.t - 0.45) < 0.07 ? [M.joint, 3] : i.t > 0.86 ? [M.joint, 2] : null) });
    RIG.hand(buf, M.joint, J.hN, 3, (i) => (i.i === 0 && i.j === 0 ? 0 : i.i === 2 || i.j === 2 ? 3 : 2));
  }
  function steelLeg(buf, hip, knee, foot, fvn, broken) {
    RIG.stroke(buf, M.steel, hip, knee, 1.9, { band: (i) => (Math.abs(i.t - 0.5) < 0.06 ? [M.joint, 3] : null) });
    const ank = [foot[0], foot[1] - 1];
    if (broken) {
      // armour stripped: a thin dark frame with a glowing wire and the knee joint bare
      RIG.stroke(buf, M.joint, knee, ank, 0.9, { hi: 2, mid: 3, lo: 4 });
      const w = new Part(buf, M.wire, { sep: false });
      const mid = [Math.round((knee[0] + ank[0]) / 2), Math.round((knee[1] + ank[1]) / 2)];
      w.add(mid[0] + 1, mid[1], { t: 1 }); w.add(mid[0] + 1, mid[1] + 3, { t: 2 });
      w.commit((i) => i.t);
    } else {
      RIG.stroke(buf, M.steel, knee, ank, 1.7, { band: (i) => (Math.abs(i.t - 0.62) < 0.07 ? [M.joint, 3] : null) });
    }
    const kc = new Part(buf, M.joint);
    kc.add(knee[0], knee[1], {}); kc.add(knee[0] + 1, knee[1], {}); kc.add(knee[0], knee[1] - 1, {}); kc.add(knee[0] + 1, knee[1] - 1, {});
    kc.commit((i) => (broken ? 3 : i.y < knee[1] ? 1 : 2));
    RIG.place(buf, M.shoe, FOOT[fvn] || FOOT.flat, KEY, foot, FOOT_ANK);
  }
  function sockLeg(buf, hip, knee, foot, fvn) {
    RIG.stroke(buf, M.sock, hip, knee, 1.9);
    RIG.stroke(buf, M.sock, knee, [foot[0], foot[1] - 1], 1.6);
    RIG.place(buf, M.shoe, FOOT[fvn] || FOOT.flat, KEY, foot, FOOT_ANK);
  }

  // odachi: a long black blade with a bright edge, wrapped hilt behind the hand, small round tsuba
  function sword(buf, h, p, br) {
    if (p.grip === 'S' || p.noSword) return;
    const a = rad(p.sw), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
    const g = [h[0] + 0.5, h[1] + 0.5];
    const hilt = new Part(buf, M.red);
    PX.line(g[0] - d[0] * 5, g[1] - d[1] * 5, g[0], g[1], (x, y, i) => hilt.add(x, y, { i }));
    hilt.commit((i) => (i.i % 2 ? 3 : 4));
    if (!p.noBlade) {
      const L = br.blade ? 10 : p.blade;
      const bl = new Part(buf, M.blade);
      const t0 = [g[0] + d[0] * 2, g[1] + d[1] * 2];
      const tip = [t0[0] + d[0] * L, t0[1] + d[1] * L];
      PX.line(t0[0], t0[1], tip[0], tip[1], (x, y) => bl.add(x, y, { e: 1 }));
      const side = n[1] > 0 ? 1 : -1;
      PX.line(t0[0] + n[0] * side, t0[1] + n[1] * side, tip[0] - d[0] * 3 + n[0] * side, tip[1] - d[1] * 3 + n[1] * side, (x, y) => { if (!bl.has(x, y)) bl.add(x, y, { e: 0 }); });
      if (br.blade) { // jagged break
        bl.add(Math.round(tip[0] + n[0] * side), Math.round(tip[1] + n[1] * side), { e: 0 });
        bl.add(Math.round(tip[0] - d[0] + n[0] * side * 2), Math.round(tip[1] - d[1] + n[1] * side * 2), { e: 0 });
      }
      bl.commit((i) => (i.e ? 1 : 3));
    }
    const ts = new Part(buf, M.gold);
    const tc = [g[0] + d[0] * 1.5, g[1] + d[1] * 1.5];
    PX.line(tc[0] - n[0] * 1.3, tc[1] - n[1] * 1.3, tc[0] + n[0] * 1.3, tc[1] + n[1] * 1.3, (x, y) => ts.add(x, y, {}));
    ts.commit(() => 1);
  }

  // hurt boxes and part anchors without rendering
  function boxes(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return RIG.boxes(J, SPEC, p);
  }
  function anchors(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return { arm: J.eN, leg: [(J.kF[0] + J.fF[0]) / 2, (J.kF[1] + J.fF[1]) / 2], blade: [J.hF[0] + Math.cos(rad(p.sw)) * 12, J.hF[1] + Math.sin(rad(p.sw)) * 12], uniform: [J.neck[0] + 2, J.neck[1] + 4] };
  }

  root.JK = {
    id: 'jk', name: '改造人間', title: '改造人間の女子高生', en: 'CYBORG JK', height: '170cm', tint: '#ff5a6e',
    M, KEY, HEAD, TORSO, FOOT, SIZE, DEF, SPEC, PARTS, render, boxes, anchors, skirtRows,
  };
})(typeof window !== 'undefined' ? window : globalThis);
