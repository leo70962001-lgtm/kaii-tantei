// jk-moves.js — the 改造人間 JK's move table for the sprite-driven engine. Every state is a list of cells from her
// Gemini action sheets (src/sprites-jk.js: A = 突き/蹴り/しゃがみ/フルコンボ/居合/電磁, B = 待機・移動/連段/ジャンプ/
// 特殊・投げ/ガード・被撃/勝敗, C = 待機/連段/跳・屈/電磁・影分身/被撃/勝敗・量子爆裂) with durations, forward
// steps and hit boxes. Frame fields are the ones src/game.js reads (see the frame format at the top of game.js);
// hit boxes are authored in cell px relative to the cell's ground anchor (+x forward, y up negative) and scaled
// to world px by the sheet's scale on emit.
(function (root) {
  'use strict';
  const K = { A: 110 / 41, B: 110 / 41, C: 110 / 30 };   // = src/sprite.js SCALE (cell px -> world px)
  let hitSerial = 1;
  const parse = (s) => ({ tag: s[0], i: +s.slice(1) });
  function seq(list) {
    const hitId = hitSerial++; const out = [];
    for (const e of list) {
      const sp = e.c ? parse(e.c) : null, k = sp ? K[sp.tag] : 3;
      if (sp && e.comp) sp.comp = e.comp.map(parse);
      if (sp && e.crop) sp.crop = e.crop;
      const hb = e.hb ? e.hb.map((v) => Math.round(v * k)) : null;
      out.push({
        sprite: sp, pose: { hidden: !!e.hidden, flash: e.flash ? 1 : 0 },
        dur: e.d || 50, dx: e.dx || 0, lift: e.lift || 0, ghost: !!e.ghost, shake: e.shake || 0, sfx: e.sfx,
        hb, dmg: e.dmg || 0, stun: e.stun || 0, kb: e.kb ?? 2, kbUp: e.kbUp || 0, kd: !!e.kd, pd: e.pd ?? 1,
        chain: !!e.chain, cancel: !!e.cancel, inv: !!e.inv, air: e.air, spawn: e.spawn, phase: e.ph,
        hitId: hb ? (e.hid ? hitId + e.hid * 1000 : hitId) : 0, form: e.form,
        throw: !!e.throw, release: !!e.release, holdX: e.holdX, holdY: e.holdY,
        face: e.face || (e.hb && !e.throw ? 'shout' : undefined),
      });
    }
    return out;
  }
  const PARTS = [
    { id: 'arm', label: '義手', zone: 'body', hp: 30, icon: 'arm' },
    { id: 'leg', label: '義足', zone: 'legs', hp: 32, icon: 'leg' },
    { id: 'blade', label: '刀', zone: 'body', hp: 26, icon: 'blade', attacking: true },
    { id: 'uniform', label: '制服', zone: 'body', hp: 34, icon: 'cloth' },
  ];

  function build() {
    const A = {};
    // ---------------------------------------------------------------- stance, movement
    A.idle = { label: '構え', loop: true, frames: seq([{ c: 'B0', d: 420 }, { c: 'B0', d: 420, lift: 1 }]) };
    A.idle2 = { label: '構え直し', frames: seq([{ c: 'B1', d: 220 }, { c: 'B2', d: 320 }, { c: 'B3', d: 320 }, { c: 'B4', d: 280 }, { c: 'B0', d: 180 }]) };
    A.walk = { label: '前進', loop: true, frames: seq([5, 6, 7, 8].map((i) => ({ c: 'B' + i, d: 110 }))) };
    A.back = { label: '後退', loop: true, frames: seq([8, 7, 6, 5].map((i) => ({ c: 'B' + i, d: 120 }))) };
    A.dash = { label: '衝刺', loop: true, frames: seq([{ c: 'A26', d: 70, ghost: true }, { c: 'A27', d: 70, ghost: true }]) };
    A.backdash = { label: '後跳', frames: seq([{ c: 'B18', d: 60, ghost: true, inv: true }, { c: 'B19', d: 90, ghost: true, inv: true }, { c: 'B17', d: 80 }]) };
    A.jump = { label: '跳躍', frames: seq([
      { c: 'B17', d: 70, air: 'squat' }, { c: 'B18', d: 100, air: 'rise', ghost: true }, { c: 'B20', d: 100, air: 'apex' },
      { c: 'B21', d: 100, air: 'fall' }, { c: 'B17', d: 90, air: 'land', sfx: 'land' },
    ]) };
    A.crouch = { label: '蹲下', loop: true, frames: seq([{ c: 'A14', d: 300 }, { c: 'A14', d: 300, lift: 1 }]) };
    A.block = { label: '防禦', loop: true, frames: seq([{ c: 'B33', d: 200 }]) };
    A.blockLow = { label: '蹲防', loop: true, frames: seq([{ c: 'B34', d: 200 }]) };
    A.blockHit = { label: '防禦', frames: seq([{ c: 'B33', d: 70, dx: -2 }, { c: 'B33', d: 90, dx: -1 }]) };
    // ---------------------------------------------------------------- hit reactions
    A.hurt = { label: '受傷', frames: seq([{ c: 'B38', d: 60, dx: -2, flash: true }, { c: 'B38', d: 110, dx: -2 }, { c: 'B37', d: 110, dx: -1 }]) };
    A.hurtHead = { label: '受傷（頭）', frames: seq([{ c: 'B35', d: 60, dx: -2, flash: true }, { c: 'B35', d: 110, dx: -2 }, { c: 'B37', d: 110, dx: -1 }]) };
    A.hurtLow = { label: '受傷（下段）', frames: seq([{ c: 'B36', d: 60, dx: -1, flash: true }, { c: 'B36', d: 110, dx: -2 }, { c: 'B36', d: 110, dx: -1 }]) };
    A.stagger = { label: '暈眩', loop: true, frames: seq([{ c: 'B37', d: 160 }, { c: 'B38', d: 160 }]) };
    A.down = { label: '倒地', frames: seq([
      { c: 'B39', d: 70, air: 'fly', ghost: true, flash: true }, { c: 'B39', d: 70, air: 'fly', ghost: true }, { c: 'B39', d: 80, air: 'fly', ghost: true },
      { c: 'B40', d: 90, air: 'land', sfx: 'slam', shake: 2 }, { c: 'B40', d: 90, air: 'land' },
      { c: 'B40', d: 400, air: 'lying', inv: true },
    ]) };
    A.getup = { label: '起身', frames: seq([{ c: 'B36', d: 120, inv: true }, { c: 'B34', d: 110, inv: true }, { c: 'B0', d: 110, inv: true }]) };
    A.lose = { label: '敗北', loop: true, frames: seq([{ c: 'B46', d: 400 }, { c: 'B46', d: 400 }]) };
    A.win = { label: '勝利', loopFrom: 5, frames: seq([
      { c: 'B41', d: 140 }, { c: 'B42', d: 160, sfx: 'click' }, { c: 'B43', d: 220 }, { c: 'B44', d: 160 }, { c: 'B45', d: 220 },
      { c: 'B44', d: 300 }, { c: 'B45', d: 300 },
    ]) };
    // ---------------------------------------------------------------- Z chain (steel arm / chrome leg)
    A.light = { label: '義手ジャブ', frames: seq([
      { c: 'A5', d: 40, ph: 'ANTICIPATION' },
      { c: 'A6', d: 50, ph: 'HIT', sfx: 'swish', hb: [3, -31, 16, -20], dmg: 5, stun: 260, kb: 2.2 },
      { c: 'A6', d: 60, ph: 'HOLD', hb: [3, -31, 16, -20], dmg: 5, stun: 260, kb: 2.2, chain: true, cancel: true },
      { c: 'A5', d: 70, ph: 'RECOVER', chain: true, cancel: true },
    ]), nextLight: 'light2', nextHeavy: 'heavy', altWhenBroken: { arm: 'bump' } };
    A.light2 = { label: '義手ストレート', frames: seq([
      { c: 'A20', d: 60, ph: 'ANTICIPATION' },
      { c: 'A21', d: 60, ph: 'HIT', ghost: true, sfx: 'heavy', shake: 2, dx: 4, hb: [2, -32, 14, -19], dmg: 9, stun: 340, kb: 4, pd: 1.6 },
      { c: 'A21', d: 90, ph: 'HOLD', hb: [2, -32, 14, -19], dmg: 9, stun: 340, kb: 4, pd: 1.6 },
      { c: 'A20', d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true },
      { c: 'A5', d: 90, ph: 'RECOVER', chain: true },
    ]), nextLight: 'kick', nextHeavy: 'heavy', altWhenBroken: { arm: 'bump' } };
    A.bump = { label: '肩タックル', frames: seq([
      { c: 'A5', d: 90, ph: 'ANTICIPATION' },
      { c: 'A2', d: 60, ph: 'HIT', ghost: true, dx: 6, sfx: 'heavy', shake: 1, hb: [0, -32, 12, -10], dmg: 6, stun: 300, kb: 4, pd: 1.2 },
      { c: 'A2', d: 90, ph: 'HOLD', hb: [0, -32, 12, -10], dmg: 6, stun: 300, kb: 4, pd: 1.2, chain: true },
      { c: 'A0', d: 120, ph: 'RECOVER', chain: true },
    ]), nextLight: 'kick', nextHeavy: 'heavy' };
    A.kick = { label: '義足ミドル', frames: seq([
      { c: 'A10', d: 60, ph: 'ANTICIPATION' },
      { c: 'A9', d: 50, ph: 'HIT', ghost: true, sfx: 'swish', shake: 1, hb: [4, -27, 24, -11], dmg: 7, stun: 340, kb: 3.2, pd: 1.2 },
      { c: 'A9', d: 80, ph: 'HOLD', hb: [4, -27, 24, -11], dmg: 7, stun: 340, kb: 3.2, pd: 1.2, chain: true, cancel: true },
      { c: 'A10', d: 70, ph: 'RETRACT', chain: true, cancel: true },
      { c: 'A5', d: 100, ph: 'RECOVER', chain: true },
    ]), nextLight: 'light3', nextHeavy: 'heavy', altWhenBroken: { leg: 'light3' } };
    A.light3 = { label: '横薙ぎ', frames: seq([
      { c: 'B9', d: 80, ph: 'ANTICIPATION' },
      { c: 'B10', d: 50, ph: 'SMEAR', sfx: 'swish', hb: [-6, -32, 16, -2], dmg: 7, stun: 320, kb: 3 },
      { c: 'A22', d: 80, ph: 'HIT', hb: [-2, -30, 16, -10], dmg: 7, stun: 320, kb: 3 },
      { c: 'A22', d: 60, ph: 'FOLLOW THROUGH', chain: true, cancel: true },
      { c: 'B9', d: 80, ph: 'RECOVER', chain: true, cancel: true },
    ]), nextLight: 'light4', nextHeavy: 'heavy3' };
    A.light4 = { label: 'ハイキック', frames: seq([
      { c: 'A10', d: 60, ph: 'ANTICIPATION' },
      { c: 'A7', d: 40, ph: 'RISE', ghost: true, hb: [4, -30, 20, -12], dmg: 9, stun: 420, kb: 3, kbUp: 6, kd: true, pd: 1.3 },
      { c: 'A8', d: 45, ph: 'HIT', ghost: true, sfx: 'swish', shake: 1, hb: [2, -40, 22, -18], dmg: 9, stun: 420, kb: 3, kbUp: 6, kd: true, pd: 1.3 },
      { c: 'A12', d: 90, ph: 'HOLD', hb: [2, -38, 18, -16], dmg: 9, stun: 420, kb: 3, kbUp: 6, kd: true, pd: 1.3 },
      { c: 'A13', d: 80, ph: 'RETRACT' },
      { c: 'A5', d: 120, ph: 'RECOVER' },
    ]) };
    // ---------------------------------------------------------------- X chain (sword)
    A.heavy = { label: '袈裟斬', frames: seq([
      { c: 'A1', d: 110, ph: 'ANTICIPATION' },
      { c: 'A30', d: 40, ph: 'ARC' },
      { c: 'A31', d: 40, ph: 'SMEAR', sfx: 'swish', shake: 2, hb: [-4, -30, 24, 0], dmg: 12, stun: 420, kb: 4, pd: 1.4 },
      { c: 'A31', d: 100, ph: 'HIT', hb: [-4, -30, 24, 0], dmg: 12, stun: 420, kb: 4, pd: 1.4 },
      { c: 'A29', d: 60, ph: 'FOLLOW THROUGH', chain: true, cancel: true },
      { c: 'A0', d: 80, ph: 'RECOVER', chain: true },
    ]), nextHeavy: 'heavy2', nextLight: 'light3' };
    A.heavy2 = { label: '刺突', frames: seq([
      { c: 'A1', d: 70, ph: 'ANTICIPATION' },
      { c: 'A2', d: 70, ph: 'CHAMBER', dx: 4 },
      { c: 'A3', d: 50, ph: 'HIT', ghost: true, sfx: 'swish', dx: 6, hb: [8, -31, 34, -21], dmg: 11, stun: 400, kb: 4, pd: 1.5 },
      { c: 'A3', d: 70, ph: 'HIT', hb: [8, -31, 34, -21], dmg: 11, stun: 400, kb: 4, pd: 1.5 },
      { c: 'A4', d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true },
      { c: 'A0', d: 90, ph: 'RECOVER', chain: true },
    ]), nextHeavy: 'heavy3', nextLight: 'light4' };
    A.heavy3 = { label: '連斬・回天', frames: seq([
      { c: 'A26', d: 60, ph: 'ANTICIPATION', ghost: true, dx: 6 },
      { c: 'A28', d: 60, ph: 'HIT', ghost: true, sfx: 'swish', dx: 8, hb: [-4, -30, 18, -4], dmg: 6, stun: 300, kb: 2, hid: 1 },
      { c: 'A29', d: 60, ph: 'HIT', sfx: 'swish', dx: 6, hb: [-8, -30, 12, -4], dmg: 6, stun: 300, kb: 2, hid: 2 },
      { c: 'A30', d: 40, ph: 'ARC' },
      { c: 'A31', d: 90, ph: 'HIT', sfx: 'swish', shake: 2, hb: [-4, -30, 24, 0], dmg: 12, stun: 500, kb: 5, kbUp: 6, kd: true, pd: 1.5, hid: 3 },
      { c: 'A29', d: 60, ph: 'FOLLOW THROUGH' },
      { c: 'A0', d: 100, ph: 'RECOVER' },
    ]) };
    // ---------------------------------------------------------------- crouching
    A.crouchLight = { label: '屈み義手', frames: seq([
      { c: 'A14', d: 50, ph: 'ANTICIPATION' },
      { c: 'A15', d: 60, ph: 'HIT', sfx: 'swish', hb: [2, -22, 17, -10], dmg: 5, stun: 280, kb: 2.5 },
      { c: 'A16', d: 70, ph: 'HOLD', hb: [2, -22, 14, -10], dmg: 5, stun: 280, kb: 2.5, chain: true, cancel: true },
      { c: 'A14', d: 100, ph: 'RECOVER' },
    ]), nextLight: 'crouchKick', altWhenBroken: { arm: 'crouchHeavy' } };
    A.crouchHeavy = { label: '足払い', frames: seq([
      { c: 'A17', d: 70, ph: 'ANTICIPATION' },
      { c: 'A18', d: 50, ph: 'HIT', sfx: 'swish', hb: [-6, -14, 16, 0], dmg: 7, stun: 340, kb: 3, kd: true },
      { c: 'A18', d: 80, ph: 'HOLD', hb: [-6, -14, 16, 0], dmg: 7, stun: 340, kb: 3, kd: true },
      { c: 'A19', d: 120, ph: 'RECOVER' },
    ]) };
    A.crouchKick = { label: '炎の足払い', frames: seq([
      { c: 'A14', d: 60, ph: 'ANTICIPATION' },
      { c: 'C11', d: 50, ph: 'HIT', ghost: true, sfx: 'swish', shake: 1, hb: [-8, -12, 12, 0], dmg: 7, stun: 360, kb: 3.5, kd: true, pd: 1.2 },
      { c: 'C11', d: 90, ph: 'HOLD', hb: [-8, -12, 12, 0], dmg: 7, stun: 360, kb: 3.5, kd: true, pd: 1.2 },
      { c: 'A14', d: 130, ph: 'RECOVER' },
    ]), altWhenBroken: { leg: 'crouchHeavy' } };
    // ---------------------------------------------------------------- air
    A.air = { label: '空中義手', frames: seq([
      { c: 'B20', d: 50, ph: 'ANTICIPATION' },
      { c: 'B22', d: 50, ph: 'HIT', ghost: true, sfx: 'swish', hb: [4, -28, 18, -14], dmg: 7, stun: 300, kb: 3 },
      { c: 'B22', d: 90, ph: 'HOLD', hb: [4, -28, 18, -14], dmg: 7, stun: 300, kb: 3 },
      { c: 'B21', d: 260, ph: 'FOLLOW THROUGH' },
    ]), altWhenBroken: { arm: 'air2' } };
    A.air2 = { label: '空中斬', frames: seq([
      { c: 'B23', d: 60, ph: 'ANTICIPATION' },
      { c: 'B24', d: 40, ph: 'SMEAR', sfx: 'swish', hb: [4, -28, 32, -10], dmg: 8, stun: 320, kb: 3 },
      { c: 'B24', d: 80, ph: 'HIT', hb: [4, -28, 32, -10], dmg: 8, stun: 320, kb: 3 },
      { c: 'B21', d: 260, ph: 'FOLLOW THROUGH' },
    ]) };
    A.airKick = { label: '空中義足', frames: seq([
      { c: 'B20', d: 50, ph: 'ANTICIPATION' },
      { c: 'B23', d: 50, ph: 'HIT', ghost: true, sfx: 'swish', hb: [2, -26, 20, -6], dmg: 8, stun: 340, kb: 3 },
      { c: 'B23', d: 90, ph: 'HOLD', hb: [2, -26, 20, -6], dmg: 8, stun: 340, kb: 3 },
      { c: 'B21', d: 260, ph: 'FOLLOW THROUGH' },
    ]) };
    // ---------------------------------------------------------------- specials
    A.special = { label: '影分身・居合', frames: seq([
      { c: 'A25', d: 90, ph: 'ANTICIPATION' },
      { c: 'A26', d: 70, ph: 'DASH', dx: 14, ghost: true, sfx: 'dash', inv: true },
      { c: 'A27', d: 60, ph: 'DASH', dx: 16, ghost: true, sfx: 'dash', inv: true },
      { c: 'A28', d: 45, ph: 'SMEAR', dx: 10, ghost: true, sfx: 'swish', hb: [-4, -30, 18, -4], dmg: 8, stun: 400, kb: 2, hid: 1 },
      { c: 'A29', d: 70, ph: 'HIT', hb: [-8, -30, 12, -4], dmg: 8, stun: 400, kb: 2, hid: 1 },
      { c: 'A30', d: 80, ph: 'WIND' },
      { c: 'A31', d: 40, ph: 'SMEAR', sfx: 'swish', shake: 3, hb: [-6, -30, 24, 0], dmg: 14, stun: 520, kb: 5, kbUp: 4, kd: true, pd: 1.8, hid: 2 },
      { c: 'A31', d: 110, ph: 'HIT', hb: [-6, -30, 24, 0], dmg: 14, stun: 520, kb: 5, kbUp: 4, kd: true, pd: 1.8, hid: 2 },
      { c: 'A29', d: 90, ph: 'FOLLOW THROUGH' },
      { c: 'A0', d: 120, ph: 'RECOVER' },
    ]) };
    A.special2 = { label: '電磁衝撃破', frames: seq([
      { c: 'A32', d: 110, ph: 'ANTICIPATION', sfx: 'charge' },
      { c: 'A33', d: 90, ph: 'CHARGE' },
      { c: 'A34', d: 60, ph: 'CHARGE' },
      { c: 'A35', d: 60, ph: 'FIRE', ghost: true, sfx: 'heavy', shake: 2, spawn: 'shot' },
      { c: 'A35', d: 110, ph: 'HOLD' },
      { c: 'A37', d: 120, ph: 'RECOVER' },
      { c: 'A0', d: 80 },
    ]), altWhenBroken: { arm: 'bump' } };
    A.super = { label: '量子爆裂', frames: seq([
      { c: 'C41', d: 150, ph: 'CHARGE', sfx: 'charge', shake: 1 },
      { c: 'C42', d: 150, ph: 'CHARGE', shake: 2 },
      { c: 'C43', d: 150, ph: 'CHARGE', shake: 3 },
      { c: 'C44', d: 70, ph: 'BURST', sfx: 'burst', shake: 7, hb: [-30, -30, 26, 0], dmg: 26, stun: 640, kb: 6, kbUp: 7, kd: true, pd: 2.2 },
      { c: 'C44', d: 120, ph: 'BURST', shake: 3, hb: [-34, -30, 28, 0], dmg: 26, stun: 640, kb: 6, kbUp: 7, kd: true, pd: 2.2 },
      { c: 'C45', d: 160, ph: 'FADE' },
      { c: 'B0', d: 240, ph: 'RECOVER' },
    ]) };
    // ---------------------------------------------------------------- throw
    A.throw = { label: '投げ', frames: seq([
      { c: 'B30', d: 60, ph: 'REACH' },
      { c: 'B30', d: 40, ph: 'GRAB', throw: true, hb: [2, -34, 16, -8], dmg: 0, stun: 0, kb: 0 },
      { c: 'B31', d: 140, ph: 'MISS' },
      { c: 'B0', d: 100, ph: 'RECOVER' },
    ]) };
    A.throwHit = { label: '投げ', frames: seq([
      { c: 'B30', d: 150, ph: 'LIFT', holdX: 40, holdY: 0 },
      { c: 'B31', d: 60, ph: 'TOSS', release: true, sfx: 'heavy', shake: 2, dmg: 12, stun: 0, kb: 5, kbUp: 5, kd: true, pd: 1.2, holdX: 36, holdY: 6 },
      { c: 'B31', d: 160, ph: 'FOLLOW THROUGH' },
      { c: 'B0', d: 120, ph: 'RECOVER' },
    ]) };
    for (const n of ['hurt', 'hurtHead', 'hurtLow', 'stagger', 'down', 'getup', 'lose']) for (const fr of A[n].frames) fr.face = 'hurt';
    // flying / lying / aura / explosion drawings keep their own heads
    for (const fr of A.down.frames) fr.face = 'none';
    for (const fr of A.super.frames) if (fr.sprite && fr.sprite.tag === 'C' && fr.sprite.i >= 41 && fr.sprite.i <= 44) fr.face = 'none';
    return A;
  }

  // hurt boxes from the drawn figure: head = the top quarter, legs = the bottom third, body = the rest (world px)
  function boxes(fr) {
    const SPR = root.SPR, sp = fr && fr.sprite;
    const fb = sp && SPR ? SPR.frame(sp.tag, sp.i, { comp: sp.comp, crop: sp.crop }).figBox : null;
    const b = fb || [-16, -110, 16, 0];
    const h = b[3] - b[1];
    const headY = b[1] + h * 0.26, legY = b[3] - h * 0.34;
    const cx = (b[0] + b[2]) / 2, w = Math.min(b[2] - b[0], 44);
    return { head: [cx - w * 0.36, b[1], cx + w * 0.36, headY], body: [cx - w * 0.45, headY, cx + w * 0.45, legY], legs: [cx - w * 0.4, legY, cx + w * 0.4, b[3] + 2] };
  }
  const ANCHORS = { arm: [-8, -62], leg: [10, -28], blade: [26, -44], uniform: [0, -72] };
  root.JKS = { id: 'jk', name: '改造人間', height: '170cm', PARTS, moves: build, boxes, anchors: () => ANCHORS };
  root.ANIMS = Object.assign(root.ANIMS || {}, { jk: build });
})(typeof window !== 'undefined' ? window : globalThis);
