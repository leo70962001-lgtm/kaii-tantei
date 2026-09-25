// maid.js — 狼人メイド (the werewolf maid, a boy in a maid dress) at KOF scale (~104 px), and the WOLF.
// Pink hair in a side bun with a small tail, a frilled headdress, a black dress with a white collar,
// apron bib and waist tie, a red ribbon (the seal), white cuffs, white tights and black shoes.
// Breakable parts: headdress, apron, ribbon (the seal — when it breaks he transforms), shoes.
// Wolf form: the same skeleton scaled up, fur strokes with tufts, a wolf head, claws, paws and a tail;
// the torn dress stays on the hips.
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('md_hair', ['#ffe0e6', '#ffb0bc', '#e8788e', '#b04a66', '#702a46'], '#2a0c1c', { softInk: '#b04a66' }),
    skin: material('md_skin', ['#fff6ee', '#ffe4d3', '#f4bfa5', '#cb8c78', '#8f5b53'], '#3a1a22', { softInk: '#cb8c78' }),
    dress: material('md_dress', ['#8e8ca8', '#55536c', '#36344a', '#212032', '#131221'], '#050408', { softInk: '#212032' }),
    white: material('md_white', ['#ffffff', '#fbfbfe', '#dbdeec', '#a6abc6', '#717796'], '#252a48', { softInk: '#a6abc6' }),
    ribbon: material('md_ribbon', ['#ffb4bc', '#ff6070', '#ce2a42', '#871c32', '#541020'], '#2a0812'),
    tights: material('md_tights', ['#ffffff', '#f9f9fd', '#e2e4f0', '#b2b6ce', '#7e829a'], '#2a2e4a', { softInk: '#b2b6ce' }),
    shoe: material('md_shoe', ['#8080a0', '#4e4c66', '#302e44', '#1e1c2c', '#100f1a'], '#050408'),
    eye: material('md_eye', ['#ffd0d8', '#ff6a7a', '#d82c48', '#8c1a30', '#4c0c1c'], '#240410'),
    ewhite: material('md_ewhite', ['#ffffff', '#f4f6ff', '#d0d6ec', '#9aa2c0', '#6c748f'], '#22263f'),
    mouth: material('md_mouth', ['#ffcccc', '#ea7c7c', '#b44454', '#722234', '#42121a'], '#1c0408'),
    fur: material('wf_fur', ['#eee6de', '#b4a494', '#78695a', '#4e443a', '#2e2822'], '#0e0a08', { softInk: '#4e443a' }),
    furLight: material('wf_furl', ['#ffffff', '#f4eee6', '#d2c8ba', '#9e9284', '#6a6056'], '#1c1612', { softInk: '#9e9284' }),
    claw: material('wf_claw', ['#ffffff', '#f8f4ec', '#d6cebe', '#9c9381', '#60594c'], '#1a1610'),
    weye: material('wf_eye', ['#ffffff', '#ffec66', '#ffb424', '#c26412', '#72320a'], '#2a1004', { glow: true }),
    maw: material('wf_maw', ['#ffa0a6', '#e45460', '#a42a3a', '#621622', '#380a12'], '#160408'),
  };

  const KEY = {
    A: [M.hair, 0], a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], B: [M.hair, 4],
    h: [M.skin, 0], s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3], T: [M.skin, 4],
    k: [M.hair, 'ink'], o: [M.eye, 2], O: [M.eye, 1], e: [M.ewhite, 1], m: [M.mouth, 3], n: [M.mouth, 2],
    W: [M.white, 0], w: [M.white, 1], x: [M.white, 2], X: [M.white, 3],
    q: [M.ribbon, 2], Q: [M.ribbon, 1],
    E: [M.shoe, 1], d: [M.shoe, 2], D: [M.shoe, 3], Z: [M.shoe, 4],
    F: [M.fur, 1], f: [M.fur, 2], g: [M.fur, 3], G: [M.fur, 4], '*': [M.fur, 0],
    L: [M.furLight, 1], l: [M.furLight, 2],
    y: [M.weye, 1], Y: [M.weye, 2], N: [M.fur, 'ink'], r: [M.maw, 2], R: [M.maw, 3], C: [M.claw, 1], v: [M.claw, 3],
  };

  // ---------------------------------------------------------------- maid head (28×26): headdress, bun, calm face, the seal ribbon
  const HEAD = {
    normal: [
      '..........wWwxwWwxwWw.......',
      '.........wwwwwwwwwwwww......',
      '........bbwxxxxxxxxxwbb.....',
      '.......bbbbbbbbbbbbbbbb.....',
      '.....bbbbbaabbbbbbbbbbbb....',
      '....bbbbbaabbbbbbbbbbbbbb...',
      '...bbbbbabbbbbbbbbbbbbbbb...',
      '..cbbbbbbbbbbbbbbbbbbbbbbb..',
      '.ccbbbbbbbbbbbbbbbbbcsSSbb..',
      'cccbbbbbbbbbbbbbbbbcsSSSSSb.',
      'ccccbbbbbbbbbbbbbbbcSSSSSSSb',
      'BcccbbbbbbbbbbbbbbccSkkSSkkS',
      'BBcccbbbbbbbbbbbbbccSeOSSeOS',
      'BBccccbbbbbbbbbbbbccSooSSooS',
      'BBBcccbbbbbbbbbbbbccSSSSSSSs',
      '.BBcccbbbbbbbbbbbbbcSSSSSSts',
      '.BBBccbbbbbbbbbbbbbcSSSSSnS.',
      '..BBBcbbbbbbbbbbbbbctSSSmSS.',
      '...BBBbbbbbbbbbbbbbcSSSSSSS.',
      '....BBbbbbbbbbbbbbbctSSSSS..',
      '.....BBbbbbbbbbbbbb.tTSSS...',
      '......Bbbbbbbbbbbb..TSSST...',
      '.......bbbbbbbbbb..qQQqqQq..',
      '........cccccc.....qqQqqq...',
      '.....................SSS....',
      '.....................SS.....',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  HEAD.shout = fv([[20, 11, 'k'], [21, 11, 'k'], [22, 11, 'k'], [25, 11, 'k'], [26, 11, 'k'], [27, 11, 'k'], [23, 17, 'm'], [24, 17, 'm'], [25, 17, 'm'], [23, 18, 'm'], [24, 18, 'm'], [25, 18, 'm']]);
  HEAD.hurt = fv([[21, 12, 'k'], [22, 12, 'k'], [25, 12, 'k'], [26, 12, 'k'], [21, 13, 'S'], [22, 13, 'S'], [25, 13, 'S'], [26, 13, 'S'], [21, 11, 'S'], [22, 11, 'S'], [25, 11, 'S'], [26, 11, 'S'], [23, 17, 'm'], [24, 17, 'm'], [24, 18, 'm']]);
  HEAD.calm = fv([[21, 12, 'k'], [22, 12, 'k'], [25, 12, 'k'], [26, 12, 'k'], [21, 13, 'S'], [22, 13, 'S'], [25, 13, 'S'], [26, 13, 'S'], [21, 11, 'S'], [22, 11, 'S'], [25, 11, 'S'], [26, 11, 'S']]);
  HEAD.grin = fv([[22, 17, 'm'], [23, 17, 'm'], [24, 17, 'm'], [25, 17, 'm'], [23, 16, 'n'], [24, 16, 'n']]);
  const NOBAND = (rows) => rows.map((r, j) => (j < 2 ? r.replace(/[wWx]/g, '.') : j === 2 ? r.replace(/[wWx]/g, 'b') : r));
  const NORIBBON = (rows) => rows.map((r, j) => (j === 22 ? r.replace(/[qQ]/g, 'S') : j === 23 ? r.replace(/[qQ]/g, '.') : r));
  const HEAD_NECK = [22, 25];
  const TAIL_ROOT = [2, 17];

  // ---------------------------------------------------------------- maid torso (26×28): collar, apron bib, dress, waist tie
  const TORSO = {
    up: [
      '..........wwwwww..........',
      '.......wwwwddddwwww.......',
      '.....ddddwwddddwwdddd.....',
      '...ddddddwxwwwwxwdddddd...',
      '..dddddddwwwwwwwwddddddd..',
      '..dddddddwwwwwwwwddddddd..',
      '.ddddddddwwwwwwwwdddddddd.',
      '.ddddddddwwwwwwwwdddddddd.',
      '.ddd/dddddwwwwwwdddddd/dd.',
      '.ddd/dddddwwwwwwdddddd/dd.',
      '.dddddddddwwwwwwdddddddd..',
      '.ddddddddddwwwwddddddddd..',
      '..dddddddddwwwwdddddddd...',
      '..ddddddddddwwddddddddd...',
      '..dddddddddddddddddddd/...',
      '...ddddddddddddddddddd....',
      '...dddddddddddddddddd.....',
      '....ddddddddddddddddd.....',
      '....dddddddddddddddd......',
      '....dddddddddddddddd......',
      '...wwwwwwwwwwwwwwwwww.....',
      '...wwwwwwwwwwwwwwwwww.....',
      '..dddddddddddddddddddd....',
      '..dddddddddddddddddddd....',
      '..dddddddddddddddddddd....',
      '.dddddddddddddddddddddd...',
      '.dddddddddddddddddddddd...',
      '.dddddddddddddddddddddd...',
    ],
  };
  TORSO.noapron = TORSO.up.map((r, j) => (j >= 2 && j <= 13 ? r.replace(/[wx]/g, (ch, i) => (j <= 3 && i >= 7 && i <= 18 ? ch : 'd')) : j === 20 || j === 21 ? r.replace(/w/g, 'd') : r));
  TORSO.torn = TORSO.noapron.map((r, j) => (j === 6 || j === 9 ? r.replace('ddddddddd', 'ddsSSddsd') : j === 15 ? r.replace('dddddddddddd', 'dddSSdddddSd') : r));
  const TKEY = {
    d: { m: M.dress, look: 'cloth' },
    w: { m: M.white, look: 'white' },
    s: { m: M.skin, look: 'skin' },
  };
  const TORSO_HIP = [13, 27];
  const TORSO_SH = { N: [4, 4], F: [21, 4], neck: [13, 0] };

  // dress skirt: black pleats with an apron panel in front and a frilled hem (24 rows)
  function skirtRows(apron, swing = 0) {
    const rows = [];
    const H = 24;
    for (let j = 0; j < H; j++) {
      const w = 20 + Math.round(j * 0.75);
      const left = Math.round(18 - w / 2 + swing * (j / (H - 1)));
      let r = '';
      for (let i = 0; i < 40; i++) {
        const q = i - left;
        if (q < 0 || q >= w) { r += '.'; continue; }
        const front = q >= w * 0.4 && q <= w - 2;
        if (j >= H - 2) { r += (q + j) % 2 ? 'x' : 'w'; continue; }
        if (apron && front && j < H - 4) { r += (q === Math.floor(w * 0.4) || j === H - 5) ? 'x' : (q > w * 0.75 ? 'W' : 'w'); continue; }
        const pl = q % 5;
        let t = pl === 0 ? 4 : pl === 1 ? 2 : pl === 2 ? 1 : 2;
        if (q < w * 0.3) t = Math.min(4, t + 1);
        if (j < 2) t = Math.min(4, t + 1);
        r += 'EdDZZ'[t];
      }
      rows.push(r);
    }
    return rows;
  }
  const SKEY = { E: [M.dress, 0], d: [M.dress, 1], D: [M.dress, 2], Z: [M.dress, 3], W: [M.white, 0], w: [M.white, 1], x: [M.white, 2] };
  const SKIRT_HIP = [18, 0];

  const FOOT = {
    shoe: [
      '...dEEE.......',
      '..dEEEEEEE....',
      '.ddEEExxEEEE..',
      '.dddEEEEEEEEEE',
      'ddddddEEEEEEEE',
      'DDDDDDDDDDDDDD',
      '.ZZZZZZZZZZZZ.',
    ],
    tights: [
      '...www........',
      '..wwwwwww.....',
      '.xwwwwwwwww...',
      '.xxwwwwwwwwwww',
      'xxxxxxwwwwwwww',
      'XXXXXXXXXXXXXX',
      '.XXXXXXXXXXXX.',
    ],
  };
  const FOOT_ANK = [4, 0];
  const FIST_SKIN = ['..ssS..', '.sSSSt.', 'sSSSSSt', 'sSStSSt', 'SSSSStt', '.SttTt.', '..TTT..'];
  const HAND_SKIN = ['..sSS..', '.sSSSSt', 'sSSSSSt', 'sSSSSSt', '.SSSStt', '.tSSTt.', '..TTT..'];

  // ---------------------------------------------------------------- wolf bitmaps
  const WHEAD = {
    normal: [
      '...gf.......gf..............',
      '..gffg.....gffg.............',
      '..gfffg...gffff.............',
      '..gffffgggfffff.............',
      '...gffffffffffffg...........',
      '...gfffffffffffffgg.........',
      '..gffffffffffffffffgg.......',
      '..gfffffffffffffffffffg.....',
      '.gffffyYYfffffffffffffgg....',
      '.gffffNNNfffffffffffffffg...',
      '.gfffffffffffffffffffffffg..',
      '.gffffffffffffffffggggGGGGg.',
      '.gffffffffffffffffgLllrrRRRg',
      '..gffffffffffffffgLllCrCrCrg',
      '..gfffffffffffffgLllRRRRRRRg',
      '..gfffffffffffffgLlRRRCRCRGg',
      '...gfffffffffffffgggggggggg.',
      '....gfffffffffffffgLLLLg....',
      '.....ggfffffffffffgllllg....',
      '.......gffffffffffgggg......',
      '........ffffffffff..........',
      '........ffffffffff..........',
      '.........fffffffff..........',
      '.........ffffffff...........',
      '..........fffffff...........',
      '..........ffffff............',
    ],
  };
  WHEAD.shout = WHEAD.normal.map((r, j) => (j === 12 ? '.gffffffffffffffffgLllrrRRRg' : j === 13 ? '..gffffffffffffffgLllCRCRCRg' : j === 14 ? '..gfffffffffffffgLllRRRRRRRg' : j === 15 ? '..gfffffffffffffgLlRRRRRRRRg' : j === 16 ? '...gfffffffffffffgggvCvCvCgg' : r));
  WHEAD.hurt = WHEAD.normal.map((r, j) => (j === 8 ? '.gffffNNNfffffffffffffgg....' : r));
  WHEAD.calm = WHEAD.normal;
  WHEAD.grin = WHEAD.shout;
  const WHEAD_NECK = [13, 25];
  const WTORSO = {
    up: [
      '..........ffffffff..........',
      '.......ffffLLLLLLffff.......',
      '.....ffffLLLLLLLLLffff......',
      '...fffffLLLLLLLLLLffffff....',
      '..ffffffLLLLLLLLLLfffffff...',
      '..ffffffLLLLLLLLLLfffffff...',
      '.fffffffLLLLLLLLLLffffffff..',
      '.fffffff/LLLLLLLLffffff/ff..',
      '.fffffff/LLLLLLLLffffff/ff..',
      '.ffffffffLLLLLLLfffffffff...',
      '.ffffffff/LLLLLffffffff/f...',
      '..fffffffffLLLffffffffff....',
      '..fffffffff/LLffffffff/f....',
      '..ffffffffffffffffffffff....',
      '...ffffffffffffffffffff.....',
      '...ffffffffffffffffffff.....',
      '....ffffffffffffffffff......',
      '....ffffffffffffffffff......',
      '....ffffffffffffffffff......',
      '...ddddddddddddddddddd......',
      '...ddZdddZdddZdddZdddd......',
      '..dddddddddddddddddddd......',
      '..dddddddddddddddddddd......',
      '..dddddddddddddddddddd......',
      '.dddddddddddddddddddddd.....',
      '.dddddddddddddddddddddd.....',
    ],
  };
  const WKEY = {
    f: { m: M.fur, look: 'fur' },
    l: { m: M.furLight, look: 'fur' },
    d: { m: M.dress, look: 'cloth' },
    z: { m: M.dress, flat: 4 },
  };
  const WTORSO_HIP = [13, 25];
  const WTORSO_SH = { N: [4, 5], F: [22, 5], neck: [13, 0] };
  const PAW = ['..lFF.........', '.lFFFFFF......', 'lFFFFFFFFF....', 'lFFFFFFFFFFF..', 'FFFFFFFFFFFFFF', 'ggggggggggggg.', '.gCgCgCgCgCgC.'];
  const CLAWHAND = ['..FFF..', '.FFFFF.', 'FFFFFFg', 'FFFFFFg', 'gFFFFgg', '.ggggg.', '..CCC..'];

  const PARTS = [
    { id: 'headdress', label: '頭飾', en: 'HEADDRESS', hp: 35, zone: 'head', icon: 'band' },
    { id: 'apron', label: '圍裙', en: 'APRON', hp: 50, zone: 'body', icon: 'cloth' },
    { id: 'ribbon', label: '封印', en: 'SEAL', hp: 45, zone: 'body', icon: 'seal', seal: true },
    { id: 'shoes', label: '皮鞋', en: 'SHOES', hp: 45, zone: 'legs', icon: 'shoe' },
  ];

  const SIZE = { w: 232, h: 204, ox: 108, oy: 194 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 25, thigh: 31, shin: 31, upper: 15, fore: 15, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 4, headH: 24, headW: 20, bodyW: 11 };
  const WSPEC = { hipTorso: WTORSO_HIP, sh: WTORSO_SH, torsoRows: WTORSO.up, torsoPivot: 23, thigh: 32, shin: 32, upper: 20, fore: 20, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 6, headH: 26, headW: 30, bodyW: 13 };
  const DEF = {
    hip: [0, -66], lean: 0, face: 'normal', head: [0, 0],
    fN: [-14, -3], fF: [16, -3], feetN: 'shoe', feetF: 'shoe',
    hN: [-5, -76], hF: [16, -79], form: 'maid',
    hair: { base: 100, droop: 92, wave: 1, phase: 0, len: 22 },
    tail: { base: 150, droop: 120, wave: 1.2, phase: 0, len: 36 },
    broken: {},
  };
  const WDEF = { hip: [0, -72], lean: 5, fN: [-18, -3], fF: [20, -3], hN: [5, -58], hF: [23, -72] };

  function render(pose, opts = {}) {
    const p = Object.assign({}, DEF, pose);
    p.hair = Object.assign({}, DEF.hair, pose.hair || {});
    p.tail = Object.assign({}, DEF.tail, pose.tail || {});
    const br = p.broken || {};
    const buf = new PX.Buf(opts.w || SIZE.w, opts.h || SIZE.h);
    const O = [opts.ox ?? SIZE.ox, opts.oy ?? SIZE.oy];
    if (p.form === 'wolf') return renderWolf(buf, O, p, br, opts);
    const spec = Object.assign({}, SPEC, { torsoRows: br.ribbon ? TORSO.torn : br.apron ? TORSO.noapron : TORSO.up });
    const J = RIG.solve(p, spec, O);
    const headO = [J.neck[0] - HEAD_NECK[0], J.neck[1] - HEAD_NECK[1]];
    if (!p.hidden) {
      const H = p.hair;
      RIG.mane(buf, M.hair, [headO[0] + TAIL_ROOT[0], headO[1] + TAIL_ROOT[1]], { ribbons: [{ off: [0, 0], w0: 6, w1: 2, len: H.len, dA: 0 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, sheen: false, groove: 3 });
      arm(buf, J.shF, J.eF, J.hF, p.grip !== 'F');
      leg(buf, J.hipF, J.kF, J.fF, br.shoes ? 'tights' : p.feetF);
      leg(buf, J.hipN, J.kN, J.fN, br.shoes ? 'tights' : p.feetN);
      RIG.place(buf, M.dress, skirtRows(!br.apron, p.skirtSwing || 0), SKEY, [J.hip[0], J.hip[1] + 2], SKIRT_HIP);
      RIG.matmap(buf, J.rows, TKEY, J.hip, TORSO_HIP, { lean: J.lean, pivot: J.pivot, order: ['s', 'd', 'w'] });
      let head = HEAD[p.face] || HEAD.normal;
      if (br.headdress) head = NOBAND(head);
      if (br.ribbon) head = NORIBBON(head);
      RIG.place(buf, M.hair, head, KEY, J.neck, HEAD_NECK);
      arm(buf, J.shN, J.eN, J.hN, p.grip !== 'F');
      RIG.finish(buf, p, J, { rotUp: 16 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, p.reach || 16, p.smearKeys || ['hF', 'la']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  function arm(buf, sh, el, hd, open) {
    RIG.cyl(buf, M.dress, sh, el, (t) => 3.5 - t * 0.5, { look: 'cloth' });
    RIG.cyl(buf, M.dress, el, hd, (t) => 3.1 - t * 0.3, { look: 'cloth', band: (i) => (i.t > 0.74 ? [M.white, RIG.sh(i.nx * 0.9, i.ny * 0.9, RIG.LOOK.white, i.x, i.y)] : null) });
    RIG.place(buf, M.skin, open ? HAND_SKIN : FIST_SKIN, KEY, hd, [3, 3]);
  }
  function leg(buf, hip, knee, foot, fvn) {
    RIG.cyl(buf, M.tights, hip, knee, (t) => 4.1 - t * 0.8, { look: 'white' });
    RIG.cyl(buf, M.tights, knee, [foot[0], foot[1] - 2], (t) => 3.4 - t * 0.5, { look: 'white' });
    RIG.place(buf, fvn === 'tights' ? M.tights : M.shoe, FOOT[fvn] || FOOT.shoe, KEY, foot, FOOT_ANK);
  }

  // ---------------------------------------------------------------- the wolf
  function renderWolf(buf, O, p, br, opts) {
    const q = Object.assign({}, WDEF, p);
    if (!p.hip) q.hip = WDEF.hip;
    const J = RIG.solve(q, WSPEC, O);
    if (!q.hidden) {
      const T = q.tail;
      RIG.mane(buf, M.fur, [J.hip[0] - 8, J.hip[1] - 2], { ribbons: [{ off: [0, 0], w0: 8, w1: 3, len: T.len, dA: 0 }], base: T.base, droop: T.droop, wave: T.wave, phase: T.phase, sheen: false, groove: 3, tone: (i) => (i.q > 0.45 ? 1 : i.q < -0.4 ? 3 : 2) });
      wolfArm(buf, J.shF, J.eF, J.hF, q);
      wolfLeg(buf, J.hipF, J.kF, J.fF);
      wolfLeg(buf, J.hipN, J.kN, J.fN);
      RIG.place(buf, M.dress, skirtRows(false, q.skirtSwing || 0).slice(0, 12), SKEY, [J.hip[0], J.hip[1] + 2], SKIRT_HIP);
      RIG.matmap(buf, J.rows, WKEY, J.hip, WTORSO_HIP, { lean: J.lean, pivot: J.pivot, order: ['d', 'z', 'f', 'l'] });
      RIG.place(buf, M.fur, WHEAD[q.face] || WHEAD.normal, KEY, J.neck, WHEAD_NECK);
      wolfArm(buf, J.shN, J.eN, J.hN, q);
      RIG.finish(buf, q, J, { rotUp: 18 });
    }
    if (q.smear) RIG.smear(buf, O, q, q.smear, q.reach || 26, q.smearKeys || ['hF', 'la']);
    if (root.FX && q.fx) { root.FX.draw(buf, O, q.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  const tuft = (i) => ((Math.floor(i.t * 7) % 2 === 0) && i.u > 0.55 ? { shift: -1 } : (Math.floor(i.t * 7) % 2 === 1) && i.u < -0.6 ? { shift: 1 } : null);
  function wolfArm(buf, sh, el, hd, q) {
    RIG.cyl(buf, M.fur, sh, el, (t) => 5.4 - t * 0.6, { look: 'fur', band: tuft });
    RIG.cyl(buf, M.fur, el, hd, (t) => 4.8 - t * 0.6, { look: 'fur', band: tuft });
    const d = [hd[0] - el[0], hd[1] - el[1]], L = Math.hypot(d[0], d[1]) || 1, u = [d[0] / L, d[1] / L], n = [-u[1], u[0]];
    RIG.place(buf, M.fur, CLAWHAND, KEY, hd, [3, 3]);
    const cl = new Part(buf, M.claw);
    for (const s of [-3, 0, 3]) {
      const bx = hd[0] + 0.5 + n[0] * s + u[0] * 3, by = hd[1] + 0.5 + n[1] * s + u[1] * 3;
      PX.line(bx, by, bx + u[0] * (q.clawLen || 7), by + u[1] * (q.clawLen || 7), (x, y, i) => cl.add(x, y, { i }));
      PX.line(bx + n[0] * 0.7, by + n[1] * 0.7, bx + n[0] * 0.7 + u[0] * (q.clawLen || 7) * 0.6, by + n[1] * 0.7 + u[1] * (q.clawLen || 7) * 0.6, (x, y) => { if (!cl.has(x, y)) cl.add(x, y, { i: 9 }); });
    }
    cl.commit((i) => (i.i === 9 ? 3 : i.i === 0 ? 3 : i.i < 3 ? 2 : 1));
  }
  function wolfLeg(buf, hip, knee, foot) {
    RIG.cyl(buf, M.fur, hip, knee, (t) => 5.8 - t * 1.0, { look: 'fur', band: tuft });
    RIG.cyl(buf, M.fur, knee, [foot[0], foot[1] - 3], (t) => 4.6 - t * 0.6, { look: 'fur', band: tuft });
    RIG.place(buf, M.fur, PAW, KEY, foot, [4, 0]);
  }

  function boxes(pose) {
    const p = Object.assign({}, DEF, pose);
    if (p.form === 'wolf') { const q = Object.assign({}, WDEF, p); if (!pose.hip) q.hip = WDEF.hip; return RIG.boxes(RIG.solve(q, WSPEC, [0, 0]), WSPEC, q); }
    return RIG.boxes(RIG.solve(p, SPEC, [0, 0]), SPEC, p);
  }
  function anchors(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return { headdress: [J.neck[0] - 4, J.neck[1] - 24], apron: [J.hip[0] + 4, J.hip[1] - 8], ribbon: [J.neck[0], J.neck[1] - 2], shoes: [J.fN[0], J.fN[1]] };
  }

  root.MAID = {
    id: 'maid', name: '狼人メイド', title: '狼人のメイド（偽娘）', en: 'WEREWOLF MAID', height: '165cm', tint: '#ff9ab8',
    M, KEY, HEAD, HEAD_NECK, TORSO, WHEAD, WHEAD_NECK, WTORSO, FOOT, SIZE, DEF, WDEF, SPEC, WSPEC, PARTS, render, boxes, anchors, skirtRows,
  };
})(typeof window !== 'undefined' ? window : globalThis);
