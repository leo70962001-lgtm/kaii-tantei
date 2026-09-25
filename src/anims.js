// anims.js — every fighter's moves, frame by frame. Shared movement (stance, walk, jump, crouch, block,
// hurt, knockdown, get up, win, lose) is built from a character's stance pose; attacks follow the
// seven beats STANCE → ANTICIPATION → SMEAR → HIT → FOLLOW THROUGH → RECOVER → OVERSHOOT.
// Frame fields read by the game: dur, dx (forward step on entry), lift (anim-driven height),
// hb [x0,y0,x1,y1] hit box in authored coords (+x forward, y up is negative, origin at the feet),
// dmg, stun (ms), kb (push), kbUp (launch), kd (knockdown), pd (part damage multiplier),
// chain (may chain into the next light/heavy), cancel (may cancel into the special),
// inv (invulnerable), air ('squat'|'rise'|'apex'|'fall'|'land'|'fly'|'lying' for physics-driven states),
// spawn (projectile id), ghost (afterimage), shake, sfx.
(function (root) {
  'use strict';
  const PX = root.PX;
  const { TAU } = PX;

  let hitSerial = 1;
  // longer legs and torsos: hips/knees/hit boxes/body effects move up by SHIFT_Y (half of it in crouches),
  // hands and elbows by SHIFT_Y + HAND_EXTRA (the taller torso lifts the shoulders)
  const K = 1.8; // KOF scale: every authored coordinate is multiplied on emit
  let SHIFT_Y = 0, HAND_EXTRA = 0;
  const JOINTS = ['hip', 'kN', 'kF', 'bat'], HANDS = ['hN', 'hF', 'eN', 'eF'];
  function shifted(pose) {
    if (!SHIFT_Y) return pose;
    const s = pose.hip && pose.hip[1] > -21 ? Math.round(SHIFT_Y / 2) : SHIFT_Y;
    const h = s + HAND_EXTRA;
    const o = Object.assign({}, pose);
    for (const k of JOINTS) if (Array.isArray(o[k])) o[k] = [o[k][0], o[k][1] + s];
    for (const k of HANDS) if (Array.isArray(o[k])) o[k] = [o[k][0], o[k][1] + h];
    if (o.smear) {
      const sm = Object.assign({}, o.smear);
      for (const w of ['from', 'to']) if (sm[w]) { sm[w] = Object.assign({}, sm[w]); for (const k of HANDS) if (Array.isArray(sm[w][k])) sm[w][k] = [sm[w][k][0], sm[w][k][1] + h]; }
      o.smear = sm;
    }
    if (o.fx) o.fx = o.fx.map((f) => { const g = Object.assign({}, f); if (typeof g.y === 'number' && g.y < -8) g.y += s; if (Array.isArray(g.c)) g.c = [g.c[0], g.c[1] + s]; return g; });
    o._s = s;
    return scaled(o);
  }
  const SC = (v) => Math.round(v * K);
  function scaled(o) {
    for (const k of [...JOINTS, ...HANDS, 'fN', 'fF']) if (Array.isArray(o[k])) o[k] = [SC(o[k][0]), SC(o[k][1])];
    if (typeof o.skirtSwing === 'number') o.skirtSwing = SC(o.skirtSwing);
    if (o.smear) { const sm = Object.assign({}, o.smear); for (const w of ['from', 'to']) if (sm[w]) { sm[w] = Object.assign({}, sm[w]); for (const k of HANDS) if (Array.isArray(sm[w][k])) sm[w][k] = [SC(sm[w][k][0]), SC(sm[w][k][1])]; } o.smear = sm; }
    if (o.fx) o.fx = o.fx.map((f) => { const g = Object.assign({}, f); for (const k of ['x', 'y', 'x0', 'x1', 'r', 'r0', 'r1', 'len', 'd', 'rx', 'ry', 'h', 'gap', 'w']) if (typeof g[k] === 'number') g[k] = k === 'w' ? Math.max(0, Math.round(g[k] * K)) : g[k] * K; if (Array.isArray(g.c)) g.c = [g.c[0] * K, g.c[1] * K]; if (typeof g.s === 'number') g.s = Math.round(g.s * 1.5); return g; });
    return o;
  }
  function seq(list, base, keys) {
    const out = [];
    let pose = Object.assign({}, base);
    let last = null;
    const pick = (p) => { const o = {}; for (const k of keys || []) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; return o; };
    const hitId = hitSerial++;
    for (const e of list) {
      const prev = pose;
      pose = Object.assign({}, pose, e.p || {});
      for (const k of ['hair', 'tail']) if (prev[k] || (e.p && e.p[k])) pose[k] = Object.assign({}, prev[k] || {}, (e.p && e.p[k]) || {});
      let smear = null;
      if (e.sm) { last = { from: pick(prev), to: pick(pose), shape: e.sm, mat: e.smat, inner: e.sinner }; smear = Object.assign({}, last, { age: 0 }); }
      else if (e.sa !== undefined && last) smear = Object.assign({}, last, { age: e.sa });
      const P = shifted(Object.assign({}, pose, { fx: e.fx || [], smear }));
      out.push({
        pose: P,
        dur: e.d || 50, dx: SC(e.dx || 0), lift: SC(e.lift || 0), ghost: !!e.ghost, shake: e.shake || 0, sfx: e.sfx,
        hb: e.hb ? [SC(e.hb[0]), SC(e.hb[1] + (P._s || 0)), SC(e.hb[2]), SC(e.hb[3] + (P._s || 0))] : null, dmg: e.dmg || 0, stun: e.stun || 0, kb: e.kb ?? 2, kbUp: e.kbUp || 0, kd: !!e.kd, pd: e.pd ?? 1,
        chain: !!e.chain, cancel: !!e.cancel, inv: !!e.inv, air: e.air, spawn: e.spawn, phase: e.ph, hitId: e.hb ? (e.hid ? hitId + e.hid * 1000 : hitId) : 0,
        form: e.form,
      });
    }
    return out;
  }
  const hitAt = (x, y, age = 0, seed = 1, mat) => ({ type: 'hitmark', x, y, age, seed, mat });
  const dust = (x, y, age, seed = 3) => ({ type: 'dust', x, y, r: 3, n: 3, age, flat: true, spread: 1.2, seed });
  const hp = (ph, more) => Object.assign({ phase: ph }, more || {});

  // ---------------------------------------------------------------- shared movement
  // feet on a stepping cycle: stride px, lift px, base offsets for the far and near foot
  function feetAt(ph, stride, lift, baseF, baseN) {
    const f = (q, base) => {
      q = ((q % 1) + 1) % 1;
      if (q < 0.5) return [Math.round(base + stride / 2 - stride * (q / 0.5)), -2];
      const s = (q - 0.5) / 0.5;
      return [Math.round(base - stride / 2 + stride * s), Math.round(-2 - lift * Math.sin(Math.PI * s))];
    };
    return { fF: f(ph, baseF), fN: f(ph + 0.5, baseN) };
  }
  function movement(S, V, keys) {
    const A = {};
    const hipY = S.hip[1];
    A.idle = { label: V.idleLabel || '構え', loop: true, frames: seq([
      { d: 220, p: { hair: hp(0), tail: hp(0) } },
      { d: 220, p: { hair: hp(0.25), tail: hp(0.25) } },
      { d: 220, p: Object.assign({ hip: [S.hip[0], hipY + 1], hair: hp(0.5), tail: hp(0.5) }, V.breath || {}) },
      { d: 220, p: { hair: hp(0.75), tail: hp(0.75) } },
    ], S, keys) };
    const walk = (back) => seq([0, 1, 2, 3, 4, 5].map((i) => {
      const ph = back ? 1 - i / 6 : i / 6;
      const ft = feetAt(ph, V.stride || 8, 3, S.fF[0], S.fN[0]);
      const sw = Math.cos(ph * TAU);
      return { d: 105, p: Object.assign({ hip: [S.hip[0], hipY - (i % 3 === 1 ? 1 : 0)], hair: hp(i / 6, { base: back ? (S.hair.base - 10) : S.hair.base + 14 }), tail: hp(i / 6), skirtSwing: Math.round(sw * 1.5) }, ft, V.walkHands ? V.walkHands(sw, back) : {}) };
    }), S, keys);
    A.walk = { label: '前進', loop: true, frames: walk(false) };
    A.back = { label: '後退', loop: true, frames: walk(true) };
    A.dash = { label: '衝刺', loop: true, frames: seq([0, 1, 2, 3].map((i) => {
      const ph = i / 4;
      const ft = feetAt(ph, 16, 6, 3, 3);
      return { d: 70, ghost: true, p: Object.assign({ hip: [1, hipY + 1 - (i % 2 ? 2 : 0)], lean: 3, head: [2, 0], hair: hp(i / 2, { base: S.hair.base + 60, droop: 120, wave: 1.4 }), tail: hp(i / 2, { base: 170 }) }, ft, V.dashHands || {}) };
    }), S, keys) };
    A.backdash = { label: '後跳', frames: seq([
      { d: 60, ghost: true, inv: true, p: Object.assign({ hip: [-2, hipY], lean: -2, fN: [-6, -4], fF: [6, -6], hair: hp(0.2, { base: S.hair.base - 40 }) }, V.blockPose || {}) },
      { d: 90, ghost: true, inv: true, p: { hip: [-2, hipY - 2], fN: [-4, -8], fF: [4, -8] } },
      { d: 80, p: Object.assign({}, S, { lean: 1, hair: hp(0.5) }) },
    ], S, keys) };
    // jump: the game drives height; frames are picked by the air tag
    const tuck = V.tuck || { fN: [-3, -8], fF: [5, -10] };
    A.jump = { label: '跳躍', frames: seq([
      { d: 70, air: 'squat', p: Object.assign({ hip: [0, hipY + 5], lean: 2, hair: hp(0, { base: S.hair.base + 20 }) }, V.squat || {}) },
      { d: 100, air: 'rise', ghost: true, p: Object.assign({ hip: [0, hipY - 1], lean: 0, fN: [-3, -3], fF: [4, -4], hair: hp(0.2, { base: S.hair.base - 10, droop: 40, wave: 0.6 }), tail: hp(0.2, { base: 120 }) }, V.rise || {}) },
      { d: 100, air: 'apex', p: Object.assign({ fN: tuck.fN, fF: tuck.fF, hair: hp(0.4, { base: S.hair.base + 30, droop: 60 }) }, V.apex || {}) },
      { d: 100, air: 'fall', p: Object.assign({ fN: [-5, -6], fF: [8, -6], hair: hp(0.6, { base: 60, droop: 30, wave: 1.2 }), tail: hp(0.6, { base: 100 }) }, V.fall || {}) },
      { d: 90, air: 'land', sfx: 'land', p: Object.assign({ hip: [0, hipY + 6], lean: 2, fN: [-9, -2], fF: [10, -2], hair: hp(0.8, { base: S.hair.base + 40, droop: 100, wave: 1.6 }) }, V.squat || {}), fx: [dust(0, -1, 0.15)] },
    ], S, keys) };
    A.crouch = { label: '蹲下', loop: true, frames: seq([{ d: 200, p: V.crouch }, { d: 200, p: Object.assign({}, V.crouch, { hip: [V.crouch.hip[0], V.crouch.hip[1] + 1] }) }], S, keys) };
    A.block = { label: '防禦', loop: true, frames: seq([{ d: 200, p: Object.assign({ lean: -1 }, V.blockPose || {}) }], S, keys) };
    A.blockLow = { label: '蹲防', loop: true, frames: seq([{ d: 200, p: Object.assign({}, V.crouch, V.blockLow || {}) }], S, keys) };
    A.blockHit = { label: '防禦', frames: seq([
      { d: 70, dx: -2, p: Object.assign({ lean: -2, hip: [-2, hipY] }, V.blockPose || {}) },
      { d: 90, dx: -1, p: Object.assign({ lean: -1, hip: [-1, hipY] }, V.blockPose || {}) },
    ], S, keys) };
    A.hurt = { label: '受傷', frames: seq([
      { d: 60, dx: -2, p: Object.assign({ flash: 1, lean: -3, hip: [-2, hipY], face: 'hurt', head: [-2, 1], hair: hp(0.2, { base: S.hair.base - 40, wave: 1.5 }) }, V.hurtPose || {}) },
      { d: 110, dx: -2, p: { flash: 0, hip: [-3, hipY + 1], hair: hp(0.4) } },
      { d: 110, dx: -1, p: { lean: -1, hip: [-1, hipY], hair: hp(0.6) } },
    ], S, keys) };
    A.hurtLow = { label: '受傷（下段）', frames: seq([
      { d: 60, dx: -1, p: Object.assign({}, V.crouch, { flash: 1, lean: (V.crouch.lean || 0) - 3, face: 'hurt', head: [-1, 1] }) },
      { d: 110, dx: -2, p: { flash: 0 } },
      { d: 110, dx: -1, p: {} },
    ], S, keys) };
    A.down = { label: '倒地', frames: seq([
      { d: 70, air: 'fly', ghost: true, p: Object.assign({ flash: 1, lean: -2, face: 'hurt', head: [-1, 0], hair: hp(0.1, { base: S.hair.base - 60, droop: 10, wave: 1.5 }) }, V.hurtPose || {}) },
      { d: 70, air: 'fly', ghost: true, p: { flash: 0, rot: -40, fF: [10, -8], fN: [4, -6] } },
      { d: 80, air: 'fly', ghost: true, p: { rot: -75, hair: hp(0.3, { base: 20 }) } },
      { d: 90, air: 'land', sfx: 'slam', shake: 2, lift: -16, p: { rot: -90, hair: hp(0.5, { base: 0, droop: 0, wave: 0.4 }) }, fx: [dust(-14, 14, 0.15, 4)] },
      { d: 90, air: 'land', lift: -14, p: { rot: -84 }, fx: [dust(-14, 14, 0.6, 4)] },
      { d: 400, air: 'lying', lift: -16, inv: true, p: { rot: -90, face: 'calm', flash: 0 } },
    ], S, keys) };
    A.getup = { label: '起身', frames: seq([
      { d: 120, inv: true, lift: -12, p: { rot: -60, face: 'hurt', fN: [-6, -4], fF: [6, -6], hair: hp(0.2, { base: 40, droop: 60 }) } },
      { d: 110, inv: true, lift: -4, p: Object.assign({ rot: -20 }, V.crouch, { face: 'normal' }) },
      { d: 110, inv: true, lift: 0, p: Object.assign({}, S, { lean: 1, hair: hp(0.5) }) },
    ], S, keys) };
    A.lose = { label: '敗北', loop: true, frames: seq([{ d: 300, p: V.losePose || V.crouch }, { d: 300, p: Object.assign({}, V.losePose || V.crouch, { hair: hp(0.5) }) }], S, keys) };
    A.win = { label: '勝利', loopFrom: V.win ? V.win.loopFrom : 0, frames: seq(V.win ? V.win.frames : [{ d: 300, p: {} }], S, keys) };
    A.stagger = { label: '暈眩', loop: true, frames: seq([
      { d: 160, p: Object.assign({ lean: -1, head: [-1, 1], face: 'hurt', hip: [-1, hipY + 1] }, V.hurtPose || {}) },
      { d: 160, p: { lean: 1, head: [1, 1], hip: [1, hipY + 1] } },
    ], S, keys) };
    return A;
  }

  // ================================================================ 改造人間 JK
  const JK_S = {
    hip: [0, -27], lean: 0, fN: [-9, -2], fF: [11, -2], feetN: 'flat', feetF: 'flat',
    hN: [-4, -27], hF: [11, -28], sw: 25, grip: 'F', swordLayer: 'back', noBlade: false, face: 'normal', head: [0, 0], rot: 0,
    hair: { base: 106, droop: 92, wave: 1, phase: 0, len: 32 }, tail: {},
  };
  const JK_KEYS = ['hF', 'sw'];
  function jkAnims() {
    SHIFT_Y = -11; HAND_EXTRA = -2;
    const V = {
      stride: 9,
      breath: { hF: [11, -27], sw: 27 },
      walkHands: (sw) => ({ hN: [-4 + Math.round(sw), -27] }),
      dashHands: { hN: [-8, -24], hF: [6, -24], sw: 170 },
      crouch: { hip: [1, -16], lean: 3, fN: [-10, -2], fF: [12, -2], hN: [-4, -16], hF: [10, -19], sw: 160, swordLayer: 'back', head: [1, 1] },
      blockPose: { hF: [10, -31], sw: -92, swordLayer: 'front', hN: [4, -30], head: [-1, 0] },
      blockLow: { hF: [10, -22], sw: -95, swordLayer: 'front', hN: [2, -20] },
      hurtPose: { hF: [9, -32], sw: -25, hN: [-8, -30] },
      tuck: { fN: [-3, -9], fF: [6, -11] },
      rise: { hF: [10, -32], sw: 200 },
      losePose: { hip: [0, -12], lean: 2, fN: [-12, -2], fF: [9, -2], kF: [6, -10], hN: [-2, -12], hF: [12, -14], sw: 175, head: [1, 3], face: 'calm', swordLayer: 'front' },
      win: { loopFrom: 4, frames: [
        { d: 100, p: { hF: [16, -34], sw: -10, swordLayer: 'front' } },
        { d: 50, sm: 'crescent', sfx: 'swish', p: { hF: [16, -20], sw: 95 } },
        { d: 200, sa: 0.7, p: {} },
        { d: 140, p: { hF: [5, -22], sw: 155, hN: [2, -21] } },
        { d: 260, sfx: 'click', p: { grip: 'S', hip: [0, -27], fF: [5, -2], fN: [-4, -2], hF: [6, -23], hN: [-6, -23], face: 'calm', hair: hp(0.3) }, fx: [{ type: 'glint', x: 3, y: -24, s: 3 }] },
        { d: 260, p: { hair: hp(0.6) } },
        { d: 260, p: { face: 'normal', hair: hp(0.9) } },
      ] },
    };
    const A = movement(JK_S, V, JK_KEYS);
    const S = JK_S, K = JK_KEYS;
    // 小斬: one hand, horizontal
    A.light = { label: '小斬', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: { hF: [6, -37], sw: -100, swordLayer: 'front', lean: -1, hair: hp(0.1, { base: 96 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [10, -44, 44, -18], dmg: 6, stun: 280, kb: 2.5, p: { hip: [2, -26], fF: [12, -2], hF: [17, -27], sw: 20, lean: 2, head: [2, 0], face: 'shout', noBlade: true, hair: hp(0.25, { base: 150, droop: 100 }) } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [10, -44, 44, -18], dmg: 6, stun: 280, kb: 2.5, p: { hF: [18, -24], sw: 42, noBlade: false, hair: hp(0.4) } },
      { d: 50, ph: 'FOLLOW THROUGH', sa: 0.8, chain: true, cancel: true, p: { hF: [16, -20], sw: 65, face: 'normal', hair: hp(0.5) } },
      { d: 70, ph: 'RECOVER', chain: true, cancel: true, p: { hip: [1, -27], fF: [10, -2], hF: [13, -27], sw: 8, lean: 1, head: [1, 0], swordLayer: 'back', hair: hp(0.65, { base: 110 }) } },
      { d: 50, ph: 'OVERSHOOT', p: { hip: [0, -27], fF: [8, -2], hF: [12, -29], sw: -5, lean: 0, hair: hp(0.8) } },
    ], S, K), next: 'light2' };
    // 返し斬: the return cut, upward
    A.light2 = { label: '返し斬', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hF: [16, -18], sw: 72, swordLayer: 'front', lean: 1, hair: hp(0.1, { base: 120 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [8, -52, 42, -16], dmg: 7, stun: 300, kb: 3, p: { hip: [3, -26], fF: [13, -2], hF: [15, -30], sw: -30, face: 'shout', noBlade: true, lean: 2, head: [2, 0], hair: hp(0.25, { base: 150 }) } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [8, -52, 42, -16], dmg: 7, stun: 300, kb: 3, p: { hF: [12, -36], sw: -62, noBlade: false, hair: hp(0.4) } },
      { d: 60, ph: 'FOLLOW THROUGH', sa: 0.8, cancel: true, p: { hF: [8, -38], sw: -96, face: 'normal', hair: hp(0.55) } },
      { d: 90, ph: 'RECOVER', p: { hip: [1, -27], fF: [9, -2], hF: [12, -29], sw: -2, lean: 0, head: [0, 0], swordLayer: 'back', hair: hp(0.7, { base: 106 }) } },
    ], S, K) };
    // 義手ストレート: the steel arm's straight punch
    A.heavy = { label: '義手ストレート', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { hN: [-10, -31], eN: [-9, -36], lean: -2, hip: [-1, -27], face: 'shout', head: [-1, 0], hair: hp(0.1, { base: 90 }) }, fx: [{ type: 'bolt', x: -10, y: -31, r: 2, len: 5, n: 3, a0: -180, a1: 180, age: 0.3, seed: 9, mat: 'ice' }] },
      { d: 60, ph: 'HIT', ghost: true, sfx: 'heavy', shake: 2, hb: [12, -40, 34, -22], dmg: 10, stun: 340, kb: 4, pd: 1.6, p: { hip: [7, -25], lean: 3, fF: [19, -2], fN: [-15, -2], hN: [26, -31], head: [3, 0], hair: hp(0.3, { base: 165, droop: 100, wave: 1.8 }) }, fx: [hitAt(32, -31, 0, 4, 'ice'), { type: 'bolt', x: 32, y: -31, r: 6, len: 10, n: 5, a0: -150, a1: 60, age: 0.1, seed: 3, mat: 'ice' }] },
      { d: 90, ph: 'HOLD', hb: [12, -40, 34, -22], dmg: 10, stun: 340, kb: 4, pd: 1.6, p: { hair: hp(0.45) }, fx: [hitAt(32, -31, 0.5, 4, 'ice'), { type: 'bolt', x: 32, y: -31, r: 8, len: 9, n: 4, a0: -150, a1: 60, age: 0.5, seed: 5, mat: 'ice' }] },
      { d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { hN: [21, -31], face: 'normal', hair: hp(0.55) } },
      { d: 90, ph: 'RECOVER', chain: true, p: { hN: [6, -29], lean: 1, hip: [2, -27], fF: [11, -2], head: [1, 0], hair: hp(0.7, { base: 112 }) } },
      { d: 60, ph: 'OVERSHOOT', p: { hN: [-4, -27], lean: 0, hip: [0, -27], fF: [8, -2], hair: hp(0.85) } },
    ], S, K), next: 'heavy2', altWhenBroken: { arm: 'bump' } };
    // 肩タックル: what is left of the punch when the arm is gone
    A.bump = { label: '肩タックル', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { lean: -2, hip: [-1, -27], face: 'shout', head: [-1, 0] } },
      { d: 60, ph: 'HIT', ghost: true, dx: 6, sfx: 'heavy', shake: 1, hb: [4, -40, 22, -18], dmg: 6, stun: 300, kb: 4, pd: 1.2, p: { hip: [4, -25], lean: 3, fF: [14, -2], fN: [-6, -2], hN: [4, -30], head: [2, 0], hair: hp(0.3, { base: 160 }) }, fx: [hitAt(20, -30, 0, 4)] },
      { d: 90, ph: 'HOLD', hb: [4, -40, 22, -18], dmg: 6, stun: 300, kb: 4, pd: 1.2, p: {} },
      { d: 120, ph: 'RECOVER', chain: true, p: { hN: [-4, -27], lean: 0, hip: [0, -27], fF: [8, -2], hair: hp(0.7) } },
    ], S, K), next: 'heavy2' };
    // 袈裟斬: two hands, over the shoulder, a lunge
    A.heavy2 = { label: '袈裟斬', frames: seq([
      { d: 110, ph: 'ANTICIPATION', p: { grip: 'B', hF: [3, -42], hN: [1, -40], sw: -135, lean: -2, hip: [-1, -27], fF: [10, -4], head: [0, 0], swordLayer: 'front', hair: hp(0.1, { base: 92 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', shake: 2, hb: [10, -50, 46, -8], dmg: 12, stun: 420, kb: 4, pd: 1.4, p: { hip: [6, -24], fF: [21, -2], fN: [-15, -2], hF: [21, -22], hN: [18, -25], sw: 42, lean: 3, head: [2, 1], face: 'shout', noBlade: true, hair: hp(0.3, { base: 170, droop: 100, wave: 1.8 }) } },
      { d: 100, ph: 'HIT', sa: 0.42, hb: [10, -50, 46, -8], dmg: 12, stun: 420, kb: 4, pd: 1.4, p: { hF: [19, -17], hN: [16, -20], sw: 66, noBlade: false, hair: hp(0.45) }, fx: [{ type: 'bolt', x: 36, y: -26, r: 5, len: 8, n: 3, a0: -120, a1: 40, age: 0.2, seed: 3 }] },
      { d: 60, ph: 'FOLLOW THROUGH', sa: 0.8, chain: true, cancel: true, p: { hF: [17, -13], hN: [14, -16], sw: 86, face: 'normal', hair: hp(0.55) } },
      { d: 80, ph: 'RECOVER', chain: true, p: { grip: 'F', hip: [1, -26], fF: [11, -2], fN: [-9, -2], hF: [13, -27], hN: [-4, -27], sw: 18, lean: 1, head: [1, 0], swordLayer: 'back', hair: hp(0.7, { base: 110 }) } },
      { d: 60, ph: 'OVERSHOOT', p: { hip: [0, -27], fF: [8, -2], hF: [12, -29], sw: 2, lean: 0, hair: hp(0.85) } },
    ], S, K), next: 'heavy3' };
    // 回天斬: jump, one full turn inside a ring, land — launches
    const ring = (a, age) => ({ type: 'arc', c: [2, -36], r0: 12, r1: 27, a0: a - 300, a1: a, age });
    A.heavy3 = { label: '回天斬', frames: seq([
      { d: 80, ph: 'ANTICIPATION', lift: 3, p: { grip: 'B', hip: [1, -24], lean: -1, fF: [10, -5], fN: [-6, -4], hF: [5, -40], hN: [2, -38], sw: -105, face: 'shout', swordLayer: 'front', hair: hp(0.1, { base: 100, droop: 60 }) } },
      { d: 45, ph: 'SMEAR', lift: 14, ghost: true, sfx: 'swish', p: { rot: 110, hip: [1, -27], fF: [5, -12], fN: [-2, -10], hF: [15, -32], hN: [12, -30], sw: -20, noBlade: true, hair: hp(0.25, { base: 200, droop: 0 }) }, fx: [ring(-20, 0)] },
      { d: 45, lift: 20, ghost: true, sfx: 'swish', p: { rot: 220 }, fx: [ring(90, 0)] },
      { d: 45, lift: 20, ghost: true, p: { rot: 330 }, fx: [ring(200, 0.1)] },
      { d: 90, ph: 'HIT', lift: 14, hb: [-12, -62, 40, -10], dmg: 14, stun: 500, kb: 5, kbUp: 6, kd: true, pd: 1.5, shake: 2, p: { rot: 0, lean: 2, hF: [17, -24], hN: [14, -22], sw: 40, noBlade: false, fF: [8, -8], fN: [-5, -6], hair: hp(0.6, { base: 190, droop: 0 }) }, fx: [ring(260, 0.45), hitAt(30, -32, 0, 9)] },
      { d: 60, ph: 'FOLLOW THROUGH', lift: 6, p: { hF: [16, -20], hN: [13, -18], sw: 62, hair: hp(0.75, { base: 205, droop: 10 }) }, fx: [ring(260, 0.8), hitAt(30, -32, 0.5, 9)] },
      { d: 100, ph: 'RECOVER', lift: 0, sfx: 'land', shake: 1, p: { hip: [2, -20], lean: 3, fF: [13, -2], fN: [-9, -2], hF: [17, -17], hN: [8, -18], sw: 70, face: 'normal', swordLayer: 'front', hair: hp(0.9, { base: 175, droop: 60 }) }, fx: [dust(1, -1, 0.15, 9)] },
      { d: 70, ph: 'OVERSHOOT', p: { grip: 'F', hip: [0, -27], lean: 0, fF: [8, -2], fN: [-8, -2], hF: [12, -29], hN: [-4, -27], sw: 0, swordLayer: 'back', hair: hp(1.05, { base: 106, droop: 92 }) } },
    ], S, K) };
    // 居合・一閃: sheathe, a hidden dash, and the cut lands behind
    const glint = (s) => ({ type: 'glint', x: 6, y: -24, s });
    const burst = (a) => [
      { type: 'arc', c: [-36, -30], r0: 4, r1: 18, a0: 200, a1: 340, age: a, mat: 'dark' },
      { type: 'arc', c: [-36, -30], r0: 4, r1: 18, a0: 20, a1: 160, age: a, mat: 'dark' },
      { type: 'chips', x: -36, y: -30, d: 14, n: 10, a0: -180, a1: 180, age: 0.2 + a, seed: 4, mat: 'fire' },
    ];
    A.special = { label: '居合・一閃', frames: seq([
      { d: 80, p: { hF: [5, -24], sw: 155, hair: hp(0.1) } },
      { d: 110, sfx: 'click', p: { grip: 'S', hip: [1, -18], lean: 3, fF: [13, -2], fN: [-12, -2], hF: [6, -21], hN: [3, -20], head: [2, 1], hair: hp(0.3, { base: 150, droop: 80, wave: 1.5 }) } },
      { d: 90, p: { hair: hp(0.55, { wave: 1.8 }) }, fx: [glint(2)] },
      { d: 90, sfx: 'charge', p: { hair: hp(0.8) }, fx: [glint(4)] },
      { d: 45, dx: 72, sfx: 'dash', inv: true, p: { hidden: true }, fx: [{ type: 'streak', x0: -80, x1: 12, y: -30, w: 2, taper: true }] },
      { d: 60, ghost: true, hb: [-76, -46, 8, -8], dmg: 18, stun: 600, kb: 3, kbUp: 4, kd: true, pd: 2, p: { hidden: false, grip: 'F', hip: [3, -19], lean: 3, fF: [15, -2], fN: [-13, -2], hF: [19, -28], sw: -6, hN: [-8, -20], swordLayer: 'front', face: 'shout', hair: hp(1.3, { base: 182, droop: 30, wave: 1.2 }) }, fx: [{ type: 'streak', x0: -80, x1: 10, y: -30, w: 1, under: true }] },
      { d: 120, p: { hair: hp(1.5, { base: 176, droop: 40 }) }, fx: [{ type: 'streak', x0: -80, x1: 10, y: -30, w: 0, dither: true, under: true }] },
      { d: 90, sfx: 'burst', shake: 3, p: { face: 'normal', hair: hp(1.7) }, fx: [...burst(0), { type: 'bolt', x: -36, y: -30, r: 7, len: 9, n: 5, age: 0.1, seed: 8, mat: 'dark' }] },
      { d: 90, shake: 1, p: { hair: hp(1.9) }, fx: burst(0.55) },
      { d: 60, sm: 'crescent', sfx: 'swish', p: { hF: [17, -20], sw: 70, hair: hp(2.05) } },
      { d: 100, sa: 0.7, p: { hair: hp(2.2) } },
      { d: 110, p: { hF: [5, -23], sw: 155, hip: [0, -25], lean: 1, swordLayer: 'back', hN: [-7, -26], hair: hp(2.4, { base: 120, droop: 92, wave: 1 }) } },
      { d: 80, p: Object.assign({}, S, { hair: hp(2.6) }) },
    ], S, K) };
    // 空中斬
    A.air = { label: '空中斬', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hF: [8, -42], sw: -120, swordLayer: 'front', fN: [-3, -9], fF: [6, -11], hair: hp(0.2, { base: 40, droop: 30 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [6, -44, 40, -4], dmg: 8, stun: 320, kb: 3, p: { hF: [16, -24], sw: 55, face: 'shout', noBlade: true, lean: 2, hair: hp(0.35) } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [6, -44, 40, -4], dmg: 8, stun: 320, kb: 3, p: { hF: [15, -18], sw: 75, noBlade: false } },
      { d: 260, ph: 'FOLLOW THROUGH', sa: 0.8, p: { face: 'normal' } },
    ], S, K) };
    // 足払い
    A.crouchLight = { label: '足払い', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: Object.assign({}, V.crouch, { hF: [-2, -20], sw: 190, swordLayer: 'back', hair: hp(0.1, { base: 120 }) }) },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [6, -16, 42, 0], dmg: 6, stun: 320, kb: 3, kd: true, p: Object.assign({}, V.crouch, { hip: [3, -15], hF: [18, -14], sw: 10, noBlade: true, face: 'shout', swordLayer: 'front', hair: hp(0.3, { base: 150 }) }) },
      { d: 90, ph: 'HIT', sa: 0.45, hb: [6, -16, 42, 0], dmg: 6, stun: 320, kb: 3, kd: true, p: { hF: [19, -12], sw: 24, noBlade: false } },
      { d: 120, ph: 'RECOVER', sa: 0.8, p: Object.assign({}, V.crouch, { face: 'normal', hair: hp(0.6) }) },
    ], S, K) };
    return A;
  }

  // ================================================================ 吸血鬼ニート
  const V_S = {
    hip: [0, -24], lean: 0, fN: [-8, -2], fF: [9, -2], feetN: 'slip', feetF: 'slip',
    hN: [8, -26], hF: [10, -25], la: 0, lapOpen: false, lapLayer: 'front', noLap: false, face: 'normal', head: [0, 0], rot: 0,
    bat: [-14, -44], flap: 0, hair: { base: 110, droop: 92, wave: 1.6, phase: 0, len: 26 }, tail: {},
  };
  const V_KEYS = ['hN', 'la'];
  function vampAnims() {
    SHIFT_Y = -10; HAND_EXTRA = -2;
    const V = {
      stride: 7, idleLabel: 'だるい構え',
      breath: { hN: [8, -25], hF: [10, -24], flap: 1, bat: [-14, -46] },
      walkHands: (sw) => ({ hN: [8 + Math.round(sw), -26], hF: [10 + Math.round(sw), -25], flap: sw > 0 ? 1 : 0 }),
      dashHands: { hN: [10, -24], hF: [12, -23], la: 10, flap: 1 },
      crouch: { hip: [0, -15], lean: 2, fN: [-9, -2], fF: [10, -2], hN: [6, -18], hF: [8, -17], la: 0, head: [1, 1], bat: [-14, -34] },
      blockPose: { hN: [10, -34], hF: [8, -30], la: -90, head: [-1, 0] },
      blockLow: { hN: [9, -22], hF: [7, -19], la: -90 },
      hurtPose: { hN: [4, -30], hF: [2, -28], la: -30, flap: 1 },
      tuck: { fN: [-3, -8], fF: [5, -9] },
      rise: { hN: [8, -30], hF: [10, -29], la: -20, flap: 1 },
      losePose: { hip: [0, -11], lean: 1, fN: [-11, -2], fF: [8, -2], kF: [5, -9], hN: [4, -12], hF: [6, -11], la: 0, head: [0, 3], face: 'calm', bat: [-12, -30], flap: 0 },
      win: { loopFrom: 2, frames: [
        { d: 160, p: { lapOpen: true, hN: [8, -30], hF: [10, -30], la: 5, face: 'grin', bat: [-8, -48], flap: 1 } },
        { d: 160, p: { bat: [-10, -50], flap: 0, hair: hp(0.2) } },
        { d: 240, p: { hip: [0, -25], bat: [-9, -49], flap: 1, hair: hp(0.4) } },
        { d: 240, p: { hip: [0, -24], bat: [-10, -51], flap: 0, hair: hp(0.7) } },
      ] },
    };
    const A = movement(V_S, V, V_KEYS);
    const S = V_S, K = V_KEYS;
    A.light = { label: 'ノートPC横振り', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: { hN: [2, -34], hF: [0, -31], la: -140, lapLayer: 'back', lean: -1, head: [-1, 0], hair: hp(0.1, { base: 100 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [8, -40, 36, -16], dmg: 6, stun: 280, kb: 2.5, p: { hip: [2, -23], fF: [11, -2], hN: [16, -28], hF: [12, -27], la: -10, lapLayer: 'front', lean: 2, face: 'shout', head: [2, 0], hair: hp(0.25, { base: 150 }), flap: 1 } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [8, -40, 36, -16], dmg: 6, stun: 280, kb: 2.5, p: { hN: [17, -26], hF: [13, -25], la: 12, hair: hp(0.4) } },
      { d: 50, ph: 'FOLLOW THROUGH', sa: 0.8, chain: true, cancel: true, p: { hN: [16, -24], la: 30, face: 'normal', hair: hp(0.5) } },
      { d: 80, ph: 'RECOVER', chain: true, cancel: true, p: { hip: [1, -24], fF: [9, -2], hN: [10, -26], hF: [11, -25], la: 5, lean: 0, head: [0, 0], hair: hp(0.65, { base: 110 }) } },
      { d: 50, ph: 'OVERSHOOT', p: Object.assign({}, S, { hair: hp(0.8) }) },
    ], S, K), next: 'light2', altWhenBroken: { laptop: 'bite' } };
    A.light2 = { label: '返し振り', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hN: [17, -22], hF: [13, -22], la: 40, lean: 1, hair: hp(0.1, { base: 120 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [6, -48, 34, -14], dmg: 7, stun: 300, kb: 3, p: { hip: [3, -23], fF: [12, -2], hN: [12, -34], hF: [8, -33], la: -60, face: 'shout', lean: 2, hair: hp(0.25, { base: 150 }) } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [6, -48, 34, -14], dmg: 7, stun: 300, kb: 3, p: { hN: [8, -38], hF: [4, -36], la: -100, hair: hp(0.4) } },
      { d: 60, ph: 'FOLLOW THROUGH', sa: 0.8, cancel: true, p: { face: 'normal', hair: hp(0.55) } },
      { d: 90, ph: 'RECOVER', p: Object.assign({}, S, { lean: 0, hair: hp(0.7) }) },
    ], S, K), altWhenBroken: { laptop: 'bite' } };
    A.bite = { label: '噛みつき', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: { hip: [-1, -23], lean: -2, head: [-1, 0], face: 'rage', hN: [4, -28], hF: [2, -27], noLap: true, hair: hp(0.1, { base: 100 }) } },
      { d: 50, ph: 'HIT', ghost: true, dx: 5, sfx: 'swish', hb: [6, -44, 26, -24], dmg: 7, stun: 300, kb: 3, pd: 1.3, p: { hip: [5, -22], lean: 5, head: [4, 2], face: 'rage', hN: [14, -26], hF: [12, -24], hair: hp(0.3, { base: 160 }), flap: 1 }, fx: [hitAt(20, -34, 0, 6, 'fire')] },
      { d: 80, ph: 'HOLD', hb: [6, -44, 26, -24], dmg: 7, stun: 300, kb: 3, pd: 1.3, p: {}, fx: [hitAt(20, -34, 0.5, 6, 'fire')] },
      { d: 90, ph: 'RECOVER', chain: true, cancel: true, p: { hip: [1, -24], lean: 1, head: [1, 0], hN: [8, -26], hF: [10, -25], noLap: false, hair: hp(0.6) } },
      { d: 50, p: Object.assign({}, S, { face: 'rage' }) },
    ], S, K), next: 'bite' };
    A.heavy = { label: 'ノートPC叩きつけ', frames: seq([
      { d: 110, ph: 'ANTICIPATION', p: { hN: [6, -44], hF: [3, -42], la: -100, lean: -2, hip: [-1, -24], head: [-1, 0], face: 'shout', hair: hp(0.1, { base: 90 }), flap: 1 } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'heavy', shake: 3, hb: [6, -32, 34, 0], dmg: 12, stun: 420, kb: 4, kd: true, pd: 1.5, p: { hip: [5, -21], lean: 5, fF: [17, -2], fN: [-12, -2], hN: [20, -12], hF: [16, -11], la: 62, head: [3, 2], hair: hp(0.3, { base: 170, droop: 100, wave: 2 }) } },
      { d: 120, ph: 'HIT', sa: 0.42, hb: [6, -32, 34, 0], dmg: 12, stun: 420, kb: 4, kd: true, pd: 1.5, p: { hN: [19, -10], hF: [15, -9], la: 75, hair: hp(0.45) }, fx: [dust(24, -1, 0.15, 5), { type: 'bolt', x: 26, y: -8, r: 5, len: 8, n: 3, a0: -150, a1: -30, age: 0.2, seed: 3 }] },
      { d: 80, ph: 'FOLLOW THROUGH', sa: 0.8, chain: true, cancel: true, p: { face: 'normal', hair: hp(0.55) }, fx: [dust(24, -1, 0.6, 5)] },
      { d: 110, ph: 'RECOVER', p: { hip: [1, -24], lean: 1, fF: [9, -2], hN: [10, -26], hF: [11, -25], la: 5, head: [0, 0], hair: hp(0.7, { base: 110 }) } },
      { d: 60, ph: 'OVERSHOOT', p: Object.assign({}, S, { hair: hp(0.85) }) },
    ], S, K), next: 'heavy2', altWhenBroken: { laptop: 'claw' } };
    A.claw = { label: '引っ掻き', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { hN: [-6, -30], hF: [-4, -34], noLap: true, lean: -2, hip: [-1, -24], face: 'rage', head: [-1, 0], hair: hp(0.1, { base: 90 }) } },
      { d: 50, ph: 'HIT', ghost: true, dx: 4, sfx: 'swish', shake: 2, hb: [6, -42, 30, -14], dmg: 10, stun: 380, kb: 4, pd: 1.6, p: { hip: [4, -22], lean: 4, fF: [14, -2], hN: [20, -26], hF: [18, -32], head: [2, 1], hair: hp(0.3, { base: 165 }), flap: 1 }, fx: [{ type: 'arc', c: [14, -28], r0: 6, r1: 18, a0: -80, a1: 60, age: 0, mat: 'dark' }] },
      { d: 100, ph: 'HOLD', hb: [6, -42, 30, -14], dmg: 10, stun: 380, kb: 4, pd: 1.6, p: {}, fx: [{ type: 'arc', c: [14, -28], r0: 6, r1: 18, a0: -80, a1: 60, age: 0.5, mat: 'dark' }] },
      { d: 120, ph: 'RECOVER', chain: true, p: { hip: [1, -24], lean: 1, fF: [9, -2], hN: [8, -26], hF: [10, -25], noLap: false, head: [0, 0], hair: hp(0.7) } },
      { d: 60, p: Object.assign({}, S, { face: 'rage' }) },
    ], S, K), next: 'heavy2' };
    // 蝙蝠猫バイト: the familiar dives
    A.heavy2 = { label: '使い魔バイト', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { bat: [-8, -46], flap: 1, hN: [12, -30], la: 10, face: 'grin', hair: hp(0.1) } },
      { d: 60, ghost: true, p: { bat: [8, -38], flap: 0, hair: hp(0.25) } },
      { d: 100, ph: 'HIT', sfx: 'swish', hb: [14, -42, 34, -22], dmg: 8, stun: 320, kb: 3, pd: 1.3, p: { bat: [24, -32], flap: 1, hair: hp(0.4) }, fx: [hitAt(30, -32, 0, 7, 'fire')] },
      { d: 80, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { bat: [22, -34], flap: 0, face: 'normal', hair: hp(0.55) }, fx: [hitAt(30, -32, 0.5, 7, 'fire')] },
      { d: 80, ph: 'RECOVER', p: { bat: [6, -42], flap: 1, hair: hp(0.7) } },
      { d: 80, p: { bat: [-12, -45], flap: 0, hN: [8, -26], la: 0, hair: hp(0.85) } },
    ], S, K) };
    // 使い魔発射: the laptop opens and the bat-cat flies as a projectile
    A.special = { label: '使い魔発射', frames: seq([
      { d: 140, ph: 'ANTICIPATION', sfx: 'charge', p: { lapOpen: true, hN: [10, -30], hF: [12, -30], la: 4, face: 'grin', bat: [-4, -48], flap: 1, hair: hp(0.1, { base: 100 }) }, fx: [{ type: 'glint', x: 12, y: -40, s: 3, mat: 'ice' }] },
      { d: 90, p: { bat: [6, -42], flap: 0, hair: hp(0.3) }, fx: [{ type: 'glint', x: 12, y: -40, s: 4, mat: 'ice' }] },
      { d: 60, ph: 'FIRE', spawn: 'bat', ghost: true, sfx: 'dash', shake: 1, p: { bat: [18, -36], flap: 1, noBat: true, hip: [-1, -24], lean: -1, hair: hp(0.45, { base: 80 }) }, fx: [{ type: 'streak', x0: 8, x1: 40, y: -36, w: 1, taper: true, mat: 'ice' }] },
      { d: 220, ph: 'RECOVER', p: { noBat: true, lapOpen: true, lean: 0, hair: hp(0.6) } },
      { d: 80, p: Object.assign({}, S, { noBat: true, hair: hp(0.8) }) },
    ], S, K) };
    A.air = { label: '空中振り', frames: seq([
      { d: 50, ph: 'ANTICIPATION', p: { hN: [4, -38], hF: [2, -36], la: -120, lapLayer: 'front', fN: [-3, -8], fF: [5, -9], hair: hp(0.2, { base: 40 }) } },
      { d: 40, ph: 'SMEAR', sm: 'fan', sfx: 'swish', hb: [6, -40, 34, -4], dmg: 7, stun: 300, kb: 3, p: { hN: [16, -24], hF: [12, -22], la: 40, face: 'shout', lean: 2 } },
      { d: 80, ph: 'HIT', sa: 0.45, hb: [6, -40, 34, -4], dmg: 7, stun: 300, kb: 3, p: { hN: [15, -20], la: 60 } },
      { d: 260, ph: 'FOLLOW THROUGH', sa: 0.8, p: { face: 'normal' } },
    ], S, K) };
    A.crouchLight = { label: 'スリッパ蹴り', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: Object.assign({}, V.crouch, { fN: [-11, -2], hair: hp(0.1) }) },
      { d: 50, ph: 'HIT', ghost: true, sfx: 'swish', hb: [6, -14, 28, 0], dmg: 5, stun: 260, kb: 3, p: Object.assign({}, V.crouch, { hip: [2, -14], fN: [18, -4], kN: [8, -10], face: 'shout', hair: hp(0.3, { base: 150 }) }) },
      { d: 90, ph: 'HOLD', hb: [6, -14, 28, 0], dmg: 5, stun: 260, kb: 3, p: {} },
      { d: 110, ph: 'RECOVER', chain: true, p: Object.assign({}, V.crouch, { face: 'normal', hair: hp(0.6) }) },
    ], S, K) };
    return A;
  }

  // ================================================================ 狼人メイド + 狼
  const M_S = {
    hip: [0, -26], lean: 0, fN: [-8, -2], fF: [9, -2], feetN: 'shoe', feetF: 'shoe',
    hN: [-3, -28], hF: [9, -30], la: 0, form: 'maid', face: 'normal', head: [0, 0], rot: 0,
    hair: { base: 100, droop: 92, wave: 1, phase: 0, len: 12 }, tail: { base: 150, droop: 120, wave: 1.2, phase: 0, len: 20 },
  };
  const W_S = Object.assign({}, M_S, { form: 'wolf', hip: [0, -28], lean: 3, fN: [-10, -2], fF: [11, -2], hN: [3, -18], hF: [13, -26] });
  const M_KEYS = ['hF', 'la', 'hN', 'fF'];
  function maidAnims() {
    SHIFT_Y = -11; HAND_EXTRA = -3;
    const V = {
      stride: 8, idleLabel: '待機',
      breath: { hN: [-3, -27], hF: [9, -29] },
      walkHands: (sw) => ({ hN: [-3 - Math.round(sw * 2), -28], hF: [9 + Math.round(sw * 2), -30] }),
      dashHands: { hN: [-8, -26], hF: [6, -27] },
      crouch: { hip: [0, -16], lean: 3, fN: [-9, -2], fF: [11, -2], hN: [-2, -18], hF: [8, -20], head: [1, 1] },
      blockPose: { hN: [7, -34], hF: [9, -32], head: [-1, 0] },
      blockLow: { hN: [6, -22], hF: [8, -20] },
      hurtPose: { hN: [-6, -32], hF: [4, -34] },
      tuck: { fN: [-3, -8], fF: [5, -10] },
      rise: { hN: [-6, -30], hF: [10, -34] },
      losePose: { hip: [0, -12], lean: 2, fN: [-11, -2], fF: [8, -2], kF: [5, -10], hN: [-4, -14], hF: [8, -14], head: [1, 3], face: 'calm' },
      win: { loopFrom: 1, frames: [
        { d: 200, p: { hN: [-2, -30], hF: [8, -30], hip: [0, -24], lean: 4, head: [2, 3], face: 'calm' } },
        { d: 300, p: { hN: [-4, -28], hF: [8, -29], hip: [0, -26], lean: 0, head: [0, 0], face: 'normal', hair: hp(0.3) } },
        { d: 300, p: { face: 'grin', hair: hp(0.6) } },
      ] },
    };
    const A = movement(M_S, V, M_KEYS);
    const S = M_S, K = M_KEYS;
    A.light = { label: '平手打ち', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: { hF: [-2, -35], la: 200, lean: -1, head: [-1, 0], hair: hp(0.1, { base: 90 }) } },
      { d: 50, ph: 'HIT', sm: 'crescent', sfx: 'swish', hb: [10, -42, 30, -24], dmg: 5, stun: 260, kb: 2.5, p: { hF: [21, -33], la: 10, hip: [2, -25], lean: 3, fF: [12, -2], face: 'shout', head: [2, 0], hair: hp(0.3, { base: 140 }) }, fx: [hitAt(24, -32, 0, 2)] },
      { d: 80, ph: 'HOLD', sa: 0.5, hb: [10, -42, 30, -24], dmg: 5, stun: 260, kb: 2.5, p: { hF: [22, -31], la: 25 }, fx: [hitAt(24, -32, 0.5, 2)] },
      { d: 60, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { hF: [18, -28], la: 50, face: 'normal', hair: hp(0.5) } },
      { d: 80, ph: 'RECOVER', chain: true, p: Object.assign({}, S, { lean: 1, hair: hp(0.7) }) },
    ], S, K), next: 'light2' };
    A.light2 = { label: '肘打ち', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hN: [-8, -30], eN: [-9, -34], lean: -1, hair: hp(0.1, { base: 90 }) } },
      { d: 50, ph: 'HIT', ghost: true, dx: 4, sfx: 'heavy', hb: [8, -40, 24, -22], dmg: 6, stun: 300, kb: 3, pd: 1.2, p: { hN: [14, -34], eN: [18, -32], hip: [3, -25], lean: 4, fF: [13, -2], face: 'shout', head: [2, 0], hair: hp(0.3, { base: 150 }) }, fx: [hitAt(20, -30, 0, 3)] },
      { d: 90, ph: 'HOLD', hb: [8, -40, 24, -22], dmg: 6, stun: 300, kb: 3, pd: 1.2, p: {}, fx: [hitAt(20, -30, 0.5, 3)] },
      { d: 60, ph: 'FOLLOW THROUGH', cancel: true, p: { face: 'normal', hair: hp(0.5) } },
      { d: 90, ph: 'RECOVER', p: Object.assign({}, S, { lean: 0, hair: hp(0.7) }) },
    ], S, K) };
    A.heavy = { label: '上段蹴り', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { hip: [-1, -25], fF: [3, -6], lean: -2, hN: [-6, -30], hF: [6, -32], head: [-1, 0], hair: hp(0.1, { base: 88 }) } },
      { d: 50, ph: 'HIT', sm: 'crescent', sfx: 'swish', shake: 1, hb: [8, -60, 32, -28], dmg: 10, stun: 360, kb: 4, pd: 1.3, p: { fF: [22, -52], kF: [13, -37], la: 250, hip: [1, -27], lean: -2, fN: [-9, -2], hN: [-10, -24], hF: [0, -30], head: [-2, 1], face: 'shout', skirtSwing: 3, hair: hp(0.3, { base: 150, wave: 1.8 }) }, fx: [hitAt(28, -50, 0, 5)] },
      { d: 90, ph: 'HOLD', sa: 0.5, hb: [8, -60, 32, -28], dmg: 10, stun: 360, kb: 4, pd: 1.3, p: { fF: [24, -49], kF: [14, -35], la: 262 }, fx: [hitAt(28, -50, 0.5, 5)] },
      { d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { fF: [20, -26], kF: [12, -22], face: 'normal', hair: hp(0.5) } },
      { d: 100, ph: 'RECOVER', chain: true, p: Object.assign({}, S, { fF: [10, -2], lean: 1, hair: hp(0.7) }) },
      { d: 60, ph: 'OVERSHOOT', p: Object.assign({}, S, { hair: hp(0.85) }) },
    ], S, K), next: 'heavy2' };
    A.heavy2 = { label: '回し蹴り', frames: seq([
      { d: 80, ph: 'ANTICIPATION', p: { hip: [-1, -25], lean: -2, fF: [4, -4], hN: [-6, -32], hF: [4, -34], head: [-1, 0], hair: hp(0.1, { base: 80 }) } },
      { d: 45, ghost: true, sfx: 'swish', p: { rot: -50, hip: [1, -27], fF: [14, -20], kF: [8, -22], fN: [-6, -2], hair: hp(0.25, { base: 200, droop: 20 }) }, fx: [{ type: 'arc', c: [2, -30], r0: 10, r1: 26, a0: -200, a1: -40, age: 0, mat: 'slash' }] },
      { d: 80, ph: 'HIT', hb: [-6, -50, 32, -14], dmg: 12, stun: 480, kb: 5, kbUp: 4, kd: true, pd: 1.4, shake: 2, p: { rot: 0, fF: [28, -34], kF: [14, -30], la: 240, lean: 3, hip: [3, -26], face: 'shout', skirtSwing: 4, hair: hp(0.45, { base: 190, droop: 30 }) }, fx: [{ type: 'arc', c: [2, -30], r0: 10, r1: 26, a0: -120, a1: 40, age: 0.3, mat: 'slash' }, hitAt(30, -34, 0, 6)] },
      { d: 70, ph: 'FOLLOW THROUGH', p: { fF: [22, -20], kF: [12, -18], face: 'normal', hair: hp(0.6) }, fx: [hitAt(30, -34, 0.5, 6)] },
      { d: 110, ph: 'RECOVER', p: Object.assign({}, S, { fF: [11, -2], lean: 1, hair: hp(0.75) }) },
      { d: 60, p: Object.assign({}, S, { hair: hp(0.9) }) },
    ], S, K) };
    // 半狼化・爪: the arm turns for one swipe
    A.special = { label: '半狼化・爪', frames: seq([
      { d: 120, ph: 'ANTICIPATION', sfx: 'charge', p: { hF: [-6, -36], hN: [-4, -30], lean: -2, hip: [-1, -25], face: 'shout', head: [-1, 0], hair: hp(0.1, { base: 80, wave: 2 }) }, fx: [{ type: 'bolt', x: -6, y: -34, r: 3, len: 6, n: 4, a0: -180, a1: 180, age: 0.1, seed: 5, mat: 'dark' }] },
      { d: 60, ph: 'HIT', ghost: true, dx: 6, sfx: 'heavy', shake: 3, hb: [8, -48, 42, -12], dmg: 14, stun: 460, kb: 5, pd: 1.9, p: { hF: [24, -30], la: 20, hip: [4, -24], lean: 5, fF: [15, -2], fN: [-8, -2], head: [3, 1], hair: hp(0.3, { base: 165 }), clawLen: 6 }, fx: [{ type: 'arc', c: [14, -32], r0: 8, r1: 26, a0: -100, a1: 50, age: 0, mat: 'dark' }, { type: 'arc', c: [14, -30], r0: 6, r1: 20, a0: -90, a1: 60, age: 0.1, mat: 'dark' }, hitAt(32, -30, 0, 8, 'dark')] },
      { d: 110, ph: 'HOLD', hb: [8, -48, 42, -12], dmg: 14, stun: 460, kb: 5, pd: 1.9, p: { hF: [25, -26], la: 40 }, fx: [{ type: 'arc', c: [14, -32], r0: 8, r1: 26, a0: -100, a1: 50, age: 0.5, mat: 'dark' }, hitAt(32, -30, 0.5, 8, 'dark')] },
      { d: 140, ph: 'RECOVER', p: { hF: [14, -28], lean: 2, hip: [2, -25], face: 'hurt', head: [1, 1], hair: hp(0.6) } },
      { d: 100, p: Object.assign({}, S, { hair: hp(0.8) }) },
    ], S, K) };
    A.air = { label: '飛び蹴り', frames: seq([
      { d: 50, ph: 'ANTICIPATION', p: { fN: [-4, -10], fF: [4, -12], hN: [-6, -30], hF: [8, -32], hair: hp(0.2, { base: 40 }) } },
      { d: 50, ph: 'HIT', ghost: true, sfx: 'swish', hb: [6, -36, 32, -10], dmg: 8, stun: 320, kb: 3, p: { fF: [27, -22], kF: [13, -27], fN: [-8, -14], lean: 5, head: [2, 1], face: 'shout', skirtSwing: 3, hair: hp(0.3, { base: 30, wave: 1.6 }) }, fx: [hitAt(29, -24, 0, 4)] },
      { d: 80, ph: 'HOLD', hb: [6, -36, 32, -10], dmg: 8, stun: 320, kb: 3, p: {} },
      { d: 260, ph: 'FOLLOW THROUGH', p: { face: 'normal' } },
    ], S, K) };
    A.crouchLight = { label: '下段蹴り', frames: seq([
      { d: 70, ph: 'ANTICIPATION', p: Object.assign({}, V.crouch, { fF: [6, -2], hair: hp(0.1) }) },
      { d: 50, ph: 'HIT', ghost: true, sfx: 'swish', hb: [6, -14, 30, 0], dmg: 5, stun: 260, kb: 3, p: Object.assign({}, V.crouch, { hip: [2, -15], fF: [22, -3], kF: [12, -10], face: 'shout', hair: hp(0.3, { base: 150 }) }) },
      { d: 90, ph: 'HOLD', hb: [6, -14, 30, 0], dmg: 5, stun: 260, kb: 3, p: {} },
      { d: 110, ph: 'RECOVER', chain: true, p: Object.assign({}, V.crouch, { face: 'normal', hair: hp(0.6) }) },
    ], S, K) };
    // 狼化: the seal breaks
    A.transform = { label: '狼化', frames: seq([
      { d: 140, inv: true, sfx: 'charge', p: { hip: [0, -22], lean: 4, head: [2, 2], face: 'hurt', hN: [2, -25], hF: [6, -26], hair: hp(0.1, { wave: 2 }) }, fx: [{ type: 'bolt', x: 0, y: -30, r: 6, len: 7, n: 4, a0: -180, a1: 180, age: 0.1, seed: 2, mat: 'dark' }] },
      { d: 140, inv: true, shake: 2, p: { hip: [0, -21], lean: 5, face: 'shout', hair: hp(0.3, { wave: 2.5 }) }, fx: [{ type: 'arc', c: [0, -28], r0: 6, r1: 20, a0: 0, a1: 300, age: 0.1, mat: 'dark' }, { type: 'bolt', x: 0, y: -30, r: 8, len: 8, n: 5, a0: -180, a1: 180, age: 0.3, seed: 3, mat: 'dark' }] },
      { d: 120, inv: true, shake: 3, sfx: 'roar', p: { flash: 1, hair: hp(0.5) }, fx: [{ type: 'arc', c: [0, -28], r0: 8, r1: 28, a0: 0, a1: 340, age: 0.4, mat: 'dark' }] },
      { d: 120, inv: true, shake: 3, form: 'wolf', p: Object.assign({}, W_S, { flash: 1, hip: [0, -22], lean: 6, hN: [-2, -12], hF: [8, -16], face: 'shout' }), fx: [{ type: 'chips', x: 0, y: -30, d: 18, n: 12, a0: -180, a1: 180, age: 0.2, seed: 4, mat: 'dark' }, { type: 'arc', c: [0, -28], r0: 10, r1: 34, a0: 0, a1: 350, age: 0.7, mat: 'dark' }] },
      { d: 200, inv: true, form: 'wolf', sfx: 'roar', shake: 2, p: Object.assign({}, W_S, { flash: 0, hip: [0, -30], lean: -2, hN: [-10, -34], hF: [14, -38], head: [0, -2], face: 'shout', tail: hp(0.2, { base: 200, droop: 160 }) }), fx: [{ type: 'chips', x: 0, y: -30, d: 22, n: 12, a0: -180, a1: 180, age: 0.6, seed: 4, mat: 'dark' }] },
      { d: 200, inv: true, form: 'wolf', p: Object.assign({}, W_S, { face: 'normal', tail: hp(0.5) }) },
    ], S, K) };
    return A;
  }
  function wolfAnims() {
    SHIFT_Y = -12; HAND_EXTRA = -2;
    const V = {
      stride: 11, idleLabel: '威嚇',
      breath: { hN: [3, -17], hF: [13, -25], head: [1, 1] },
      walkHands: (sw) => ({ hN: [3 - Math.round(sw * 2), -18], hF: [13 + Math.round(sw * 2), -26] }),
      dashHands: { hN: [-6, -16], hF: [4, -18], lean: 6 },
      crouch: { hip: [0, -18], lean: 6, fN: [-10, -2], fF: [12, -2], hN: [0, -14], hF: [10, -16], head: [2, 2] },
      blockPose: { hN: [8, -32], hF: [10, -34], head: [-1, 0] },
      blockLow: { hN: [6, -20], hF: [8, -22] },
      hurtPose: { hN: [-6, -24], hF: [4, -32] },
      tuck: { fN: [-4, -9], fF: [6, -11] },
      rise: { hN: [-6, -26], hF: [12, -34] },
      losePose: { hip: [0, -13], lean: 4, fN: [-12, -2], fF: [9, -2], kF: [5, -11], hN: [-6, -14], hF: [8, -14], head: [1, 4], face: 'hurt' },
      win: { loopFrom: 1, frames: [
        { d: 200, sfx: 'roar', shake: 2, p: { hip: [0, -31], lean: -3, hN: [-12, -36], hF: [14, -40], head: [0, -3], face: 'shout', tail: hp(0.1, { base: 200, droop: 160 }) } },
        { d: 300, p: { head: [0, -2], tail: hp(0.4) } },
        { d: 300, p: { hip: [0, -30], tail: hp(0.7) } },
      ] },
    };
    const A = movement(W_S, V, M_KEYS);
    const S = W_S, K = M_KEYS;
    const claw = (c, age, r1 = 22) => ({ type: 'arc', c, r0: 6, r1, a0: -110, a1: 50, age, mat: 'dark' });
    A.light = { label: '爪', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hF: [-2, -38], la: 200, lean: 0, head: [-1, 0], tail: hp(0.1, { base: 130 }) } },
      { d: 50, ph: 'HIT', sm: 'crescent', smat: 'dark', sfx: 'swish', hb: [8, -46, 38, -16], dmg: 8, stun: 300, kb: 3, pd: 1.4, p: { hF: [25, -30], la: 15, hip: [3, -27], lean: 5, fF: [14, -2], face: 'shout', head: [2, 0], tail: hp(0.3, { base: 170 }) }, fx: [hitAt(30, -30, 0, 2, 'dark')] },
      { d: 80, ph: 'HOLD', sa: 0.5, hb: [8, -46, 38, -16], dmg: 8, stun: 300, kb: 3, pd: 1.4, p: { hF: [26, -26], la: 35 }, fx: [hitAt(30, -30, 0.5, 2, 'dark')] },
      { d: 60, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { hF: [20, -22], la: 60, face: 'normal', tail: hp(0.5) } },
      { d: 90, ph: 'RECOVER', chain: true, p: Object.assign({}, S, { lean: 4, tail: hp(0.7) }) },
    ], S, K), next: 'light2' };
    A.light2 = { label: '逆爪', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: { hN: [-4, -12], lean: 5, tail: hp(0.1) } },
      { d: 50, ph: 'HIT', sm: 'crescent', smat: 'dark', sfx: 'swish', hb: [8, -52, 34, -18], dmg: 8, stun: 320, kb: 3, pd: 1.4, p: { hN: [20, -40], la: -60, hip: [3, -28], lean: 2, fF: [13, -2], face: 'shout', tail: hp(0.3, { base: 170 }) }, fx: [hitAt(28, -38, 0, 3, 'dark')] },
      { d: 80, ph: 'HOLD', sa: 0.5, hb: [8, -52, 34, -18], dmg: 8, stun: 320, kb: 3, pd: 1.4, p: { hN: [16, -44], la: -90 }, fx: [hitAt(28, -38, 0.5, 3, 'dark')] },
      { d: 60, ph: 'FOLLOW THROUGH', cancel: true, p: { face: 'normal', tail: hp(0.5) } },
      { d: 100, ph: 'RECOVER', p: Object.assign({}, S, { tail: hp(0.7) }) },
    ], S, K) };
    A.heavy = { label: '両爪', frames: seq([
      { d: 100, ph: 'ANTICIPATION', p: { hN: [-6, -12], hF: [-2, -16], hip: [-1, -24], lean: 6, head: [1, 2], face: 'shout', tail: hp(0.1, { base: 120 }) } },
      { d: 60, ph: 'HIT', ghost: true, dx: 4, sfx: 'heavy', shake: 2, hb: [6, -58, 36, -18], dmg: 12, stun: 480, kb: 4, kbUp: 6, kd: true, pd: 1.6, p: { hN: [18, -40], hF: [22, -44], hip: [4, -31], lean: 0, fF: [12, -2], fN: [-9, -2], head: [1, -1], tail: hp(0.3, { base: 180, droop: 140 }) }, fx: [claw([12, -34], 0, 26), claw([10, -30], 0.1, 20), hitAt(28, -40, 0, 4, 'dark')] },
      { d: 90, ph: 'HOLD', hb: [6, -58, 36, -18], dmg: 12, stun: 480, kb: 4, kbUp: 6, kd: true, pd: 1.6, p: {}, fx: [claw([12, -34], 0.5, 26), hitAt(28, -40, 0.5, 4, 'dark')] },
      { d: 80, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: { hN: [14, -34], hF: [18, -36], face: 'normal', tail: hp(0.5) } },
      { d: 120, ph: 'RECOVER', chain: true, p: Object.assign({}, S, { lean: 4, tail: hp(0.7) }) },
    ], S, K), next: 'heavy2' };
    A.heavy2 = { label: '噛みつき', frames: seq([
      { d: 90, ph: 'ANTICIPATION', p: { head: [-2, -1], hip: [-1, -27], lean: 1, hN: [0, -20], hF: [10, -28], face: 'shout', tail: hp(0.1) } },
      { d: 50, ph: 'HIT', ghost: true, dx: 6, sfx: 'heavy', shake: 2, hb: [10, -48, 32, -28], dmg: 11, stun: 380, kb: 4, pd: 1.5, p: { head: [6, 3], hip: [5, -26], lean: 7, fF: [16, -2], fN: [-8, -2], hN: [8, -14], hF: [18, -22], tail: hp(0.3, { base: 175 }) }, fx: [hitAt(30, -38, 0, 5, 'fire'), { type: 'chips', x: 30, y: -38, d: 8, n: 5, age: 0.2, seed: 6, mat: 'fire' }] },
      { d: 100, ph: 'HOLD', hb: [10, -48, 32, -28], dmg: 11, stun: 380, kb: 4, pd: 1.5, p: {}, fx: [hitAt(30, -38, 0.5, 5, 'fire')] },
      { d: 120, ph: 'RECOVER', chain: true, p: Object.assign({}, S, { face: 'normal', tail: hp(0.6) }) },
    ], S, K) };
    A.special = { label: '飛びかかり', frames: seq([
      { d: 110, ph: 'ANTICIPATION', sfx: 'charge', p: { hip: [0, -21], lean: 6, fN: [-10, -2], fF: [12, -2], hN: [-2, -12], hF: [8, -14], head: [2, 2], face: 'shout', tail: hp(0.1, { base: 120 }) } },
      { d: 60, lift: 12, dx: 16, ghost: true, sfx: 'dash', p: { rot: -20, hip: [2, -30], lean: 2, fN: [-6, -8], fF: [8, -10], hN: [10, -34], hF: [18, -38], tail: hp(0.3, { base: 200, droop: 170 }) } },
      { d: 60, ph: 'HIT', lift: 18, dx: 18, ghost: true, hb: [0, -54, 34, -8], dmg: 15, stun: 520, kb: 5, kbUp: 5, kd: true, pd: 1.7, shake: 2, p: { rot: -30, hN: [14, -30], hF: [24, -34], face: 'shout' }, fx: [claw([14, -30], 0, 28), claw([12, -26], 0.1, 22), hitAt(30, -32, 0, 7, 'dark')] },
      { d: 60, lift: 10, dx: 14, hb: [0, -54, 34, -8], dmg: 15, stun: 520, kb: 5, kbUp: 5, kd: true, pd: 1.7, p: { rot: -15, hN: [16, -26], hF: [26, -28] }, fx: [claw([14, -30], 0.5, 28), hitAt(30, -32, 0.5, 7, 'dark')] },
      { d: 120, lift: 0, sfx: 'land', shake: 2, p: { rot: 0, hip: [2, -20], lean: 7, fN: [-10, -2], fF: [14, -2], hN: [4, -8], hF: [14, -10], head: [2, 2], face: 'normal', tail: hp(0.6, { base: 150 }) }, fx: [dust(2, -1, 0.15, 8)] },
      { d: 100, p: Object.assign({}, S, { tail: hp(0.8) }), fx: [dust(2, -1, 0.6, 8)] },
    ], S, K) };
    A.air = { label: '空中爪', frames: seq([
      { d: 50, ph: 'ANTICIPATION', p: { hF: [-2, -40], la: 200, fN: [-4, -10], fF: [6, -12], tail: hp(0.2, { base: 60 }) } },
      { d: 50, ph: 'HIT', sm: 'crescent', smat: 'dark', sfx: 'swish', hb: [6, -40, 36, -6], dmg: 8, stun: 320, kb: 3, pd: 1.3, p: { hF: [22, -22], la: 50, face: 'shout', lean: 4 }, fx: [hitAt(28, -24, 0, 4, 'dark')] },
      { d: 80, ph: 'HOLD', sa: 0.5, hb: [6, -40, 36, -6], dmg: 8, stun: 320, kb: 3, pd: 1.3, p: { hF: [20, -18], la: 70 } },
      { d: 260, ph: 'FOLLOW THROUGH', p: { face: 'normal' } },
    ], S, K) };
    A.crouchLight = { label: '低い爪', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: Object.assign({}, V.crouch, { hF: [-4, -18], la: 190, tail: hp(0.1) }) },
      { d: 50, ph: 'HIT', sm: 'crescent', smat: 'dark', sfx: 'swish', hb: [6, -16, 36, 0], dmg: 6, stun: 280, kb: 3, pd: 1.3, p: Object.assign({}, V.crouch, { hip: [3, -17], hF: [24, -8], la: 20, face: 'shout', tail: hp(0.3, { base: 150 }) }), fx: [hitAt(28, -8, 0, 3, 'dark')] },
      { d: 90, ph: 'HOLD', sa: 0.5, hb: [6, -16, 36, 0], dmg: 6, stun: 280, kb: 3, pd: 1.3, p: {} },
      { d: 110, ph: 'RECOVER', chain: true, p: Object.assign({}, V.crouch, { face: 'normal', tail: hp(0.6) }) },
    ], S, K) };
    return A;
  }

  root.ANIMS = { seq, jk: jkAnims, vamp: vampAnims, maid: maidAnims, wolf: wolfAnims, stances: { jk: JK_S, vamp: V_S, maid: M_S, wolf: W_S } };
})(typeof window !== 'undefined' ? window : globalThis);
