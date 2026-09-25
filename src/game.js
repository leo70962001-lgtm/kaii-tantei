// game.js — 怪異探偵部 fighting game: fixed-step simulation (input, movement, hit boxes, part damage,
// projectiles, CPU), the round/screen flow, and the pixel renderer with a text HUD on top.
(function () {
  'use strict';
  const { PX, STAGE, ANIMS, RIG } = window;
  const G = STAGE.GROUND, TICK = 1000 / 60, W = STAGE.W, VW = STAGE.VW, VH = STAGE.H, KB = 1.8;
  const clamp = PX.clamp;
  const rnd = Math.random;

  // ------------------------------------------------------------ roster
  const ROSTER = [
    { id: 'jk', R: window.JK, forms: { jk: ANIMS.jk() }, form0: 'jk', color: '#ff5a6e',
      stats: { walk: 3.1, back: 2.4, dash: 7.6, jumpV: 9.4, hp: 100, def: 0.66, dmg: 1 },
      onBreak: { arm: (f) => { f.dmgMul *= 0.9; }, leg: (f) => { f.speedMul *= 0.75; f.jumpMul *= 0.85; }, blade: (f) => { f.dmgMul *= 0.85; loseSword(f); }, uniform: (f) => { f.defMul *= 1.1; } },
    },
    { id: 'vamp', R: window.VAMP, forms: { vamp: ANIMS.vamp() }, form0: 'vamp', color: '#ffd24a',
      stats: { walk: 3.4, back: 2.7, dash: 8.1, jumpV: 9.7, hp: 92, def: 0.68, dmg: 1 },
      onBreak: { glasses: (f) => { f.blind = true; }, laptop: (f) => { f.speedMul *= 1.15; f.dmgMul *= 0.95; f.face_ = 'rage'; }, slippers: (f) => { f.speedMul *= 0.85; }, ahoge: (f) => { f.defMul *= 1.1; } },
    },
    { id: 'maid', R: window.MAID, forms: { maid: ANIMS.maid(), wolf: ANIMS.wolf() }, form0: 'maid', color: '#c9a6ff',
      stats: { walk: 3.2, back: 2.5, dash: 7.9, jumpV: 9.5, hp: 100, def: 0.68, dmg: 1 },
      wolfStats: { walk: 4.0, back: 2.7, dash: 9, jumpV: 10.4 },
      onBreak: { headdress: (f) => { f.defMul *= 1.05; }, apron: (f) => { f.defMul *= 1.05; }, ribbon: (f) => { f.wantTransform = true; }, shoes: (f) => { f.speedMul *= 0.9; } },
    },
  ];
  for (const C of ROSTER) for (const [form, A] of Object.entries(C.forms)) for (const [id, an] of Object.entries(A)) { an.id = id; an.form = form; }
  // only characters with their own action-sheet frames are playable for now (the others are placeholders)
  const PLAYABLE = ROSTER.filter((C) => C.id === 'jk');
  const ROSTER_ALL = ROSTER.slice();
  ROSTER.length = 0; ROSTER.push(...PLAYABLE);
  const byId = (id) => ROSTER.find((c) => c.id === id);

  // ------------------------------------------------------------ frame cache (rendered on demand)
  function toCanvas(c32, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const id = ctx.createImageData(w, h);
    new Uint32Array(id.data.buffer).set(c32); ctx.putImageData(id, 0, 0); return cv;
  }
  const cache = new Map();
  function maskOf(f) {
    let m = 0;
    f.C.R.PARTS.forEach((p, i) => { if (f.parts[p.id].broken) m |= 1 << i; });
    if (f.batOut) m |= 64;
    return m;
  }
  function frameImg(f, an, fi) {
    const key = f.C.id + ':' + an.form + ':' + an.id + ':' + fi + ':' + maskOf(f);
    let e = cache.get(key);
    if (e) return e;
    const fr = an.frames[fi];
    const pose = Object.assign({}, fr.pose, { broken: brokenOf(f) });
    if (f.batOut) pose.noBat = true;
    if (f.swordLost) pose.noSword = true;
    if (f.face_ && pose.face === 'normal') pose.face = f.face_;
    const b = f.C.R.render(pose, {});
    const fl = PX.flipX(b);
    const sil = new Uint32Array(b.c.length), tint = PX.hex(f.C.color);
    const inkc = PX.rgba(6, 8, 24, 255);
    for (let i = 0; i < b.c.length; i++) if (b.c[i] && !(b.f[i] & 2)) sil[i] = tint;
    const silL = new Uint32Array(sil.length);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) silL[y * b.w + (b.w - 1 - x)] = sil[y * b.w + x];
    const sh = new Uint32Array(b.c.length);
    for (let i = 0; i < b.c.length; i++) if (sil[i]) sh[i] = inkc;
    const shL = new Uint32Array(sh.length);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) shL[y * b.w + (b.w - 1 - x)] = sh[y * b.w + x];
    const fxc = new Uint32Array(b.c.length); let anyFx = false;
    for (let i = 0; i < b.c.length; i++) if (b.c[i] && (b.f[i] & 2)) { fxc[i] = b.c[i]; anyFx = true; }
    let FR = null, FL = null;
    if (anyFx) { const fxl = new Uint32Array(fxc.length); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) fxl[y * b.w + (b.w - 1 - x)] = fxc[y * b.w + x]; FR = toCanvas(fxc, b.w, b.h); FL = toCanvas(fxl, b.w, b.h); }
    e = { R: toCanvas(b.c, b.w, b.h), L: toCanvas(fl.c, fl.w, fl.h), GR: toCanvas(sil, b.w, b.h), GL: toCanvas(silL, b.w, b.h), SR: toCanvas(sh, b.w, b.h), SL: toCanvas(shL, b.w, b.h), FR, FL };
    cache.set(key, e);
    return e;
  }
  function brokenOf(f) { const o = {}; for (const p of f.C.R.PARTS) if (f.parts[p.id].broken) o[p.id] = 1; return o; }
  // portraits: the head bitmap alone
  const portraits = new Map();
  function portrait(f) {
    const key = f.C.id + ':' + f.form;
    if (portraits.has(key)) return portraits.get(key);
    const R = f.C.R;
    const buf = new PX.Buf(38, 34);
    const C = window.CAST && window.CAST[f.C.id];
    if (C && f.form !== 'wolf') {
      const [x0, y0, x1, y1] = C.body.headBox, hw = x1 - x0 + 1, hh = y1 - y0 + 1, src = RIG.imgData(C.body);
      const s = Math.max(1, hw / 36, hh / 32);
      for (let y = 0; y < 34; y++) for (let x = 0; x < 38; x++) { const sx = x0 + Math.floor((x - (38 - hw / s) / 2) * s), sy = y0 + Math.floor((y - (34 - hh / s)) * s); if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue; const c = src[sy * C.body.w + sx]; if (c) buf.set(x, y, c, 0, 1, 1); }
    } else {
      const rows = f.form === 'wolf' ? R.WHEAD.normal : R.HEAD.normal;
      const mat = f.form === 'wolf' ? R.M.fur : R.M.hair;
      RIG.place(buf, mat, rows, R.KEY, [19, 32], f.form === 'wolf' ? R.WHEAD_NECK : R.HEAD_NECK);
    }
    PX.outline(buf);
    const cv = toCanvas(buf.c, buf.w, buf.h);
    portraits.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------ sound
  let ac = null, soundOn = true;
  function ensureAudio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function noiseBuf(dur) { const b = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function burst(dur, f0, f1, q, vol, type = 'bandpass') {
    const src = ac.createBufferSource(); src.buffer = noiseBuf(dur);
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; const g = ac.createGain(); const t = ac.currentTime;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl).connect(g).connect(ac.destination); src.start();
  }
  function tone(dur, f0, f1, vol, type = 'sine') {
    const o = ac.createOscillator(); o.type = type; const g = ac.createGain(); const t = ac.currentTime;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(t + dur);
  }
  function sfx(kind) {
    if (!soundOn || !ac) return;
    try {
      if (kind === 'swish') burst(0.16, 900, 3600, 1.4, 0.2);
      else if (kind === 'heavy') burst(0.3, 500, 2400, 1.1, 0.28);
      else if (kind === 'slam') { burst(0.28, 500, 90, 0.8, 0.35, 'lowpass'); tone(0.22, 120, 45, 0.35); }
      else if (kind === 'roar') { tone(0.7, 110, 70, 0.22, 'sawtooth'); burst(0.6, 700, 200, 0.6, 0.18); }
      else if (kind === 'click') { tone(0.05, 2400, 1800, 0.12, 'square'); tone(0.08, 1200, 900, 0.08, 'triangle'); }
      else if (kind === 'dash') burst(0.22, 4000, 700, 0.9, 0.22);
      else if (kind === 'burst') { burst(0.35, 2600, 200, 0.7, 0.3); tone(0.3, 180, 50, 0.25, 'triangle'); }
      else if (kind === 'charge') tone(0.3, 300, 900, 0.06, 'triangle');
      else if (kind === 'land') burst(0.1, 500, 150, 0.8, 0.12, 'lowpass');
      else if (kind === 'step') burst(0.05, 400, 200, 1, 0.04, 'lowpass');
      else if (kind === 'hit') { burst(0.12, 1800, 600, 1.2, 0.2); tone(0.1, 220, 110, 0.14, 'square'); }
      else if (kind === 'hit2') { burst(0.18, 1200, 300, 1.0, 0.28); tone(0.14, 160, 70, 0.2, 'square'); }
      else if (kind === 'block') { tone(0.08, 900, 600, 0.12, 'square'); burst(0.08, 2500, 1500, 2, 0.1); }
      else if (kind === 'break') { burst(0.4, 3200, 400, 0.6, 0.35); tone(0.35, 900, 120, 0.2, 'sawtooth'); tone(0.12, 2200, 1800, 0.1, 'square'); }
      else if (kind === 'ko') { burst(0.6, 400, 60, 0.7, 0.4, 'lowpass'); tone(0.5, 90, 30, 0.4); }
      else if (kind === 'sel') tone(0.06, 800, 1200, 0.1, 'square');
      else if (kind === 'ok') { tone(0.08, 600, 1200, 0.12, 'square'); tone(0.12, 1200, 1800, 0.08, 'square'); }
      else if (kind === 'go') { tone(0.2, 440, 880, 0.15, 'square'); }
    } catch (e) { /* optional */ }
  }

  // ------------------------------------------------------------ fighters
  const ATTACKS = ['light', 'light2', 'light3', 'light4', 'heavy', 'heavy2', 'heavy3', 'special', 'special2', 'air', 'air2', 'crouchLight', 'crouchHeavy', 'throw', 'throwHit', 'bump', 'bite', 'claw'];
  const LOW = { crouchHeavy: 1 }, HIGH = { air: 1, air2: 1 };
  function makeFighter(C, slot) {
    const f = {
      C, slot, form: C.form0, x: 0, y: 0, vx: 0, vy: 0, face: 1, hp: C.stats.hp, maxhp: C.stats.hp,
      parts: {}, anim: null, fi: 0, ft: 0, air: false, hitIds: new Set(), stun: 0, freeze: 0, combo: 0, comboT: 0,
      input: {}, prev: {}, ai: null, dmgMul: C.stats.dmg, defMul: C.stats.def, speedMul: 1, jumpMul: 1, breaks: 0,
      trail: [], queue: null, tapT: 0, tapDir: 0, batOut: false, wantTransform: false, face_: null, blind: false, koed: false, wins: 0, flashT: 0,
    };
    for (const p of C.R.PARTS) f.parts[p.id] = { hp: p.hp, max: p.hp, broken: false };
    return f;
  }
  const A = (f) => f.C.forms[f.form];
  const cur = (f) => A(f)[f.anim].frames[f.fi];
  const isAttack = (f) => ATTACKS.includes(f.anim) || f.anim === 'transform';
  const stats = (f) => (f.form === 'wolf' && f.C.wolfStats ? Object.assign({}, f.C.stats, f.C.wolfStats) : f.C.stats);
  function busy(f) {
    return isAttack(f) || ['hurt', 'hurtLow', 'down', 'getup', 'blockHit', 'stagger', 'lose', 'win', 'backdash'].includes(f.anim) || (f.anim === 'jump' && (cur(f).air === 'squat' || cur(f).air === 'land'));
  }

  function play(f, name) {
    let an = A(f)[name];
    if (!an) an = A(f).idle;
    if (an.altWhenBroken) for (const [pid, alt] of Object.entries(an.altWhenBroken)) if (f.parts[pid] && f.parts[pid].broken && A(f)[alt]) { an = A(f)[alt]; break; }
    f.anim = an.id; f.fi = 0; f.ft = 0; f.hitIds = new Set(); f.queue = null;
    enter(f);
  }
  function enter(f) {
    const fr = cur(f);
    if (fr.ghost) { f.trail.push({ an: A(f)[f.anim], fi: f.fi, x: f.x, y: f.y + (fr.lift || 0), face: f.face, t: sim.t, mask: maskOf(f), sk: f.sk || null }); if (f.trail.length > 5) f.trail.shift(); }
    if (fr.dx) f.x = clamp(f.x + fr.dx * f.face, 24, W - 24);
    if (fr.shake) sim.shake = Math.max(sim.shake, fr.shake);
    if (fr.sfx) sfx(fr.sfx);
    if (fr.spawn === 'bat') spawnBat(f);
    if (fr.spawn === 'shot') spawnShot(f);
    if (fr.form) f.formNext = fr.form;
    if ((f.anim === 'walk' || f.anim === 'back') && (f.fi === 1 || f.fi === 4)) sfx('step');
  }
  function next(f) {
    const an = A(f)[f.anim];
    f.fi++;
    if (f.fi < an.frames.length) return enter(f);
    // the animation ended
    f.fi = an.frames.length - 1;
    if (an.loop) { f.fi = 0; return enter(f); }
    if (an.loopFrom !== undefined) { f.fi = an.loopFrom; return enter(f); }
    if (f.anim === 'transform') { f.form = 'wolf'; f.hp = Math.min(f.maxhp, f.hp + 15); f.dmgMul *= 1.2; f.defMul *= 0.9; f.speedMul *= 1.05; sim.callout('狼化！', f.C.color, 1200); return play(f, 'idle'); }
    if (f.anim === 'down') { if (f.hp <= 0 || sim.phase !== 'fight') { f.fi = an.frames.length - 1; return; } return play(f, 'getup'); }
    if (f.anim === 'jump' || f.anim === 'air') { if (f.air) { f.fi = an.frames.length - 1; return; } return play(f, 'idle'); }
    play(f, f.input.down && !f.air ? 'crouch' : 'idle');
  }

  // per-tick control from the input struct (player or CPU)
  function control(f, o) {
    const I = f.input, P = f.prev;
    const press = (k) => I[k] && !P[k];
    const fwd = f.face > 0 ? 'right' : 'left', bwd = f.face > 0 ? 'left' : 'right';
    const fr = cur(f);
    const st = stats(f);
    // double tap → dash / backdash
    for (const d of ['left', 'right']) if (press(d)) { if (f.tapDir === d && sim.t - f.tapT < 260) f.dashReq = d; f.tapDir = d; f.tapT = sim.t; }
    if (f.wantTransform && !busy(f) && !f.air && f.form !== 'wolf') { f.wantTransform = false; return play(f, 'transform'); }
    if (f.freeze > 0) return;
    if (isAttack(f)) {
      // chains and cancels inside attack windows
      const an = A(f)[f.anim];
      if (fr.cancel && press('special') && !f.air) { const sp = I.down && A(f).special2 ? 'special2' : 'special'; if (A(f)[sp]) return play(f, sp); }
      if (fr.chain && (press('light') || press('heavy'))) {
        const nx = press('light') ? (an.nextLight || an.next) : (an.nextHeavy || an.next);
        if (nx && !f.air && A(f)[nx]) return play(f, nx);
        if (!f.air && press('light') && f.anim !== 'light' && A(f).light) return play(f, 'light');
      }
      return;
    }
    if (busy(f)) return;
    if (f.air) {
      if (f.anim === 'jump' && press('light') && A(f).air) return play(f, 'air');
      if (f.anim === 'jump' && press('heavy') && (A(f).air2 || A(f).air)) return play(f, A(f).air2 ? 'air2' : 'air');
      return;
    }
    // grounded, free
    if (press('up')) { f.jumpDir = I[fwd] ? 1 : I[bwd] ? -1 : 0; return play(f, 'jump'); }
    if (press('special')) { const sp = I.down && A(f).special2 ? 'special2' : 'special'; if (A(f)[sp]) return play(f, sp); }
    if (I.down) {
      if (press('down') && f.swordLost && pickUpSword(f)) { play(f, 'crouch'); return; }
      if (press('light')) return play(f, 'crouchLight');
      if (press('heavy')) return play(f, A(f).crouchHeavy ? 'crouchHeavy' : 'crouchLight');
      const blk = I[bwd] && o.threat;
      if (blk) { if (f.anim !== 'blockLow') play(f, 'blockLow'); return; }
      if (f.anim !== 'crouch') play(f, 'crouch');
      return;
    }
    if (press('light')) return play(f, 'light');
    if (press('heavy') && I[fwd] && A(f).throw && o.foe && !o.foe.air && !o.foe.held && Math.abs(o.foe.x - f.x) < 50 && !['down', 'getup', 'throwHit'].includes(o.foe.anim)) return play(f, 'throw');
    if (press('heavy')) return play(f, 'heavy');
    if (f.dashReq) { const d = f.dashReq; f.dashReq = null; if (d === fwd) return play(f, 'dash'); return play(f, 'backdash'); }
    if (f.anim === 'dash' && I[fwd]) return;
    if (I[bwd] && o.threat) { if (f.anim !== 'block') play(f, 'block'); return; }
    const want = I[fwd] ? 'walk' : I[bwd] ? 'back' : 'idle';
    if (want !== f.anim) play(f, want);
  }

  function physics(f) {
    const st = stats(f), fr = cur(f);
    if (f.freeze > 0) { f.freeze--; return; }
    const spd = f.speedMul;
    if (!f.air) {
      if (f.anim === 'walk') f.x += st.walk * spd * f.face;
      else if (f.anim === 'back') f.x -= st.back * spd * f.face;
      else if (f.anim === 'dash') f.x += st.dash * spd * f.face;
      else if (f.anim === 'backdash') f.x -= (f.fi === 0 ? 6.3 : 4) * f.face;
      // launch after the squat
      if (f.anim === 'jump' && fr.air === 'squat' && f.ft + TICK >= fr.dur) { f.air = true; f.vy = st.jumpV * f.jumpMul; f.vx = (f.jumpDir || 0) * 3.8 * f.face * spd; f.y = 0.01; }
      // knockback slides
      if (f.vx) { f.x += f.vx; f.vx *= 0.82; if (Math.abs(f.vx) < 0.05) f.vx = 0; }
    } else {
      f.y += f.vy; f.vy -= 0.5; f.x += f.vx;
      if (f.y <= 0) { f.y = 0; f.air = false; f.vy = 0; f.vx = 0; land(f); }
    }
    f.x = clamp(f.x, sim.camX + 22, sim.camX + VW - 22);
  }
  function land(f) {
    const an = A(f)[f.anim];
    if (f.anim === 'down') { const i = an.frames.findIndex((r) => r.air === 'land'); if (i >= 0) { f.fi = i; f.ft = 0; enter(f); } return; }
    if (f.anim === 'jump' || f.anim === 'air') { const i = A(f).jump.frames.findIndex((r) => r.air === 'land'); f.anim = 'jump'; f.fi = i; f.ft = 0; f.hitIds = new Set(); enter(f); return; }
    if (f.anim === 'hurt') { play(f, 'idle'); }
  }
  function animate(f) {
    if (f.freeze > 0) return;
    const an = A(f)[f.anim];
    let fr = cur(f);
    // physics-driven frame choice while airborne
    if (f.air && f.anim === 'jump') {
      const want = f.vy > 0.6 ? 'rise' : f.vy > -0.6 ? 'apex' : 'fall';
      const i = an.frames.findIndex((r) => r.air === want);
      if (i >= 0 && i !== f.fi) { f.fi = i; f.ft = 0; }
      return;
    }
    if (f.air && f.anim === 'down') { const i = an.frames.findIndex((r) => r.air === 'fly'); const last = an.frames.map((r) => r.air).lastIndexOf('fly'); if (f.fi > last) { f.fi = i; } }
    if (f.air && f.anim === 'air' && f.fi === an.frames.length - 1) return;
    if (f.air && f.anim === 'down' && fr.air === 'fly' && f.fi === an.frames.map((r) => r.air).lastIndexOf('fly')) return; // hold the last fly frame
    f.ft += TICK;
    let guard = 0;
    while (f.ft >= cur(f).dur && guard++ < 8) {
      f.ft -= cur(f).dur;
      if (f.anim === 'down' && cur(f).air === 'lying' && (f.hp <= 0 || sim.phase !== 'fight')) { f.ft = 0; return; }
      next(f);
    }
  }

  // ------------------------------------------------------------ hits
  function worldBox(f, b, lift) {
    const y0 = G - f.y - (lift || 0);
    return f.face > 0 ? [f.x + b[0], y0 + b[1], f.x + b[2], y0 + b[3]] : [f.x - b[2], y0 + b[1], f.x - b[0], y0 + b[3]];
  }
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  function hurtboxes(f) {
    const fr = cur(f);
    const bx = f.C.R.boxes(fr.pose);
    const out = {};
    for (const z of ['head', 'body', 'legs']) out[z] = worldBox(f, bx[z], fr.lift);
    return out;
  }
  function blocking(f, att) {
    const I = f.input;
    const bwd = f.face > 0 ? 'left' : 'right';
    const level = LOW[att.anim] ? 'low' : HIGH[att.anim] ? 'high' : 'mid';
    if (f.anim === 'blockLow' || (f.anim === 'blockHit' && f.low)) return level !== 'high';
    if (f.anim === 'block' || (f.anim === 'blockHit' && !f.low)) return level !== 'low';
    if (busy(f) || f.air) return false;
    if (!I[bwd]) return false;
    if (I.down) return level !== 'high';
    return level !== 'low';
  }
  function resolveHits() {
    const [a, b] = sim.fighters;
    for (const [att, def] of [[a, b], [b, a]]) {
      const fr = cur(att);
      if (!fr.hb || att.hitIds.has(fr.hitId) || att.freeze > 0) continue;
      const hb = worldBox(att, fr.hb, fr.lift);
      const hz = hurtboxes(def);
      const zones = Object.keys(hz).filter((z) => overlap(hb, hz[z]));
      if (!zones.length || cur(def).inv) continue;
      if (fr.throw) {
        if (def.air || def.held || ['down', 'getup', 'throwHit', 'throw'].includes(def.anim)) continue;
        def.held = att; def.stun = 0; def.vx = 0; def.vy = 0; def.freeze = 0;
        play(def, 'hurt'); play(att, 'throwHit'); sfx('hit'); sim.spark(def.x, G - 60, 'hit');
        continue;
      }
      att.hitIds.add(fr.hitId);
      const cx = (Math.max(hb[0], Math.min(...zones.map((z) => hz[z][0]))) + Math.min(hb[2], Math.max(...zones.map((z) => hz[z][2])))) / 2;
      const cy = (Math.max(hb[1], Math.min(...zones.map((z) => hz[z][1]))) + Math.min(hb[3], Math.max(...zones.map((z) => hz[z][3])))) / 2;
      if (blocking(def, att)) {
        def.low = !!def.input.down;
        const chip = fr.dmg * 0.08;
        def.hp = Math.max(1, def.hp - chip);
        play(def, 'blockHit'); def.low = !!def.input.down;
        def.vx = -def.face * fr.kb * 0.9 * KB; att.freeze = 3; def.freeze = 3;
        if (def.x <= sim.camX + 23 || def.x >= sim.camX + VW - 23) att.vx = -att.face * fr.kb * 0.8 * KB;
        sim.spark(cx, cy, 'block'); sfx('block');
        continue;
      }
      hitFighter(att, def, fr, zones, cx, cy);
    }
    // projectiles
    for (const p of sim.projs) {
      if (p.dead) continue;
      const def = sim.fighters[1 - p.owner.slot];
      const hb = p.kind === 'shot' ? [p.x - 14, G - p.y - 10, p.x + 14, G - p.y + 10] : [p.x - 11, G - p.y - 9, p.x + 11, G - p.y + 9];
      const hz = hurtboxes(def);
      const zones = Object.keys(hz).filter((z) => overlap(hb, hz[z]));
      if (!zones.length || cur(def).inv) continue;
      p.dead = true;
      const fr = p.kind === 'shot' ? { dmg: 11, stun: 400, kb: 4, kbUp: 3, kd: true, pd: 1.3, anim: 'shot' } : { dmg: 9, stun: 320, kb: 3, kbUp: 0, kd: false, pd: 1.3, anim: 'bat' };
      if (blocking(def, { anim: 'mid' })) { def.hp = Math.max(1, def.hp - (p.kind === 'shot' ? 2 : 1)); play(def, 'blockHit'); def.vx = -def.face * 2 * KB; sim.spark(p.x, G - p.y, 'block'); sfx('block'); continue; }
      hitFighter(p.owner, def, fr, zones, p.x, G - p.y);
    }
  }
  function hitFighter(att, def, fr, zones, cx, cy) {
    const dmg = fr.dmg * att.dmgMul * def.defMul;
    const wasHurt = def.stun > 0 || ['hurt', 'hurtLow', 'down'].includes(def.anim) || def.air;
    def.hp = Math.max(0, def.hp - dmg);
    att.combo = wasHurt ? att.combo + 1 : 1; att.comboT = 900;
    if (att.combo >= 2) sim.comboText(att, att.combo);
    def.freeze = fr.kd ? 7 : 4; att.freeze = fr.kd ? 6 : 3;
    sim.spark(cx, cy, fr.kd ? 'big' : 'hit'); sfx(fr.kd ? 'hit2' : 'hit');
    sim.shake = Math.max(sim.shake, fr.kd ? 3 : 1);
    def.flashT = 4;
    // part damage: every part whose zone was struck; weapons only when their owner was attacking
    for (const P of def.C.R.PARTS) {
      const s = def.parts[P.id];
      if (s.broken || !zones.includes(P.zone)) continue;
      if (P.attacking && !isAttack(def)) continue;
      s.hp -= dmg * (fr.pd || 1) * (P.attacking ? 1.6 : 1) * 0.7;
      if (s.hp <= 0) breakPart(att, def, P);
    }
    if (def.hp <= 0 && sim.mode === 'practice' && def.ai && def.ai.passive) { def.hp = def.maxhp; for (const P of def.C.R.PARTS) { const s = def.parts[P.id]; s.broken = false; s.hp = s.max; } def.breaks = 0; def.speedMul = 1; def.dmgMul = def.C.stats.dmg; def.defMul = def.C.stats.def; knockdown(def, att, fr, false); sim.callout('木人 RESET', '#9fe3ff', 900); return; }
    if (def.hp <= 0) { knockdown(def, att, fr, true); return; }
    if (fr.kd || def.air || def.anim === 'down') knockdown(def, att, fr, false);
    else {
      def.stun = fr.stun;
      def.vx = -def.face * fr.kb * KB;
      if (def.x <= sim.camX + 23 || def.x >= sim.camX + VW - 23) att.vx = -att.face * fr.kb * 0.6 * KB;
      play(def, def.anim === 'crouch' || def.anim === 'crouchLight' || def.anim === 'blockLow' ? 'hurtLow' : 'hurt');
    }
  }
  function knockdown(def, att, fr, ko) {
    def.air = true; def.y = Math.max(def.y, 0.01);
    def.vy = (Math.max(2.4, (fr.kbUp || 0) * 0.8) + (ko ? 0.6 : 0)) * KB;
    def.vx = -def.face * (fr.kb || 3) * 1.1 * KB;
    def.stun = 0;
    play(def, 'down');
    if (ko) { def.koed = true; sim.ko(def, att); }
  }
  function breakPart(att, def, P) {
    const s = def.parts[P.id];
    s.broken = true; s.hp = 0; def.breaks++;
    const hook = def.C.onBreak && def.C.onBreak[P.id];
    if (hook) hook(def);
    // structural damage and a burst of debris in the part's colours
    def.hp = Math.max(0, def.hp - 4);
    const an = def.C.R.anchors(cur(def).pose)[P.id] || [0, -54];
    const wx = def.x + an[0] * def.face, wy = G - def.y + an[1];
    sim.debris(wx, wy, def, P);
    sim.shake = Math.max(sim.shake, 4);
    sfx('break');
    sim.callout('PART BREAK! ' + P.label, '#ffd24a', 1300, def);
    if (def.hp <= 0 && !def.koed) { def.koed = true; knockdown(def, att, { kb: 4, kbUp: 3 }, true); }
  }
  function spawnBat(f) {
    f.batOut = true;
    sim.projs.push({ owner: f, x: f.x + 29 * f.face, y: 65, vx: 6.1 * f.face, life: 70, flap: 0, t: 0 });
  }
  // the katana leaves her hand: a spinning prop that lands blade-first and waits to be picked up (↓ beside it)
  function loseSword(f) {
    if (f.swordLost) return;
    f.swordLost = true;
    sim.props.push({ kind: 'sword', owner: f, x: f.x + 6 * f.face, y: 72, vx: -f.face * (2.4 + rnd() * 1.6) * 1.6, vy: 6.5 + rnd() * 2, rot: -40, vr: -18 * f.face, landed: false, dead: false, t: 0 });
    sim.callout('刀が飛んだ！', '#9fe3ff', 900);
  }
  function pickUpSword(f) {
    const sw = sim.props.find((p) => p.kind === 'sword' && p.owner === f && p.landed && !p.dead && Math.abs(p.x - f.x) < 28);
    if (!sw) return false;
    sw.dead = true; f.swordLost = false;
    const P = f.parts.blade; if (P) { P.broken = false; P.hp = Math.max(P.hp, P.max * 0.5); }
    f.dmgMul /= 0.85; f.breaks = Math.max(0, f.breaks - 1);
    sim.callout('刀を拾った', f.C.color, 800); sfx('click');
    return true;
  }
  function spawnShot(f) {
    sim.projs.push({ owner: f, kind: 'shot', x: f.x + 36 * f.face, y: 60, vx: 6.6 * f.face, life: 56, flap: 0, t: 0 });
  }
  // a grabbed fighter rides along with the thrower until the release frame, which is the actual hit
  function holdTick(f) {
    const att = f.held;
    if (!att) return;
    const fr = cur(att);
    if (att.anim !== 'throwHit' || att.hp <= 0) { f.held = null; if (f.anim === 'hurt') play(f, 'idle'); return; }
    f.x = clamp(att.x + att.face * (fr.holdX ?? 40), sim.camX + 22, sim.camX + VW - 22); f.y = fr.holdY || 0; f.face = -att.face;
    f.air = false; f.vx = 0; f.vy = 0; f.stun = 100; f.freeze = 0;
    if (f.anim !== 'hurt') play(f, 'hurt');
    f.fi = 0; f.ft = 0;
    if (fr.release && !att.hitIds.has('release')) {
      att.hitIds.add('release'); f.held = null;
      hitFighter(att, f, fr, ['body'], f.x, G - f.y - 50);
    }
  }

  // ------------------------------------------------------------ CPU
  function think(f, foe) {
    const ai = f.ai;
    const I = f.input;
    for (const k of Object.keys(I)) I[k] = false;
    if (ai.passive) return;
    if (ai.wait > 0) { ai.wait--; if (ai.hold) Object.assign(I, ai.hold); return; }
    const dx = foe.x - f.x, d = Math.abs(dx), dir = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
    const foeAtt = isAttack(foe) && !!cur(foe).hb || (isAttack(foe) && foe.fi < 2);
    const reach = f.form === 'wolf' ? 72 : f.C.id === 'jk' ? 76 : 61;
    const lvl = ai.level;
    const r = rnd();
    const hold = (keys, ticks) => { ai.hold = keys; ai.wait = ticks; Object.assign(I, keys); };
    if (busy(f) || f.air) { if (f.air && d < 72 && r < 0.4 * lvl) I.light = true; return; }
    // defend
    if (foeAtt && d < 126 && r < 0.35 + 0.45 * lvl) { hold({ [away]: true, down: rnd() < 0.4 }, 10 + Math.floor(rnd() * 10)); return; }
    if (foe.anim === 'down' && d < 90) { hold({ [away]: true }, 10); return; }
    if (f.swordLost && !foeAtt) {
      const sw = sim.props.find((p) => p.kind === 'sword' && p.owner === f && p.landed && !p.dead);
      if (sw) { const sd = sw.x - f.x; if (Math.abs(sd) < 22) { I.down = true; hold({ down: true }, 4); return; } if (Math.abs(sd) < 170 && r < 0.7) { hold({ [sd > 0 ? 'right' : 'left']: true }, 8); return; } }
    }
    if (d > reach + 25) {
      if (r < 0.06 * lvl && f.C.id !== 'maid') { I.special = true; if (A(f).special2 && rnd() < 0.7) { I.down = true; hold({ down: true }, 6); } else hold({}, 6); return; }
      if (r < 0.14) { I[dir] = true; hold({ [dir]: true }, 6); ai.tapTwice = 1; return; }
      if (r < 0.2 && d < 162) { hold({ up: true, [dir]: true }, 3); return; }
      if (ai.tapTwice) { ai.tapTwice = 0; I[dir] = true; hold({ [dir]: true }, 14); return; }
      hold({ [dir]: true }, 8 + Math.floor(rnd() * 10));
      return;
    }
    // in range
    const p = rnd();
    if (p < 0.1 && d < 44 && A(f).throw && !foe.air) { I[dir] = true; I.heavy = true; hold({ [dir]: true }, 4); }
    else if (p < 0.34) { I.light = true; hold({ light: false }, 14); ai.chain = 3; }
    else if (p < 0.55) { I.heavy = true; hold({}, 16); ai.chain = 2; }
    else if (p < 0.65) { I.down = true; if (rnd() < 0.5) I.light = true; else I.heavy = true; hold({ down: true }, 12); }
    else if (p < 0.72 + 0.1 * lvl) { I.special = true; hold({}, 8); }
    else if (p < 0.86) { hold({ [away]: true }, 12 + Math.floor(rnd() * 12)); }
    else { hold({ up: true, [dir]: true }, 4); }
  }
  function chainThink(f) {
    // press the next button in a chain window
    const ai = f.ai;
    if (!ai || !ai.chain || !isAttack(f)) return;
    const fr = cur(f);
    if (fr.chain && rnd() < 0.5 + 0.4 * ai.level) { f.input.light = f.anim.startsWith('light') || f.anim === 'bump'; f.input.heavy = !f.input.light; ai.chain--; }
  }

  // ------------------------------------------------------------ simulation state
  const sim = {
    t: 0, phase: 'title', fighters: [], projs: [], props: [], particles: [], texts: [], camX: 80, camTarget: 80, shake: 0, timer: 60000, round: 1, mode: '1p', sel: [0, 0], selStep: 0, koT: 0, slow: 1, level: 0.6,
    introT: 0, resultT: 0, winner: null, demoT: 0,
    callout(text, color, ms, f) { this.texts.push({ text, color, t: ms, life: ms, f, kind: 'big' }); },
    comboText(f, n) { this.texts = this.texts.filter((t) => !(t.kind === 'combo' && t.f === f)); this.texts.push({ text: n + ' HITS', color: f.C.color, t: 800, life: 800, f, kind: 'combo' }); },
    spark(x, y, kind) {
      const n = kind === 'big' ? 18 : kind === 'block' ? 8 : 12;
      const cols = kind === 'block' ? ['#ffffff', '#9fe3ff', '#5aa3d4'] : ['#ffffff', '#fff2a0', '#ffb040', '#ff6a3a'];
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, s = (kind === 'big' ? 3.6 : 2.5) * (0.4 + rnd()); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 14 + rnd() * 10, col: cols[Math.floor(rnd() * cols.length)], g: 0.14, size: rnd() < 0.3 ? 3 : 2 }); }
      this.particles.push({ x, y, ring: 1, life: 8, col: kind === 'block' ? '#9fe3ff' : '#ffffff', r: kind === 'big' ? 11 : 7 });
    },
    debris(x, y, f, P) {
      const M = f.C.R.M;
      const pal = { arm: ['#e4ebf5', '#a9b5cc', '#6a7590', '#ff9a3a'], leg: ['#e4ebf5', '#a9b5cc', '#414a62', '#ff9a3a'], blade: ['#d9e0ee', '#7a8398', '#2f3446', '#ffffff'], uniform: ['#ffffff', '#d3d8e8', '#ff6a5c', '#8fa4d0'],
        glasses: ['#ff4040', '#d01c1c', '#c8fbff', '#ffffff'], laptop: ['#e8ebf2', '#b6bccb', '#505766', '#62d8ff'], slippers: ['#ffe66a', '#f2bc34', '#bc861e', '#ffffff'], ahoge: ['#ffdc62', '#eaa92e', '#fff8d0', '#b8721a'],
        headdress: ['#ffffff', '#d9dcea', '#a4a9c4', '#ffffff'], apron: ['#ffffff', '#d9dcea', '#a4a9c4', '#fbfbfe'], ribbon: ['#ff5c6c', '#cc2840', '#ffb0b8', '#ffffff'], shoes: ['#4a4860', '#2e2c40', '#7c7a92', '#ffffff'] }[P.id] || ['#ffffff', '#cccccc', '#888888', '#ffd24a'];
      for (let i = 0; i < 26; i++) { const a = -Math.PI * (0.15 + rnd() * 0.7), s = 2 + rnd() * 4; this.particles.push({ x: x + (rnd() - 0.5) * 10, y: y + (rnd() - 0.5) * 10, vx: Math.cos(a) * s * (rnd() < 0.5 ? 1 : -1), vy: Math.sin(a) * s, life: 30 + rnd() * 30, col: pal[Math.floor(rnd() * pal.length)], g: 0.28, size: rnd() < 0.45 ? 3 : 2, bounce: true }); }
      this.particles.push({ x, y, ring: 1, life: 12, col: '#ffd24a', r: 18 });
      this.particles.push({ x, y, ring: 1, life: 9, col: '#ffffff', r: 9 });
    },
    ko(def, att) { this.phase = 'ko'; this.koT = 0; this.slow = 0.35; sfx('ko'); this.callout('K.O.', '#ff5a5a', 1600); },
  };

  function threatOf(foe) { return isAttack(foe) && foe.fi <= A(foe)[foe.anim].frames.findIndex((r) => r.hb) + 1 || sim.projs.some((p) => !p.dead && p.owner === foe); }

  function startMatch(p1Id, p2Id, mode) {
    sim.fighters = [makeFighter(byId(p1Id), 0), makeFighter(byId(p2Id), 1)];
    sim.mode = mode; sim.round = 1;
    sim.fighters[0].wins = 0; sim.fighters[1].wins = 0;
    if (mode !== '2p') sim.fighters[1].ai = { level: sim.level, wait: 0, hold: null, passive: mode === 'practice' };
    if (mode === 'demo') sim.fighters[0].ai = { level: sim.level, wait: 0, hold: null };
    startRound();
  }
  function startRound() {
    const [a, b] = sim.fighters;
    for (const f of [a, b]) {
      f.hp = f.maxhp; f.x = f.slot === 0 ? W / 2 - 83 : W / 2 + 83; f.y = 0; f.vx = f.vy = 0; f.air = false; f.stun = 0; f.freeze = 0; f.combo = 0; f.koed = false; f.trail = []; f.batOut = false; f.face = f.slot === 0 ? 1 : -1;
      f.input = {}; f.prev = {}; f.queue = null;
      if (f.ai) f.ai.wait = 0;
      play(f, 'idle');
    }
    sim.projs = []; sim.props = []; sim.particles = []; sim.texts = [];
    for (const f of sim.fighters) { f.swordLost = false; f.held = null; }
    sim.timer = 60000; sim.phase = 'intro'; sim.introT = 0; sim.slow = 1; sim.camX = W / 2 - VW / 2; sim.camTarget = sim.camX;
  }

  function step() {
    sim.t += TICK;
    const [a, b] = sim.fighters.length ? sim.fighters : [null, null];
    if (sim.phase === 'intro') {
      sim.introT += TICK;
      if (sim.introT > 1800) { sim.phase = 'fight'; sim.callout('FIGHT!', '#ffffff', 700); sfx('go'); }
    }
    if (sim.phase === 'fight' && sim.mode !== 'practice') {
      sim.timer = Math.max(0, sim.timer - TICK);
      if (sim.timer === 0) { sim.phase = 'ko'; sim.koT = 0; sim.slow = 1; sim.callout('TIME UP', '#ffffff', 1500); }
    }
    if (!a) return;
    if (sim.phase === 'fight' || sim.phase === 'intro' || sim.phase === 'ko') {
      const active = sim.phase === 'fight';
      for (const f of [a, b]) {
        const foe = f === a ? b : a;
        if (f.ai && active) { think(f, foe); chainThink(f); }
        else if (f.ai) for (const k of Object.keys(f.input)) f.input[k] = false;
        if (active && !f.koed) control(f, { threat: threatOf(foe), foe: foe });
        f.prev = Object.assign({}, f.input);
        if (f.stun > 0) f.stun = Math.max(0, f.stun - TICK);
        if (f.comboT > 0) { f.comboT -= TICK; if (f.comboT <= 0) f.combo = 0; }
        if (f.flashT > 0) f.flashT--;
      }
      for (const f of [a, b]) physics(f);
      // keep them apart
      const dx = b.x - a.x;
      if (Math.abs(dx) < 29 && !a.air && !b.air && a.anim !== 'down' && b.anim !== 'down') { const push = (29 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); a.x -= push; b.x += push; }
      for (const f of [a, b]) {
        const foe = f === a ? b : a;
        if (!busy(f) && !f.air && f.anim !== 'crouch' && f.anim !== 'blockLow') f.face = foe.x >= f.x ? 1 : -1;
        animate(f);
      }
      for (const f of sim.fighters) holdTick(f);
      if (active) resolveHits();
      // projectiles
      for (const p of sim.projs) {
        if (p.dead) continue;
        p.x += p.vx; p.t++;
        if (p.kind === 'shot') { p.y = 60; } else { p.flap = (p.t >> 3) & 1; p.y = 65 + Math.sin(p.t * 0.25) * 5 * (p.owner.blind ? 3 : 1); }
        if (--p.life <= 0 || p.x < sim.camX - 30 || p.x > sim.camX + VW + 30) p.dead = true;
      }
      for (const sw of sim.props) {
        if (sw.dead || sw.landed) continue;
        sw.x += sw.vx; sw.y += sw.vy; sw.vy -= 0.5; sw.rot += sw.vr; sw.t++;
        if (sw.y <= 0) { sw.landed = true; sw.rot = sw.vx > 0 ? 58 : 122; sw.y = 60 * Math.sin(58 * Math.PI / 180) - 12; sfx('click'); sim.spark(sw.x, G, 'hit'); }
        sw.x = clamp(sw.x, 30, W - 30);
      }
      for (const p of sim.projs) if (p.dead && p.owner.batOut) p.owner.batOut = false;
      sim.projs = sim.projs.filter((p) => !p.dead);
      if (sim.phase === 'ko') {
        sim.koT += TICK;
        if (sim.koT > 900) sim.slow = 1;
        if (sim.koT > 2600) endRound();
      }
    }
    // camera follows the midpoint
    if (a && b) {
      const mid = (a.x + b.x) / 2;
      sim.camTarget = clamp(mid - VW / 2, 0, W - VW);
      sim.camX += (sim.camTarget - sim.camX) * 0.12;
    }
    for (const p of sim.particles) {
      p.life--;
      if (p.ring) continue;
      p.x += p.vx; p.y += p.vy; p.vy += p.g || 0;
      if (p.bounce && p.y > G - 1) { p.y = G - 1; p.vy *= -0.4; p.vx *= 0.6; }
    }
    sim.particles = sim.particles.filter((p) => p.life > 0);
    for (const t of sim.texts) t.t -= TICK;
    sim.texts = sim.texts.filter((t) => t.t > 0);
    if (sim.shake > 0) sim.shake = Math.max(0, sim.shake - 0.25);
  }
  function endRound() {
    const [a, b] = sim.fighters;
    let winner = null;
    if (a.hp <= 0 && b.hp <= 0) winner = null;
    else if (a.hp <= 0) winner = b; else if (b.hp <= 0) winner = a;
    else winner = a.hp === b.hp ? null : a.hp > b.hp ? a : b;
    if (winner) winner.wins++;
    sim.phase = 'result'; sim.resultT = 0; sim.winner = winner;
    for (const f of [a, b]) { f.input = {}; if (f === winner && !f.air && f.anim !== 'down') play(f, 'win'); else if (f !== winner && f.hp > 0 && f.anim !== 'down') play(f, 'lose'); }
    sim.callout(winner ? (winner.slot === 0 ? 'P1' : (sim.mode === '2p' ? 'P2' : 'CPU')) + ' WIN' : 'DRAW', winner ? winner.C.color : '#ffffff', 2200);
  }
  function afterResult() {
    const [a, b] = sim.fighters;
    if (a.wins >= 2 || b.wins >= 2) { sim.phase = 'end'; sim.resultT = 0; return; }
    sim.round++;
    startRound();
  }

  // ------------------------------------------------------------ input
  const KEYS = {
    ArrowLeft: [0, 'left'], ArrowRight: [0, 'right'], ArrowUp: [0, 'up'], ArrowDown: [0, 'down'], z: [0, 'light'], x: [0, 'heavy'], c: [0, 'special'],
    a: [1, 'left'], d: [1, 'right'], w: [1, 'up'], s: [1, 'down'], j: [1, 'light'], k: [1, 'heavy'], l: [1, 'special'],
  };
  const held = [{}, {}], stick = [{}, {}]; // stick: a press that lasts at least one simulation tick
  let uiPress = null;
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    ensureAudio();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'g' && !e.repeat && glc) { wantGL = !wantGL; if (!wantGL) gl = null; glc.style.display = wantGL ? '' : 'none'; }
    if (k === 'b' && !e.repeat) usePuppet = !usePuppet;
    const m = KEYS[k];
    if (m) { e.preventDefault(); if (!held[m[0]][m[1]]) { uiPress = uiPress || { slot: m[0], key: m[1] }; stick[m[0]][m[1]] = true; } held[m[0]][m[1]] = true; }
    if (e.key === 'Enter') { e.preventDefault(); uiPress = { slot: 0, key: 'start' }; }
    if (e.key === 'Escape') { uiPress = { slot: 0, key: 'esc' }; }
    if (k === 'm') { soundOn = !soundOn; }
    if (k === 'p' && sim.phase === 'fight') { sim.paused = !sim.paused; }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; const m = KEYS[k]; if (m) held[m[0]][m[1]] = false; });
  window.addEventListener('blur', () => { for (const h of held) for (const k of Object.keys(h)) h[k] = false; });
  // touch pad: hold buttons for P1
  document.querySelectorAll('[data-hold]').forEach((b) => {
    const k = b.dataset.hold;
    const on = (e) => { e.preventDefault(); ensureAudio(); if (!held[0][k]) { uiPress = uiPress || { slot: 0, key: k }; stick[0][k] = true; } held[0][k] = true; };
    const off = () => { held[0][k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });
  document.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', () => { ensureAudio(); uiPress = { slot: 0, key: b.dataset.press }; }));

  function applyInput() {
    for (const f of sim.fighters) if (!f.ai) { for (const k of ['left', 'right', 'up', 'down', 'light', 'heavy', 'special']) { f.input[k] = !!held[f.slot][k] || !!stick[f.slot][k]; stick[f.slot][k] = false; } }
  }

  // ------------------------------------------------------------ screens
  const MODES = [['1p', '1P vs CPU'], ['practice', '練習（木人）'], ['2p', '1P vs 2P'], ['demo', 'CPU vs CPU（觀戰）']];
  let modeI = 0;
  const LEVELS = [['かんたん', 0.3], ['ふつう', 0.6], ['つよい', 0.95]];
  let levelI = 1;
  function uiStep() {
    const p = uiPress; uiPress = null;
    if (!p) return;
    if (sim.phase === 'title') {
      if (p.key === 'up') { modeI = (modeI + MODES.length - 1) % MODES.length; sfx('sel'); }
      else if (p.key === 'down') { modeI = (modeI + 1) % MODES.length; sfx('sel'); }
      else if (p.key === 'left') { levelI = (levelI + LEVELS.length - 1) % LEVELS.length; sfx('sel'); }
      else if (p.key === 'right') { levelI = (levelI + 1) % LEVELS.length; sfx('sel'); }
      else if (['start', 'light', 'heavy', 'special'].includes(p.key)) {
        sfx('ok');
        if (ROSTER.length === 1) { sim.level = LEVELS[levelI][1]; sim.sel = [0, 0]; startMatch(ROSTER[0].id, ROSTER[0].id, MODES[modeI][0]); }
        else { sim.phase = 'select'; sim.sel = [0, 1]; sim.selStep = 0; }
      }
      return;
    }
    if (sim.phase === 'select') {
      const mode = MODES[modeI][0];
      const who = sim.selStep === 0 ? 0 : 1;
      const slotOk = mode === '2p' ? p.slot === who : p.slot === 0;
      if (p.key === 'esc') { sim.phase = 'title'; return; }
      if (!slotOk && p.key !== 'start') return;
      if (p.key === 'left') { sim.sel[who] = (sim.sel[who] + ROSTER.length - 1) % ROSTER.length; sfx('sel'); }
      else if (p.key === 'right') { sim.sel[who] = (sim.sel[who] + 1) % ROSTER.length; sfx('sel'); }
      else if (['start', 'light', 'heavy', 'special'].includes(p.key)) {
        sfx('ok');
        if (sim.selStep === 0) {
          sim.selStep = 1;
          if (mode !== '2p') { sim.sel[1] = Math.floor(rnd() * ROSTER.length); }
          if (mode !== '2p') { sim.level = LEVELS[levelI][1]; startMatch(ROSTER[sim.sel[0]].id, ROSTER[sim.sel[1]].id, mode); }
        } else { sim.level = LEVELS[levelI][1]; startMatch(ROSTER[sim.sel[0]].id, ROSTER[sim.sel[1]].id, mode); }
      }
      return;
    }
    if (sim.phase === 'result' && sim.resultT > 1200 && ['start', 'light', 'heavy', 'special'].includes(p.key)) { afterResult(); return; }
    if (sim.phase === 'end' && sim.resultT > 800 && ['start', 'light', 'heavy', 'special'].includes(p.key)) { sim.phase = 'title'; sfx('ok'); return; }
    if (p.key === 'esc') { sim.phase = 'title'; }
  }

  // ------------------------------------------------------------ drawing
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const glc = document.getElementById('gl');
  let gl = null, wantGL = !!glc && !/\bgl=0\b/.test(location.search);
  let usePuppet = !/\bpuppet=0\b/.test(location.search);
  function initGL() {
    if (gl || !wantGL || !window.createGL) return;
    try { gl = window.createGL({ canvas: glc, VW, VH, G, far: FAR, near: NEAR, farRate: 0.35, RS }); }
    catch (e) { console.warn('WebGL renderer unavailable, staying on the 2D canvas', e); wantGL = false; glc.style.display = 'none'; }
  }
  function koZoom() { return sim.phase === 'ko' ? 1 + 0.12 * Math.min(1, sim.koT / 500) : sim.phase === 'result' ? 1.12 : 1; }
  const RS = 2;  // render scale: the low canvas / WebGL target are 2× the world so the puppet's finer parts show
  const low = document.createElement('canvas'); low.width = VW * RS; low.height = VH * RS;
  const lx = low.getContext('2d'); lx.imageSmoothingEnabled = false;
  const BG = STAGE.paint();
  const FAR = toCanvas(BG.far.c, BG.far.w, BG.far.h), NEAR = toCanvas(BG.near.c, BG.near.w, BG.near.h);
  let scale = 3;
  const holder = document.getElementById('stage');
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const availCss = holder.clientWidth - 12;
    const intScale = Math.floor((availCss * dpr) / VW);
    const fill = intScale >= 1 && (intScale * VW) / dpr >= availCss * 0.8;
    scale = fill ? intScale : Math.max(1, (availCss * dpr) / VW);
    cv.width = Math.round(VW * scale); cv.height = Math.round(VH * scale);
    cv.style.width = (cv.width / dpr) + 'px'; cv.style.height = (cv.height / dpr) + 'px';
    if (glc) { glc.style.width = cv.style.width; glc.style.height = cv.style.height; }
  }
  window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(holder);

  // the energy shot: the Gemini sheet's projectile cell (effect pixels only), flipped to fly +x
  const shotImgs = {};
  function shotImg(face, t) {
    const key = face + ':' + ((t >> 2) & 1);
    if (shotImgs[key]) return shotImgs[key];
    const part = window.FX.sheetPart('jk2', 32);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < part.h; y++) for (let x = 0; x < part.w; x++) if (part.px[y * part.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, c = new Uint32Array(w * h);
    const flicker = (t >> 2) & 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = part.px[(y + y0) * part.w + (x + x0)];
      if (!v) continue;
      if (flicker && ((x + y) & 3) === 0) continue;
      c[y * w + (face > 0 ? w - 1 - x : x)] = v;
    }
    return (shotImgs[key] = toCanvas(c, w, h));
  }
  const batImgs = {};
  function batImg(flap, face, angry) {
    const key = flap + ':' + face + ':' + (angry ? 1 : 0);
    if (batImgs[key]) return batImgs[key];
    const buf = new PX.Buf(24, 14);
    window.VAMP.bat(buf, [12, 7], flap, { flip: face < 0, angry });
    PX.outline(buf);
    return (batImgs[key] = toCanvas(buf.c, buf.w, buf.h));
  }

  // ------------------------------------------------------------ world draw list
  // Both renderers consume the same list (screen pixels, camera applied, y down): draw2D() executes it on the
  // low canvas, src/gl.js turns it into textured planes in a three.js scene.
  function fighterList(list, f, camX) {
    const an = A(f)[f.anim], fr = cur(f);
    const S = f.C.R.SIZE;
    const img = frameImg(f, an, f.fi);
    const lift = f.y + (fr.lift || 0);
    const sx = Math.round(f.x - camX), sy = Math.round(G - lift);
    const oxL = S.w - 1 - S.ox;
    const right = f.face > 0;
    // the cutout puppet: parts bound to the interpolated skeleton (JK only, not for the standing picture)
    const PUP = window.PUPPET, puppet = usePuppet && PUP && f.C.id === 'jk' && !fr.pose.full && !fr.pose.hidden;
    const mirX = (m) => [-m[0], m[1], -m[2], m[3], -m[4], m[5]];
    const toScreen = (m, ox, oy, face) => { const q = face > 0 ? m : mirX(m); return [q[0], q[1], q[2], q[3], q[4] + ox, q[5] + oy]; };
    const brk = brokenOf(f);
    if (!fr.pose.hidden) {
      list.push({ k: 'blob', x: sx, y: G - 2, w: Math.max(11, 22 - f.y * 0.15) });
      if (lift >= 0) {
        if (puppet) {
          const sk = PUP.skeleton(an, f.fi, f.ft); f.sk = sk;
          const sh = [1, 0, -f.face * 0.5, -0.07, sx + 0.5 * f.face * lift, G + 0.07 * lift];
          for (const it of PUP.place(sk.J, Object.assign({}, sk.p, { noSword: !!f.swordLost || sk.p.noSword, lag: f._lag || 0 }), 'dark', brk)) list.push({ k: 'skew', img: it.img, m: PUP.mul(sh, right ? it.m : mirX(it.m)), a: 0.35 });
        } else list.push({ k: 'skew', img: right ? img.SR : img.SL, m: [1, 0, -f.face * 0.5, -0.07, Math.round(sx - (right ? S.ox : oxL) + S.oy * f.face * 0.5 + lift * f.face * 0.5), G + S.oy * 0.07 + lift * 0.07], a: 0.35 });
      }
    }
    for (const g of f.trail) {
      const age = (sim.t - g.t) / 200;
      if (age >= 1) continue;
      const gfr = g.an.frames[g.fi];
      if (usePuppet && PUP && g.sk && f.C.id === 'jk' && !gfr.pose.full && !gfr.pose.hidden) {
        const gx = Math.round(g.x - camX), gy = Math.round(G - g.y);
        for (const it of PUP.place(g.sk.J, g.sk.p, f.C.color, brk)) list.push({ k: 'skew', img: it.img, m: toScreen(it.m, gx, gy, g.face), a: 0.4 * (1 - age) });
        continue;
      }
      const gi = cache.get(f.C.id + ':' + g.an.form + ':' + g.an.id + ':' + g.fi + ':' + g.mask);
      if (!gi) continue;
      list.push({ k: 'img', img: g.face > 0 ? gi.GR : gi.GL, x: Math.round(g.x - camX - (g.face > 0 ? S.ox : oxL)), y: Math.round(G - g.y - S.oy), a: 0.4 * (1 - age) });
    }
    f.trail = f.trail.filter((g) => sim.t - g.t < 200);
    if (puppet) {
      const sk = f.sk && f.sk.an === an && f.sk.fi === f.fi && f.sk.ft === f.ft ? f.sk : PUP.skeleton(an, f.fi, f.ft);
      sk.an = an; sk.fi = f.fi; sk.ft = f.ft; f.sk = sk;
      // motion lag: how fast the head moves forward this frame (world + pose), smoothed
      const vx = (f.x - (f._lx ?? f.x)) * f.face + (sk.J.neck[0] - (f._ln ?? sk.J.neck[0]));
      f._lx = f.x; f._ln = sk.J.neck[0];
      const target = Math.max(-0.45, Math.min(0.45, vx * 0.05));
      f._lag = (f._lag || 0) + (target - (f._lag || 0)) * 0.3;
      sk.p = Object.assign({}, sk.p, { noSword: !!f.swordLost || sk.p.noSword, lag: f._lag });
      // reflection on the road, then the body, then the frame's effects (bloom sources) on top
      const rf = [1, 0, 0, -1, sx, 2 * G - sy];
      for (const it of PUP.place(sk.J, sk.p, 'cv', brk)) list.push({ k: 'skew', img: it.img, m: PUP.mul(rf, right ? it.m : mirX(it.m)), a: 0.2 });
      for (const it of PUP.place(sk.J, sk.p, sk.p.flash ? 'white' : 'cv', brk)) list.push({ k: 'skew', img: it.img, m: toScreen(it.m, sx, sy, f.face), a: 1 });
      const fxi = right ? img.FR : img.FL;
      if (fxi) list.push({ k: 'img', img: fxi, x: sx - (right ? S.ox : oxL), y: sy - S.oy, a: 1, glow: true });
    } else {
      f.sk = null;
      list.push({ k: 'img', img: right ? img.R : img.L, x: sx - (right ? S.ox : oxL), y: sy - S.oy, a: 1, fx: right ? img.FR : img.FL, refl: !fr.pose.hidden });
    }
  }
  function draw2D(list) {
    for (const it of list) {
      if (it.k === 'blob') { lx.fillStyle = 'rgba(4,6,20,0.55)'; for (let r = 0; r < 5; r++) { const ww = Math.round(it.w - Math.abs(r - 2) * 3); lx.fillRect(it.x - ww, it.y + r, ww * 2, 1); } }
      else if (it.k === 'skew') { lx.save(); lx.globalAlpha = it.a; lx.transform(...it.m); lx.drawImage(it.img, 0, 0); lx.restore(); }
      else if (it.k === 'img') { lx.globalAlpha = it.a; lx.drawImage(it.img, it.x, it.y); lx.globalAlpha = 1; }
      else if (it.k === 'rect') { lx.fillStyle = it.col; lx.fillRect(it.x, it.y, it.w, it.h); }
      else if (it.k === 'ring') { lx.strokeStyle = it.col; lx.globalAlpha = it.a; lx.beginPath(); lx.arc(it.x, it.y, it.r, 0, Math.PI * 2); lx.stroke(); lx.globalAlpha = 1; }
    }
  }
  function drawFighter(f, camX) { const list = []; fighterList(list, f, camX); draw2D(list); }

  function bar(x, y, w, h, frac, col, back, right) {
    lx.fillStyle = '#05060f'; lx.fillRect(x - 1, y - 1, w + 2, h + 2);
    lx.fillStyle = back; lx.fillRect(x, y, w, h);
    const fw = Math.round(w * clamp(frac, 0, 1));
    lx.fillStyle = col; lx.fillRect(right ? x + w - fw : x, y, fw, h);
    lx.fillStyle = 'rgba(255,255,255,0.35)'; lx.fillRect(right ? x + w - fw : x, y, fw, 1);
  }
  const ICONS = {
    arm: ['..###..', '.#.#.#.', '.#####.', '..###..', '..#.#..', '.##.##.', '.#...#.'],
    leg: ['..###..', '..#.#..', '..###..', '..#.#..', '..###..', '..#.##.', '.#####.'],
    blade: ['......#', '.....##', '....##.', '...##..', '.###...', '.##....', '#......'],
    cloth: ['.#...#.', '#######', '#.....#', '.#...#.', '.#...#.', '.#...#.', '.#####.'],
    glass: ['.......', '###.###', '#.#.#.#', '#.###.#', '###.###', '.......', '.......'],
    laptop: ['.#####.', '.#...#.', '.#...#.', '.#####.', '#######', '#.....#', '#######'],
    shoe: ['.......', '...##..', '..#.#..', '.##.##.', '#....##', '#######', '.......'],
    hair: ['...#...', '..##...', '..#....', '.##....', '.#.....', '##.....', '#......'],
    band: ['.#.#.#.', '#######', '#######', '.......', '.......', '.......', '.......'],
    seal: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  };
  function icon(name, x, y, col, s = 2) {
    const rows = ICONS[name] || ICONS.seal;
    lx.fillStyle = col;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') lx.fillRect(x + i * s, y + j * s, s, s); });
  }
  function hudPixels() {
    const [a, b] = sim.fighters;
    if (!a) return;
    const BW = 178;
    for (const f of [a, b]) {
      const right = f.slot === 1;
      const x0 = right ? VW - 12 - 42 - BW : 12 + 42;
      bar(x0, 10, BW, 9, f.hp / f.maxhp, f.hp / f.maxhp > 0.3 ? '#ffd24a' : '#ff5a5a', '#5a1a24', right);
      const pr = portrait(f);
      lx.drawImage(pr, right ? VW - 12 - 38 : 12, 4);
      f.C.R.PARTS.forEach((P, i) => {
        const st = f.parts[P.id];
        const ix = right ? x0 + BW - 15 - i * 18 : x0 + i * 18;
        const col = st.broken ? '#ff4a4a' : st.hp / st.max < 0.5 ? '#ffb040' : '#cfe0ff';
        lx.fillStyle = 'rgba(5,6,15,0.7)'; lx.fillRect(ix - 1, 23, 16, 16);
        icon(P.icon, ix, 24, st.broken ? '#6a2a2a' : col, 2);
        if (st.broken) { lx.strokeStyle = '#ff4a4a'; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(ix + 1, 25); lx.lineTo(ix + 13, 37); lx.moveTo(ix + 13, 25); lx.lineTo(ix + 1, 37); lx.stroke(); }
        else { lx.fillStyle = '#05060f'; lx.fillRect(ix - 1, 40, 16, 3); lx.fillStyle = col; lx.fillRect(ix - 1, 40, Math.round(16 * st.hp / st.max), 2); }
      });
      for (let i = 0; i < 2; i++) { lx.fillStyle = i < f.wins ? f.C.color : '#2a2e52'; lx.fillRect(right ? VW - 12 - 38 - 8 - i * 9 : 12 + 42 + i * 9, 46, 6, 4); }
    }
  }

  function worldList(camX) {
    const list = [];
    const fs = sim.fighters.slice().sort((p, q) => (p.anim === 'down' ? -1 : 0) - (q.anim === 'down' ? -1 : 0));
    for (const f of fs) fighterList(list, f, camX);
    for (const p of sim.projs) {
      if (p.dead) continue;
      if (p.kind === 'shot') { const im = shotImg(p.vx > 0 ? 1 : -1, p.t); list.push({ k: 'img', img: im, x: Math.round(p.x - camX - im.width / 2), y: Math.round(G - p.y - im.height / 2), a: 1, glow: true }); continue; }
      list.push({ k: 'img', img: batImg(p.flap, p.vx > 0 ? 1 : -1, p.owner.parts.laptop && p.owner.parts.laptop.broken), x: Math.round(p.x - camX - 12), y: Math.round(G - p.y - 7), a: 1 });
    }
    for (const sw of sim.props) {
      if (sw.dead || !window.PUPPET) continue;
      const part = window.PUPPET.build().sword, PUP = window.PUPPET;
      const m = PUP.mul(PUP.mul(PUP.T(Math.round(sw.x - camX), Math.round(G - sw.y)), PUP.R(sw.rot * Math.PI / 180)), PUP.T(-part.pivot[0], -part.pivot[1]));
      if (!sw.landed) list.push({ k: 'blob', x: Math.round(sw.x - camX), y: G - 2, w: 9 });
      list.push({ k: 'skew', img: part.cv, m, a: 1 });
    }
    for (const p of sim.particles) {
      if (p.ring) { list.push({ k: 'ring', x: p.x - camX, y: p.y, r: p.r * (1.6 - p.life / 12), col: p.col, a: p.life / 12 }); continue; }
      list.push({ k: 'rect', x: Math.round(p.x - camX), y: Math.round(p.y), w: p.size || 1, h: p.size || 1, col: p.col });
    }
    return list;
  }
  function drawWorld() {
    const camX = Math.round(sim.camX);
    const shake = sim.shake > 0.2 ? [Math.round((rnd() * 2 - 1) * sim.shake), Math.round((rnd() * 2 - 1) * sim.shake * 0.5)] : [0, 0];
    const list = worldList(camX);
    initGL();
    lx.setTransform(RS, 0, 0, RS, 0, 0);
    if (gl) {
      gl.render({ camX, list, shake, zoom: koZoom() });
      lx.clearRect(0, 0, VW, VH);
    } else {
      lx.setTransform(RS, 0, 0, RS, shake[0] * RS, shake[1] * RS);
      lx.drawImage(FAR, -Math.round(camX * 0.35), 0);
      lx.drawImage(NEAR, -camX, 0);
      draw2D(list);
      lx.setTransform(RS, 0, 0, RS, 0, 0);
    }
    if (sim.phase !== 'title' && sim.phase !== 'select') hudPixels();
  }

  // text HUD on the scaled canvas
  const FONT = '"DotGothic16", "Noto Sans TC", monospace';
  function text(str, x, y, size, col, align = 'center', shadow = true) {
    ctx.font = size * scale + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (shadow) { ctx.fillStyle = '#05060f'; ctx.fillText(str, x * scale + scale, y * scale + scale); }
    ctx.fillStyle = col; ctx.fillText(str, x * scale, y * scale);
  }
  function drawHudText() {
    const [a, b] = sim.fighters;
    if (!a) return;
    text(a.C.R.name + (a.form === 'wolf' ? '（狼）' : '') + ' 1P', 54, 56, 12, '#e8ebf8', 'left');
    text(b.C.R.name + (b.form === 'wolf' ? '（狼）' : '') + (sim.mode === '2p' ? ' 2P' : sim.mode === 'practice' ? ' 木人' : ' CPU'), VW - 54, 56, 12, '#e8ebf8', 'right');
    text(sim.mode === 'practice' ? '∞' : Math.ceil(sim.timer / 1000).toString().padStart(2, '0'), VW / 2, 20, 22, sim.timer < 10000 && sim.mode !== 'practice' ? '#ff5a5a' : '#ffffff');
    text('ROUND ' + sim.round, VW / 2, 40, 10, '#b9c2ea');
    for (const t of sim.texts) {
      const k = t.t / t.life;
      if (t.kind === 'combo') { const f = t.f; text(t.text, f.slot === 0 ? 60 : VW - 60, 90 + (1 - k) * 6, 15, t.color, f.slot === 0 ? 'left' : 'right'); continue; }
      const pop = k > 0.85 ? 1 + (k - 0.85) * 6 : 1;
      ctx.save(); ctx.globalAlpha = k < 0.2 ? k / 0.2 : 1;
      const y = t.text.startsWith('PART') ? 78 : t.text === 'FIGHT!' || t.text === 'K.O.' ? 126 : 108;
      text(t.text, VW / 2, y, (t.text.length > 12 ? 16 : 24) * pop, t.color);
      ctx.restore();
    }
    if (sim.phase === 'intro') { const k = sim.introT; if (k < 1200) text('ROUND ' + sim.round, VW / 2, 120, 27, '#ffd24a'); }
    if (sim.phase === 'result' && sim.resultT > 1200) text('PRESS Z / ENTER', VW / 2, 225, 12, '#b9c2ea');
    if (sim.phase === 'end') {
      const w = sim.fighters.find((f) => f.wins >= 2);
      ctx.fillStyle = 'rgba(5,6,15,0.55)'; ctx.fillRect(0, 90 * scale, cv.width, 105 * scale);
      text((w ? (w.slot === 0 ? 'P1 ' : (sim.mode === '2p' ? 'P2 ' : 'CPU ')) + w.C.R.name : '') + ' WINS', VW / 2, 126, 24, w ? w.C.color : '#fff');
      text('破壞部位 ' + sim.fighters[0].breaks + ' / ' + sim.fighters[1].breaks + '   PRESS Z / ENTER', VW / 2, 159, 12, '#e8ebf8');
    }
    if (sim.paused) text('PAUSE', VW / 2, 135, 24, '#ffffff');
  }
  function drawTitle() {
    lx.setTransform(RS, 0, 0, RS, 0, 0);
    lx.drawImage(FAR, -30, 0); lx.drawImage(NEAR, -120, 0);
    lx.fillStyle = 'rgba(5,6,15,0.45)'; lx.fillRect(0, 0, VW, VH);
    // three club members standing in a row
    if (!sim.titleCast) {
      sim.titleCast = ROSTER.map((C) => makeFighter(C, 0));
      sim.titleCast.forEach((f, i) => { f.x = (ROSTER.length === 1 ? 120 : 70) + i * 80; play(f, 'idle'); });
    }
    sim.titleCast.forEach((f) => { f.face = 1; animate(f); drawFighter(f, 0); });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(low, 0, 0, cv.width, cv.height);
    text('怪異探偵部', VW / 2, 50, 45, '#ffffff');
    text('KAII TANTEI-BU — PART BREAK FIGHTERS', VW / 2, 78, 10, '#ffd24a');
    const mx = 352;
    MODES.forEach((m, i) => text((i === modeI ? '▶ ' : '   ') + m[1], mx, 160 + i * 18, 13, i === modeI ? '#ffd24a' : '#b9c2ea'));
    text('CPU 強度 ◀ ' + LEVELS[levelI][0] + ' ▶', mx, 236, 12, '#e8ebf8');
    text('Z / ENTER で開始', mx, 254, 10, '#b9c2ea');
    text('東京鬼高校・怪異探偵部', 140, 258, 10, '#8f97b8');
  }
  function drawSelect() {
    lx.setTransform(RS, 0, 0, RS, 0, 0);
    lx.drawImage(FAR, -60, 0); lx.drawImage(NEAR, -180, 0);
    lx.fillStyle = 'rgba(5,6,15,0.5)'; lx.fillRect(0, 0, VW, VH);
    if (!sim.selCast) { sim.selCast = ROSTER.map((C) => makeFighter(C, 0)); sim.selCast.forEach((f) => play(f, 'idle')); }
    const mode = MODES[modeI][0];
    sim.selCast.forEach((f, i) => {
      f.x = ROSTER.length === 1 ? VW / 2 : 96 + i * 144; f.face = 1;
      const chosen = (sim.selStep === 0 && sim.sel[0] === i) || (sim.selStep === 1 && sim.sel[1] === i);
      if (chosen && f.anim === 'idle' && rnd() < 0.01) play(f, i === 0 ? 'light' : i === 1 ? 'light' : 'heavy');
      animate(f);
      if (isAttack(f) && f.fi === A(f)[f.anim].frames.length - 1 && f.ft > cur(f).dur - 20) play(f, 'idle');
      drawFighter(f, 0);
      lx.fillStyle = chosen ? f.C.color : 'rgba(255,255,255,0.15)'; lx.fillRect(f.x - 40, G + 6, 80, 3);
    });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(low, 0, 0, cv.width, cv.height);
    text(sim.selStep === 0 ? 'P1 SELECT' : (mode === '2p' ? 'P2 SELECT' : 'CPU'), VW / 2, 24, 21, '#ffd24a');
    sim.selCast.forEach((f, i) => {
      const chosen = (sim.selStep === 0 && sim.sel[0] === i) || (sim.selStep === 1 && sim.sel[1] === i);
      text(f.C.R.name, f.x, 252, 13, chosen ? f.C.color : '#b9c2ea');
      text(f.C.R.height + ' · ' + f.C.R.PARTS.map((p) => p.label).join('/'), f.x, 264, 8, '#8f97b8');
      if (sim.selStep === 1 && sim.sel[0] === i) text('1P', f.x - 42, 150, 12, ROSTER[sim.sel[0]].color);
    });
    text('◀ ▶ 選擇　Z 決定　ESC 返回', VW / 2, 45, 10, '#b9c2ea');
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(80, now - last); last = now;
    uiStep();
    if (sim.phase === 'title') { drawTitle(); requestAnimationFrame(frame); return; }
    if (sim.phase === 'select') { drawSelect(); requestAnimationFrame(frame); return; }
    if (!sim.paused) {
      acc += dt * sim.slow;
      let n = 0;
      while (acc >= TICK && n++ < 4) { applyInput(); step(); acc -= TICK; if (sim.phase === 'result' || sim.phase === 'end') sim.resultT += TICK; }
    }
    if (sim.phase === 'result' || sim.phase === 'end') { for (const f of sim.fighters) { animate(f); physics(f); } for (const p of sim.particles) { p.life--; if (!p.ring) { p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; } } sim.particles = sim.particles.filter((p) => p.life > 0); for (const t of sim.texts) t.t -= dt; sim.texts = sim.texts.filter((t) => t.t > 0); }
    drawWorld();
    ctx.imageSmoothingEnabled = false;
    if (gl) ctx.clearRect(0, 0, cv.width, cv.height); else { ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.drawImage(low, 0, 0, cv.width, cv.height);
    drawHudText();
    requestAnimationFrame(frame);
  }
  fit();
  // warm the cache for the idle frames so the first fight does not stutter
  requestAnimationFrame((t) => { last = t; frame(t); });

  window.__game = { sim, ROSTER, ROSTER_ALL, startMatch, step, play, makeFighter, cache, breakPart, hitFighter, cur, A, MODES, setMode: (i) => { modeI = i; }, sfx, toCanvas };
})();
