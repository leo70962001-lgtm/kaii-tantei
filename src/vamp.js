// vamp.js — 吸血鬼ニート (the vampire NEET), a small hand-pixeled fighter (~53 px).
// Huge blonde hair with an ahoge, red glasses, a red track suit with white stripes, a pink shirt,
// yellow cat slippers, a laptop with a bat-cat sticker (her weapon) and a bat-cat familiar.
// Breakable parts: glasses (she squints), laptop (cracked in half — she fights furious and short),
// slippers (barefoot), ahoge (cut off — shocked).
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('vp_hair', ['#fff8d0', '#ffdc62', '#eaa92e', '#b8721a', '#7a4810'], '#3a2008', { softInk: '#b8721a' }),
    skin: material('vp_skin', ['#fff8f4', '#ffeae0', '#f7ccb8', '#d49e8a', '#9c6c60'], '#3c1c24', { softInk: '#d49e8a' }),
    red: material('vp_red', ['#ffb8a4', '#ff6c4c', '#d83c2c', '#902618', '#5a1610'], '#2a0a08', { softInk: '#902618' }),
    white: material('vp_white', ['#ffffff', '#fbfbff', '#d8dcea', '#a2a8c2', '#6c7290'], '#252a48', { softInk: '#a2a8c2' }),
    pink: material('vp_pink', ['#ffe4f0', '#ffb8d4', '#f088b0', '#c25c88', '#8a3c60'], '#3a1428'),
    frame: material('vp_frame', ['#ff9a9a', '#ff4040', '#d01c1c', '#8a1010', '#500808'], '#2a0404'),
    eye: material('vp_eye', ['#d0f4ff', '#66ccff', '#2a8ee8', '#1c5cb0', '#0e3870'], '#061c3a'),
    lap: material('vp_lap', ['#ffffff', '#e8ebf2', '#b6bccb', '#7e8698', '#505766'], '#1e2230', { softInk: '#7e8698' }),
    screen: material('vp_screen', ['#ffffff', '#c8fbff', '#62d8ff', '#2a8ad8', '#1a4a90'], '#0a2440', { glow: true }),
    slip: material('vp_slip', ['#fffad0', '#ffe66a', '#f2bc34', '#bc861e', '#7c5612'], '#3a2608', { softInk: '#bc861e' }),
    bat: material('vp_bat', ['#f4f4fc', '#c0c4d8', '#828aa0', '#525868', '#303440'], '#101018', { softInk: '#525868' }),
    mouth: material('vp_mouth', ['#ffd0d0', '#ff7080', '#c03050', '#701830', '#400c1c'], '#1c0408'),
  };

  const KEY = {
    a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], A: [M.hair, 0],
    s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3],
    k: [M.hair, 'ink'], e: [M.eye, 2], g: [M.frame, 2], G: [M.frame, 1], m: [M.mouth, 3], f: [M.white, 0],
    R: [M.red, 1], r: [M.red, 2], d: [M.red, 3], D: [M.red, 4],
    T: [M.white, 1], h: [M.white, 2], H: [M.white, 3],
    p: [M.pink, 2], P: [M.pink, 1],
    Y: [M.slip, 1], y: [M.slip, 2], u: [M.slip, 3],
    L: [M.lap, 1], l: [M.lap, 2], j: [M.lap, 3], J: [M.lap, 4],
    w: [M.bat, 2], W: [M.bat, 1], v: [M.bat, 3], V: [M.bat, 4], o: [M.eye, 1],
    z: [M.screen, 2], Z: [M.screen, 1],
  };

  // ---------------------------------------------------------------- head: a cloud of hair, small face, red glasses
  const HEAD = {
    normal: [
      '..........a...........',
      '.........aa...........',
      '........aab...........',
      '......aaaaaaaaa.......',
      '....aaaaabbbbbbba.....',
      '...aabbbbbbbbbbbbba...',
      '..aabbbbbbbbbbbbbbba..',
      '..abbbbbbbbbbbbSSSbba.',
      '..abbbbbbbbbbbSSSSSSb.',
      '..abbbbbbbbbbgggggggg.',
      '..abbbbbbbbbbgeSgeSgs.',
      '..aabbbbbbbbbcSSSSSSs.',
      '...abbbbbbbbbcSSSmfS..',
      '...aabbbbbbbbccSSSS...',
      '....abbbbbbbbbc.SS....',
      '....aabbbbbbbb..SS....',
      '.....abbbbbbbb........',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  HEAD.shout = fv([[17, 12, 'm'], [18, 12, 'm'], [17, 13, 'm'], [18, 13, 'f']]);
  HEAD.hurt = fv([[14, 10, 'k'], [15, 10, 'k'], [17, 10, 'k'], [18, 10, 'k'], [16, 12, 'm'], [17, 12, 'm'], [18, 12, 'm']]);
  HEAD.calm = fv([[14, 10, 'k'], [15, 10, 'k'], [17, 10, 'k'], [18, 10, 'S'], [17, 12, 'S'], [18, 12, 'S']]);
  HEAD.grin = fv([[16, 12, 'm'], [17, 12, 'f'], [18, 12, 'm']]);
  HEAD.rage = fv([[13, 9, 'k'], [14, 9, 'k'], [16, 9, 'k'], [17, 9, 'k'], [18, 9, 'k'], [19, 9, 'S'], [16, 12, 'm'], [17, 12, 'f'], [18, 12, 'm'], [17, 13, 'm']]);
  // without glasses: the frame row becomes brow/skin, eyes squint
  const NOGLASS = (rows) => rows.map((r, j) => (j === 9 ? r.replace('gggggggg', 'SSkkSkkS') : j === 10 ? r.replace(/g/g, 'S') : r));
  const NOAHOGE = (rows) => rows.map((r, j) => (j < 3 ? r.replace(/[ab]/g, '.') : r));
  const HEAD_NECK = [16, 16];
  const HAIR_ROOT = [6, 13];

  // ---------------------------------------------------------------- torso: zipped track jacket, bare midriff, waistband
  const TORSO = {
    up: [
      '.....rrrr.....',
      '...rrRRrrrr...',
      '..rrRRPprrrr..',
      '.rrRRRPpRrrrr.',
      '.rrRRRRTRrrrr.',
      '.rrRRRRTRrrrr.',
      '.rrrRRRTRrrrr.',
      '..rrrRRTRrrr..',
      '..drrrrrrrrd..',
      '...sSSSSSSs...',
      '...tSSSSSSs...',
      '..rrrRRTrrrr..',
      '..rrrrrrrrrr..',
    ],
  };
  const TORSO_HIP = [7, 12];
  const TORSO_SH = { N: [3, 3], F: [11, 3], neck: [7, 0] };

  const FOOT = {
    slip: [
      '.Y..Y...',
      'yYYYYY..',
      'yYYYYYY.',
      'uuuuuuu.',
    ],
    bare: [
      '........',
      '.sSSS...',
      'tSSSSS..',
      'ttttttt.',
    ],
  };
  const FOOT_ANK = [2, 0];

  // laptop: closed = a slab 11 px long, drawn along angle `la` from the near hand; open = screen up, glowing
  function laptop(buf, h, p, br) {
    if (p.noLap) return;
    const a = rad(p.la ?? 0), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
    const g = [h[0] + 0.5, h[1] + 0.5];
    const L = br.laptop ? 6 : 11;
    const base = new Part(buf, M.lap);
    for (let k = 0; k <= L; k++) for (let s = -1; s <= 1; s++) {
      const x = Math.floor(g[0] + d[0] * (k - 3) + n[0] * s), y = Math.floor(g[1] + d[1] * (k - 3) + n[1] * s);
      base.add(x, y, { s, k });
    }
    if (br.laptop) { // jagged break at the far end
      base.remove(Math.floor(g[0] + d[0] * (L - 3) + n[0]), Math.floor(g[1] + d[1] * (L - 3) + n[1]));
      base.remove(Math.floor(g[0] + d[0] * (L - 4) - n[0]), Math.floor(g[1] + d[1] * (L - 4) - n[1]));
    }
    base.commit((i) => (i.s === -1 ? 1 : i.s === 1 ? 3 : i.k === 4 && !br.laptop ? 4 : 2));
    if (p.lapOpen && !br.laptop) {
      const sc = new Part(buf, M.screen, { sep: false });
      for (let k = 0; k <= 8; k++) for (let s = 0; s <= L; s++) {
        const x = Math.floor(g[0] + d[0] * (s - 3) - n[0] * (k + 1)), y = Math.floor(g[1] + d[1] * (s - 3) - n[1] * (k + 1));
        sc.add(x, y, { k, s, edge: k === 8 || s === 0 || s === L });
      }
      sc.commit((i) => (i.edge ? [M.lap, 3] : (i.k >= 2 && i.k <= 5 && i.s >= 4 && i.s <= 7 && ((i.k === 3 && (i.s === 5 || i.s === 6)) || i.k === 5)) ? 0 : (i.k + i.s) % 3 === 0 ? 1 : 2));
    }
  }
  // the bat-cat familiar: round grey body, cat ears, bat wings (two flap frames)
  const BAT = [
    [
      '..w.....w..',
      '.ww.a.a.ww.',
      'www.bbb.www',
      'wwwwbobbwww',
      '.ww.bbb.ww.',
      '....bbb....',
    ],
    [
      '...........',
      '....a.a....',
      'ww..bbb..ww',
      'wwwwbobbwww',
      '.wwwbbbwww.',
      '....bbb....',
    ],
  ];
  const BATKEY = { w: [M.bat, 3], a: [M.bat, 2], b: [M.bat, 2], o: [M.eye, 1] };
  function bat(buf, at, flap, opts = {}) {
    const rows = BAT[flap ? 1 : 0];
    const part = new Part(buf, M.bat);
    PX.sprite(part, rows, BATKEY, at, [5, 3], !!opts.flip);
    part.commit((i) => (i.ch === 'w' ? [M.bat, 3] : i.ch === 'a' ? [M.bat, 2] : i.ch === 'o' ? (opts.angry ? [M.frame, 1] : [M.eye, 1]) : i.j === 2 ? [M.bat, 1] : i.j >= 4 ? [M.bat, 3] : [M.bat, 2]));
  }

  const PARTS = [
    { id: 'glasses', label: '眼鏡', en: 'GLASSES', hp: 35, zone: 'head', icon: 'glass' },
    { id: 'laptop', label: '筆電', en: 'LAPTOP', hp: 60, zone: 'body', icon: 'laptop' },
    { id: 'slippers', label: '拖鞋', en: 'SLIPPERS', hp: 45, zone: 'legs', icon: 'shoe' },
    { id: 'ahoge', label: '呆毛', en: 'AHOGE', hp: 30, zone: 'head', icon: 'hair' },
  ];

  const SIZE = { w: 128, h: 108, ox: 60, oy: 100 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 11, thigh: 12, shin: 11, upper: 6, fore: 6, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 2, headH: 15, headW: 14 };
  const DEF = {
    hip: [0, -24], lean: 0, face: 'normal', head: [0, 0],
    fN: [-7, -2], fF: [7, -2], feetN: 'slip', feetF: 'slip',
    hN: [8, -26], hF: [10, -25], la: 0, lapOpen: false, lapLayer: 'front',
    bat: [-14, -44], flap: 0,
    hair: { base: 110, droop: 92, wave: 1.6, phase: 0, len: 26 },
    broken: {},
  };

  function render(pose, opts = {}) {
    const p = Object.assign({}, DEF, pose);
    p.hair = Object.assign({}, DEF.hair, pose.hair || {});
    const br = p.broken || {};
    const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
    const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
    const J = RIG.solve(p, SPEC, O);
    const headO = [J.neck[0] - HEAD_NECK[0], J.neck[1] - HEAD_NECK[1]];
    const hairRoot = [headO[0] + HAIR_ROOT[0], headO[1] + HAIR_ROOT[1]];
    if (p.bat && !p.noBat) bat(buf, [O[0] + p.bat[0], O[1] + p.bat[1]], p.flap, { angry: !!br.laptop });
    if (!p.hidden) {
      const H = p.hair;
      RIG.mane(buf, M.hair, hairRoot, { ribbons: [{ off: [0, 0], w0: 7, w1: 3, len: H.len, dA: 0 }, { off: [-3, -2], w0: 4, w1: 2, len: H.len - 4, dA: 12 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, freq: 0.7, waveGrow: 14, sheenAt: 0.1 });
      // far arm: red sleeve with a white stripe, skin hand
      arm(buf, J.shF, J.eF, J.hF);
      if (p.lapLayer === 'back') laptop(buf, J.hN, p, br);
      // legs: red pants with the white side stripe
      leg(buf, J.hipF, J.kF, J.fF, br.slippers ? 'bare' : p.feetF);
      leg(buf, J.hipN, J.kN, J.fN, br.slippers ? 'bare' : p.feetN);
      RIG.place(buf, M.red, J.tb, KEY, J.hip, J.tAnchor);
      let head = HEAD[p.face] || HEAD.normal;
      if (br.glasses) head = NOGLASS(head);
      if (br.ahoge) head = NOAHOGE(head);
      RIG.place(buf, M.hair, head, KEY, J.neck, HEAD_NECK);
      arm(buf, J.shN, J.eN, J.hN);
      if (p.lapLayer === 'front') laptop(buf, J.hN, p, br);
      RIG.finish(buf, p, J, { rotUp: 9 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, (br.laptop ? 7 : 12), ['hN', 'la']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  function arm(buf, sh, el, hd) {
    const stripe = (i) => (Math.abs(i.u) < 0.3 ? [M.white, 1] : null);
    RIG.stroke(buf, M.red, sh, el, 1.5, { band: stripe });
    RIG.stroke(buf, M.red, el, hd, 1.3, { band: (i) => (i.t > 0.8 ? [M.red, 3] : stripe(i)) });
    RIG.hand(buf, M.skin, hd, 2);
  }
  function leg(buf, hip, knee, foot, fvn) {
    const stripe = (i) => (Math.abs(i.u - 0.05) < 0.28 ? [M.white, 1] : null);
    RIG.stroke(buf, M.red, hip, knee, 1.9, { band: stripe });
    RIG.stroke(buf, M.red, knee, [foot[0], foot[1] - 1], 1.7, { band: stripe });
    RIG.place(buf, fvn === 'bare' ? M.skin : M.slip, FOOT[fvn] || FOOT.slip, KEY, foot, FOOT_ANK);
  }

  function boxes(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return RIG.boxes(J, SPEC, p);
  }
  function anchors(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return { glasses: [J.neck[0] + 2, J.neck[1] - 7], laptop: [J.hN[0] + 4, J.hN[1]], slippers: [J.fN[0], J.fN[1]], ahoge: [J.neck[0] - 4, J.neck[1] - 16] };
  }

  root.VAMP = {
    id: 'vamp', name: '吸血鬼', title: '吸血鬼のニート', en: 'VAMPIRE NEET', height: '152cm', tint: '#ffd24a',
    M, KEY, HEAD, TORSO, FOOT, SIZE, DEF, SPEC, PARTS, render, boxes, anchors, bat, BAT, BATKEY,
  };
})(typeof window !== 'undefined' ? window : globalThis);
