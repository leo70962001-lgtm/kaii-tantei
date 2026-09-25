// stage.js — 東京鬼高校・夜の校門前: a 480 px wide night street in front of the school gate, seen through
// a 320×180 camera window. Painted pixel by pixel once; the far skyline scrolls slower than the street.
(function (root) {
  'use strict';
  const PX = root.PX;
  const W = 480, H = 180, VW = 320, GROUND = 158, FAR_W = 400;
  const hx = PX.hex;
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > bayer[y & 3][x & 3] + 0.5;

  function layer(w, h) {
    const c = new Uint32Array(w * h);
    return { w, h, c, set(x, y, col) { if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; }, get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : 0; } };
  }

  // far layer: sky, stars, moon, city skyline with lit windows
  function paintFar() {
    const L = layer(FAR_W, H);
    const sky = ['#07091c', '#0a0d26', '#10132f', '#161a3c', '#1d2048', '#262856', '#312f62', '#3d366c'].map(hx);
    for (let y = 0; y < H; y++) {
      const t = Math.pow(y / 150, 1.3) * (sky.length - 1);
      const i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
      for (let x = 0; x < FAR_W; x++) L.set(x, y, dith(x, y, Math.min(1, f)) ? sky[i + 1] : sky[i]);
    }
    for (let k = 0; k < 140; k++) {
      const x = Math.floor(PX.hash(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(PX.hash(k, 2, 11), 1.5) * 100);
      const b = PX.hash(k, 3, 11);
      L.set(x, y, b > 0.86 ? hx('#ffffff') : b > 0.5 ? hx('#b3bcf0') : hx('#6f78bc'));
      if (b > 0.95) { L.set(x + 1, y, hx('#6f78bc')); L.set(x - 1, y, hx('#6f78bc')); L.set(x, y + 1, hx('#6f78bc')); L.set(x, y - 1, hx('#6f78bc')); }
    }
    // a big low moon, slightly red — the school's colour
    const mx = 300, my = 46, mr = 20;
    for (let y = my - 40; y <= my + 40; y++) for (let x = mx - 40; x <= mx + 40; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d <= mr) {
        const lx = (x - mx) / mr, ly = (y - my) / mr;
        L.set(x, y, lx + ly > 1.0 ? hx('#d9b28e') : lx + ly > 0.5 ? hx('#efd1ac') : hx('#fbe8cc'));
      } else if (d <= mr + 7 && dith(x, y, (mr + 7 - d) / 12)) L.set(x, y, hx('#4a3f78'));
      else if (d <= mr + 16 && dith(x, y, (mr + 16 - d) / 40)) L.set(x, y, hx('#3a3468'));
    }
    for (const [dx, dy, r] of [[-7, -4, 3], [6, 4, 3], [-2, 9, 2], [8, -8, 2], [-9, 6, 2]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      L.set(mx + dx + x, my + dy + y, (x + y < 0) ? hx('#dcbb98') : hx('#e9cfae'));
    }
    const cloud = (x0, y0, len, col) => { for (let x = x0; x < x0 + len; x++) { L.set(x, y0, col); if ((x - x0) % 9 < 6) L.set(x + 3, y0 + 1, col); } };
    cloud(250, 52, 90, hx('#2c2b66')); cloud(270, 58, 60, hx('#272560')); cloud(40, 30, 70, hx('#1c1e50')); cloud(20, 36, 40, hx('#1a1c4c'));
    // skyline: blocks of towers with dithered window grids, two depths
    const tower = (x0, w, top, col, win, lit) => {
      for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, col);
      if (win) for (let y = top + 3; y < GROUND - 4; y += 4) for (let x = x0 + 2; x < x0 + w - 2; x += 3) if (PX.hash(x, y, 5) < lit) L.set(x, y, PX.hash(x, y, 6) > 0.7 ? hx('#ffd98a') : hx('#b8c4ff'));
    };
    for (let k = 0; k < 26; k++) {
      const x0 = Math.floor(PX.hash(k, 7, 3) * FAR_W), w = 10 + Math.floor(PX.hash(k, 8, 3) * 26), top = 92 + Math.floor(PX.hash(k, 9, 3) * 30);
      tower(x0, w, top, hx('#15173a'), false, 0);
    }
    for (let k = 0; k < 18; k++) {
      const x0 = Math.floor(PX.hash(k, 17, 4) * FAR_W), w = 12 + Math.floor(PX.hash(k, 18, 4) * 22), top = 108 + Math.floor(PX.hash(k, 19, 4) * 26);
      tower(x0, w, top, hx('#1c1f48'), true, 0.35);
      if (PX.hash(k, 20, 4) > 0.6) { L.set(x0 + (w >> 1), top - 1, hx('#ff5a5a')); L.set(x0 + (w >> 1), top - 2, hx('#ff5a5a')); }
    }
    // a red radio mast
    for (let y = 70; y < 130; y++) { L.set(180, y, y % 6 < 3 ? hx('#7a2030') : hx('#c8c8d8')); }
    L.set(180, 69, hx('#ff4040'));
    return L;
  }

  // mid + near layer: the school wall and gate, cherry trees, a lamp, the road
  function paintNear() {
    const L = layer(W, H);
    // haze above the wall
    for (let y = 118; y < 138; y++) for (let x = 0; x < W; x++) if (dith(x, y, (y - 118) / 30)) L.set(x, y, hx('#222452'));
    // school building behind the wall (left) with a clock and lit windows
    const bld = (x0, w, top, col) => { for (let y = top; y < 140; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, col); };
    bld(30, 150, 96, hx('#1a1d44')); bld(60, 60, 84, hx('#1f2350'));
    for (let y = 100; y < 136; y += 6) for (let x = 36; x < 176; x += 7) { const lit = PX.hash(x, y, 9) < 0.28; L.set(x, y, lit ? hx('#ffe08a') : hx('#0f1130')); L.set(x + 1, y, lit ? hx('#ffd060') : hx('#0f1130')); L.set(x, y + 1, lit ? hx('#e0b850') : hx('#0d0f2a')); L.set(x + 1, y + 1, lit ? hx('#c8a040') : hx('#0d0f2a')); }
    // clock on the tower
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) L.set(90 + x, 91 + y, x * x + y * y <= 9 ? hx('#f4ecd0') : hx('#5a4a30'));
    L.set(90, 90, hx('#302010')); L.set(90, 89, hx('#302010')); L.set(91, 91, hx('#302010')); L.set(92, 91, hx('#302010'));
    // the wall: concrete with a tile cap, plastered panels, a long shadow line
    for (let y = 126; y < GROUND; y++) for (let x = 0; x < W; x++) {
      const t = (y - 126) / (GROUND - 126);
      L.set(x, y, y === 126 ? hx('#5a5f8a') : y === 127 ? hx('#3a3e66') : dith(x, y, t * 0.9) ? hx('#252a4e') : hx('#2d3258'));
    }
    for (let x = 0; x < W; x += 32) for (let y = 129; y < GROUND; y++) L.set(x, y, hx('#1e2244'));
    // gate pillars with lamps and the school crest (a red plate with a horned white mask)
    const pillar = (x0) => {
      for (let y = 104; y < GROUND; y++) for (let x = x0; x < x0 + 12; x++) L.set(x, y, x === x0 ? hx('#6a6f9c') : x === x0 + 11 ? hx('#2a2e52') : dith(x, y, (y - 104) / 60) ? hx('#3d4270') : hx('#4a4f80'));
      for (let x = x0 - 1; x <= x0 + 12; x++) { L.set(x, 103, hx('#8a8fbe')); L.set(x, 102, hx('#6a6f9c')); }
      // lamp on top
      for (let y = 94; y < 102; y++) for (let x = x0 + 3; x < x0 + 9; x++) L.set(x, y, y < 96 ? hx('#3a3050') : dith(x, y, 0.5) ? hx('#fff2c0') : hx('#ffd870'));
      for (let y = 88; y < 108; y++) for (let x = x0 - 6; x < x0 + 18; x++) { const d = Math.hypot(x - x0 - 5.5, (y - 98) * 1.4); if (d > 5 && d < 12 && dith(x, y, (12 - d) / 9)) if (!L.get(x, y) || L.get(x, y) === hx('#222452')) L.set(x, y, hx('#5a4a50')); }
    };
    pillar(212); pillar(276);
    // crest on the right pillar
    for (let y = 112; y < 122; y++) for (let x = 279; x < 289; x++) L.set(x, y, hx('#b8202c'));
    const mask = ['..x..x..', '.xxxxxx.', 'xx.xx.xx', 'xxxxxxxx', '.x.xx.x.', '..xxxx..'];
    mask.forEach((r, j) => r.split('').forEach((ch, i) => { if (ch === 'x') L.set(280 + i, 114 + j, hx('#fff4e0')); }));
    // the gate itself: iron bars between the pillars, half open
    for (let x = 226; x < 274; x += 4) for (let y = 112; y < GROUND; y++) L.set(x, y, y % 9 === 0 ? hx('#6a6f9c') : hx('#4a4f80'));
    for (let x = 224; x < 276; x++) { L.set(x, 111, hx('#6a6f9c')); L.set(x, 134, hx('#5a5f8a')); }
    // cherry trees over the wall: dark violet canopies with pink lights
    const tree = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r * 0.7; y++) for (let x = cx - r * 1.3; x <= cx + r * 1.3; x++) {
        const d = Math.hypot((x - cx) / 1.3, y - cy) + PX.hash(x, y, 13) * 3;
        if (d > r) continue;
        const lit = (x - cx) * 0.4 - (y - cy) > r * 0.35;
        L.set(x, y, PX.hash(x, y, 14) < 0.12 ? hx('#ffb7cc') : lit ? hx('#5a3866') : d > r - 3 ? hx('#241a3c') : hx('#3a2650'));
      }
      for (let y = cy + r * 0.5; y < 127; y++) { L.set(cx, y, hx('#2a1c30')); L.set(cx + 1, y, hx('#1a1020')); }
    };
    tree(24, 100, 20); tree(330, 96, 24); tree(420, 104, 18); tree(180, 106, 14);
    // street lamp near the right, its pool of light on the road
    for (let y = 70; y < GROUND; y++) { L.set(392, y, hx('#5a5f8a')); L.set(393, y, hx('#2a2e52')); }
    for (let x = 386; x < 400; x++) L.set(x, 69, hx('#5a5f8a'));
    for (let y = 70; y < 76; y++) for (let x = 386; x < 392; x++) L.set(x, y, dith(x, y, 0.6) ? hx('#fff6d0') : hx('#ffe080'));
    // road: asphalt with a kerb, a crosswalk and manhole
    const g = ['#3e4374', '#2f3462', '#262a52', '#1e2246', '#181b3a'].map(hx);
    for (let y = GROUND; y < H; y++) {
      const t = (y - GROUND) / (H - GROUND);
      for (let x = 0; x < W; x++) L.set(x, y, y === GROUND ? hx('#6a6f9c') : y === GROUND + 1 ? hx('#4a4f80') : dith(x, y, t * 2.2 - Math.floor(t * 2.2)) ? g[Math.min(4, 2 + Math.floor(t * 2.2))] : g[Math.min(4, 1 + Math.floor(t * 2.2))]);
    }
    for (let x = 200; x < 300; x += 12) for (let y = GROUND + 4; y < H - 2; y++) for (let i = 0; i < 6; i++) if (dith(x + i, y, 0.75)) L.set(x + i, y, hx('#c9cce6'));
    for (let x = 0; x < W; x++) if (x % 7 < 4) L.set(x, GROUND + 2, hx('#4c5186'));
    for (let y = -3; y <= 3; y++) for (let x = -6; x <= 6; x++) if ((x * x) / 36 + (y * y) / 9 <= 1) L.set(120 + x, 170 + y, (x + y) % 2 ? hx('#2a2e58') : hx('#3a3e6a'));
    // light pool from the lamp
    for (let y = GROUND; y < H; y++) for (let x = 360; x < 430; x++) { const d = Math.hypot((x - 392) / 34, (y - GROUND - 8) / 10); if (d < 1 && dith(x, y, (1 - d) * 0.6)) L.set(x, y, hx('#5a5474')); }
    return L;
  }

  let FAR = null, NEAR = null;
  function paint() { if (!FAR) { FAR = paintFar(); NEAR = paintNear(); } return { far: FAR, near: NEAR }; }

  root.STAGE = { W, H, VW, GROUND, FAR_W, paint, name: '東京鬼高校・夜の校門前', en: 'TOKYO ONI HIGH — NIGHT GATE' };
})(typeof window !== 'undefined' ? window : globalThis);
