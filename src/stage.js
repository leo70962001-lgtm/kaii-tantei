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
      for (let y = 141; y < 153; y++) for (let x = x0 + 4; x < x0 + 14; x++) L.set(x, y, y < 144 ? hx('#3a3050') : dith(x, y, 0.5) ? hx('#fff2c0') : hx('#ffd870'));
      for (let y = 132; y < 162; y++) for (let x = x0 - 9; x < x0 + 27; x++) { const d = Math.hypot(x - x0 - 8.5, (y - 147) * 1.4); if (d > 8 && d < 18 && dith(x, y, (18 - d) / 14)) if (!L.get(x, y) || L.get(x, y) === hx('#222452')) L.set(x, y, hx('#5a4a50')); }
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

  let FAR = null, NEAR = null;
  function paint() { if (!FAR) { FAR = paintFar(); NEAR = paintNear(); } return { far: FAR, near: NEAR }; }

  root.STAGE = { W, H, VW, GROUND, FAR_W, paint, name: '東京鬼高校・夜の校門前', en: 'TOKYO ONI HIGH — NIGHT GATE' };
})(typeof window !== 'undefined' ? window : globalThis);
