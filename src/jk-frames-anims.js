// jk-frames-anims.js — the JK's moves built from her action-sheet cells (see frames-jk.js):
// 3 = stance / thrust start, 4-6 = thrusts, 0 / 2 = crescent slashes, 1 = electric fan slash,
// 7-9 = spins, 10-11 = dash slashes, 12 = low wide slash. `fig` = figure only (effect stripped).
// Hit boxes are the sheet's own effect boxes (F[i].eff), so the reach is exactly what is drawn.
(function (root) {
  'use strict';
  const F = root.FRAMES && root.FRAMES.jk;
  if (!F) return;
  let serial = 5000;
  const eff = (i, o = {}) => { const e = F[i].eff.slice(); return [e[0] + (o.x0 || 0), e[1] + (o.y0 || 0), e[2] + (o.x1 || 0), e[3] + (o.y1 || 0)]; };
  const fig = (i, more) => Object.assign({ cell: i, fig: true }, more || {});
  const act = (i, more) => Object.assign({ cell: i, fig: false }, more || {});
  function seq(list) {
    const id = serial++;
    return list.map((e) => ({
      pose: Object.assign({}, e.p, { fx: e.fx || [] }),
      dur: e.d || 60, dx: e.dx || 0, lift: e.lift || 0, ghost: !!e.ghost, shake: e.shake || 0, sfx: e.sfx,
      hb: e.hb || null, dmg: e.dmg || 0, stun: e.stun || 0, kb: e.kb ?? 2, kbUp: e.kbUp || 0, kd: !!e.kd, pd: e.pd ?? 1,
      chain: !!e.chain, cancel: !!e.cancel, inv: !!e.inv, air: e.air, spawn: e.spawn, phase: e.ph, hitId: e.hb ? id + (e.hid || 0) * 1000 : 0,
    }));
  }
  function build() {
    const A = {};
    A.idle = { label: '構え', loop: true, frames: seq([{ d: 320, p: fig(3) }, { d: 320, p: fig(3, { dy: 1 }) }]) };
    A.walk = { label: '前進', loop: true, frames: seq([{ d: 140, p: fig(3) }, { d: 140, p: fig(10, { dy: 0 }) }, { d: 140, p: fig(3, { dy: 1 }) }, { d: 140, p: fig(11) }]) };
    A.back = { label: '後退', loop: true, frames: seq([{ d: 150, p: fig(3, { dy: 1 }) }, { d: 150, p: fig(11) }, { d: 150, p: fig(3) }, { d: 150, p: fig(10) }]) };
    A.dash = { label: '衝刺', loop: true, frames: seq([{ d: 80, ghost: true, p: fig(10) }, { d: 80, ghost: true, p: fig(11) }]) };
    A.backdash = { label: '後跳', frames: seq([{ d: 70, ghost: true, inv: true, p: fig(8) }, { d: 90, ghost: true, inv: true, p: fig(9) }, { d: 80, p: fig(3) }]) };
    A.jump = { label: '跳躍', frames: seq([
      { d: 70, air: 'squat', p: fig(12) },
      { d: 100, air: 'rise', ghost: true, p: fig(8) },
      { d: 100, air: 'apex', p: fig(8, { dy: -1 }) },
      { d: 100, air: 'fall', p: fig(9) },
      { d: 90, air: 'land', sfx: 'land', p: fig(12) },
    ]) };
    A.crouch = { label: '蹲下', loop: true, frames: seq([{ d: 250, p: fig(12) }, { d: 250, p: fig(12, { dy: 1 }) }]) };
    A.block = { label: '防禦', loop: true, frames: seq([{ d: 200, p: fig(3) }]) };
    A.blockLow = { label: '蹲防', loop: true, frames: seq([{ d: 200, p: fig(12) }]) };
    A.blockHit = { label: '防禦', frames: seq([{ d: 70, dx: -1, p: fig(3, { dx: -1 }) }, { d: 90, dx: -1, p: fig(3) }]) };
    A.hurt = { label: '受傷', frames: seq([{ d: 60, dx: -1, p: fig(9, { flash: 1 }) }, { d: 110, dx: -1, p: fig(9) }, { d: 110, p: fig(3, { dy: 1 }) }]) };
    A.hurtLow = { label: '受傷（下段）', frames: seq([{ d: 60, dx: -1, p: fig(12, { flash: 1 }) }, { d: 110, dx: -1, p: fig(12) }, { d: 100, p: fig(12) }]) };
    A.down = { label: '倒地', frames: seq([
      { d: 70, air: 'fly', ghost: true, p: fig(9, { flash: 1 }) },
      { d: 70, air: 'fly', ghost: true, p: fig(11, { rot: -35 }) },
      { d: 80, air: 'fly', ghost: true, p: fig(11, { rot: -70 }) },
      { d: 90, air: 'land', sfx: 'slam', shake: 2, lift: -13, p: fig(11, { rot: -90 }), fx: [{ type: 'dust', x: -10, y: 8, r: 3, n: 3, age: 0.15, flat: true, seed: 4 }] },
      { d: 90, air: 'land', lift: -12, p: fig(11, { rot: -86 }) },
      { d: 400, air: 'lying', lift: -13, inv: true, p: fig(11, { rot: -90 }) },
    ]) };
    A.getup = { label: '起身', frames: seq([{ d: 120, inv: true, lift: -8, p: fig(11, { rot: -55 }) }, { d: 110, inv: true, p: fig(12) }, { d: 100, inv: true, p: fig(3) }]) };
    A.lose = { label: '敗北', loop: true, frames: seq([{ d: 300, p: fig(12) }, { d: 300, p: fig(12, { dy: 1 }) }]) };
    A.win = { label: '勝利', loopFrom: 2, frames: seq([{ d: 220, p: fig(1) }, { d: 260, p: fig(1, { dy: -1 }) }, { d: 300, p: fig(3) }, { d: 300, p: fig(3, { dy: 1 }) }]) };
    A.stagger = { label: '暈眩', loop: true, frames: seq([{ d: 160, p: fig(9) }, { d: 160, p: fig(3, { dx: 1 }) }]) };
    // ---------------------------------------------------------------- attacks: the effect box is the hit box
    A.light = { label: '突き', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: fig(3) },
      { d: 50, ph: 'HIT', sfx: 'swish', hb: eff(4), dmg: 6, stun: 280, kb: 2.5, p: act(4) },
      { d: 60, ph: 'HIT', hb: eff(5), dmg: 6, stun: 280, kb: 2.5, p: act(5) },
      { d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: act(6) },
      { d: 70, ph: 'RECOVER', chain: true, p: fig(3) },
    ]), next: 'light2' };
    A.light2 = { label: '二段突き', frames: seq([
      { d: 40, ph: 'ANTICIPATION', p: fig(4) },
      { d: 60, ph: 'HIT', sfx: 'swish', hb: eff(6), dmg: 7, stun: 300, kb: 3, p: act(6) },
      { d: 60, ph: 'FOLLOW THROUGH', cancel: true, p: act(5) },
      { d: 90, ph: 'RECOVER', p: fig(3) },
    ]) };
    A.heavy = { label: '袈裟斬', frames: seq([
      { d: 110, ph: 'ANTICIPATION', p: fig(1) },
      { d: 80, ph: 'HIT', sfx: 'heavy', shake: 2, hb: eff(0), dmg: 12, stun: 420, kb: 4, pd: 1.4, p: act(0) },
      { d: 70, ph: 'HIT', hb: eff(0), dmg: 12, stun: 420, kb: 4, pd: 1.4, p: act(0, { dy: 1 }) },
      { d: 70, ph: 'FOLLOW THROUGH', chain: true, cancel: true, p: fig(2) },
      { d: 90, ph: 'RECOVER', chain: true, p: fig(3) },
    ]), next: 'heavy2', altWhenBroken: { arm: 'bump' } };
    A.bump = { label: '肩タックル', frames: seq([
      { d: 80, ph: 'ANTICIPATION', p: fig(3) },
      { d: 60, ph: 'HIT', ghost: true, dx: 4, sfx: 'heavy', hb: [2, -32, 22, -6], dmg: 5, stun: 300, kb: 3, pd: 1.2, p: fig(10) },
      { d: 110, ph: 'RECOVER', chain: true, p: fig(3) },
    ]), next: 'heavy2' };
    A.heavy2 = { label: '逆袈裟', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: fig(0) },
      { d: 80, ph: 'HIT', sfx: 'heavy', shake: 2, hb: eff(2), dmg: 12, stun: 420, kb: 4, pd: 1.4, p: act(2) },
      { d: 70, ph: 'HIT', hb: eff(2), dmg: 12, stun: 420, kb: 4, pd: 1.4, p: act(2, { dy: 1 }) },
      { d: 90, ph: 'RECOVER', chain: true, p: fig(3) },
    ]), next: 'heavy3' };
    A.heavy3 = { label: '回天斬', frames: seq([
      { d: 60, ph: 'ANTICIPATION', lift: 2, p: fig(7) },
      { d: 70, ph: 'HIT', lift: 5, ghost: true, sfx: 'swish', hb: eff(7), dmg: 5, stun: 300, kb: 2, hid: 1, p: act(7) },
      { d: 70, ph: 'HIT', lift: 9, ghost: true, sfx: 'swish', hb: eff(8), dmg: 5, stun: 300, kb: 2, hid: 2, p: act(8) },
      { d: 90, ph: 'HIT', lift: 5, sfx: 'heavy', shake: 2, hb: eff(9), dmg: 9, stun: 500, kb: 4, kbUp: 4, kd: true, pd: 1.5, hid: 3, p: act(9) },
      { d: 100, ph: 'RECOVER', sfx: 'land', p: fig(9) },
      { d: 80, p: fig(3) },
    ]) };
    A.special = { label: '疾風斬', frames: seq([
      { d: 100, ph: 'ANTICIPATION', sfx: 'charge', p: fig(10) },
      { d: 60, ph: 'HIT', dx: 12, ghost: true, sfx: 'dash', hb: eff(10), dmg: 8, stun: 320, kb: 3, hid: 1, p: act(10) },
      { d: 60, ph: 'HIT', dx: 12, ghost: true, sfx: 'swish', hb: eff(11), dmg: 8, stun: 340, kb: 3, hid: 2, p: act(11) },
      { d: 80, ph: 'HIT', dx: 8, sfx: 'heavy', shake: 2, hb: eff(12), dmg: 10, stun: 500, kb: 4, kbUp: 3, kd: true, pd: 1.6, hid: 3, p: act(12) },
      { d: 130, ph: 'RECOVER', p: fig(12) },
      { d: 80, p: fig(3) },
    ]) };
    A.air = { label: '空中斬', frames: seq([
      { d: 50, ph: 'ANTICIPATION', p: fig(1) },
      { d: 90, ph: 'HIT', sfx: 'swish', hb: eff(1), dmg: 8, stun: 320, kb: 3, p: act(1) },
      { d: 260, ph: 'FOLLOW THROUGH', p: fig(1) },
    ]) };
    A.crouchLight = { label: '足払い', frames: seq([
      { d: 60, ph: 'ANTICIPATION', p: fig(12) },
      { d: 70, ph: 'HIT', sfx: 'swish', hb: eff(12, { y0: 10 }), dmg: 6, stun: 320, kb: 3, kd: true, p: act(12) },
      { d: 110, ph: 'RECOVER', chain: true, p: fig(12) },
    ]) };
    return A;
  }
  root.ANIMS = root.ANIMS || {};
  root.ANIMS.jkFrames = build;
})(typeof window !== 'undefined' ? window : globalThis);
