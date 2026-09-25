// maid.js — 狼人メイド (the werewolf maid, a boy in a maid dress), ~57 px, and the WOLF he turns into.
// Brown hair in a side bun with a small tail, a frilled headdress, a black dress with a white apron bib
// and collar, a red ribbon (the seal), white cuffs, white tights and black shoes.
// Breakable parts: headdress, apron, ribbon (the seal — when it breaks he transforms), shoes.
// Wolf form: the same skeleton scaled up, fur strokes, a wolf head, claws, paws and a tail;
// the torn dress stays on the hips.
(function (root) {
  'use strict';
  const PX = root.PX, RIG = root.RIG;
  const { material, Part, rad, clamp, lerp } = PX;

  const M = {
    hair: material('md_hair', ['#e8bc90', '#b7824f', '#84552f', '#58361c', '#382010'], '#1a0c06', { softInk: '#58361c' }),
    skin: material('md_skin', ['#fff4ea', '#ffe2d0', '#f2bda2', '#c98a76', '#8e5a52'], '#3a1a22', { softInk: '#c98a76' }),
    dress: material('md_dress', ['#8a88a4', '#525068', '#343248', '#201f30', '#121120'], '#050408', { softInk: '#201f30' }),
    white: material('md_white', ['#ffffff', '#fbfbfe', '#d9dcea', '#a4a9c4', '#6f7594'], '#252a48', { softInk: '#a4a9c4' }),
    ribbon: material('md_ribbon', ['#ffb0b8', '#ff5c6c', '#cc2840', '#851a30', '#521020'], '#2a0812'),
    tights: material('md_tights', ['#ffffff', '#f8f8fc', '#e0e2ee', '#b0b4cc', '#7c8098'], '#2a2e4a', { softInk: '#b0b4cc' }),
    shoe: material('md_shoe', ['#7c7a92', '#4a4860', '#2e2c40', '#1c1a2a', '#0e0d18'], '#050408'),
    eye: material('md_eye', ['#ffe4a0', '#f0b040', '#c07828', '#805018', '#4a2c0c'], '#241204'),
    mouth: material('md_mouth', ['#ffc8c8', '#e87878', '#b04050', '#702030', '#401018'], '#1c0408'),
    fur: material('wf_fur', ['#ece4dc', '#b0a090', '#746656', '#4c4238', '#2c2620'], '#0e0a08', { softInk: '#4c4238' }),
    furLight: material('wf_furl', ['#ffffff', '#f2ece4', '#cfc4b6', '#9a8e80', '#665c52'], '#1c1612', { softInk: '#9a8e80' }),
    claw: material('wf_claw', ['#ffffff', '#f6f2ea', '#d4ccbc', '#9a917f', '#5e574a'], '#1a1610'),
    weye: material('wf_eye', ['#ffffff', '#ffe860', '#ffb020', '#c06010', '#703008'], '#2a1004', { glow: true }),
    maw: material('wf_maw', ['#ff9aa0', '#e0505c', '#a02838', '#601420', '#360a12'], '#160408'),
  };

  const KEY = {
    a: [M.hair, 1], b: [M.hair, 2], c: [M.hair, 3], B: [M.hair, 3],
    s: [M.skin, 1], S: [M.skin, 2], t: [M.skin, 3],
    k: [M.hair, 'ink'], o: [M.eye, 2], m: [M.mouth, 3],
    T: [M.white, 1], h: [M.white, 2], H: [M.white, 3],
    K: [M.dress, 2], d: [M.dress, 3], D: [M.dress, 4], L: [M.dress, 1],
    q: [M.ribbon, 2], Q: [M.ribbon, 1],
    e: [M.shoe, 2], E: [M.shoe, 3], l: [M.shoe, 1],
    // wolf
    F: [M.fur, 1], f: [M.fur, 2], g: [M.fur, 3], G: [M.fur, 4],
    w: [M.furLight, 2], W: [M.furLight, 1],
    y: [M.weye, 1], Y: [M.weye, 2], n: [M.fur, 'ink'], r: [M.maw, 2], R: [M.maw, 3], C: [M.claw, 1], v: [M.claw, 3],
  };

  // ---------------------------------------------------------------- maid head
  const HEAD = {
    normal: [
      '.....TThThT.....',
      '....bbTTTTTbb...',
      '...bbbbbbbbbbb..',
      '..Bbabbbbbbbbbb.',
      '.BBbbbbbbbcSSSb.',
      'BBBbbbbbbbcSkSkS',
      'BBBbbbbbbbcSoSoS',
      '.BBbbbbbbbcSSSSs',
      '..BbbbbbbbcSSmS.',
      '...bbbbbbbctSSS.',
      '....cbbbbb.tSS..',
      '.....ccbb.qQq...',
      '..........SS....',
    ],
  };
  const fv = (edits) => RIG.variant(HEAD.normal, edits);
  HEAD.shout = fv([[12, 5, 'k'], [13, 5, 'k'], [13, 8, 'm'], [14, 8, 'm'], [13, 9, 'm']]);
  HEAD.hurt = fv([[12, 6, 'k'], [14, 6, 'k'], [12, 5, 'S'], [14, 5, 'S'], [13, 8, 'm'], [13, 9, 'm']]);
  HEAD.calm = fv([[12, 6, 'k'], [14, 6, 'k'], [12, 5, 'S'], [14, 5, 'S']]);
  HEAD.grin = fv([[12, 8, 'm'], [13, 8, 'm'], [14, 8, 'm']]);
  const NOBAND = (rows) => rows.map((r, j) => (j === 0 ? r.replace(/[Th]/g, '.') : j === 1 ? r.replace('TTTTT', 'bbbbb') : r));
  const NORIBBON = (rows) => rows.map((r, j) => (j === 11 ? r.replace('qQq', '.S.') : r));
  const HEAD_NECK = [11, 12];
  const TAIL_ROOT = [1, 8];

  // ---------------------------------------------------------------- maid torso: collar, apron bib, dress, waist tie
  const TORSO = {
    up: [
      '.....TTTT.....',
      '...TTKKKKTT...',
      '..KKKThhTKKK..',
      '.KKKTTTTTTKKK.',
      '.KKKTTTTTTKKK.',
      '.KKKTTTTTTKKK.',
      '.KKKKThhTKKKK.',
      '.KKKKKTTKKKKK.',
      '..KKKKKKKKKK..',
      '..dKKKKKKKKd..',
      '.ThThThThThTh.',
      '.dKKKKKKKKKKd.',
    ],
  };
  TORSO.noapron = RIG.recolour(TORSO.up, { h: 'K' }).map((r, j) => (j >= 2 && j <= 7 ? r.replace(/T/g, 'K') : j === 10 ? r.replace(/[Th]/g, 'K') : r));
  TORSO.torn = TORSO.noapron.map((r, j) => (j === 3 || j === 6 ? r.replace('KKKKKK', 'KSSKKS') : j === 8 ? r.replace('KKKKKKKKKK', 'KKSSKKKSKK') : r));
  for (const k of ['up', 'noapron', 'torn']) TORSO[k] = RIG.tall(TORSO[k], [3, 5, 8]);
  const TORSO_HIP = [7, 14];
  const TORSO_SH = { N: [3, 3], F: [11, 3], neck: [7, 0] };

  // dress skirt with an apron panel in front and a frilled hem
  function skirtRows(apron, swing = 0) {
    const rows = [];
    const H = 13;
    for (let j = 0; j < H; j++) {
      const w = 10 + Math.round(j * 0.9);
      const left = Math.round(9 - w / 2 + swing * (j / (H - 1)));
      let r = '';
      for (let i = 0; i < 22; i++) {
        const q = i - left;
        if (q < 0 || q >= w) { r += '.'; continue; }
        const front = q >= w * 0.42 && q <= w - 1;
        if (j === H - 1) r += (q % 2 ? 'h' : 'T');
        else if (apron && front && j < H - 2) r += (q === Math.floor(w * 0.42) ? 'h' : (j === H - 3 ? 'h' : 'T'));
        else r += q < w * 0.3 ? 'd' : ((q + (j >> 1)) % 3 === 0 ? 'd' : 'K');
      }
      rows.push(r);
    }
    return rows;
  }
  const SKIRT_HIP = [9, 0];

  const FOOT = {
    shoe: ['.eEE....', 'eEEEEE..', 'eEEEEEEE', 'EEEEEEEE'].map((r) => r.replace(/E/g, 'e').replace(/^(.)e/, '$1l')),
    tights: ['.hTT....', 'hTTTT...', 'hTTTTTT.', 'HHHHHHH.'],
  };
  const FOOT_ANK = [2, 0];

  // ---------------------------------------------------------------- wolf bitmaps
  const WHEAD = {
    normal: [
      '..gf....gf.........',
      '.gffg..gffg........',
      '.gfffgfffff........',
      '..gfffffffffg......',
      '..gffffffffffgg....',
      '.gfffffffffffffg...',
      '.gffffyYfffffffffg.',
      '.gffffnnfffffffffffg',
      '.gfffffffffffgggGGG.',
      '..gfffffffffffrrRRg',
      '..gffffffffffgCrCrg',
      '...gfffffffffgRRRRg',
      '....ggfffffffgggg..',
      '......gffffff......',
    ],
  };
  WHEAD.shout = WHEAD.normal.map((r, j) => (j === 9 ? '..gfffffffffffrrrRg' : j === 10 ? '..gffffffffffgCRCRg' : j === 11 ? '...gfffffffffgRRRRCg' : j === 12 ? '....ggfffffffgvCvg.' : r));
  WHEAD.hurt = WHEAD.normal.map((r, j) => (j === 6 ? '.gffffnnfffffffffg.' : r));
  const WHEAD_NECK = [8, 13];
  const WTORSO = {
    up: [
      '......ffffff......',
      '....fffFFFffff....',
      '...ffFFFFFfffff...',
      '..ffFFFFFFffffff..',
      '..ffFFFFFFffffff..',
      '..fffFFFFfffffff..',
      '..ffffFFfffffffff.',
      '..gffffffffffffff.',
      '..ggfffffffffffg..',
      '...ggfffffffffg...',
      '...dKdKKdKKdKd....',
      '...KKKKKKKKKKK....',
    ],
  };
  WTORSO.up = RIG.tall(WTORSO.up, [4, 7]);
  const WTORSO_HIP = [8, 13];
  const WTORSO_SH = { N: [3, 3], F: [14, 3], neck: [9, 0] };
  const PAW = ['.wFF...', 'wFFFFF.', 'wFFFFFF', 'gggCgCC'];
  const CLAW = ['CvC', 'fFf', 'fff'];

  const PARTS = [
    { id: 'headdress', label: '頭飾', en: 'HEADDRESS', hp: 35, zone: 'head', icon: 'band' },
    { id: 'apron', label: '圍裙', en: 'APRON', hp: 50, zone: 'body', icon: 'cloth' },
    { id: 'ribbon', label: '封印', en: 'SEAL', hp: 45, zone: 'body', icon: 'seal', seal: true },
    { id: 'shoes', label: '皮鞋', en: 'SHOES', hp: 45, zone: 'legs', icon: 'shoe' },
  ];

  const SIZE = { w: 128, h: 108, ox: 60, oy: 100 };
  const SPEC = { hipTorso: TORSO_HIP, sh: TORSO_SH, torsoRows: TORSO.up, torsoPivot: 13, thigh: 17, shin: 17, upper: 8.5, fore: 8.5, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 2, headH: 12, headW: 11 };
  const WSPEC = { hipTorso: WTORSO_HIP, sh: WTORSO_SH, torsoRows: WTORSO.up, torsoPivot: 12, thigh: 18, shin: 18, upper: 11, fore: 11, kneeBend: -1, elbowN: 1, elbowF: 1, hipSpread: 3, headH: 14, headW: 18 };
  const DEF = {
    hip: [0, -37], lean: 0, face: 'normal', head: [0, 0],
    fN: [-8, -2], fF: [9, -2], feetN: 'shoe', feetF: 'shoe',
    hN: [-3, -42], hF: [9, -44], form: 'maid',
    hair: { base: 100, droop: 92, wave: 1, phase: 0, len: 12 },
    tail: { base: 150, droop: 120, wave: 1.2, phase: 0, len: 20 },
    broken: {},
  };
  const WDEF = { hip: [0, -40], lean: 3, fN: [-10, -2], fF: [11, -2], hN: [3, -32], hF: [13, -40] };

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
      RIG.mane(buf, M.hair, [headO[0] + TAIL_ROOT[0], headO[1] + TAIL_ROOT[1]], { ribbons: [{ off: [0, 0], w0: 3.5, w1: 1.5, len: H.len, dA: 0 }], base: H.base, droop: H.droop, wave: H.wave, phase: H.phase, sheen: false });
      arm(buf, J.shF, J.eF, J.hF);
      leg(buf, J.hipF, J.kF, J.fF, br.shoes ? 'tights' : p.feetF);
      leg(buf, J.hipN, J.kN, J.fN, br.shoes ? 'tights' : p.feetN);
      RIG.place(buf, M.dress, skirtRows(!br.apron, p.skirtSwing || 0), KEY, [J.hip[0], J.hip[1] + 1], SKIRT_HIP);
      RIG.place(buf, M.dress, J.tb, KEY, J.hip, J.tAnchor);
      let head = HEAD[p.face] || HEAD.normal;
      if (br.headdress) head = NOBAND(head);
      if (br.ribbon) head = NORIBBON(head);
      RIG.place(buf, M.hair, head, KEY, J.neck, HEAD_NECK);
      arm(buf, J.shN, J.eN, J.hN);
      RIG.finish(buf, p, J, { rotUp: 9 });
    }
    if (p.smear) RIG.smear(buf, O, p, p.smear, p.reach || 9, p.smearKeys || ['hF', 'la']);
    if (root.FX && p.fx) { root.FX.draw(buf, O, p.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  function arm(buf, sh, el, hd) {
    RIG.stroke(buf, M.dress, sh, el, 1.8);
    RIG.stroke(buf, M.dress, el, hd, 1.5, { band: (i) => (i.t > 0.72 ? [M.white, 1] : null) });
    RIG.hand(buf, M.skin, hd, 3);
  }
  function leg(buf, hip, knee, foot, fvn) {
    RIG.stroke(buf, M.tights, hip, knee, 2.2);
    RIG.stroke(buf, M.tights, knee, [foot[0], foot[1] - 1], 1.9);
    RIG.place(buf, fvn === 'tights' ? M.tights : M.shoe, FOOT[fvn] || FOOT.shoe, KEY, foot, FOOT_ANK);
  }

  // ---------------------------------------------------------------- the wolf
  function renderWolf(buf, O, p, br, opts) {
    const q = Object.assign({}, WDEF, p);
    if (!p.hip) q.hip = WDEF.hip;
    const J = RIG.solve(q, WSPEC, O);
    if (!q.hidden) {
      const T = q.tail;
      RIG.mane(buf, M.fur, [J.hip[0] - 4, J.hip[1] - 1], { ribbons: [{ off: [0, 0], w0: 4, w1: 2, len: T.len, dA: 0 }], base: T.base, droop: T.droop, wave: T.wave, phase: T.phase, sheen: false, tone: (i) => (i.q > 0.4 ? 1 : i.q < -0.4 ? 3 : 2) });
      wolfArm(buf, J.shF, J.eF, J.hF, q);
      wolfLeg(buf, J.hipF, J.kF, J.fF);
      wolfLeg(buf, J.hipN, J.kN, J.fN);
      RIG.place(buf, M.dress, skirtRows(false, q.skirtSwing || 0).slice(0, 6), KEY, [J.hip[0], J.hip[1] + 1], SKIRT_HIP);
      RIG.place(buf, M.fur, J.tb, KEY, J.hip, J.tAnchor);
      RIG.place(buf, M.fur, WHEAD[q.face] || WHEAD.normal, KEY, J.neck, WHEAD_NECK);
      wolfArm(buf, J.shN, J.eN, J.hN, q);
      RIG.finish(buf, q, J, { rotUp: 10 });
    }
    if (q.smear) RIG.smear(buf, O, q, q.smear, q.reach || 14, q.smearKeys || ['hF', 'la']);
    if (root.FX && q.fx) { root.FX.draw(buf, O, q.fx, 'over'); root.FX.outlineFx(buf); }
    return opts.flip ? PX.flipX(buf) : buf;
  }
  function wolfArm(buf, sh, el, hd, q) {
    RIG.stroke(buf, M.fur, sh, el, 3.0);
    RIG.stroke(buf, M.fur, el, hd, 2.6);
    // claws: three bone spikes along the hand's direction
    const d = [hd[0] - el[0], hd[1] - el[1]], L = Math.hypot(d[0], d[1]) || 1, u = [d[0] / L, d[1] / L], n = [-u[1], u[0]];
    const cl = new Part(buf, M.claw);
    for (const s of [-2, 0, 2]) {
      const bx = hd[0] + 0.5 + n[0] * s, by = hd[1] + 0.5 + n[1] * s;
      PX.line(bx, by, bx + u[0] * (q.clawLen || 4), by + u[1] * (q.clawLen || 4), (x, y, i) => cl.add(x, y, { i }));
    }
    cl.commit((i) => (i.i === 0 ? 3 : 1));
    RIG.hand(buf, M.fur, hd, 3, (i) => (i.j === 0 ? 1 : i.j === 2 ? 3 : 2));
  }
  function wolfLeg(buf, hip, knee, foot) {
    RIG.stroke(buf, M.fur, hip, knee, 3.2);
    RIG.stroke(buf, M.fur, knee, [foot[0], foot[1] - 1], 2.5);
    RIG.place(buf, M.fur, PAW, KEY, foot, [2, 0]);
  }

  function boxes(pose) {
    const p = Object.assign({}, DEF, pose);
    if (p.form === 'wolf') { const q = Object.assign({}, WDEF, p); if (!pose.hip) q.hip = WDEF.hip; return RIG.boxes(RIG.solve(q, WSPEC, [0, 0]), WSPEC, q); }
    return RIG.boxes(RIG.solve(p, SPEC, [0, 0]), SPEC, p);
  }
  function anchors(pose) {
    const p = Object.assign({}, DEF, pose);
    const J = RIG.solve(p, SPEC, [0, 0]);
    return { headdress: [J.neck[0] - 2, J.neck[1] - 12], apron: [J.hip[0] + 2, J.hip[1] - 4], ribbon: [J.neck[0], J.neck[1] - 1], shoes: [J.fN[0], J.fN[1]] };
  }

  root.MAID = {
    id: 'maid', name: '狼人メイド', title: '狼人のメイド（偽娘）', en: 'WEREWOLF MAID', height: '165cm', tint: '#c9a6ff',
    M, KEY, HEAD, HEAD_NECK, TORSO, WHEAD, WTORSO, FOOT, SIZE, DEF, WDEF, SPEC, WSPEC, PARTS, render, boxes, anchors, skirtRows,
  };
})(typeof window !== 'undefined' ? window : globalThis);
