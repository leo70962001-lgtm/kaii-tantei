// stage.js — 東京鬼高校・夜の校門前: a 720 px wide night street in front of the school gate, seen through
// a 480×270 camera window. Painted pixel by pixel once; the far skyline scrolls slower than the street.
(function (root) {
  'use strict';
  const PX = root.PX;
  const W = 720, H = 270, VW = 480, GROUND = 240, FAR_W = 600;
  const hx = PX.hex;
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > bayer[y & 3][x & 3] + 0.5;

  function layer(w, h) {
    const c = new Uint32Array(w * h);
    return { w, h, c, set(x, y, col) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; }, get(x, y) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : 0; } };
  }

  // far layer: sky, stars, moon, city skyline with lit windows
  function paintFar() {
    const L = layer(FAR_W, H);
    const sky = ['#07091c', '#0a0d26', '#10132f', '#161a3c', '#1d2048', '#262856', '#312f62', '#3d366c'].map(hx);
    for (let y = 0; y < H; y++) {
      const t = Math.pow(y / 226, 1.3) * (sky.length - 1);
      const i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
      for (let x = 0; x < FAR_W; x++) L.set(x, y, dith(x, y, Math.min(1, f)) ? sky[i + 1] : sky[i]);
    }
    for (let k = 0; k < 260; k++) {
      const x = Math.floor(PX.hash(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(PX.hash(k, 2, 11), 1.5) * 150);
      const b = PX.hash(k, 3, 11);
      L.set(x, y, b > 0.86 ? hx('#ffffff') : b > 0.5 ? hx('#b3bcf0') : hx('#6f78bc'));
      if (b > 0.95) { L.set(x + 1, y, hx('#6f78bc')); L.set(x - 1, y, hx('#6f78bc')); L.set(x, y + 1, hx('#6f78bc')); L.set(x, y - 1, hx('#6f78bc')); }
    }
    // a big low moon
    const mx = 450, my = 70, mr = 30;
    for (let y = my - 60; y <= my + 60; y++) for (let x = mx - 60; x <= mx + 60; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d <= mr) {
        const lx = (x - mx) / mr, ly = (y - my) / mr;
        L.set(x, y, lx + ly > 1.0 ? hx('#d9b28e') : lx + ly > 0.5 ? hx('#efd1ac') : hx('#fbe8cc'));
      } else if (d <= mr + 10 && dith(x, y, (mr + 10 - d) / 18)) L.set(x, y, hx('#4a3f78'));
      else if (d <= mr + 24 && dith(x, y, (mr + 24 - d) / 60)) L.set(x, y, hx('#3a3468'));
    }
    for (const [dx, dy, r] of [[-10, -6, 5], [9, 6, 4], [-3, 13, 3], [12, -12, 3], [-13, 9, 3]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      L.set(mx + dx + x, my + dy + y, (x + y < 0) ? hx('#dcbb98') : hx('#e9cfae'));
    }
    const cloud = (x0, y0, len, col) => { for (let x = x0; x < x0 + len; x++) { L.set(x, y0, col); L.set(x, y0 + 1, col); if ((x - x0) % 13 < 9) { L.set(x + 4, y0 + 2, col); L.set(x + 4, y0 + 3, col); } } };
    cloud(375, 78, 135, hx('#2c2b66')); cloud(405, 87, 90, hx('#272560')); cloud(60, 45, 105, hx('#1c1e50')); cloud(30, 54, 60, hx('#1a1c4c'));
    const tower = (x0, w, top, col, win, lit) => {
      for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, col);
      if (win) for (let y = top + 4; y < GROUND - 6; y += 6) for (let x = x0 + 3; x < x0 + w - 3; x += 5) if (PX.hash(x, y, 5) < lit) { const c = PX.hash(x, y, 6) > 0.7 ? hx('#ffd98a') : hx('#b8c4ff'); L.set(x, y, c); L.set(x + 1, y, c); }
    };
    for (let k = 0; k < 26; k++) {
      const x0 = Math.floor(PX.hash(k, 7, 3) * FAR_W), w = 15 + Math.floor(PX.hash(k, 8, 3) * 40), top = 138 + Math.floor(PX.hash(k, 9, 3) * 45);
      tower(x0, w, top, hx('#15173a'), false, 0);
    }
    for (let k = 0; k < 18; k++) {
      const x0 = Math.floor(PX.hash(k, 17, 4) * FAR_W), w = 18 + Math.floor(PX.hash(k, 18, 4) * 33), top = 162 + Math.floor(PX.hash(k, 19, 4) * 39);
      tower(x0, w, top, hx('#1c1f48'), true, 0.35);
      if (PX.hash(k, 20, 4) > 0.6) { L.set(x0 + (w >> 1), top - 1, hx('#ff5a5a')); L.set(x0 + (w >> 1), top - 2, hx('#ff5a5a')); L.set(x0 + (w >> 1), top - 3, hx('#ff5a5a')); }
    }
    for (let y = 105; y < 195; y++) { const c = y % 9 < 5 ? hx('#7a2030') : hx('#c8c8d8'); L.set(270, y, c); L.set(271, y, c); }
    L.set(270, 104, hx('#ff4040')); L.set(271, 104, hx('#ff4040'));
    return L;
  }

  // mid + near layer: the school wall and gate, cherry trees, a lamp, the road
  function paintNear() {
    const L = layer(W, H);
    for (let y = 177; y < 207; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 177) / 45)) L.set(x, y, hx('#222452'));
    const bld = (x0, w, top, col) => { for (let y = top; y < 210; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, col); };
    bld(45, 225, 144, hx('#1a1d44')); bld(90, 90, 126, hx('#1f2350'));
    for (let y = 150; y < 204; y += 9) for (let x = 54; x < 264; x += 10) { const lit = PX.hash(x, y, 9) < 0.28; const c1 = lit ? hx('#ffe08a') : hx('#0f1130'), c2 = lit ? hx('#e0b850') : hx('#0d0f2a'); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) L.set(x + i, y + j, j === 0 ? c1 : c2); }
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 38) L.set(135 + x, 137 + y, x * x + y * y <= 20 ? hx('#f4ecd0') : hx('#5a4a30'));
    for (const [dx, dy] of [[0, -1], [0, -2], [0, -3], [1, 0], [2, 0], [3, 0]]) L.set(135 + dx, 137 + dy, hx('#302010'));
    // the wall
    for (let y = 189; y < GROUND; y++) for (let x = 0; x < W; x++) {
      const t = (y - 189) / (GROUND - 189);
      L.set(x, y, y === 189 ? hx('#5a5f8a') : y === 190 || y === 191 ? hx('#3a3e66') : dith(x, y, t * 0.9) ? hx('#252a4e') : hx('#2d3258'));
    }
    for (let x = 0; x < W; x += 48) for (let y = 193; y < GROUND; y++) { L.set(x, y, hx('#1e2244')); L.set(x + 1, y, hx('#1e2244')); }
    const pillar = (x0) => {
      for (let y = 156; y < GROUND; y++) for (let x = x0; x < x0 + 18; x++) L.set(x, y, x <= x0 + 1 ? hx('#6a6f9c') : x >= x0 + 16 ? hx('#2a2e52') : dith(x, y, (y - 156) / 90) ? hx('#3d4270') : hx('#4a4f80'));
      for (let x = x0 - 2; x <= x0 + 19; x++) { L.set(x, 155, hx('#8a8fbe')); L.set(x, 154, hx('#8a8fbe')); L.set(x, 153, hx('#6a6f9c')); }
      // the lamp on top and its warm light on the wall are the 'lamp' breakable prop (PROPS below), so that a
      // smashed lamp really goes dark — the GL bloom would otherwise keep glowing through a picture drawn over it
    };
    pillar(318); pillar(414);
    for (let y = 168; y < 183; y++) for (let x = 418; x < 433; x++) L.set(x, y, hx('#b8202c'));
    const mask = ['...xx....xx.', '..xxxxxxxxx.', '.xxxx.xx.xxx', '.xxxxxxxxxxx', 'xxx.xxxx.xxx', '.xxxxxxxxxx.', '..xx.xx.xx..', '...xxxxxx...'];
    mask.forEach((r, j) => r.split('').forEach((ch, i) => { if (ch === 'x') L.set(420 + i, 171 + j, hx('#fff4e0')); }));
    for (let x = 339; x < 411; x += 6) for (let y = 168; y < GROUND; y++) { const c = y % 13 === 0 ? hx('#6a6f9c') : hx('#4a4f80'); L.set(x, y, c); L.set(x + 1, y, c); }
    for (let x = 336; x < 414; x++) { L.set(x, 166, hx('#6a6f9c')); L.set(x, 167, hx('#6a6f9c')); L.set(x, 201, hx('#5a5f8a')); }
    const tree = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r * 0.7; y++) for (let x = cx - r * 1.3; x <= cx + r * 1.3; x++) {
        const d = Math.hypot((x - cx) / 1.3, y - cy) + PX.hash(x, y, 13) * 4;
        if (d > r) continue;
        const lit = (x - cx) * 0.4 - (y - cy) > r * 0.35;
        L.set(x, y, PX.hash(x, y, 14) < 0.12 ? hx('#ffb7cc') : lit ? hx('#5a3866') : d > r - 4 ? hx('#241a3c') : hx('#3a2650'));
      }
      for (let y = cy + r * 0.5; y < 190; y++) { L.set(cx, y, hx('#2a1c30')); L.set(cx + 1, y, hx('#2a1c30')); L.set(cx + 2, y, hx('#1a1020')); }
    };
    tree(36, 150, 30); tree(495, 144, 36); tree(630, 156, 27); tree(270, 159, 21);
    for (let y = 105; y < GROUND; y++) { L.set(588, y, hx('#5a5f8a')); L.set(589, y, hx('#5a5f8a')); L.set(590, y, hx('#2a2e52')); }
    for (let x = 579; x < 600; x++) { L.set(x, 103, hx('#5a5f8a')); L.set(x, 104, hx('#5a5f8a')); }
    for (let y = 105; y < 114; y++) for (let x = 579; x < 588; x++) L.set(x, y, dith(x, y, 0.6) ? hx('#fff6d0') : hx('#ffe080'));
    // road
    const g = ['#3e4374', '#2f3462', '#262a52', '#1e2246', '#181b3a'].map(hx);
    for (let y = GROUND; y < H; y++) {
      const t = (y - GROUND) / (H - GROUND);
      for (let x = 0; x < W; x++) L.set(x, y, y === GROUND ? hx('#6a6f9c') : y <= GROUND + 2 ? hx('#4a4f80') : dith(x, y, t * 2.2 - Math.floor(t * 2.2)) ? g[Math.min(4, 2 + Math.floor(t * 2.2))] : g[Math.min(4, 1 + Math.floor(t * 2.2))]);
    }
    for (let x = 300; x < 450; x += 18) for (let y = GROUND + 6; y < H - 3; y++) for (let i = 0; i < 9; i++) if (dith(x + i, y, 0.75)) L.set(x + i, y, hx('#c9cce6'));
    for (let x = 0; x < W; x++) if (x % 10 < 6) { L.set(x, GROUND + 3, hx('#4c5186')); }
    for (let y = -4; y <= 4; y++) for (let x = -9; x <= 9; x++) if ((x * x) / 81 + (y * y) / 16 <= 1) L.set(180 + x, 255 + y, (x + y) % 2 ? hx('#2a2e58') : hx('#3a3e6a'));
    for (let y = GROUND; y < H; y++) for (let x = 540; x < 645; x++) { const d = Math.hypot((x - 588) / 51, (y - GROUND - 12) / 15); if (d < 1 && dith(x, y, (1 - d) * 0.6)) L.set(x, y, hx('#5a5474')); }
    return L;
  }

  // the sheet-scale game shows everything at half size: 360×135 world, 240×135 view
  function half(L) {
    const w = L.w >> 1, h = L.h >> 1, c = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[y * w + x] = L.c[(y * 2) * L.w + x * 2];
    return { w, h, c };
  }
  let FAR = null, NEAR = null;
  function paint() { if (!FAR) { FAR = paintFar(); NEAR = paintNear(); } return { far: FAR, near: NEAR }; }

  // ---------------------------------------------------------------- living background (「背景加入會動的物體」)
  // Everything is a pure function of the sim time t (ms), so nothing needs state: falling cherry petals swaying in
  // the wind (most behind the fighters, a few in front), the gate and street lamps flickering, windows of the near
  // block switching on and off, clouds drifting over the moon, stars twinkling, a flight of bats now and then, and a
  // cat that walks the wall top every so often. Items are stage coordinates: { far, x, y, w, h, col, a, front }.
  const HS = PX.hash, PINK = ['#ffb7cc', '#f7a3bd', '#ffd6e0', '#e88fa8'];   // CSS colours: the draw list's rects take strings
  function anim(t, broken) {
    const out = [], s = t / 1000, H = HS, hx = (c) => c; broken = broken || new Set();
    // petals
    for (let k = 0; k < 34; k++) {
      const vy = 14 + H(k, 1, 21) * 16, per = 1.4 + H(k, 2, 21) * 2.2, amp = 5 + H(k, 3, 21) * 10;
      const y = ((H(k, 4, 21) * 300 + s * vy) % (GROUND + 30)) - 12;
      const x = ((H(k, 5, 21) * W + s * (10 + H(k, 6, 21) * 12) + Math.sin(s / per * Math.PI * 2 + k) * amp) % W + W) % W;
      const big = H(k, 7, 21) > 0.6, front = k % 5 === 0;
      out.push({ x: Math.round(x), y: Math.round(y), w: big ? 3 : 2, h: 2, col: PINK[k & 3], a: front ? 0.9 : 0.75, front });
      if (big) out.push({ x: Math.round(x) + 1, y: Math.round(y) - 1, w: 1, h: 1, col: PINK[(k + 1) & 3], a: 0.6, front });
    }
    // lamp flicker: a warm halo whose strength wobbles (gate lamps at the pillars, the tall street lamp)
    for (const [k, lx0, ly0, lw, lh, r, id] of [[0, 322, 141, 10, 12, 16, 'lampL'], [1, 418, 141, 10, 12, 16, 'lampR'], [2, 579, 105, 9, 9, 14, 'street']]) {
      if (broken.has(id)) continue;                        // a smashed lamp gives no light
      const f = 0.55 + 0.45 * Math.sin(s * 9 + k * 2) * Math.sin(s * 3.3 + k) + (H(Math.floor(s * 12) + k, 8, 21) > 0.9 ? -0.35 : 0);
      out.push({ x: lx0 - r, y: ly0 - r, w: lw + r * 2, h: lh + r * 2, col: hx('#ffd070'), a: 0.05 + 0.05 * f });
      out.push({ x: lx0 - (r >> 1), y: ly0 - (r >> 1), w: lw + r, h: lh + r, col: hx('#ffe4a0'), a: 0.08 + 0.08 * f });
    }
    // the vending machine's cold light (its lit window and a patch on the road), gone once it is smashed
    if (!broken.has('vend')) {
      const f = 0.85 + 0.15 * Math.sin(s * 7.3) + (H(Math.floor(s * 9), 13, 21) > 0.94 ? -0.4 : 0);
      out.push({ x: 60, y: 164, w: 56, h: 80, col: hx('#9fd8ff'), a: 0.035 * f });
      out.push({ x: 68, y: 170, w: 40, h: 70, col: hx('#c0e8ff'), a: 0.05 * f });
      out.push({ x: 56, y: 241, w: 64, h: 8, col: hx('#c0e8ff'), a: 0.07 * f });
    }
    // windows switching (the near block, x 54–264, y 150–204)
    for (let k = 0; k < 6; k++) {
      const slot = Math.floor(s / 0.9) + k * 7, on = H(slot, 9, 21) > 0.5;
      const wx = 54 + Math.floor(H(slot, 10, 21) * 21) * 10, wy = 150 + Math.floor(H(slot, 11, 21) * 6) * 9;
      out.push({ x: wx, y: wy, w: 3, h: 3, col: on ? hx('#ffe08a') : hx('#0f1130'), a: 1 });
      if (on) out.push({ x: wx, y: wy + 1, w: 3, h: 2, col: hx('#e0b850'), a: 1 });
    }
    // clouds drifting over the moon (far layer)
    for (const [k, y0, len, col, spd] of [[0, 62, 70, '#2c2b66', 3.2], [1, 74, 48, '#272560', 2.4], [2, 92, 90, '#232258', 1.8]]) {
      const x0 = ((k * 170 + s * spd) % (FAR_W + 140)) - 70;
      for (let x = 0; x < len; x += 2) {
        const bump = (x % 13 < 9) ? 2 : 0;
        out.push({ far: true, x: x0 + x, y: y0 + ((x / 2) & 1) - bump, w: 2, h: 2 + bump, col: hx(col), a: 0.9 });
      }
    }
    // twinkling stars (far)
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(H(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(H(k, 2, 11), 1.5) * 150);
      const tw = 0.5 + 0.5 * Math.sin(s * (1.5 + H(k, 12, 21) * 3) + k * 1.7);
      out.push({ far: true, x, y, w: 1, h: 1, col: hx('#ffffff'), a: tw });
    }
    // bats crossing the sky every 14 s (far)
    const bp = (s % 14) / 14;
    if (bp < 0.45) for (let k = 0; k < 3; k++) {
      const bx = FAR_W + 40 - bp / 0.45 * (FAR_W + 80) + k * 22, by = 58 + k * 9 + Math.sin(s * 6 + k) * 4, flap = Math.floor(s * 10 + k) & 1;
      out.push({ far: true, x: bx, y: by, w: 2, h: 1, col: hx('#0a0b1c'), a: 1 });
      out.push({ far: true, x: bx - 3, y: by - flap, w: 3, h: 1, col: hx('#0a0b1c'), a: 1 });
      out.push({ far: true, x: bx + 2, y: by - flap, w: 3, h: 1, col: hx('#0a0b1c'), a: 1 });
    }
    // a cat walking the wall top every 26 s (near, behind the fighters)
    const cp = (s % 26) / 26;
    if (cp > 0.7) {
      const u = (cp - 0.7) / 0.3, cx = 690 - u * 200, cy = 181, step = Math.floor(s * 6) & 1;
      const C = hx('#0c0d1e');
      out.push({ x: cx, y: cy + 2, w: 11, h: 4, col: C, a: 1 });                       // body
      out.push({ x: cx - 4, y: cy + 1, w: 5, h: 4, col: C, a: 1 });                    // head (walking left)
      out.push({ x: cx - 4, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 1, y: cy - 1, w: 1, h: 2, col: C, a: 1 });   // ears
      out.push({ x: cx + 11, y: cy - 2 + step, w: 1, h: 5, col: C, a: 1 });          // tail
      out.push({ x: cx + 1 + step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 8 - step, y: cy + 6, w: 1, h: 2, col: C, a: 1 });   // legs
      out.push({ x: cx - 3, y: cy + 2, w: 1, h: 1, col: hx('#ffe060'), a: 1 });        // an eye
    }
    return out;
  }

  // ---------------------------------------------------------------- breakable props (「場景可以破壞的東西」)
  // Every prop is painted pixel by pixel at the stage's density, one picture per state (0 intact → 1 damaged →
  // 2 broken), inside a box big enough for its broken pose (a tipped vending machine lies on its side). Stage
  // coordinates: hit = the intact silhouette the attacks are tested against [x, y = top edge, w, h], box = the
  // picture area, hp = hits to break. game.js turns the pictures into canvases and draws them behind the fighters;
  // a smashed lamp or vending machine also stops glowing (anim() skips its halo).
  const PROPS = [
    { id: 'vend', kind: 'vend', hp: 4, hit: [70, 168, 36, 72], box: [70, 168, 78, 72] },
    { id: 'bike', kind: 'bike', hp: 2, hit: [186, 214, 44, 26], box: [180, 208, 60, 32] },
    { id: 'lampL', kind: 'lamp', hp: 2, hit: [322, 141, 10, 12], box: [309, 132, 36, 30] },
    { id: 'lampR', kind: 'lamp', hp: 2, hit: [418, 141, 10, 12], box: [405, 132, 36, 30] },
    { id: 'sign', kind: 'sign', hp: 2, hit: [470, 214, 22, 26], box: [466, 214, 34, 26] },
    { id: 'bin', kind: 'bin', hp: 2, hit: [556, 214, 14, 26], box: [552, 212, 40, 28] },
    { id: 'cone1', kind: 'cone', hp: 1, hit: [640, 222, 12, 18], box: [640, 222, 26, 18] },
    { id: 'cone2', kind: 'cone', hp: 1, hit: [664, 222, 12, 18], box: [664, 222, 26, 18] },
  ];
  function breakables() {
    return PROPS.map((p) => ({ id: p.id, kind: p.kind, hp: p.hp, hp0: p.hp, state: 0, hits: new Set(), x: p.hit[0], y: p.hit[1], w: p.hit[2], h: p.hit[3], box: p.box.slice() }));
  }
  // small painters on a layer
  const OUT = hx('#0a0f2a');
  const rect = (L, x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L.set(x + i, y + j, col); };
  function line(L, x0, y0, x1, y1, col) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { L.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function ring(L, cx, cy, r0, r1, col) { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x - cx, y - cy); if (d >= r0 && d < r1) L.set(x, y, col); } }
  function blit(L, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = S.c[y * S.w + x]; if (c) L.set(ox + x, oy + y, c); } }
  function rot90cw(S) {   // the top goes to the right: a thing that fell over to the right
    const R = layer(S.h, S.w);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(S.h - 1 - y, x, S.c[y * S.w + x]);
    return R;
  }

  function paintVend(state) {
    const L = layer(78, 72); const W0 = 36, H0 = 72, S = layer(W0, H0);
    // body: a vertical gradient, a lit left edge, a dark right edge, a 1-px outline
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const edge = x === 0 || y === 0 || x === W0 - 1 || y === H0 - 1;
      S.set(x, y, edge ? OUT : x <= 1 ? hx('#4a6fd0') : x >= W0 - 3 ? hx('#141f44') : dith(x, y, y / H0 * 0.8) ? hx('#1b3470') : hx('#22407f'));
    }
    for (let x = 1; x < W0 - 1; x++) { S.set(x, 1, hx('#5a80e0')); S.set(x, 2, hx('#3b5fc0')); S.set(x, 3, hx('#3b5fc0')); }
    // the lit product window (dark when damaged) with three shelves of cans, shelf lights and price tags
    const wx = 4, wy = 6, ww = 28, wh = 30, dim = state > 0;
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
      const rim = x === wx || y === wy || x === wx + ww - 1 || y === wy + wh - 1;
      S.set(x, y, rim ? OUT : dim ? (dith(x, y, 0.5) ? hx('#2c3558') : hx('#354070')) : dith(x, y, (y - wy) / wh) ? hx('#8fc8ff') : hx('#bfe4ff'));
    }
    const CANS = [['#e84a5f', '#ff9fb0', '#a02040'], ['#ffd24a', '#fff0a0', '#b08a20'], ['#5ad0ff', '#c0f0ff', '#2a80b0'], ['#7ae06a', '#c8ffb0', '#3a9030'], ['#f4f4f8', '#ffffff', '#9a9ab0'], ['#ff8a3a', '#ffc090', '#b04a10']];
    for (let j = 0; j < 3; j++) {
      const sy = wy + 3 + j * 9;
      for (let i = 0; i < 5; i++) {
        if (dim && HS(i, j, 31) < 0.4) { rect(S, wx + 2 + i * 5, sy + 3, 3, 2, hx('#20284c')); continue; }   // fallen cans
        const [c, hi, lo] = CANS[(i + j * 2) % CANS.length].map(hx), cx = wx + 2 + i * 5;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) S.set(cx + x, sy + y, x === 0 ? hi : x === 2 ? lo : c);
        S.set(cx + 1, sy, hx('#ffffff'));
      }
      for (let x = wx + 1; x < wx + ww - 1; x++) { S.set(x, sy + 5, dim ? hx('#1d2548') : hx('#7aa9d0')); S.set(x, sy + 6, x % 5 === 3 ? (dim ? hx('#1d2548') : hx('#ffe08a')) : (dim ? hx('#20284c') : hx('#5a80b0'))); }
    }
    // coin panel: slot, a lit button, a bill slot; the dispenser hatch; the base
    rect(S, 4, 39, 28, 9, hx('#1a2a5c')); rect(S, 4, 39, 28, 1, hx('#2c4590')); rect(S, 6, 41, 1, 4, OUT); rect(S, 9, 41, 6, 1, OUT);
    rect(S, 20, 41, 8, 5, dim ? hx('#2c3558') : hx('#7ad4ff')); rect(S, 21, 42, 2, 1, dim ? hx('#3a4266') : hx('#ffffff')); rect(S, 9, 44, 4, 1, hx('#3a5090'));
    rect(S, 6, 52, 24, 10, OUT); rect(S, 7, 53, 22, 8, hx('#101a3c')); rect(S, 7, 53, 22, 1, hx('#3a4a8a')); rect(S, 16, 57, 4, 1, hx('#3a4a8a'));
    rect(S, 1, 66, 34, 5, hx('#141f44')); rect(S, 1, 66, 34, 1, hx('#2c3558')); rect(S, 2, 70, 32, 1, OUT);
    if (state === 1) {   // cracks across the glass and a dent in the side
      line(S, 10, 9, 18, 24, OUT); line(S, 18, 24, 15, 34, OUT); line(S, 18, 24, 26, 30, OUT); line(S, 21, 8, 18, 15, hx('#5a7ab0'));
      for (let y = 28; y < 40; y++) { S.set(33, y, OUT); S.set(34, y, hx('#22407f')); }
    }
    if (state < 2) blit(L, S, 0, 0);
    else {   // tipped over to the right, the glass dark, cans rolling out
      const R = rot90cw(S); blit(L, R, 0, 36);
      line(L, 14, 40, 26, 58, OUT); line(L, 26, 58, 40, 62, OUT);
      for (const [k, x, y] of [[0, 72, 68], [2, 69, 63], [1, 75, 65], [3, 66, 68]]) { const [c, hi, lo] = CANS[k].map(hx); rect(L, x, y, 3, 2, c); L.set(x, y, hi); L.set(x + 2, y + 1, lo); }
    }
    return L;
  }
  function paintLamp(state) {   // a 36×30 box around the pillar top: the light's dots on the wall, the 10×12 lamp at (13, 9)
    const L = layer(36, 30);
    if (state < 2) for (let y = 0; y < 30; y++) for (let x = 0; x < 36; x++) {
      if (y >= 21 && x >= 7 && x <= 28) continue;                       // the pillar's cap and body stay clean
      const d = Math.hypot(x - 17.5, (y - 15) * 1.4);
      if (d > 8 && d < 18 && dith(x + 1, y, (18 - d) / 14 * (state ? 0.55 : 1))) L.set(x, y, hx('#5a4a50'));
    }
    const ox = 13, oy = 9, P = (x, y, c) => L.set(ox + x, oy + y, c);
    rect(L, ox, oy, 10, 3, hx('#3a3050')); rect(L, ox, oy, 10, 1, hx('#5a5070')); rect(L, ox, oy + 11, 10, 1, hx('#3a3050')); rect(L, ox, oy + 3, 1, 8, hx('#3a3050')); rect(L, ox + 9, oy + 3, 1, 8, hx('#3a3050'));
    if (state < 2) {
      const a = state ? hx('#ffe8a8') : hx('#fff2c0'), b = state ? hx('#e8c060') : hx('#ffd870');
      for (let y = 3; y < 11; y++) for (let x = 1; x < 9; x++) P(x, y, dith(x, y, 0.5) ? a : b);
      rect(L, ox + 4, oy + 5, 2, 3, hx('#ffffff'));
      if (state) { for (const [x, y] of [[2, 4], [3, 5], [4, 6], [4, 7], [5, 8], [6, 8]]) P(x, y, hx('#3a3050')); rect(L, ox + 7, oy + 3, 2, 2, hx('#2a2240')); }
    } else {
      rect(L, ox + 1, oy + 3, 8, 8, hx('#2a2240')); rect(L, ox + 4, oy + 4, 2, 2, hx('#5a5070'));
      for (const [x, y] of [[1, 3], [2, 3], [1, 4], [8, 10], [7, 10], [8, 9]]) P(x, y, hx('#e0b850'));
    }
    return L;
  }
  function paintBin(state) {
    const L = layer(40, 28); const S = layer(16, 26);
    for (let y = 2; y < 26; y++) for (let x = 1; x < 15; x++) {
      const edge = x === 1 || x === 14 || y === 25;
      S.set(x, y, edge ? hx('#1a1d38') : x === 2 ? hx('#8a90b0') : x >= 12 ? hx('#3f4666') : (y === 9 || y === 19) ? hx('#3f4666') : (y === 8 || y === 18) ? hx('#8a90b0') : hx('#5c6486'));
    }
    rect(S, 6, 5, 4, 3, hx('#1a1d38'));                 // the throw-in hole
    rect(S, 6, 12, 4, 3, hx('#2a2e52')); S.set(7, 13, hx('#8a90b0')); S.set(8, 13, hx('#8a90b0'));   // label
    const lidY = state ? 1 : 2;
    rect(S, 0, lidY, 16, 2, hx('#8a90b0')); rect(S, 0, lidY, 16, 1, hx('#b8bcd8')); rect(S, 6, lidY - 1, 4, 1, hx('#8a90b0'));
    if (state) { rect(S, 10, 12, 3, 6, hx('#3f4666')); S.set(11, 13, hx('#1a1d38')); S.set(12, 15, hx('#1a1d38')); S.set(11, 16, hx('#1a1d38')); rect(S, 0, lidY, 8, 1, hx('#8a90b0')); }
    if (state < 2) blit(L, S, 3, 2);
    else {
      const R = rot90cw(S); blit(L, R, 2, 12);
      rect(L, 28, 26, 3, 1, hx('#e8e8f0')); rect(L, 31, 25, 2, 2, hx('#e8e8f0')); rect(L, 34, 26, 3, 2, hx('#c9cce6')); L.set(34, 26, hx('#ffffff')); rect(L, 37, 27, 2, 1, hx('#ffd24a'));
      rect(L, 24, 25, 10, 2, hx('#8a90b0')); rect(L, 24, 25, 10, 1, hx('#b8bcd8'));
    }
    return L;
  }
  function paintSign(state) {
    const L = layer(34, 26);
    if (state < 2) {
      const sh = (y) => (state && y < 12 ? 2 : 0);     // damaged: the top leans to the right
      rect(L, 2, 18, 2, 8, hx('#5c6486')); rect(L, 27, 18, 2, 8, hx('#5c6486')); rect(L, 1, 24, 5, 2, hx('#3f4666')); rect(L, 25, 24, 5, 2, hx('#3f4666'));
      for (let y = 0; y < 22; y++) for (let x = 5; x < 26; x++) {
        const edge = x === 5 || x === 25 || y === 0 || y === 21;
        L.set(x + sh(y), y, edge ? hx('#8a90b0') : y >= 2 && y <= 6 ? hx('#b8202c') : hx('#f4ecd0'));
      }
      for (const [x, y] of [[9, 3], [9, 4], [9, 5], [10, 3], [11, 5], [13, 3], [13, 4], [13, 5], [14, 3], [14, 5], [17, 3], [17, 5], [18, 4], [20, 3], [21, 4], [21, 5]]) L.set(x + sh(y), y, hx('#fff4e0'));
      for (let x = 8; x < 23; x++) { if (x % 4 !== 3) L.set(x + sh(9), 9, hx('#302a40')); if (x < 20 && x % 3 !== 2) L.set(x + sh(12), 12, hx('#302a40')); if (x % 5 !== 4) L.set(x + sh(15), 15, hx('#302a40')); }
      rect(L, 13, 17, 5, 3, hx('#302a40')); L.set(15, 18, hx('#f4ecd0'));
      if (state) { line(L, 9, 3, 15, 16, hx('#302a40')); line(L, 15, 16, 12, 20, hx('#302a40')); line(L, 3, 18, 1, 25, hx('#5c6486')); }
      rect(L, 6, 21, 2, 5, hx('#8a90b0')); rect(L, 23, 21, 2, 5, hx('#8a90b0'));
    } else {
      rect(L, 4, 21, 26, 5, hx('#8a90b0')); rect(L, 5, 22, 24, 3, hx('#f4ecd0')); rect(L, 6, 22, 3, 3, hx('#b8202c'));
      for (let x = 11; x < 27; x += 2) L.set(x, 23, hx('#302a40'));
      line(L, 26, 20, 32, 17, hx('#5c6486')); rect(L, 2, 24, 3, 2, hx('#3f4666'));
    }
    return L;
  }
  function paintCone(state) {
    const L = layer(26, 18); const S = layer(12, 18);
    rect(S, 0, 15, 12, 3, hx('#1a1a2a')); rect(S, 0, 15, 12, 1, hx('#3a3a50'));
    for (let y = 0; y < 15; y++) {
      const hw = 1 + (y / 15) * 4, x0 = Math.round(6 - hw), x1 = Math.round(6 + hw);
      for (let x = x0; x <= x1; x++) S.set(x, y, x === x0 || x === x1 ? hx('#6a2a10') : x === x0 + 1 ? hx('#ffb070') : x === x1 - 1 ? hx('#c04a10') : y >= 6 && y <= 9 ? (x === x1 - 2 ? hx('#c0c0d0') : hx('#f4f4f8')) : hx('#ff7a2a'));
    }
    S.set(6, 0, hx('#ffb070'));
    if (state < 2) blit(L, S, 0, 0); else blit(L, rot90cw(S), 0, 6);
    return L;
  }
  function paintBike(state) {
    const L = layer(60, 32);
    const TYRE = hx('#0c0d1e'), RIM = hx('#8a90b0'), SPOKE = hx('#5c6486'), HUB = hx('#c9cce6'), RED = hx('#e84a5f'), DRED = hx('#a02040'), DARK = hx('#302a40');
    if (state < 2) {
      const S = layer(50, 26), wheel = (cx, cy) => { ring(S, cx, cy, 6.2, 7.6, TYRE); ring(S, cx, cy, 5.0, 6.2, RIM); for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) line(S, cx - dx * 5, cy - dy * 5, cx + dx * 5, cy + dy * 5, SPOKE); rect(S, cx - 1, cy - 1, 2, 2, HUB); };
      wheel(12, 18); wheel(38, 18);
      line(S, 12, 18, 24, 20, DRED); line(S, 12, 17, 24, 19, RED);      // chain stay
      line(S, 24, 19, 21, 4, RED); line(S, 25, 19, 22, 4, DRED);        // seat tube
      line(S, 12, 17, 21, 5, RED);                                      // seat stay
      line(S, 21, 5, 34, 6, RED); line(S, 21, 6, 34, 7, DRED);          // top tube
      line(S, 24, 19, 34, 7, RED); line(S, 34, 6, 38, 18, DRED); line(S, 35, 6, 39, 18, RED);   // down tube, fork
      ring(S, 24, 19, 2.2, 3.6, DARK); rect(S, 25, 21, 3, 1, HUB);      // chain ring, a pedal
      rect(S, 18, 2, 7, 2, DARK); rect(S, 21, 2, 1, 2, SPOKE);          // saddle
      rect(S, 32, 2, 7, 1, HUB); rect(S, 31, 2, 1, 2, DARK); rect(S, 39, 2, 1, 2, DARK);   // handlebar with grips
      for (let y = 6; y < 13; y++) for (let x = 38; x < 49; x++) if (x === 38 || x === 48 || y === 6 || y === 12) S.set(x, y, RIM); else if ((x + y) & 1) S.set(x, y, SPOKE);   // wire basket
      if (state) { for (let y = 6; y < 13; y++) S.set(48, y, 0); line(S, 46, 5, 49, 12, RIM); }   // bent basket
      // leaning against the wall when damaged: rows shift by height
      for (let y = 0; y < 26; y++) for (let x = 0; x < 50; x++) { const c = S.c[y * 50 + x]; if (c) L.set(6 + x + (state ? Math.round((26 - y) * 0.2) : 0), 6 + y, c); }
    } else {   // fallen: the rear wheel flat on the ground, the front wheel still tilted, the frame lying low
      for (let y = -2; y <= 2; y++) for (let x = -8; x <= 8; x++) { const d = (x * x) / 64 + (y * y) / 4; if (d <= 1 && d > 0.45) L.set(14 + x, 29 + y, TYRE); else if (d <= 0.45 && d > 0.2) L.set(14 + x, 29 + y, RIM); }
      rect(L, 13, 29, 2, 1, HUB);
      for (let y = -4; y <= 4; y++) for (let x = -6; x <= 6; x++) { const d = (x * x) / 36 + (y * y) / 16; if (d <= 1 && d > 0.6) L.set(42 + x, 26 + y, TYRE); else if (d <= 0.6 && d > 0.3) L.set(42 + x, 26 + y, RIM); }
      rect(L, 41, 25, 2, 2, HUB);
      line(L, 14, 28, 36, 27, RED); line(L, 14, 29, 36, 28, DRED); line(L, 20, 28, 27, 22, RED); line(L, 27, 22, 36, 24, RED);
      rect(L, 25, 20, 6, 2, DARK); rect(L, 46, 18, 1, 7, HUB); rect(L, 45, 17, 3, 1, DARK);
      for (let y = 24; y < 30; y++) for (let x = 48; x < 58; x++) if (x === 48 || x === 57 || y === 24 || y === 29) L.set(x, y, RIM); else if ((x + y) & 1) L.set(x, y, SPOKE);
    }
    return L;
  }
  const PAINTERS = { vend: paintVend, lamp: paintLamp, bin: paintBin, sign: paintSign, cone: paintCone, bike: paintBike };
  const propCache = new Map();
  function propImage(kind, state) {   // { w, h, c } for the prop kind in that state, painted once
    const key = kind + ':' + state;
    if (!propCache.has(key)) propCache.set(key, PAINTERS[kind](state));
    return propCache.get(key);
  }

  root.STAGE = { W, H, VW, GROUND, FAR_W, paint, half, anim, breakables, propImage, name: '東京鬼高校・夜の校門前', en: 'TOKYO ONI HIGH — NIGHT GATE' };
})(typeof window !== 'undefined' ? window : globalThis);
