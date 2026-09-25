// jk.js — 改造人間の女子高生 (the cyborg schoolgirl) at KOF scale (~108 px).
// Head, hands, feet and the side lock are hand-typed bitmaps; the sailor top is a material map shaded by
// the rig; the long hair is a flowing mane with strand grooves; arms and legs are cylinder-shaded strokes:
// near arm = steel prosthetic (plates, joints, a 7 px fist), far leg = steel prosthetic, far arm = skin with
// a short white sleeve, near leg = black thigh-high. The odachi rides in the far hand.
// Breakable parts: arm (forearm blown off), leg (shin armour stripped to its frame), blade (snapped short),
// uniform (scarf and collar torn away, exposing the stitches).
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('jk_hair', ['#9aa6d2', '#4d5880', '#28304e', '#171c34', '#0c0f1e'], '#05060c', { softInk: '#171c34' }),
    streak: material('jk_streak', ['#ffffff', '#f6f7ff', '#cfd4ea', '#959dbf', '#626a8c'], '#2a2f4a', { softInk: '#959dbf' }),
    skin: material('jk_skin', ['#fff5ec', '#ffe3d0', '#f3bb9f', '#cb8773', '#8f5652'], '#3a1a22', { softInk: '#cb8773' }),
    white: material('jk_white', ['#ffffff', '#f8f9fd', '#d5dae9', '#9ca5c4', '#68728f'], '#232848', { softInk: '#9ca5c4' }),
    collar: material('jk_collar', ['#d0dcf4', '#93a8d3', '#6079ac', '#40527c', '#2a3654'], '#151c30', { softInk: '#40527c' }),
    red: material('jk_red', ['#ffb6a6', '#ff6e60', '#da3740', '#912032', '#5b1427'], '#2a0812', { softInk: '#912032' }),
    skirt: material('jk_skirt', ['#a2c6ff', '#6092ea', '#3664bf', '#234388', '#172d5c'], '#0b1530', { softInk: '#234388' }),
    sock: material('jk_sock', ['#6e738f', '#444861', '#2c2f44', '#1c1e30', '#111222'], '#050610', { softInk: '#1c1e30' }),
    steel: material('jk_steel', ['#ffffff', '#e2f0fa', '#aebad2', '#6f7a9a', '#4a4a70'], '#12162a', { softInk: '#6f7a9a' }),
    joint: material('jk_joint', ['#9ea4bc', '#5e647a', '#3d4154', '#26293c', '#181a26'], '#08090f'),
    shoe: material('jk_shoe', ['#8f95ae', '#5a5f7a', '#373b52', '#23253c', '#151627'], '#07080f', { softInk: '#23253c' }),
    blade: material('jk_blade', ['#ffffff', '#dbe2f0', '#7d869b', '#303548', '#191c2a'], '#07080e', { softInk: '#303548' }),
    gold: material('jk_gold', ['#fff2a0', '#ffd04a', '#e8962e', '#b05a26', '#7a3620'], '#2a0e08'),
    eye: material('jk_eye', ['#ffd0c8', '#ff6a6a', '#e0202c', '#8a1028', '#4a0818'], '#1d030e'),
    ewhite: material('jk_ewhite', ['#ffffff', '#f4f6ff', '#d0d6ec', '#9aa2c0', '#6c748f'], '#22263f'),
    wire: material('jk_wire', ['#fff0a0', '#ff9a3a', '#c8482a', '#5a2a30', '#2a1420'], '#120608'),
  };

  const KEY = {
    A: [M.hair, 0], a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], d: [M.hair, 4],
    W: [M.streak, 1], w: [M.streak, 2], u: [M.streak, 3], X: [M.streak, 0],
    h: [M.skin, 0], s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3], T: [M.skin, 4],
    k: [M.hair, 'ink'], e: [M.ewhite, 1], R: [M.eye, 1], r: [M.eye, 2], m: [M.red, 4], n: [M.red, 3],
    q: [M.red, 3], Q: [M.red, 2],
    B: [M.shoe, 1], o: [M.shoe, 2], O: [M.shoe, 3], D: [M.shoe, 4],
    I: [M.steel, 1], i: [M.steel, 2], j: [M.steel, 3], J: [M.steel, 4], '*': [M.steel, 0],
    g: [M.joint, 2], G: [M.joint, 3], f: [M.joint, 1],
  };

  // ---------------------------------------------------------------- head (3/4 view, facing +x), 28×26
  const HEAD = {
    normal: [
      '..........bbbbbbbb..........',
      '.......bbbbbbbbbbbbb........',
      '.....bbbbaaaabbbbbbbb.......',
      '....bbbbaaaabbbbbbbbbb......',
      '...bbbbbabbbbbbbbbbbbbb.....',
      '...cbbbbbbbbbbbbbbbbbbbb....',
      '..ccbbbbbbbbbbbbbWbbbbbb....',
      '..ccbbbbbbbbbbbbbWbbbbbbb...',
      '..ccbbbbbbbbbbbbcWbcbbbbb...',
      '.cccbbbbbbbbbbbbcWbcsSSbbb..',
      '.cccbbbbbbbbbbbbcWcsSSSSSb..',
      '.cccbbbbbbbbbbbccWsSSSSSSSb.',
      '.cccbbbbbbbbbbbcdWsSkkSSkkS.',
      '.ccccbbbbbbbbbbcdWSSeRSSeRS.',
      '.ccccbbbbbbbbbbcdwSSrrSSrrs.',
      '..cccbbbbbbbbbbcdwSSSSSSSSs.',
      '..cccbbbbbbbbbbcdwSSSSSSSts.',
      '..cccbbbbbbbbbbcdwSSSSSnSS..',
      '..ccccbbbbbbbbbcdwtSSSmmSS..',
      '...cccbbbbbbbbbcduSSSSSSS...',
      '...cccbbbbbbbbbbcutSSSSS....',
      '....ccbbbbbbbbbbc.tTSSS.....',
      '....ccbbbbbbbbbb..TqQQqT....',
      '.....ccbbbbbbbbb..qQXQQq....',
      '.....ccbbbbbbbbb...SSSS.....',
      '......ccbbbbbbb....SSS......',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  // eyes: lashes row 12 (cols 20-21, 24-25), whites/iris rows 13-14, mouth row 18 (cols 22-23)
  HEAD.shout = fv([[19, 12, 'k'], [20, 12, 'k'], [21, 12, 'k'], [24, 12, 'k'], [25, 12, 'k'], [26, 12, 'k'], [22, 17, 'm'], [23, 17, 'm'], [21, 18, 'm'], [22, 18, 'm'], [23, 18, 'm'], [24, 18, 'm'], [22, 19, 'm'], [23, 19, 'm']]);
  HEAD.hurt = fv([[20, 13, 'k'], [21, 13, 'k'], [24, 13, 'k'], [25, 13, 'k'], [20, 14, 'S'], [21, 14, 'S'], [24, 14, 'S'], [25, 14, 'S'], [20, 12, 'S'], [21, 12, 'S'], [24, 12, 'S'], [25, 12, 'S'], [22, 18, 'm'], [23, 18, 'm'], [22, 19, 'm'], [23, 19, 'm']]);
  HEAD.calm = fv([[20, 13, 'k'], [21, 13, 'k'], [24, 13, 'k'], [25, 13, 'k'], [20, 14, 'S'], [21, 14, 'S'], [24, 14, 'S'], [25, 14, 'S'], [20, 12, 'S'], [21, 12, 'S'], [24, 12, 'S'], [25, 12, 'S']]);
  HEAD.grin = fv([[21, 18, 'm'], [22, 18, 'm'], [23, 18, 'm'], [24, 18, 'm'], [22, 17, 'n'], [23, 17, 'n']]);
  const HEAD_NECK = [21, 25];
  const HAIR_ROOT = [5, 19];
  const SIDELOCK = ['Wu', 'Wu', 'wu', 'wu', '.wu', '.wu', '.wu', '.wu', '..wu', '..wu', '..wu', '..w', '..u', '..u', '...u'];

  // ---------------------------------------------------------------- torso material map (facing +x), hip at [13, 29]
  const TORSO = {
    up: [
      '..........vvvvvv..........',
      '.......vvvvvvvvvvvv.......',
      '.....vvvvvvvvvvvvvvvv.....',
      '...vvvvvvvvvvvvvvvvvvvv...',
      '..wvvvvvvvvvvvvvvvvvvrr...',
      '..wwvvvvvvvvvvvvvvvvrrrr..',
      '.wwwwvvvvvvvvvvvvvvrrrrrw.',
      '.wwwwwvvvvvvvvvvvvrrrrrww.',
      '.wwwwwwvvvvvvvvvvrrrRrwww.',
      '.wwwwwwwvvvvvvvvrrrrrwwww.',
      '.wwwwwwwwwwvvvvrrrrwwwwww.',
      '.wwwwwwwwwwwwwwrrrwwwwwww.',
      '.wwwwwwwwwwwwwwrrrwwwwww..',
      '.w/wwwwwwwwwwwwwrrwwwwww..',
      '.w/wwwwwwwwwwwwwrrwwwwww..',
      '..w/wwwwwwwwwwwwwrwwwww/..',
      '..wwwwwwwwwwwwwwwwwwwww/..',
      '..wwwwwwwwwwwwwwwwwwwww...',
      '...wwwwwwwwwwwwwwwwwww....',
      '....sssssssssssssssss.....',
      '....ssssssssssssssss......',
      '....sssssssnsssssssss.....',
      '....sssssssssssssssss.....',
      '...ssssssssssssssssss.....',
      '...ssssssssssssssssss.....',
      '..jppppppppppppppppppj....',
      '..pppppppppppppppppppp....',
      '..pppppppppppppppppppp....',
      '.pppppppppppppppppppppp...',
      '.pppppppppppppppppppppp...',
    ],
  };
  TORSO.up = TORSO.up.map((r) => r.replace(/./g, (ch, i) => (ch === 'v' && ((r[i - 1] && r[i - 1] !== 'v' && r[i - 1] !== '.') || (r[i + 1] && r[i + 1] !== 'v' && r[i + 1] !== '.')) ? 'V' : ch)));
  TORSO.torn = RIG.recolour(TORSO.up, { r: 'v', R: 'v' }).map((r, j) => (j >= 4 && j <= 9 ? r.replace(/vvvv(?=w|\.)/, 'v/vv') : j === 21 ? r.replace('sssssssn', 'ssnssssn') : j === 13 ? r.replace('wwwwww..', 'ww/ww/..') : r));
  const TKEY = {
    v: { m: M.collar, look: 'cloth' },
    w: { m: M.white, look: 'white' },
    r: { m: M.red, look: 'cloth' },
    s: { m: M.skin, look: 'skin' },
    n: { m: M.red, flat: 3 },
    p: { m: M.skirt, look: 'cloth' },
    j: { m: M.joint, flat: 2 },
  };
  const TORSO_HIP = [13, 29];
  const TORSO_SH = { N: [4, 4], F: [21, 4], neck: [13, 0] };

  // pleated skirt: alternating light/base/dark pleats, darker toward the back, a shadow under the band
  function skirtRows(swing = 0, flare = 0) {
    const rows = [];
    const H = 20;
    for (let j = 0; j < H; j++) {
      const w = 20 + Math.round(j * (0.7 + flare * 0.4));
      const left = Math.round(18 - w / 2 + swing * (j / (H - 1)));
      let r = '';
      for (let i = 0; i < 40; i++) {
        const q = i - left;
        if (q < 0 || q >= w) { r += '.'; continue; }
        const back = q < w * 0.3, front = q > w * 0.7;
        const pl = q % 4;
        let t = pl === 0 ? 3 : pl === 1 ? 1 : 2;
        if (front && pl === 1) t = 0;
        if (back) t = Math.min(4, t + 1);
        if (j < 2) t = Math.min(4, t + 1);
        if (j === H - 1) t = 4; else if (j === H - 2) t = Math.min(4, t + 1);
        r += 'PpnNd'[t];
      }
      rows.push(r);
    }
    return rows;
  }
  const SKEY = { P: [M.skirt, 0], p: [M.skirt, 1], n: [M.skirt, 2], N: [M.skirt, 3], d: [M.skirt, 4] };
  const SKIRT_HIP = [18, 0];

  const FOOT = {
    flat: [
      '...oBBB.......',
      '..oBBBBBBB....',
      '.ooBBBBBBBBB..',
      '.oooBBBBBBBBBB',
      'ooooooBBBBBBBB',
      'OOOOOOOOOOOOOO',
      '.DDDDDDDDDDDD.',
    ],
    toe: [
      '...oBB........',
      '..oBBBBB......',
      '.ooBBBBBB.....',
      '.oooBBBBBBB...',
      'ooooooBBBBB...',
      'OOOOOOOOOOO...',
      '.DDDDDDDDD....',
    ],
  };
  const FOOT_ANK = [4, 0];
  const FIST_STEEL = ['..IIIi.', '.IiiiiJ', 'IiiiiiJ', 'IiigiiJ', 'iiiiijJ', '.iijjJ.', '..GGG..'];
  const FIST_SKIN = ['..ssS..', '.sSSSt.', 'sSSSSSt', 'sSStSSt', 'SSSSStt', '.SttTt.', '..TTT..'];
  const HAND_SKIN = ['..sSS..', '.sSSSSt', 'sSSSSSt', 'sSSSSSt', '.SSSStt', '.tSSTt.', '..TTT..'];
  const KNEE = ['.III.', 'IiiiJ', 'IiiiJ', 'iijjJ', '.JJJ.'];
  const ELBOW = ['.fgg.', 'fgggG', 'fgggG', 'gggGG', '.GGG.'];

  const PARTS = [
    { id: 'arm', label: '義手', en: 'ARM', hp: 55, zone: 'body', icon: 'arm' },
    { id: 'leg', label: '義足', en: 'LEG', hp: 55, zone: 'legs', icon: 'leg' },
    { id: 'blade', label: '刀', en: 'BLADE', hp: 45, zone: 'body', attacking: true, icon: 'blade' },
    { id: 'uniform', label: '制服', en: 'UNIFORM', hp: 40, zone: 'body', icon: 'cloth' },
  ];

  const SIZE = { w: 232, h: 204, ox: 108, oy: 194 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 27, thigh: 32, shin: 32, upper: 16, fore: 16, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 4, headH: 24, headW: 20, bodyW: 11 };
  const DEF = {
    hip: [0, -68], lean: 0, face: 'normal', head: [0, 0],
    fN: [-16, -3], fF: [20, -3], feetN: 'flat', feetF: 'flat',
    hN: [3, -58], hF: [20, -74],
    sw: 25, blade: 46, grip: 'F', swordLayer: 'back',
    hair: { base: 106, droop: 92, wave: 1, phase: 0, len: 62 },
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
      const H = p.hair;
      RIG.mane(buf, M.hair, hairRoot, { ribbons: [{ off: [0, 0], w0: 11, w1: 3, len: H.len, dA: 0 }, { off: [-4, -1], w0: 7, w1: 2, len: H.len - 10, dA: 8 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, freq: 0.32, waveGrow: 9, groove: 4 });
      farArm(buf, J, p);
      if (p.swordLayer === 'back') sword(buf, J.hF, p, br);
      steelLeg(buf, J.hipF, J.kF, J.fF, p.feetF, br.leg);
      sockLeg(buf, J.hipN, J.kN, J.fN, p.feetN);
      RIG.place(buf, M.skirt, skirtRows(p.skirtSwing || 0, p.skirtFlare || 0), SKEY, [J.hip[0], J.hip[1] + 2], SKIRT_HIP);
      RIG.matmap(buf, J.rows, TKEY, J.hip, TORSO_HIP, { lean: J.lean, pivot: J.pivot, order: ['p', 'j', 's', 'w', 'v', 'r', 'n'] });
      RIG.place(buf, M.hair, HEAD[p.face] || HEAD.normal, KEY, J.neck, HEAD_NECK);
      RIG.place(buf, M.streak, SIDELOCK, KEY, [headO[0] + 16, headO[1] + 17], [0, 0]);
      steelArm(buf, J, p, br.arm);
      if (p.swordLayer === 'front') sword(buf, J.hF, p, br);
      RIG.finish(buf, p, J, { rotUp: 18 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, (br.blade ? 20 : p.blade) + 6, ['hF', 'sw']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }

  // far arm: a puffed white sleeve over the upper arm, skin below, an open hand or fist
  function farArm(buf, J, p) {
    RIG.cyl(buf, M.white, J.shF, J.eF, (t) => (t < 0.55 ? 3.6 - t * 0.6 : 2.9), { look: 'white', band: (i) => (i.t > 0.55 ? [M.skin, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.skin, i.x, i.y)] : i.t > 0.47 ? { shift: 1 } : null) });
    RIG.cyl(buf, M.skin, J.eF, J.hF, (t) => 2.9 - t * 0.3, { look: 'skin' });
    RIG.place(buf, M.skin, p.grip === 'S' || p.noSword ? HAND_SKIN : FIST_SKIN, KEY, J.hF, [3, 3]);
  }
  // the steel arm: plated upper arm, a dark elbow, a heavy forearm with a seam and a wrist ring, a 7 px fist
  function steelArm(buf, J, p, broken) {
    RIG.cyl(buf, M.steel, J.shN, J.eN, (t) => 3.6 - t * 0.5, { look: 'metal', band: (i) => (i.t < 0.16 ? [M.joint, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.metal, i.x, i.y, { shift: 1 })] : Math.abs(i.t - 0.55) < 0.05 ? { shift: 2 } : null) });
    RIG.place(buf, M.joint, ELBOW, KEY, J.eN, [2, 2]);
    if (broken) {
      const d = [J.hN[0] - J.eN[0], J.hN[1] - J.eN[1]], L = Math.hypot(d[0], d[1]) || 1;
      const u = [d[0] / L, d[1] / L];
      const stump = [Math.round(J.eN[0] + u[0] * 6), Math.round(J.eN[1] + u[1] * 6)];
      RIG.cyl(buf, M.joint, J.eN, stump, 2.4, { look: 'metal', add: -0.2 });
      const w = new Part(buf, M.wire, { sep: false });
      for (const [dx, dy, t] of [[3, 0, 1], [5, 1, 0], [2, -3, 2], [4, 3, 1], [6, -1, 0]]) w.add(stump[0] + Math.round(u[0] * dx - u[1] * dy), stump[1] + Math.round(u[1] * dx + u[0] * dy), { t });
      w.commit((i) => i.t);
      return;
    }
    RIG.cyl(buf, M.steel, J.eN, J.hN, (t) => 3.8 - t * 0.6, { look: 'metal', band: (i) => (Math.abs(i.t - 0.4) < 0.045 ? { shift: 2 } : i.t > 0.86 ? [M.joint, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.metal, i.x, i.y, { shift: 1 })] : null) });
    RIG.place(buf, M.steel, FIST_STEEL, KEY, J.hN, [3, 3]);
  }
  function steelLeg(buf, hip, knee, foot, fvn, broken) {
    RIG.cyl(buf, M.steel, hip, knee, (t) => 4.2 - t * 0.8, { look: 'metal', band: (i) => (Math.abs(i.t - 0.5) < 0.04 ? { shift: 2 } : i.t < 0.1 ? { shift: 1 } : null) });
    const ank = [foot[0], foot[1] - 2];
    if (broken) {
      RIG.cyl(buf, M.joint, knee, ank, 1.8, { look: 'metal', add: -0.25 });
      const w = new Part(buf, M.wire, { sep: false });
      const mid = [Math.round((knee[0] + ank[0]) / 2), Math.round((knee[1] + ank[1]) / 2)];
      for (const [dx, dy, t] of [[2, 0, 1], [3, 5, 2], [-2, 8, 0], [2, -6, 1]]) w.add(mid[0] + dx, mid[1] + dy, { t });
      w.commit((i) => i.t);
    } else {
      RIG.cyl(buf, M.steel, knee, ank, (t) => 3.4 - t * 0.4, { look: 'metal', band: (i) => (Math.abs(i.t - 0.62) < 0.04 ? { shift: 2 } : i.t > 0.9 ? [M.joint, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.metal, i.x, i.y, { shift: 1 })] : null) });
    }
    RIG.place(buf, broken ? M.joint : M.steel, KNEE, KEY, knee, [2, 2]);
    RIG.place(buf, M.shoe, FOOT[fvn] || FOOT.flat, KEY, foot, FOOT_ANK);
  }
  function sockLeg(buf, hip, knee, foot, fvn) {
    RIG.cyl(buf, M.sock, hip, knee, (t) => 4.2 - t * 0.8, { look: 'leather', band: (i) => (i.t < 0.06 ? { shift: -1 } : null) });
    RIG.cyl(buf, M.sock, knee, [foot[0], foot[1] - 2], (t) => 3.4 - t * 0.5, { look: 'leather' });
    RIG.place(buf, M.shoe, FOOT[fvn] || FOOT.flat, KEY, foot, FOOT_ANK);
  }

  // odachi: a long black blade 3 px wide with a bright edge and a dark spine, wrapped hilt, round tsuba
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
      if (br.blade) { bl.add(Math.round(tip[0] + n[0] * side * 2), Math.round(tip[1] + n[1] * side * 2), { s: 1 }); bl.add(Math.round(tip[0] - d[0] * 2 - n[0] * side * 2), Math.round(tip[1] - d[1] * 2 - n[1] * side * 2), { s: -1 }); }
      bl.commit((i) => (i.s === -1 ? 1 : i.s === 0 ? 3 : 4));
    }
    const ts = new Part(buf, M.gold);
    const tc = [g[0] + d[0] * 2.5, g[1] + d[1] * 2.5];
    for (let s = -2.5; s <= 2.5; s += 0.5) PX.line(tc[0] + n[0] * s - d[0] * 0.5, tc[1] + n[1] * s - d[1] * 0.5, tc[0] + n[0] * s + d[0] * 0.5, tc[1] + n[1] * s + d[1] * 0.5, (x, y) => ts.add(x, y, { s }));
    ts.commit((i) => (i.s < -1 ? 0 : i.s > 1.5 ? 3 : 1));
  }

  function boxes(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return RIG.boxes(J, SPEC, p);
  }
  function anchors(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return { arm: J.eN, leg: [(J.kF[0] + J.fF[0]) / 2, (J.kF[1] + J.fF[1]) / 2], blade: [J.hF[0] + Math.cos(rad(p.sw)) * 22, J.hF[1] + Math.sin(rad(p.sw)) * 22], uniform: [J.neck[0] + 4, J.neck[1] + 8] };
  }

  root.JK = {
    id: 'jk', name: '改造人間', title: '改造人間の女子高生', en: 'CYBORG JK', height: '170cm', tint: '#ff5a6e',
    M, KEY, HEAD, HEAD_NECK, TORSO, FOOT, SIZE, DEF, SPEC, PARTS, render, boxes, anchors, skirtRows,
  };
})(typeof window !== 'undefined' ? window : globalThis);
