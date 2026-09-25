// vamp.js — 吸血鬼ニート (the vampire NEET) at KOF scale (~96 px).
// A cloud of blonde hair with an ahoge, red glasses over blue eyes, a fang, a zipped red track jacket
// with white stripes over a pink shirt, cropped above the midriff, red track pants with side stripes,
// yellow cat slippers, a laptop with a bat-cat sticker (her weapon) and a bat-cat familiar.
// Breakable parts: glasses (she squints), laptop (cracked in half — she fights furious and short),
// slippers (barefoot), ahoge (cut off).
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('vp_hair', ['#fff9d6', '#ffde6a', '#ecab30', '#ba741c', '#7c4a12'], '#3a2008', { softInk: '#ba741c' }),
    skin: material('vp_skin', ['#fff9f5', '#ffece2', '#f8cebb', '#d6a08c', '#9e6e62'], '#3c1c24', { softInk: '#d6a08c' }),
    red: material('vp_red', ['#ffbcaa', '#ff7050', '#dc3e2e', '#93281a', '#5c1812'], '#2a0a08', { softInk: '#93281a' }),
    white: material('vp_white', ['#ffffff', '#fbfbff', '#dadeec', '#a4aac4', '#6e7492'], '#252a48', { softInk: '#a4aac4' }),
    pink: material('vp_pink', ['#ffe6f2', '#ffbcd6', '#f28cb4', '#c45e8a', '#8c3e62'], '#3a1428'),
    frame: material('vp_frame', ['#ffa0a0', '#ff4444', '#d21e1e', '#8c1212', '#520a0a'], '#2a0404'),
    eye: material('vp_eye', ['#d4f6ff', '#6ad0ff', '#2c92ec', '#1e60b4', '#103c74'], '#061c3a'),
    ewhite: material('vp_ewhite', ['#ffffff', '#f4f6ff', '#d0d6ec', '#9aa2c0', '#6c748f'], '#22263f'),
    lap: material('vp_lap', ['#ffffff', '#eaedf4', '#b8bece', '#80889a', '#525968'], '#1e2230', { softInk: '#80889a' }),
    screen: material('vp_screen', ['#ffffff', '#ccfcff', '#66daff', '#2c8cda', '#1c4c92'], '#0a2440', { glow: true }),
    slip: material('vp_slip', ['#fffbd4', '#ffe870', '#f4be38', '#be8820', '#7e5814'], '#3a2608', { softInk: '#be8820' }),
    bat: material('vp_bat', ['#f6f6fe', '#c4c8dc', '#868ea4', '#565c6c', '#323644'], '#101018', { softInk: '#565c6c' }),
    mouth: material('vp_mouth', ['#ffd4d4', '#ff7484', '#c43454', '#741c34', '#420e1e'], '#1c0408'),
  };

  const KEY = {
    A: [M.hair, 0], a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], d: [M.hair, 4],
    h: [M.skin, 0], s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3], T: [M.skin, 4],
    k: [M.hair, 'ink'], e: [M.eye, 2], E: [M.eye, 1], o: [M.ewhite, 1], g: [M.frame, 2], G: [M.frame, 1], m: [M.mouth, 3], f: [M.white, 0], n: [M.mouth, 2],
    p: [M.pink, 2], P: [M.pink, 1],
    Y: [M.slip, 1], y: [M.slip, 2], u: [M.slip, 3], U: [M.slip, 4], K: [M.slip, 'ink'],
    L: [M.lap, 1], l: [M.lap, 2], j: [M.lap, 3], J: [M.lap, 4],
    w: [M.bat, 2], W: [M.bat, 1], v: [M.bat, 3], V: [M.bat, 4],
  };

  // ---------------------------------------------------------------- head: a cloud of hair, small face, red glasses (30×26)
  const HEAD = {
    normal: [
      '..............aa..............',
      '.............aa...............',
      '............ab................',
      '.........aaaaaaaaaaa..........',
      '......aaaabbbbbbbbbbaa........',
      '....aaabbbbbbbbbbbbbbba.......',
      '...aabbbbbbbbbbbbbbbbbba......',
      '..aabbbbbbbbbbbbbbbbbbbba.....',
      '..abbbbbbbbbbbbbbbbsSSSbba....',
      '.aabbbbbbbbbbbbbbbsSSSSSSb....',
      '.abbbbbbbbbbbbbbbcsSSSSSSSb...',
      '.abbbbbbbbbbbbbbbcSSkkSSkkSs..',
      '.abbbbbbbbbbbbbbccggggggggggs.',
      '.abbbbbbbbbbbbbbccgoEgSgoEgs..',
      '..abbbbbbbbbbbbbccgeegSgeegs..',
      '..abbbbbbbbbbbbbccggggSggggS..',
      '..aabbbbbbbbbbbbbcSSSSSSSSSs..',
      '...abbbbbbbbbbbbbcSSSSSSSts...',
      '...abbbbbbbbbbbbbcSSSSnmfS....',
      '....abbbbbbbbbbbbccSSSSmSS....',
      '....abbbbbbbbbbbbccSSSSSS.....',
      '.....abbbbbbbbbbbbc.tSSS......',
      '.....abbbbbbbbbbbbc..SSS......',
      '......abbbbbbbbbbb...SSS......',
      '......aabbbbbbbbbb...SSS......',
      '.......abbbbbbbbb....SS.......',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  // eyes: whites/iris at (19-20,13-14) and (24-25,13-14) inside the frames; mouth at (22-24, 18-19)
  HEAD.shout = fv([[22, 18, 'm'], [23, 18, 'm'], [24, 18, 'm'], [22, 19, 'm'], [23, 19, 'f'], [24, 19, 'm'], [23, 20, 'm']]);
  HEAD.hurt = fv([[19, 13, 'k'], [20, 13, 'k'], [24, 13, 'k'], [25, 13, 'k'], [19, 14, 'S'], [20, 14, 'S'], [24, 14, 'S'], [25, 14, 'S'], [22, 18, 'm'], [23, 18, 'm'], [24, 18, 'm'], [23, 19, 'm']]);
  HEAD.calm = fv([[19, 13, 'k'], [20, 13, 'k'], [24, 13, 'k'], [25, 13, 'k'], [19, 14, 'S'], [20, 14, 'S'], [24, 14, 'S'], [25, 14, 'S'], [22, 18, 'S'], [23, 18, 'S'], [24, 18, 'S']]);
  HEAD.grin = fv([[21, 18, 'm'], [22, 18, 'f'], [23, 18, 'm'], [24, 18, 'f'], [25, 18, 'm']]);
  HEAD.rage = fv([[18, 11, 'k'], [19, 11, 'k'], [20, 11, 'k'], [24, 11, 'k'], [25, 11, 'k'], [26, 11, 'k'], [21, 18, 'm'], [22, 18, 'f'], [23, 18, 'm'], [24, 18, 'f'], [25, 18, 'm'], [22, 19, 'm'], [23, 19, 'm'], [24, 19, 'm']]);
  // without glasses: frames become skin, the eyes squint; without the ahoge the top three rows go
  const NOGLASS = (rows) => rows.map((r, j) => (j === 12 || j === 15 ? r.replace(/g/g, 'S') : j === 13 || j === 14 ? r.replace(/g/g, 'S').replace(/o/g, 'k').replace(/E/g, 'k') : r));
  const NOAHOGE = (rows) => rows.map((r, j) => (j < 3 ? r.replace(/[ab]/g, '.') : r));
  const HEAD_NECK = [22, 25];
  const HAIR_ROOT = [6, 18];

  // ---------------------------------------------------------------- torso: zipped track jacket, bare midriff, waistband (26×26)
  const TORSO = {
    up: [
      '..........rrrrrr..........',
      '.......rrrrrrRRrrrr.......',
      '.....rrrrrRRppRRrrrrr.....',
      '...rrrrrrrRRpppRRrrrrrr...',
      '..rrrrrrrrrRRppRRrrrrrrr..',
      '..rrrrrrrrrrRpWpRrrrrrrr..',
      '.rrrrrrrrrrrrrWrrrrrrrrrr.',
      '.rrrrrrrrrrrrrWrrrrrrrrrr.',
      '.rrr/rrrrrrrrrWrrrrrrr/rr.',
      '.rrr/rrrrrrrrrWrrrrrrr/rr.',
      '.rrrrrrrrrrrrrWrrrrrrrrrr.',
      '.rrrrrrrrrrrrrWrrrrrrrrrr.',
      '..rrrrrrrrrrrrWrrrrrrrrr..',
      '..rrrrrrrrrrrrWrrrrrrrrr..',
      '..rrr/rrrrrrrrWrrrrrr/rr..',
      '...rrrrrrrrrrrWrrrrrrrr...',
      '...rrrrrrrrrrrrrrrrrrrr...',
      '....ssssssssssssssssss....',
      '....sssssssssssssssss.....',
      '....ssssssssssssssss......',
      '....sssssssssssssssss.....',
      '...ssssssssssssssssss.....',
      '...rrrrrrrrrrrrrrrrrrr....',
      '..rrrrrrrrrWWWrrrrrrrr....',
      '..rrrrrrrrrrrrrrrrrrrrr...',
      '..rrrrrrrrrrrrrrrrrrrrr...',
    ],
  };
  const TKEY = {
    r: { m: M.red, look: 'cloth' },
    p: { m: M.pink, look: 'cloth' },
    w: { m: M.white, flat: 1 },
    s: { m: M.skin, look: 'skin' },
  };
  const TORSO_HIP = [13, 25];
  const TORSO_SH = { N: [4, 4], F: [21, 4], neck: [13, 0] };

  const FOOT = {
    slip: [
      '..Y....Y......',
      '.YYy..yYYY....',
      '.yYYYYYYYYYY..',
      '.yYKYYKYYYYYYY',
      'yyyYYYYYYYYYYY',
      'uuuuuuuuuuuuuu',
      '.UUUUUUUUUUUU.',
    ],
    bare: [
      '..............',
      '...sSSS.......',
      '..sSSSSSSS....',
      '.sSSSSSSSSSS..',
      'sSSSSSSSSSSSSS',
      'ttttttttttttt.',
      '.TTTTTTTTTTT..',
    ],
  };
  const FOOT_ANK = [4, 0];
  const FIST_SKIN = ['..ssS..', '.sSSSt.', 'sSSSSSt', 'sSStSSt', 'SSSSStt', '.SttTt.', '..TTT..'];
  const HAND_SKIN = ['..sSS..', '.sSSSSt', 'sSSSSSt', 'sSSSSSt', '.SSSStt', '.tSSTt.', '..TTT..'];

  // laptop: a slab 20 px long, 5 thick, along angle `la` from the near hand; open = screen up, glowing
  function laptop(buf, h, p, br) {
    if (p.noLap) return;
    const a = rad(p.la ?? 0), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
    const g = [h[0] + 0.5, h[1] + 0.5];
    const L = br.laptop ? 11 : 20;
    const base = new Part(buf, M.lap);
    for (let k = 0; k <= L; k++) for (let s = -2; s <= 2; s++) {
      const x = Math.floor(g[0] + d[0] * (k - 5) + n[0] * s), y = Math.floor(g[1] + d[1] * (k - 5) + n[1] * s);
      base.add(x, y, { s, k });
    }
    if (br.laptop) for (const [kk, ss] of [[L, 1], [L, 0], [L - 1, -2], [L - 2, 2], [L - 1, 2]]) base.remove(Math.floor(g[0] + d[0] * (kk - 5) + n[0] * ss), Math.floor(g[1] + d[1] * (kk - 5) + n[1] * ss));
    base.commit((i) => (i.s === -2 ? 0 : i.s === -1 ? 1 : i.s === 2 ? 3 : (!br.laptop && i.k >= 7 && i.k <= 12 && i.s === 0) ? 4 : (!br.laptop && (i.k === 8 || i.k === 11) && i.s === 1) ? 4 : 2));
    if (p.lapOpen && !br.laptop) {
      const sc = new Part(buf, M.screen, { sep: false });
      for (let k = 0; k <= 14; k++) for (let s = 0; s <= L; s++) {
        const x = Math.floor(g[0] + d[0] * (s - 5) - n[0] * (k + 2)), y = Math.floor(g[1] + d[1] * (s - 5) - n[1] * (k + 2));
        sc.add(x, y, { k, s, edge: k === 14 || k === 0 || s === 0 || s === L });
      }
      // a bat-cat face on the glowing screen
      sc.commit((i) => (i.edge ? [M.lap, 3] : ((i.k >= 4 && i.k <= 9 && i.s >= 7 && i.s <= 13 && ((i.k === 5 && (i.s === 8 || i.s === 12)) || (i.k === 8 && i.s >= 9 && i.s <= 11) || (i.k === 6 && (i.s === 9 || i.s === 11)))) ? 0 : (i.k + i.s) % 4 === 0 ? 1 : 2)));
    }
  }
  // the bat-cat familiar (20×12), two flap frames
  const BAT = [
    [
      '....w..........w....',
      '...ww...a...a...ww..',
      '..www...bb.bb...www.',
      '.wwww..bbbbbbb..wwww',
      'wwwwww.bWbbbWb.wwwww',
      'wwwwwwwbbobbobwwwwww',
      '.wwwwwwbbbbbbbwwwww.',
      '..wwww.bbbvbbb.wwww.',
      '...ww..bbbbbbb..ww..',
      '........bbbbb.......',
      '.........vvv........',
      '....................',
    ],
    [
      '....................',
      '........a...a.......',
      '........bb.bb.......',
      '.......bbbbbbb......',
      '.......bWbbbWb......',
      'ww.....bbobbob.....w',
      'wwww...bbbbbbb...www',
      'wwwwwwwbbbvbbbwwwwww',
      '.wwwwwwbbbbbbbwwwww.',
      '...wwww.bbbbb.wwww..',
      '.....ww..vvv..ww....',
      '....................',
    ],
  ];
  const BATKEY = { w: [M.bat, 3], a: [M.bat, 2], b: [M.bat, 2], W: [M.bat, 1], o: [M.eye, 1], v: [M.bat, 4] };
  function bat(buf, at, flap, opts = {}) {
    const rows = BAT[flap ? 1 : 0];
    const part = new Part(buf, M.bat);
    PX.sprite(part, rows, BATKEY, at, [10, 6], !!opts.flip);
    part.commit((i) => (i.ch === 'o' ? (opts.angry ? [M.frame, 1] : [M.eye, 1]) : i.ch === 'w' ? [M.bat, i.j > 6 ? 4 : 3] : i.ch === 'b' ? [M.bat, i.j <= 3 ? 1 : i.j >= 8 ? 3 : 2] : BATKEY[i.ch]));
  }

  const PARTS = [
    { id: 'glasses', label: '眼鏡', en: 'GLASSES', hp: 35, zone: 'head', icon: 'glass' },
    { id: 'laptop', label: '筆電', en: 'LAPTOP', hp: 60, zone: 'body', icon: 'laptop' },
    { id: 'slippers', label: '拖鞋', en: 'SLIPPERS', hp: 45, zone: 'legs', icon: 'shoe' },
    { id: 'ahoge', label: '呆毛', en: 'AHOGE', hp: 30, zone: 'head', icon: 'hair' },
  ];

  const SIZE = { w: 232, h: 204, ox: 108, oy: 194 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 23, thigh: 29, shin: 29, upper: 14, fore: 14, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 4, headH: 24, headW: 24, bodyW: 10 };
  const DEF = {
    hip: [0, -61], lean: 0, face: 'normal', head: [0, 0],
    fN: [-14, -3], fF: [16, -3], feetN: 'slip', feetF: 'slip',
    hN: [14, -68], hF: [18, -66], la: 0, lapOpen: false, lapLayer: 'front',
    bat: [-25, -79], flap: 0,
    hair: { base: 110, droop: 92, wave: 1.6, phase: 0, len: 46 },
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
      RIG.mane(buf, M.hair, hairRoot, { ribbons: [{ off: [0, 0], w0: 14, w1: 4, len: H.len, dA: 0 }, { off: [-5, -3], w0: 9, w1: 3, len: H.len - 8, dA: 12 }, { off: [3, 2], w0: 6, w1: 2, len: H.len - 14, dA: -10 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, freq: 0.5, waveGrow: 14, sheenAt: 0.1, groove: 5 });
      arm(buf, J.shF, J.eF, J.hF, p.grip === 'O');
      if (p.lapLayer === 'back') laptop(buf, J.hN, p, br);
      leg(buf, J.hipF, J.kF, J.fF, br.slippers ? 'bare' : p.feetF);
      leg(buf, J.hipN, J.kN, J.fN, br.slippers ? 'bare' : p.feetN);
      RIG.matmap(buf, J.rows, TKEY, J.hip, TORSO_HIP, { lean: J.lean, pivot: J.pivot, order: ['s', 'r', 'p', 'w'] });
      let head = HEAD[p.face] || HEAD.normal;
      if (br.glasses) head = NOGLASS(head);
      if (br.ahoge) head = NOAHOGE(head);
      RIG.place(buf, M.hair, head, KEY, J.neck, HEAD_NECK);
      arm(buf, J.shN, J.eN, J.hN, p.grip === 'O');
      if (p.lapLayer === 'front') laptop(buf, J.hN, p, br);
      RIG.finish(buf, p, J, { rotUp: 16 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, (br.laptop ? 13 : 22), ['hN', 'la']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  // a track-suit sleeve: red with a white stripe along the outside, a dark cuff, a skin hand
  function arm(buf, sh, el, hd, open) {
    const stripe = (i) => (Math.abs(i.u - 0.1) < 0.24 ? [M.white, i.nx > 0.3 ? 0 : 1] : null);
    RIG.cyl(buf, M.red, sh, el, (t) => 3.6 - t * 0.4, { look: 'cloth', band: stripe });
    RIG.cyl(buf, M.red, el, hd, (t) => 3.3 - t * 0.5, { look: 'cloth', band: (i) => (i.t > 0.84 ? { shift: 2 } : stripe(i)) });
    RIG.place(buf, M.skin, open ? HAND_SKIN : FIST_SKIN, KEY, hd, [3, 3]);
  }
  function leg(buf, hip, knee, foot, fvn) {
    const stripe = (i) => (Math.abs(i.u - 0.05) < 0.22 ? [M.white, i.nx > 0.3 ? 0 : 1] : null);
    RIG.cyl(buf, M.red, hip, knee, (t) => 4.4 - t * 0.6, { look: 'cloth', band: stripe });
    RIG.cyl(buf, M.red, knee, [foot[0], foot[1] - 2], (t) => 3.9 - t * 0.3, { look: 'cloth', band: stripe });
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
    return { glasses: [J.neck[0] + 3, J.neck[1] - 11], laptop: [J.hN[0] + 8, J.hN[1]], slippers: [J.fN[0], J.fN[1]], ahoge: [J.neck[0] - 8, J.neck[1] - 24] };
  }

  root.VAMP = {
    id: 'vamp', name: '吸血鬼', title: '吸血鬼のニート', en: 'VAMPIRE NEET', height: '152cm', tint: '#ffd24a',
    M, KEY, HEAD, HEAD_NECK, TORSO, FOOT, SIZE, DEF, SPEC, PARTS, render, boxes, anchors, bat, BAT, BATKEY,
  };
})(typeof window !== 'undefined' ? window : globalThis);
