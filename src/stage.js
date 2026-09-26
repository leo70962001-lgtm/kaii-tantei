// stage.js — 東京鬼高校・校門前 (rebuilt from scratch, 「場景整個重來」「參考夜景先做一版」): a 720 px wide street in
// front of the school gate at night, in the way of the konbini-street pin (981784787524549284): a lit convenience store
// on the left with a pink neon sign, the gate in the middle with a huge neon-lit cherry tree spreading over it from the
// school grounds, an apartment block on the right, a curved street lamp, poles and wires, a wet road that mirrors every
// light, petals on the ground. Seen through a 480×270 camera window.
//
// Scale: the fighter is 82 world px = 158 cm → 52 px per metre on the fight plane (the sidewalk, y = GROUND); things
// behind the gate are drawn smaller by their distance (the school ×0.3, the mid-rise blocks of the MID layer ×0.25).
// Depth = four parallax layers: far 0.35 (sky, drifting clouds, hazy city), mid 0.6 (blocks, the railway with its
// train, mist), near 1 (the street), front 1.25 (blossom branches in the corners).
// Every colour comes from the current theme TH: the night palette is the authored one, the other hours (dusk, the neon
// rain, the pastel noon) are derived from it plus their own sky / cloud / haze / light entries.
(function (root) {
  'use strict';
  const PX = root.PX;
  const W = 720, H = 270, VW = 480, GROUND = 240, FAR_W = 600, FRONT_W = 800, MID_W = 660, MID_RATE = 0.6, PXM = 52;
  const hx = PX.hex;
  const rgba = (hex, a) => ((hx(hex) & 0x00ffffff) | ((a & 255) << 24)) >>> 0;
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => t * 16 > bayer[y & 3][x & 3] + 0.5;
  const HS = PX.hash;

  // ---------------------------------------------------------------- layers and small painters
  function layer(w, h) {
    const c = new Uint32Array(w * h);
    return { w, h, c, set(x, y, col) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) c[y * w + x] = col; }, get(x, y) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < w && y < h ? c[y * w + x] : 0; } };
  }
  function wrapLayer(w, h) {   // x wraps: a layer that tiles horizontally (the drifting clouds)
    const c = new Uint32Array(w * h), wx = (x) => (((x | 0) % w) + w) % w;
    return { w, h, c, set(x, y, col) { y |= 0; if (y >= 0 && y < h) c[y * w + wx(x)] = col; }, get(x, y) { y |= 0; return y >= 0 && y < h ? c[y * w + wx(x)] : 0; } };
  }
  const rect = (L, x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L.set(x + i, y + j, col); };
  function line(L, x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { L.set(x0, y0, col); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function ring(L, cx, cy, r0, r1, col) { for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) { const d = Math.hypot(x - cx, y - cy); if (d >= r0 && d < r1) L.set(x, y, col); } }
  function ellipse(L, cx, cy, rx, ry, col, inner) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 && (inner === undefined || d > inner)) L.set(x, y, col); } }
  function blit(L, S, ox, oy) { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { const c = S.c[y * S.w + x]; if (c) L.set(ox + x, oy + y, c); } }
  function rot90cw(S) { const R = layer(S.h, S.w); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(S.h - 1 - y, x, S.c[y * S.w + x]); return R; }     // the top goes to the right
  function rot90ccw(S) { const R = layer(S.h, S.w); for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) R.set(y, S.w - 1 - x, S.c[y * S.w + x]); return R; }    // the top goes to the left
  // a translucent colour over whatever is there: mixed into an opaque pixel, kept translucent over nothing
  function mixPx(L, x, y, col, a) {
    const d = L.get(x, y);
    if (!d || ((d >>> 24) & 255) < 255) { L.set(x, y, ((col & 0x00ffffff) | (Math.max(a, d ? (d >>> 24) & 255 : 0) << 24)) >>> 0); return; }
    const t = a / 255, r = ((d & 255) * (1 - t) + (col & 255) * t) | 0, g = (((d >> 8) & 255) * (1 - t) + ((col >> 8) & 255) * t) | 0, b = (((d >> 16) & 255) * (1 - t) + ((col >> 16) & 255) * t) | 0;
    L.set(x, y, (0xff000000 | (b << 16) | (g << 8) | r) >>> 0);
  }
  function glow(L, cx, cy, rx, ry, hex, aMax, pow) {   // a soft dithered radial glow
    const col = hx(hex);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d >= 1) continue;
      const a = aMax * Math.pow(1 - d, pow || 1.6);
      if (a < 6) { if (dith(x, y, a / 6)) mixPx(L, x, y, col, 6); continue; }
      mixPx(L, x, y, col, Math.round(a));
    }
  }
  function streak(L, x0, x1, yTop, yBot, hex, aMax) {   // a light's reflection on the wet ground, breaking up with distance
    for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
      const t = (y - yTop) / Math.max(1, yBot - yTop), edge = Math.min(x - x0, x1 - 1 - x) / Math.max(1, (x1 - x0) / 2);
      const a = aMax * (1 - t * 0.7) * Math.min(1, edge * 1.6) * (HS(x, y >> 1, 43) < 0.75 ? 1 : 0.35);
      if (a >= 5) mixPx(L, x, y, hx(hex), Math.round(a));
    }
  }
  const OUT = hx('#0a0f2a');

  // ---------------------------------------------------------------- palettes (「選擇場景」: four hours of one street)
  const c2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const h2 = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mixc = (a, b, t) => { const A = c2(a), B = c2(b); return h2(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lift = (h, k, tint) => { const [r, g, b] = c2(h); let R = 255 - (255 - r) * (1 - k), G = 255 - (255 - g) * (1 - k * 0.96), B = 255 - (255 - b) * (1 - k * 1.12); if (tint) { const T = c2(tint); R = R * 0.86 + T[0] * 0.14; G = G * 0.86 + T[1] * 0.14; B = B * 0.86 + T[2] * 0.14; } return h2(R, G, B); };
  function derive(base, f, over) {
    const o = {};
    for (const k in base) { const v = base[k]; o[k] = typeof v === 'string' && v[0] === '#' ? f(v) : Array.isArray(v) ? v.map((x) => (typeof x === 'string' && x[0] === '#' ? f(x) : x)) : (v && typeof v === 'object') ? derive(v, f, null) : v; }
    return Object.assign(o, over || {});
  }
  const NIGHT = {
    id: 'night', name: '夜の校門前', en: 'NIGHT GATE', day: false, rain: false, dense: false, cloudSpeed: 2.5,
    sky: ['#07061a', '#0b0a26', '#120e34', '#1a1240', '#22164c', '#2c1a58', '#382066', '#4a2874', '#603280'], stars: 220, moon: true, sun: null,
    cloud: { body: '#2c2262', shade: '#1c1648', lit: '#5a4a98', rim: '#a08ad0', warm: '#5a2a5c' }, cum: ['#c8b8f0', '#7a68b8', '#524698', '#241c50', '#3c3278', '#302868'],
    haze: ['#4a2a70', '#7a3a80'], farBody: '#1a1640', farEdge: '#2c2658', farWin: ['#ff8ad4', '#5ad0ff', '#ffd98a'], farLit: 0.14,
    midBody: '#141232', midEdge: '#26224e', midWin: '#ff8ad4', midWin2: '#c050a0', midLit: 0.22, mist: '#3a2a60',
    storeWall: '#2a2450', storeEdge: '#3a3466', storeSign: '#f0e4ec', signA: '#ff5ad0', signB: '#ff9a3a', signInk: '#2a1a40', storeGlass: '#f8dfae', storeGlassTop: '#fae6c8', shelf: '#8a7a50', storeDoor: '#9aa0b0', storeGlow: '#ffe0a0', poster: '#ece6dc', posterInk: '#d8302c',
    neon: '#ff5ad0', neonText: '#ffd0f0', neonBox: '#3a1040', neon2: '#5ad0ff',
    pillar: '#3c3868', pillarLight: '#5c5694', pillarDark: '#242048', cap: '#7c76ae', gate: '#3a3e66', gateLight: '#5c6190', gateDark: '#2c3060', plate: '#e8e8f0', plateInk: '#302a40', emblem: '#b8202c', emblemInk: '#fff4e0', yard: '#1c1a40',
    school: '#141232', schoolTrim: '#20264a', schoolWin: '#0f1330', schoolLit: '#ffd98a', schoolLit2: '#e0b850',
    apt: '#1e1c48', aptEdge: '#2e2c64', aptDark: '#151438', aptWin: '#0f1130', aptFrame: '#2c3060', aptLit: ['#ffd98a', '#e0b850'], balcony: '#3c4074', ac: '#3a3e70', shutter: '#2a2e5a', shutter2: '#383c6c', door: '#101430', doorLit: '#ffe0a0', pipe: '#2a2e5c',
    pole: '#5a5f8a', poleLight: '#7a7fae', poleDark: '#3a3e66', wire: '#141a3a', lampHead: '#3a3e66', lampGlass: '#fff6d0', lampGlass2: '#ffe080', lampGlow: '#ffe8b0', insulator: '#c8c4d8',
    bark: '#241832', bark2: '#463050', bark3: '#140c1c', sakura: ['#6a1a70', '#c0209a', '#ff5ad0', '#ff8ad4', '#ffc4ea'], gap: '#2a1040',
    sidewalk: '#444a78', sidewalk2: '#4a4f80', joint: '#2f3462', top: '#7a7fae', tactile: '#c9a830', tactile2: '#d8b83a', kerb: '#8a8fbe', kerb2: '#3a3e66',
    road: ['#3e4374', '#2f3462', '#262a52', '#1e2246', '#181b3a'], roadLine: '#c9cce6', sheen: '#5a4a8a', puddle: '#8a7ab8', petals: ['#ff9cd6', '#f070bc', '#ffd0ea', '#d04a98'], drain: '#1a1d38',
    winLit: ['#ffd98a', '#e0b850'],
  };
  const THEMES = {
    night: NIGHT,
    dusk: derive(NIGHT, (c) => mixc(lift(c, 0.2), '#ff9a60', 0.14), { id: 'dusk', name: '夕暮れの校門前', en: 'DUSK GATE', moon: false, sun: [470, 158], stars: 30,
      sky: ['#1a1440', '#2c1c58', '#48286a', '#6a3a72', '#8c4a6e', '#b06062', '#d08262', '#eaa472', '#f8c484'],
      cloud: { body: '#5a3a70', shade: '#3a2450', lit: '#c07890', rim: '#ffd0b0', warm: '#c06a60' }, cum: ['#ffd8c0', '#e09aa0', '#a06080', '#4a2e60', '#7c4a7c', '#603a68'], haze: ['#8a5a78', '#c07a70'],
      farWin: ['#ffc890', '#ffd0a0'], farLit: 0.06, midLit: 0.1, sakura: ['#a03a80', '#d0509c', '#f078b8', '#ffa0d0', '#ffd0e6'] }),
    cyber: derive(NIGHT, (c) => mixc(c, '#1a5060', 0.16), { id: 'cyber', name: '雨のネオン街', en: 'NEON RAIN', moon: false, stars: 60, dense: true, rain: true, cloudSpeed: 3,
      sky: ['#04080e', '#061018', '#081622', '#0a1c2a', '#0c2232', '#0e2838', '#123040', '#163848', '#1a4050'],
      cloud: { body: '#123040', shade: '#0a1c2a', lit: '#2a5a6a', rim: '#5aa0b0', warm: '#4a2a5a' }, cum: ['#7ac0d0', '#3a7080', '#1e4a58', '#0a1c2a', '#163848', '#123040'], haze: ['#1a4a5a', '#3a2a5a'],
      farWin: ['#ff5ad0', '#5ad0ff'], farLit: 0.3, midLit: 0.4, sakura: ['#8a2a70', '#c0409a', '#e864b8', '#ff8ad4', '#ffc4ea'], winLit: ['#ff8ad4', '#c050a0'], aptLit: ['#ff8ad4', '#c050a0'] }),
    pastel: derive(NIGHT, (c) => lift(c, 0.5, '#c8b8e8'), { id: 'pastel', name: '桜の午後', en: 'PASTEL NOON', day: true, moon: false, stars: 0, cloudSpeed: 4,
      sky: ['#6a7ad0', '#7a8ad8', '#8c98e0', '#a0a8e4', '#b4b4e8', '#c4bce8', '#d4c4e8', '#e4cce8', '#f0d4e8'],
      cloud: { body: '#f0ecf8', shade: '#c4bce0', lit: '#ffffff', rim: '#ffffff', warm: '#f8e0e8' }, cum: ['#ffffff', '#f6f2fc', '#e6def4', '#b8acd8', '#dcd4ee', '#d0c8ea'], haze: ['#c8c0e8', '#ead4ea'],
      farWin: ['#ffffff'], farLit: 0.02, midLit: 0.04, winLit: ['#fff4e0', '#f0e0c0'], aptLit: ['#fff4e0', '#f0e0c0'], schoolLit: '#fff4e0', schoolLit2: '#f0e0c0', storeGlass: '#f6e8d4', storeGlassTop: '#f8ecdc',
      sakura: ['#b040a0', '#d858b0', '#f078c8', '#ff9ad8', '#ffc0ea'], lampGlass: '#e8f0f8', lampGlass2: '#d0dce8' }),
  };
  const THEME_IDS = ['night', 'dusk', 'cyber', 'pastel'];
  let TH = THEMES.night;
  function setTheme(id) { TH = THEMES[id] || THEMES.night; return TH; }
  const T = (k) => hx(TH[k]);   // a theme colour as a packed pixel

  // ---------------------------------------------------------------- far: sky, drifting clouds, hazy city
  function paintFar() {
    let L = layer(FAR_W, H);
    const sky = TH.sky.map(hx);
    for (let y = 0; y < H; y++) {
      const t = Math.pow(y / 226, 1.25) * (sky.length - 1), i = Math.min(sky.length - 2, Math.floor(t)), f = t - i;
      for (let x = 0; x < FAR_W; x++) L.set(x, y, dith(x, y, Math.min(1, f)) ? sky[i + 1] : sky[i]);
    }
    for (let k = 0; k < TH.stars; k++) {
      const x = Math.floor(HS(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(HS(k, 2, 11), 1.5) * 150), b = HS(k, 3, 11);
      L.set(x, y, b > 0.86 ? hx('#ffffff') : b > 0.5 ? hx('#b3bcf0') : hx('#6f78bc'));
      if (b > 0.95) { L.set(x + 1, y, hx('#6f78bc')); L.set(x - 1, y, hx('#6f78bc')); L.set(x, y + 1, hx('#6f78bc')); L.set(x, y - 1, hx('#6f78bc')); }
    }
    if (TH.sun) { glow(L, TH.sun[0], TH.sun[1], 150, 70, '#ffb070', 120, 1.3); glow(L, TH.sun[0], TH.sun[1], 70, 30, '#ffe0a0', 110, 1.2); }
    if (TH.moon) {   // a small moon high on the right (the reference's sky is mostly neon-lit indigo)
      const mx = 520, my = 46, mr = 16;
      for (let y = my - 46; y <= my + 46; y++) for (let x = mx - 46; x <= mx + 46; x++) {
        const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
        if (d <= mr) { const lx = (x - mx) / mr, ly = (y - my) / mr; L.set(x, y, lx + ly > 1.0 ? hx('#d9b28e') : lx + ly > 0.5 ? hx('#efd1ac') : hx('#fbe8cc')); }
        else if (d <= mr + 8 && dith(x, y, (mr + 8 - d) / 14)) L.set(x, y, hx('#5a4a8c'));
        else if (d <= mr + 24 && dith(x, y, (mr + 24 - d) / 70)) L.set(x, y, hx('#3e3470'));
      }
      for (const [dx, dy, r] of [[-5, -3, 3], [5, 3, 2], [-2, 7, 2]]) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) L.set(mx + dx + x, my + dy + y, hx('#dcbb98'));
    }
    // clouds in their own wrapping layer (they drift): elongated banks with a lit rim, cauliflower cumulus
    const CL = wrapLayer(FAR_W, H), C1 = derive(TH.cloud, (c) => c), CC = {}; for (const k in C1) CC[k] = hx(C1[k]);
    const cloudBank = (blobs, ldx, ldy, warm) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [cx, cy, rx, ry] of blobs) { x0 = Math.min(x0, cx - rx - 2); x1 = Math.max(x1, cx + rx + 2); y0 = Math.min(y0, cy - ry - 2); y1 = Math.max(y1, cy + ry + 2); }
      const F = (x, y) => { let f = 0; for (const [cx, cy, rx, ry] of blobs) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) f += (1 - d) * (1 - d); } return f; };
      const Tt = 0.16;
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        const f = F(x, y); if (f < Tt) continue;
        if (f < Tt + HS(x, y, 41) * 0.09) continue;
        const fl = F(x + ldx, y + ldy), fs = F(x - ldx, y - ldy);
        let c = CC.body;
        if (fl < Tt) c = CC.rim; else if (fl < Tt * 2.4) c = dith(x, y, 0.65) ? CC.lit : CC.body; else if (fl < Tt * 4 && dith(x, y, 0.3)) c = CC.lit;
        if (c === CC.body && fs < Tt * 1.8) c = dith(x, y, 0.7) ? CC.shade : CC.body;
        if (c === CC.body && f < Tt * 1.6 && dith(x, y, 0.5)) c = CC.shade;
        if (warm && c === CC.shade && y > y1 - (y1 - y0) * 0.35 && dith(x, y, 0.5)) c = CC.warm;
        CL.set(x, y, c);
      }
    };
    cloudBank([[60, 28, 60, 14], [120, 38, 70, 18], [190, 52, 60, 16], [250, 66, 55, 14], [300, 80, 48, 12], [340, 92, 40, 10], [150, 60, 40, 10], [220, 74, 30, 8]], 5, -4, false);
    cloudBank([[400, 96, 46, 10], [440, 102, 52, 12], [490, 98, 40, 9], [530, 106, 44, 10], [470, 110, 30, 6]], 4, -4, false);
    cloudBank([[20, 150, 70, 14], [90, 158, 90, 18], [180, 164, 70, 14], [250, 170, 50, 10], [560, 150, 60, 12], [600, 158, 40, 10]], 4, -3, true);
    const cumulus = (bx, by, w, seed, ldx) => {
      const lobes = [], n = 4 + Math.floor(w / 20);
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; lobes.push([bx + t * w, by - (0.3 + 0.7 * Math.sin(t * Math.PI)) * w * 0.3 - HS(k, 1, seed) * 6, 7 + HS(k, 2, seed) * 6 + Math.sin(t * Math.PI) * w * 0.07]); }
      for (let k = 0; k < n - 1; k++) { const t = (k + 1) / n; lobes.push([bx + t * w, by - 6 - HS(k, 4, seed) * 6, 8 + Math.sin(t * Math.PI) * w * 0.06]); }
      const F = (x, y) => y <= by && lobes.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
      const CU = TH.cum.map(hx);
      for (let y = by - w * 0.6; y <= by; y++) for (let x = bx - 14; x <= bx + w + 14; x++) {
        if (!F(x, y)) continue;
        const nearEdge = !F(x + 2, y) || !F(x - 2, y) || !F(x, y - 2) || !F(x, y + 2);
        if (nearEdge && HS(x, y, seed + 3) < 0.3) continue;
        const lit = !F(x + ldx * 2, y - 2), mid = !F(x + ldx * 5, y - 5), shade = !F(x - ldx * 3, y + 3) || y > by - 4;
        CL.set(x, y, lit ? CU[0] : mid ? (dith(x, y, 0.55) ? CU[1] : CU[2]) : shade ? CU[3] : dith(x, y, 0.5) ? CU[4] : CU[5]);
      }
    };
    cumulus(486, 122, 92, 51, -1); cumulus(96, 88, 84, 53, 1); cumulus(300, 112, 54, 55, 1); cumulus(560, 96, 40, 57, -1);
    if (TH.day) { cumulus(200, 70, 120, 59, 1); cumulus(400, 58, 70, 61, 1); }
    const SKY = L; L = layer(FAR_W, H);
    // the city: light pollution over the skyline, a far rank of towers in haze, a nearer rank with lit windows and neon
    for (let y = 120; y < 200; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 120) / 80) * 0.55)) L.set(x, y, hx(TH.haze[0]));
    for (let y = 168; y < 198; y++) for (let x = 0; x < FAR_W; x++) if (dith(x, y, ((y - 168) / 30) * 0.35)) L.set(x, y, hx(TH.haze[1]));
    const body = T('farBody'), edge = T('farEdge'), wins = TH.farWin.map(hx);
    const tower = (x0, w, top, lit, k) => {
      for (let y = top; y < GROUND; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, x === x0 || y === top ? edge : body);
      for (let y = top + 3; y < GROUND - 6; y += 5) for (let x = x0 + 2; x < x0 + w - 3; x += 4) {
        if (HS(x, y, 5) < lit) { const c = wins[Math.floor(HS(x, y, 6) * wins.length)]; rect(L, x, y, 2, 3, c); } else { L.set(x, y + 2, edge); L.set(x + 1, y + 2, edge); }
      }
      const r = HS(x0, top, 8);
      if (r > 0.7) { rect(L, x0 + (w >> 1) - 1, top - 6, 2, 6, edge); L.set(x0 + (w >> 1) - 1, top - 7, hx('#ff5a5a')); }
      else if (r > 0.45) { rect(L, x0 + 3, top - 3, 6, 3, edge); rect(L, x0 + w - 8, top - 2, 5, 2, edge); }
      if (HS(k, 21, 4) > 0.55) { const sx = x0 + 3 + Math.floor(HS(k, 22, 4) * Math.max(1, w - 10)), sc = HS(k, 23, 4) > 0.5 ? T('neon') : T('neon2'); rect(L, sx, top + 8, 6, 2, sc); }
    };
    for (let k = 0; k < 26; k++) { const x0 = Math.floor(HS(k, 7, 3) * FAR_W), w = 15 + Math.floor(HS(k, 8, 3) * 40), top = 130 + Math.floor(HS(k, 9, 3) * 45); tower(x0, w, top, TH.farLit * 0.6, k + 100); }
    if (TH.dense) for (let k = 0; k < 34; k++) { const x0 = Math.floor(HS(k, 27, 3) * FAR_W), w = 12 + Math.floor(HS(k, 28, 3) * 26), top = 40 + Math.floor(HS(k, 29, 3) * 90); tower(x0, w, top, 0.35, k + 200); }
    const tx = 380, tt = 52, tb = 190;   // 東京タワー
    for (let y = tt; y < tb; y++) {
      const t = (y - tt) / (tb - tt), hw = 1 + t * t * 14, c = ((y - tt) % 18) < 9 ? hx('#7a2a3a') : hx('#c8c4d8');
      for (let x = Math.round(tx - hw); x <= Math.round(tx + hw); x++) if (Math.abs(x - tx) > hw - 2 || (y % 6 === 0) || dith(x, y, 0.25)) L.set(x, y, c);
    }
    rect(L, tx - 6, 118, 12, 5, hx('#c8c4d8')); rect(L, tx - 10, 150, 20, 6, hx('#c8c4d8')); L.set(tx, tt - 1, hx('#ff4040')); L.set(tx, tt - 2, hx('#ff4040'));
    for (let k = 0; k < 18; k++) { const x0 = Math.floor(HS(k, 17, 4) * FAR_W), w = 18 + Math.floor(HS(k, 18, 4) * 33), top = 160 + Math.floor(HS(k, 19, 4) * 39); tower(x0, w, top, TH.farLit, k); if (HS(k, 24, 4) > 0.8) for (let y = top + 2; y < GROUND; y += 2) { L.set(x0 + 2, y, T('neon2')); L.set(x0 + w - 3, y, T('neon2')); } }
    return { sky: SKY, clouds: CL, city: L };
  }

  // ---------------------------------------------------------------- mid: mid-rise blocks, the elevated railway, mist
  function paintMid() {
    const L = layer(MID_W, H), body = T('midBody'), edge = T('midEdge'), win = T('midWin'), win2 = T('midWin2');
    for (let k = 0; k < 22; k++) {
      const x0 = Math.floor(HS(k, 41, 5) * MID_W), w = 34 + Math.floor(HS(k, 42, 5) * 50), top = (TH.dense ? 8 : 26) + Math.floor(HS(k, 43, 5) * 56);
      for (let y = top; y < 200; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, x === x0 || y === top ? edge : dith(x, y, (y - top) / 200 + HS(x, y, 44) * 0.1) ? body : T('midBody'));
      for (let y = top + 6; y < 190; y += 12) for (let x = x0 + 4; x < x0 + w - 6; x += 9) {
        if (HS(x, y, 45) < TH.midLit) { rect(L, x, y, 5, 6, win); rect(L, x, y + 3, 5, 3, win2); } else { rect(L, x, y, 5, 6, hx('#0a0e24')); L.set(x + 1, y + 1, edge); }
      }
      if (HS(k, 46, 5) > 0.6) { rect(L, x0 + 6, top - 5, 8, 5, edge); rect(L, x0 + w - 12, top - 3, 6, 3, edge); }
      if (TH.dense && HS(k, 47, 5) > 0.5) { const sx = x0 + 4, sc = HS(k, 48, 5) > 0.5 ? '#ff5ad0' : '#5ad0ff'; rect(L, sx, top + 2, w - 8, 3, hx(sc)); glow(L, sx + (w - 8) / 2, top + 3, w / 2 + 8, 8, sc, 50, 1.4); }
    }
    rect(L, 0, 72, MID_W, 3, T('gateLight')); rect(L, 0, 75, MID_W, 9, T('gate')); rect(L, 0, 84, MID_W, 2, T('gateDark'));
    for (let x = 0; x < MID_W; x += 7) rect(L, x, 68, 1, 4, T('pole')); rect(L, 0, 68, MID_W, 1, T('pole'));
    for (let x = 20; x < MID_W; x += 64) { rect(L, x, 86, 8, 114, T('gateDark')); rect(L, x, 86, 2, 114, T('gate')); rect(L, x + 3, 58, 1, 14, T('pole')); rect(L, x + 1, 58, 6, 1, T('pole')); }
    for (let y = 96; y < 150; y++) for (let x = 0; x < MID_W; x++) { const t = Math.sin((y - 96) / 54 * Math.PI); if (HS(x >> 1, y, 49) < t * 0.5) mixPx(L, x, y, T('mist'), Math.round(30 + t * 60)); }
    return L;
  }

  // ---------------------------------------------------------------- near: the street
  let TREES = null, SAKURA = null;
  // a cherry tree: a dark trunk and twisting limbs (recursive), the crown = small clusters of flowers hung along the twigs
  function sakuraOn(L, cx, cy, rx, ry, seed, opts) {
    opts = opts || {}; const near = L === NEARL, light = opts.light === undefined ? 1 : opts.light;
    const BARK = T('bark'), BARK2 = T('bark2'), BARK3 = T('bark3');
    const mark = (x, y) => { if (near) TREES.set(x, y, 1); };
    const limbLine = (x0, y0, x1, y1, w) => { for (let o = -w / 2; o < w / 2; o++) { const c = o < -w / 4 - 0.5 ? BARK2 : o > w / 4 ? BARK3 : BARK; line(L, x0 + o, y0, x1 + o, y1, c); if (near) line(TREES, x0 + o, y0, x1 + o, y1, 1); } };
    const limbs = [];
    const grow = (x, y, ang, len, w, depth, k) => {
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      limbs.push([x, y, x1, y1, w, depth]);
      if (depth <= 0) return;
      const n = 2 + (HS(k, depth, seed) > 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) { const spread = 0.45 + HS(k * 7 + i, depth, seed) * 0.5, a = ang + (i - (n - 1) / 2) * spread + (HS(k * 3 + i, depth + 9, seed) - 0.5) * 0.5; grow(x1, y1, a, len * (0.6 + HS(k + i, depth + 3, seed) * 0.25), Math.max(1, w * 0.62), depth - 1, k * 4 + i + 1); }
    };
    if (opts.trunk !== false) {
      const base = cy + ry * 0.38, bottom = opts.bottom || 190, tw = opts.trunkW || 6;
      for (let y = base; y < bottom; y++) { const w = tw + (y - base) / 40; for (let i = -w / 2; i < w / 2; i++) { const xx = cx + i + Math.round(Math.sin(y * 0.15 + seed) * 1.2); L.set(xx, y, i < -w / 4 ? BARK2 : i > w / 4 ? BARK3 : BARK); mark(xx, y); } }
      grow(cx, base, -Math.PI / 2 + (HS(1, 1, seed) - 0.5) * 0.5, ry * 0.42, tw - 1, 3, 1);
      grow(cx, base + 6, -Math.PI / 2 - 0.9 * (HS(2, 1, seed) > 0.5 ? 1 : -1), ry * 0.32, 3, 2, 9);
      if (opts.big) grow(cx, base + 12, -Math.PI / 2 + 0.9 * (HS(2, 1, seed) > 0.5 ? 1 : -1), ry * 0.3, 3, 2, 17);
    } else grow(cx, cy, opts.ang || Math.PI / 2, opts.len || ry * 0.45, 5, 3, 1);
    limbs.sort((p, q) => q[4] - p[4]);
    for (const [x0, y0, x1, y1, w] of limbs) limbLine(x0, y0, x1, y1, w);
    const TONES = TH.sakura.map(hx), WHITE = hx('#fff2f8'), GAP = T('gap');
    const cluster = (fx, fy, r, k) => {
      for (let y = Math.floor(fy - r); y <= fy + r; y++) for (let x = Math.floor(fx - r); x <= fx + r; x++) {
        const d = Math.hypot(x - fx, y - fy) / r + HS(x, y, seed + 5) * 0.25; if (d > 1) continue;
        const n = HS(x, y, seed + 6 + k); if (n < 0.13) continue;
        const l = ((x - fx) / r) * 0.55 * light - ((y - fy) / r) * 0.75 + (HS(x, y, seed + 7) - 0.5) * 0.5;
        L.set(x, y, n > 0.96 ? WHITE : l > 0.55 ? TONES[4] : l > 0.15 ? TONES[3] : l > -0.25 ? TONES[2] : l > -0.6 ? TONES[1] : TONES[0]); mark(x, y);
      }
    };
    let k = 0;
    for (const [x0, y0, x1, y1, w, depth] of limbs) {
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(2, Math.round(len / 3.5)), per = depth === 0 ? 3 : depth === 1 ? 2 : 1;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t;
        for (let c = 0; c < per; c++) {
          const ox = (HS(i * 13 + c, 21, seed + k) - 0.5) * (10 + w * 2), oy = (HS(i * 13 + c, 22, seed + k) - 0.5) * 12, fx = bx + ox, fy = by + oy;
          if (((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2 > 1.05) continue;
          cluster(fx, fy, 2.5 + HS(i + c, 23, seed + k) * 3.0, k);
        }
      }
      k++;
    }
    for (let g = 0; g < 8; g++) { const gx = cx + (HS(g, 31, seed) - 0.5) * rx * 1.4, gy = cy + (HS(g, 32, seed) - 0.5) * ry * 1.2; for (let y = gy - 2; y <= gy + 2; y++) for (let x = gx - 3; x <= gx + 3; x++) if (L.get(x, y) && HS(x, y, seed + 33) < 0.5) L.set(x, y, GAP); }
  }
  let NEARL = null;
  const WINDOWS = [[30, 84], [110, 84], [560, 84], [640, 84], [560, 138], [640, 138]];   // the apartment panes that switch at night
  function paintNear() {
    const L = layer(W, H); NEARL = L; TREES = layer(W, H);
    // ---- the school grounds behind the gate (×0.3): the yard, the school building, and the great cherry tree
    for (let y = 150; y < 200; y++) for (let x = 200; x < 560; x++) if (dith(x, y, (y - 150) / 70)) L.set(x, y, T('yard'));
    rect(L, 282, 96, 208, 92, T('school')); rect(L, 282, 96, 208, 3, T('schoolTrim')); rect(L, 282, 99, 208, 1, hx('#0f1330'));
    for (let row = 0; row < 3; row++) for (let x = 292; x < 484; x += 12) { const y = 106 + row * 26, lit = HS(x, row, 23) < 0.14; rect(L, x, y, 7, 9, lit ? T('schoolLit') : T('schoolWin')); if (lit) rect(L, x, y + 5, 7, 4, T('schoolLit2')); else L.set(x + 1, y + 1, hx('#2a3060')); }
    rect(L, 374, 160, 24, 28, T('schoolWin')); rect(L, 370, 156, 32, 4, hx('#2a3060')); rect(L, 384, 168, 4, 20, hx('#3a4a8a'));
    for (let y = 60; y < 188; y++) L.set(302, y, T('pole')); rect(L, 303, 62, 7, 4, hx('#e8e8f0')); L.set(306, 64, hx('#e84a5f'));
    for (let y = 188; y < GROUND; y++) for (let x = 282; x < 490; x++) L.set(x, y, dith(x, y, (y - 188) / 60) ? T('yard') : T('aptEdge'));
    sakuraOn(L, 386, 54, 178, 104, 13, { big: true, trunkW: 10, bottom: GROUND, light: -1 });   // the great tree over the gate
    // ---- left: the convenience store with the flat above it (the reference's lit storefront and pink neon)
    rect(L, 0, 64, 196, 176, T('storeWall')); rect(L, 0, 64, 196, 3, T('storeEdge')); rect(L, 0, 67, 196, 1, hx('#0f1130')); rect(L, 194, 64, 2, 176, T('storeEdge'));
    for (let y = 68; y < 136; y++) for (let x = 0; x < 196; x++) if (HS(x, y, 45) < 0.06) L.set(x, y, T('storeEdge'));
    const win = (x, y, lit, curtain) => {
      rect(L, x - 1, y - 1, 23, 27, T('aptFrame')); rect(L, x, y, 21, 25, lit ? hx(TH.aptLit[0]) : T('aptWin'));
      if (lit) { rect(L, x, y + 13, 21, 12, hx(TH.aptLit[1])); if (curtain) { rect(L, x, y, 6, 25, hx('#f0c890')); rect(L, x + 15, y, 6, 25, hx('#f0c890')); } } else { L.set(x + 2, y + 2, hx('#2a3060')); L.set(x + 3, y + 2, hx('#2a3060')); }
      rect(L, x + 10, y, 1, 25, T('aptFrame')); rect(L, x, y + 12, 21, 1, T('aptFrame'));
    };
    win(30, 84, true, true); win(110, 84, false, false);
    for (const x of [24, 104]) { rect(L, x, 112, 33, 2, T('balcony')); for (let i = 0; i < 33; i += 3) L.set(x + i, 108, T('balcony')); rect(L, x, 108, 1, 6, T('balcony')); rect(L, x + 32, 108, 1, 6, T('balcony')); }
    rect(L, 150, 100, 10, 7, T('ac')); rect(L, 150, 100, 10, 1, T('pole')); for (let i = 1; i < 6; i += 2) rect(L, 151, 100 + i, 8, 1, T('aptDark'));
    rect(L, 4, 68, 2, 70, T('pipe')); rect(L, 4, 68, 1, 70, T('storeEdge'));
    rect(L, 0, 136, 196, 16, T('storeSign')); rect(L, 0, 136, 196, 1, hx('#c8c4d8')); rect(L, 0, 151, 196, 1, hx('#a8a4b8'));   // the sign band
    rect(L, 8, 139, 60, 5, T('signA')); rect(L, 8, 145, 60, 4, T('signB'));
    for (const [x, w] of [[80, 6], [90, 5], [99, 7], [110, 5], [119, 6], [129, 5], [138, 7], [150, 5], [160, 6], [170, 5]]) rect(L, x, 140, w, 8, T('signInk'));
    rect(L, 0, 152, 196, 88, T('storeEdge'));   // the glass front: the lit interior, shelves of goods, the door, posters
    for (let y = 154; y < GROUND; y++) for (let x = 6; x < 190; x++) L.set(x, y, dith(x, y, (y - 154) / 90) ? T('storeGlass') : T('storeGlassTop'));
    for (let y = 168; y < GROUND; y += 14) { rect(L, 10, y, 76, 1, T('shelf')); rect(L, 130, y, 56, 1, T('shelf')); for (let x = 12; x < 84; x += 4) rect(L, x, y - 6, 3, 6, [hx('#e84a5f'), hx('#5ad0ff'), hx('#7ae06a'), hx('#ffd24a'), hx('#ff8a3a'), hx('#c9cce6')][(x + y) % 6]); for (let x = 132; x < 184; x += 4) rect(L, x, y - 6, 3, 6, [hx('#ff5ad0'), hx('#7ad4ff'), hx('#ffd24a'), hx('#c9cce6')][(x + y) % 4]); }
    rect(L, 92, 152, 2, 88, T('storeDoor')); rect(L, 128, 152, 2, 88, T('storeDoor')); rect(L, 94, 154, 34, 86, hx('#f6e4c2')); rect(L, 109, 154, 2, 86, T('storeDoor')); rect(L, 96, 200, 30, 2, T('shelf'));   // the sliding door
    for (const [x, y] of [[14, 158], [40, 158]]) { rect(L, x, y, 18, 24, T('poster')); rect(L, x + 2, y + 2, 14, 6, T('posterInk')); for (let j = 0; j < 4; j++) rect(L, x + 2, y + 11 + j * 3, 14, 1, hx('#302a40')); }
    rect(L, 6, 232, 184, 8, hx('#2a2450'));   // the sill
    if (!TH.day) glow(L, 98, 244, 120, 30, TH.storeGlow, 40, 1.4);
    glow(L, 190, 100, 30, 44, TH.neon, TH.day ? 0 : 60, 1.5);   // the vertical neon sign on the store's corner
    rect(L, 183, 70, 14, 60, T('neonBox')); rect(L, 184, 71, 12, 58, T('neon')); rect(L, 185, 72, 10, 56, mixc(TH.neon, '#000000', 0.35) ? hx(mixc(TH.neon, '#3a1040', 0.45)) : T('neon'));
    for (let k = 0; k < 4; k++) { const y = 75 + k * 14; rect(L, 187, y, 6, 1, T('neonText')); rect(L, 189, y + 1, 1, 8, T('neonText')); rect(L, 186, y + 4, 8, 1, T('neonText')); rect(L, 187, y + 8, 6, 1, T('neonText')); }
    rect(L, 185, 130, 10, 2, T('neonBox')); rect(L, 189, 132, 2, 6, T('neonBox'));
    // ---- the gate (0.5-m pillars 2.2 m tall, the 1.8-m iron gate) with the school plate and the oni emblem
    const pillar = (x0) => {
      for (let y = 126; y < GROUND; y++) for (let x = x0; x < x0 + 26; x++) { const band = (y - 126) % 22 === 0; L.set(x, y, x <= x0 + 1 ? T('pillarLight') : x >= x0 + 24 ? T('pillarDark') : band ? T('pillarDark') : dith(x, y, (y - 126) / 130 + HS(x, y, 31) * 0.1) ? T('pillarDark') : T('pillar')); }
      rect(L, x0 - 2, 122, 30, 2, T('cap')); rect(L, x0 - 2, 124, 30, 2, T('pillarLight')); rect(L, x0 - 1, 126, 28, 1, T('pillarDark'));
    };
    pillar(256); pillar(490);
    rect(L, 262, 150, 14, 14, T('emblem')); rect(L, 263, 151, 12, 12, hx(mixc(TH.emblem, '#ffffff', 0.12)));
    ['....xx....xx', '...xxxxxxxx.', '..xxxx.xx.xx', '..xxxxxxxxxx', '.xxx.xxxx.xx', '..xxxxxxxxx.', '...xx.xx.xx.', '....xxxxxx..'].forEach((r, j) => r.split('').forEach((ch, i) => { if (ch === 'x') L.set(263 + i, 153 + j, T('emblemInk')); }));
    rect(L, 496, 146, 14, 44, T('plate')); rect(L, 496, 146, 14, 1, hx('#a8a8b8')); rect(L, 496, 189, 14, 1, hx('#a8a8b8'));
    for (let k = 0; k < 5; k++) { rect(L, 499, 150 + k * 8, 8, 2, T('plateInk')); rect(L, 500, 153 + k * 8, 6, 1, T('plateInk')); rect(L, 502, 152 + k * 8, 1, 3, T('plateInk')); }
    for (let x = 282; x < 490; x++) { L.set(x, 146, T('gateLight')); L.set(x, 147, T('gate')); L.set(x, 148, T('gateDark')); L.set(x, 192, T('gate')); L.set(x, 193, T('gateDark')); L.set(x, 236, T('gate')); L.set(x, 237, T('gateDark')); }
    for (let x = 286; x < 490; x += 8) { for (let y = 149; y < GROUND; y++) { L.set(x, y, T('gate')); L.set(x + 1, y, T('gateDark')); } L.set(x, 144, T('gateLight')); L.set(x + 1, 144, T('gateLight')); L.set(x, 143, T('cap')); }
    rect(L, 382, 186, 8, 12, T('pillarDark')); rect(L, 383, 188, 6, 3, T('cap'));
    // ---- right: the apartment block at the street line: an entrance, a garage shutter, two floors of windows, balconies
    rect(L, 516, 64, 204, 176, T('apt')); rect(L, 516, 64, 204, 3, T('aptEdge')); rect(L, 516, 67, 204, 1, hx('#0f1130')); rect(L, 516, 64, 2, 176, T('aptEdge'));
    for (let y = 68; y < GROUND; y++) for (let x = 516; x < W; x++) if (HS(x, y, 46) < 0.06) L.set(x, y, T('aptEdge'));
    for (let x = 516; x < W; x += 5) rect(L, x, 58, 1, 6, T('balcony')); rect(L, 516, 58, 204, 1, T('pole'));
    win(560, 84, HS(1, 5, 41) < 0.6, true); win(640, 84, false, false); win(560, 138, true, false); win(640, 138, HS(2, 5, 41) < 0.5, true);
    for (const [x, y] of [[554, 112], [634, 112], [554, 166], [634, 166]]) { rect(L, x, y, 33, 2, T('balcony')); for (let i = 0; i < 33; i += 3) L.set(x + i, y - 4, T('balcony')); rect(L, x, y - 4, 1, 6, T('balcony')); rect(L, x + 32, y - 4, 1, 6, T('balcony')); }
    for (const [x, y] of [[600, 92], [690, 146]]) { rect(L, x, y, 10, 7, T('ac')); rect(L, x, y, 10, 1, T('pole')); for (let i = 1; i < 6; i += 2) rect(L, x + 1, y + i, 8, 1, T('aptDark')); }
    rect(L, 528, 190, 26, 50, T('aptDark')); rect(L, 530, 192, 22, 46, T('door')); rect(L, 533, 196, 16, 12, T('doorLit')); rect(L, 540, 192, 1, 46, T('aptDark')); rect(L, 530, 184, 22, 6, T('aptEdge'));   // the entrance
    rect(L, 630, 176, 80, 64, T('shutter')); for (let y = 178; y < GROUND; y += 4) rect(L, 630, y, 80, 1, T('shutter2')); rect(L, 630, 176, 80, 3, T('aptEdge'));   // the garage shutter
    rect(L, 706, 68, 2, 172, T('pipe')); rect(L, 706, 68, 1, 172, T('aptEdge'));
    // ---- the curved street lamp in the gap between the store and the gate, the utility pole on the right, the wires
    for (let y = 40; y < GROUND; y++) for (let x = 236; x < 243; x++) L.set(x, y, x === 236 ? T('poleLight') : x === 242 ? T('poleDark') : T('pole'));
    for (let i = 0; i <= 48; i++) { const t = i / 48, x = 239 + t * 50, y = 40 - Math.sin(t * Math.PI / 2) * 14 + t * t * 14; rect(L, Math.round(x), Math.round(y), 2, 3, T('pole')); L.set(Math.round(x), Math.round(y), T('poleLight')); }   // the arm
    rect(L, 282, 52, 20, 8, T('lampHead')); rect(L, 283, 53, 18, 6, T('pole')); for (let y = 55; y < 60; y++) for (let x = 284; x < 300; x++) L.set(x, y, dith(x, y, 0.6) ? T('lampGlass') : T('lampGlass2'));
    if (!TH.day) { for (let y = 60; y < GROUND; y++) { const t = (y - 60) / (GROUND - 60), hw = 5 + t * 40; for (let x = Math.round(292 - hw); x <= Math.round(292 + hw); x++) { const e = 1 - Math.abs(x - 292) / hw, a = 34 * (1 - t * 0.85) * e; if (a >= 4 && dith(x, y, Math.min(1, a / 10))) mixPx(L, x, y, hx(TH.lampGlow), Math.max(8, Math.round(a))); } } }
    for (let y = 0; y < GROUND; y++) for (let x = 606; x < 620; x++) L.set(x, y, x < 608 ? T('poleLight') : x > 617 ? T('poleDark') : dith(x, y, 0.5 + HS(x, y, 33) * 0.2) ? T('pole') : T('poleLight'));
    for (let y = 0; y < GROUND; y += 30) rect(L, 606, y, 14, 1, T('poleDark'));
    rect(L, 579, 36, 66, 3, T('poleDark')); rect(L, 579, 36, 66, 1, T('poleLight')); for (const ix of [583, 597, 627, 641]) { rect(L, ix, 32, 3, 4, T('insulator')); rect(L, ix, 31, 3, 1, hx('#e8e8f0')); }
    rect(L, 620, 58, 14, 22, T('aptDark')); rect(L, 620, 58, 14, 2, T('pole')); rect(L, 622, 62, 10, 14, T('storeWall')); rect(L, 620, 80, 14, 2, T('poleDark'));
    const wire = (x0, y0, x1, y1, sag) => { for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0), y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t); L.set(x, Math.round(y), T('wire')); } };
    wire(0, 24, 584, 32, 9); wire(0, 32, 598, 32, 10); wire(628, 32, W, 20, 4); wire(642, 32, W, 28, 4); wire(0, 44, 606, 50, 7); wire(240, 44, 606, 46, 6);
    // ---- the ground: tiled sidewalk, tactile strip, kerb, asphalt with its markings; then the wet-road treatment
    for (let y = GROUND; y < 252; y++) for (let x = 0; x < W; x++) { const tile = (Math.floor(x / 12) + Math.floor((y - GROUND) / 6)) & 1, joint = x % 12 === 0 || (y - GROUND) % 6 === 0; L.set(x, y, y === GROUND ? T('top') : joint ? T('joint') : tile ? T('sidewalk2') : T('sidewalk')); }
    for (let x = 0; x < W; x++) for (let y = 245; y < 249; y++) L.set(x, y, ((x % 4 === 1 || x % 4 === 2) && (y === 246 || y === 247)) ? T('tactile2') : T('tactile'));
    rect(L, 0, 252, W, 1, T('kerb')); rect(L, 0, 253, W, 2, T('kerb2'));
    const g = TH.road.map(hx);
    for (let y = 255; y < H; y++) { const t = (y - 255) / (H - 255); for (let x = 0; x < W; x++) L.set(x, y, dith(x, y, t * 2.2 - Math.floor(t * 2.2)) ? g[Math.min(4, 2 + Math.floor(t * 2.2))] : g[Math.min(4, 1 + Math.floor(t * 2.2))]); }
    for (let x = 0; x < W; x++) if (x % 16 < 10) L.set(x, 257, T('roadLine'));
    for (let x = 300; x < 470; x += 18) for (let y = 261; y < H - 2; y++) for (let i = 0; i < 9; i++) if (dith(x + i, y, 0.75)) L.set(x + i, y, T('roadLine'));
    for (let y = -3; y <= 3; y++) for (let x = -7; x <= 7; x++) if ((x * x) / 49 + (y * y) / 9 <= 1) L.set(180 + x, 263 + y, (x + y) % 2 ? T('joint') : T('sidewalk2'));
    rect(L, 396, 250, 10, 2, T('drain')); for (let i = 0; i < 5; i++) L.set(397 + i * 2, 250, T('kerb2'));
    // the street mirrored in the wet asphalt (dim, rippled), the sheen, the puddle, every light's streak
    for (let y = 255; y < H; y++) { const t = (y - 255) / (H - 255), sy = GROUND - 1 - Math.round((y - 255) * 1.15), off = Math.round(Math.sin(y * 1.9) * 1.5 + Math.sin(y * 0.7) * 1.2); for (let x = 0; x < W; x++) { const c = L.get(x + off, sy); if (c && dith(x, y, 0.62 - t * 0.4)) mixPx(L, x, y, c, Math.round(82 - t * 46)); } }
    for (let y = 255; y < H; y++) for (let x = 0; x < W; x++) if (HS(x, y, 47) < 0.08 + (y - 255) / 60) mixPx(L, x, y, T('sheen'), 22 + Math.round((y - 255) * 1.5 * (TH.rain ? 1.6 : 1)));
    for (let y = 255; y < H; y++) for (let x = 555; x < 705; x++) { const d = Math.hypot((x - 630) / 72, (y - 262) / 9); if (d < 1 && dith(x, y, (1 - d) * 0.7)) mixPx(L, x, y, T('puddle'), 70); }
    if (!TH.day) {
      streak(L, 8, 190, GROUND, 252, TH.storeGlow, 40); streak(L, 12, 186, 255, H, TH.storeGlow, 60);
      streak(L, 180, 200, 255, H, TH.neon, 70); streak(L, 176, 204, GROUND, 252, TH.neon, 30);
      streak(L, 282, 302, GROUND, 252, TH.lampGlow, 60); streak(L, 278, 306, 255, H, TH.lampGlow, 85);
      streak(L, 530, 552, 255, H, TH.doorLit, 30); streak(L, 300, 470, 262, H, TH.puddle, 14);
    }
    const PET = TH.petals.map(hx);   // fallen petals, thickest under the great tree
    for (let y = GROUND + 1; y < H; y++) for (let x = 0; x < W; x++) { let dens = 0.014 + 0.08 * Math.max(0, 1 - Math.abs(x - 386) / 150); if (y > 252) dens *= 0.45; if (HS(x, y, 61) < dens) { const c = PET[Math.floor(HS(x, y, 62) * 4)]; L.set(x, y, c); if (HS(x, y, 63) < 0.4) L.set(x + 1, y, c); } }
    SAKURA = sakuraOn;
    return L;
  }
  function paintFront() {   // blossom branches reaching into the top corners, nearer than the fighters
    const L = layer(FRONT_W, H);
    sakuraOn(L, 10, -24, 230, 120, 23, { trunk: false, ang: Math.PI * 0.36, len: 52, light: 1 });
    sakuraOn(L, 790, -20, 220, 112, 29, { trunk: false, ang: Math.PI * 0.64, len: 50, light: -1 });
    return L;
  }
  const WINSPANS = [];
  function windowSpans() {   // each switching pane cut into the row spans no tree covers (「窗子的燈光在櫻花樹後」)
    WINSPANS.length = 0;
    for (const [wx, wy] of WINDOWS) {
      const spans = [];
      for (let y = wy; y < wy + 25; y++) { if (y === wy + 12) continue; let x0 = -1; for (let x = wx; x <= wx + 21; x++) { const pane = x < wx + 21 && x !== wx + 10 && !TREES.get(x, y); if (pane && x0 < 0) x0 = x; if (!pane && x0 >= 0) { spans.push([x0, y, x - x0, y < wy + 13]); x0 = -1; } } }
      WINSPANS.push(spans);
    }
  }
  function half(L) { const w = L.w >> 1, h = L.h >> 1, c = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c[y * w + x] = L.c[(y * 2) * L.w + x * 2]; return { w, h, c }; }
  const PAINTED = {};
  function paint(id) {
    id = id || TH.id; setTheme(id);
    if (!PAINTED[id]) { const F = paintFar(); PAINTED[id] = { theme: id, sky: F.sky, clouds: F.clouds, city: F.city, mid: paintMid(), near: paintNear(), front: paintFront(), frontRate: 1.25, midRate: MID_RATE, cloudSpeed: TH.cloudSpeed || 2.5 }; if (!WINSPANS.length) windowSpans(); }
    return PAINTED[id];
  }

  // ---------------------------------------------------------------- living background: pure functions of the time
  const PINK = ['#ffb7cc', '#f7a3bd', '#ffd6e0', '#e88fa8'];
  function anim(t, broken) {
    const out = [], s = t / 1000, Hh = HS; broken = broken || new Set();
    const PK = TH.petals || PINK;
    for (let k = 0; k < 34; k++) {   // petals in the wind (one in five in front of the fighters)
      const vy = 14 + Hh(k, 1, 21) * 16, per = 1.4 + Hh(k, 2, 21) * 2.2, amp = 5 + Hh(k, 3, 21) * 10;
      const y = ((Hh(k, 4, 21) * 300 + s * vy) % (GROUND + 30)) - 12, x = ((Hh(k, 5, 21) * W + s * (10 + Hh(k, 6, 21) * 12) + Math.sin(s / per * Math.PI * 2 + k) * amp) % W + W) % W;
      const big = Hh(k, 7, 21) > 0.6, front = k % 5 === 0;
      out.push({ x: Math.round(x), y: Math.round(y), w: big ? 3 : 2, h: 2, col: PK[k & 3], a: front ? 0.9 : 0.75, front });
      if (big) out.push({ x: Math.round(x) + 1, y: Math.round(y) - 1, w: 1, h: 1, col: PK[(k + 1) & 3], a: 0.6, front });
    }
    for (const [k, lx0, ly0, lw, lh, r, id] of [[0, 261, 106, 16, 16, 20, 'lampL'], [1, 495, 106, 16, 16, 20, 'lampR'], [2, 284, 55, 16, 5, 22, 'street']]) {   // lamp flicker
      if (broken.has(id) || TH.day) continue;
      const f = 0.55 + 0.45 * Math.sin(s * 9 + k * 2) * Math.sin(s * 3.3 + k) + (Hh(Math.floor(s * 12) + k, 8, 21) > 0.9 ? -0.35 : 0);
      out.push({ x: lx0 - r, y: ly0 - r, w: lw + r * 2, h: lh + r * 2, col: '#ffd070', a: 0.02 + 0.04 * f });
      out.push({ x: lx0 - (r >> 1), y: ly0 - (r >> 1), w: lw + r, h: lh + r, col: '#ffe4a0', a: 0.04 + 0.06 * f });
    }
    if (!TH.day) {   // the store's light and the neon hum
      const f = 0.85 + 0.15 * Math.sin(s * 7.3) + (Hh(Math.floor(s * 9), 13, 21) > 0.94 ? -0.5 : 0);
      out.push({ x: 6, y: 154, w: 184, h: 86, col: TH.storeGlow, a: 0.03 * f });
      out.push({ x: 176, y: 66, w: 28, h: 72, col: TH.neon, a: 0.03 + 0.03 * Math.sin(s * 11) });
      if (!broken.has('vend')) out.push({ x: 198, y: 148, w: 48, h: 92, col: '#c0e8ff', a: 0.03 * f });
    }
    if (!TH.day) for (let k = 0; k < 4; k++) {   // the flats' windows switching, only where no canopy covers the pane
      const slot = Math.floor(s / 1.1) + k * 7, on = Hh(slot, 9, 21) > 0.5, wi = Math.floor(Hh(slot, 10, 21) * WINDOWS.length) % WINDOWS.length;
      for (const [x, y, w, top] of WINSPANS[wi] || []) out.push({ x, y, w, h: 1, col: on ? (top ? TH.aptLit[0] : TH.aptLit[1]) : TH.aptWin, a: 1 });
    }
    for (const [k, y0, len, col, spd] of [[0, 62, 70, TH.cloud.body, 3.2], [1, 74, 48, TH.cloud.shade, 2.4], [2, 92, 90, TH.cloud.shade, 1.8]]) {   // wisps (far)
      const x0 = ((k * 170 + s * spd) % (FAR_W + 140)) - 70;
      for (let x = 0; x < len; x += 2) { const bump = (x % 13 < 9) ? 2 : 0; out.push({ far: true, x: x0 + x, y: y0 + ((x / 2) & 1) - bump, w: 2, h: 2 + bump, col, a: 0.9 }); }
    }
    for (let k = 0; k < 14; k++) { const x = Math.floor(Hh(k, 1, 11) * FAR_W), y = Math.floor(Math.pow(Hh(k, 2, 11), 1.5) * 150); if (TH.stars) out.push({ far: true, x, y, w: 1, h: 1, col: '#ffffff', a: 0.5 + 0.5 * Math.sin(s * (1.5 + Hh(k, 12, 21) * 3) + k * 1.7) }); }
    if (Math.floor(s * 1.2) & 1) out.push({ far: true, x: 379, y: 49, w: 3, h: 2, col: '#ff6060', a: 0.9 });
    const tp = (s % 22) / 22;   // the train on the elevated railway (mid)
    if (tp < 0.32) { const u = tp / 0.32, tx0 = MID_W + 40 - u * (MID_W + 260); for (let c = 0; c < 6; c++) { const cx = tx0 + c * 34; out.push({ mid: true, x: cx, y: 60, w: 32, h: 12, col: '#c9cce6', a: 1 }); out.push({ mid: true, x: cx, y: 60, w: 32, h: 2, col: '#e8e8f0', a: 1 }); out.push({ mid: true, x: cx, y: 69, w: 32, h: 3, col: '#3a3e66', a: 1 }); for (let i = 0; i < 5; i++) out.push({ mid: true, x: cx + 3 + i * 6, y: 62, w: 4, h: 5, col: TH.rain ? '#ffb0e0' : '#ffe6a0', a: 1 }); if (c === 0) out.push({ mid: true, x: cx - 2, y: 64, w: 2, h: 3, col: '#ffffff', a: 1 }); } }
    if (TH.rain) for (let k = 0; k < 110; k++) { const spd = 160 + Hh(k, 51, 21) * 120, x = ((Hh(k, 52, 21) * (W + 60) + s * 14) % (W + 60)) - 30, y = ((Hh(k, 53, 21) * 320 + s * spd) % (H + 40)) - 20, front = k % 4 === 0; out.push(front ? { x: Math.round(x), y: Math.round(y), w: 1, h: 9, col: '#bfe0ff', a: 0.5, front: true } : { mid: true, x: Math.round(x * 1.2), y: Math.round(y), w: 1, h: 7, col: '#9ad0e0', a: 0.35 }); }
    const bp = (s % 14) / 14;   // bats (far)
    if (bp < 0.45 && !TH.day) for (let k = 0; k < 3; k++) { const bx = FAR_W + 40 - bp / 0.45 * (FAR_W + 80) + k * 22, by = 58 + k * 9 + Math.sin(s * 6 + k) * 4, flap = Math.floor(s * 10 + k) & 1; out.push({ far: true, x: bx, y: by, w: 2, h: 1, col: '#0a0b1c', a: 1 }); out.push({ far: true, x: bx - 3, y: by - flap, w: 3, h: 1, col: '#0a0b1c', a: 1 }); out.push({ far: true, x: bx + 2, y: by - flap, w: 3, h: 1, col: '#0a0b1c', a: 1 }); }
    const cp = (s % 26) / 26;   // a cat along the store's sign band
    if (cp > 0.7) { const u = (cp - 0.7) / 0.3, cx = 186 - u * 170, cy = 128, step = Math.floor(s * 6) & 1, C = '#0c0d1e'; out.push({ x: cx, y: cy + 2, w: 11, h: 4, col: C, a: 1 }); out.push({ x: cx - 4, y: cy + 1, w: 5, h: 4, col: C, a: 1 }); out.push({ x: cx - 4, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 1, y: cy - 1, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 11, y: cy - 2 + step, w: 1, h: 5, col: C, a: 1 }); out.push({ x: cx + 1 + step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx + 8 - step, y: cy + 6, w: 1, h: 2, col: C, a: 1 }); out.push({ x: cx - 3, y: cy + 2, w: 1, h: 1, col: '#ffe060', a: 1 }); }
    return out;
  }

  // ---------------------------------------------------------------- breakable props (real size; the pictures below)
  const PROPS = [
    { id: 'vend', kind: 'vend', hp: 4, hit: [200, 145, 44, 95], box: [184, 125, 120, 145] },
    { id: 'bike', kind: 'bike', hp: 2, hit: [524, 188, 91, 52], box: [514, 180, 112, 60] },
    { id: 'lampL', kind: 'lamp', hp: 2, hit: [261, 106, 16, 16], box: [229, 70, 80, 200] },
    { id: 'lampR', kind: 'lamp', hp: 2, hit: [495, 106, 16, 16], box: [463, 70, 80, 200] },
    { id: 'sign', kind: 'sign', hp: 2, hit: [622, 193, 29, 47], box: [616, 193, 62, 47] },
    { id: 'bin', kind: 'bin', hp: 2, hit: [656, 193, 23, 47], box: [650, 190, 70, 50] },
    { id: 'cone1', kind: 'cone', hp: 1, hit: [676, 204, 20, 36], box: [660, 204, 40, 36] },
    { id: 'cone2', kind: 'cone', hp: 1, hit: [698, 204, 20, 36], box: [682, 204, 40, 36] },
  ];
  function breakables() { return PROPS.map((p) => ({ id: p.id, kind: p.kind, hp: p.hp, hp0: p.hp, state: 0, hits: new Set(), x: p.hit[0], y: p.hit[1], w: p.hit[2], h: p.hit[3], box: p.box.slice() })); }

  function paintVend(state) {   // 44×95 standing at (16, 20) of a 120×145 box (183 × 85 cm); broken: on its side, cans rolling out
    const L = layer(120, 145); const W0 = 44, H0 = 95, S = layer(W0, H0), dim = state > 0, OX = 16, OY = 20;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
      const edge = x === 0 || y === 0 || x === W0 - 1 || y === H0 - 1;
      S.set(x, y, edge ? OUT : x <= 1 ? hx('#4a6fd0') : x >= W0 - 3 ? hx('#141f44') : dith(x, y, y / H0 * 0.8) ? hx('#1b3470') : hx('#22407f'));
    }
    rect(S, 1, 1, W0 - 2, 1, hx('#5a80e0')); rect(S, 1, 2, W0 - 2, 4, hx('#3b5fc0'));
    for (let i = 0; i < 5; i++) rect(S, 6 + i * 7, 3, 4, 2, dim ? hx('#8fa0d0') : hx('#ffffff'));   // the brand strip
    // the lit product window: four shelves of six cans, shelf lights, price tags
    const wx = 4, wy = 8, ww = 36, wh = 44;
    for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
      const rim = x === wx || y === wy || x === wx + ww - 1 || y === wy + wh - 1;
      S.set(x, y, rim ? OUT : dim ? (dith(x, y, 0.5) ? hx('#2c3558') : hx('#354070')) : dith(x, y, (y - wy) / wh) ? hx('#8fc8ff') : hx('#bfe4ff'));
    }
    const CANS = [['#e84a5f', '#ff9fb0', '#a02040'], ['#ffd24a', '#fff0a0', '#b08a20'], ['#5ad0ff', '#c0f0ff', '#2a80b0'], ['#7ae06a', '#c8ffb0', '#3a9030'], ['#f4f4f8', '#ffffff', '#9a9ab0'], ['#ff8a3a', '#ffc090', '#b04a10']];
    for (let j = 0; j < 4; j++) {
      const sy = wy + 2 + j * 10;
      for (let i = 0; i < 6; i++) {
        const cx = wx + 2 + i * 6;
        if (dim && HS(i, j, 31) < 0.35) { rect(S, cx, sy + 4, 4, 2, hx('#20284c')); continue; }   // fallen cans
        const [c, hi, lo] = CANS[(i + j * 2) % CANS.length].map(hx);
        for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) S.set(cx + x, sy + y, x === 0 ? hi : x === 3 ? lo : c);
        S.set(cx + 1, sy, hx('#ffffff')); S.set(cx + 2, sy, hx('#ffffff'));
      }
      for (let x = wx + 1; x < wx + ww - 1; x++) { S.set(x, sy + 6, dim ? hx('#1d2548') : hx('#7aa9d0')); S.set(x, sy + 7, x % 6 === 4 ? (dim ? hx('#1d2548') : hx('#ffe08a')) : (dim ? hx('#20284c') : hx('#5a80b0'))); }
    }
    // the coin panel: a display, coin slot, lit buttons, bill slot; the dispenser hatch; the base
    rect(S, 4, 55, 36, 12, hx('#1a2a5c')); rect(S, 4, 55, 36, 1, hx('#2c4590'));
    rect(S, 6, 57, 10, 4, dim ? hx('#2c3558') : hx('#0a0f2a')); for (let i = 0; i < 3; i++) rect(S, 7 + i * 3, 58, 2, 2, dim ? hx('#3a4266') : hx('#7ad4ff'));   // the display digits
    rect(S, 19, 57, 1, 5, OUT); rect(S, 22, 57, 8, 1, OUT); rect(S, 22, 60, 8, 1, hx('#3a5090'));
    rect(S, 32, 57, 6, 8, dim ? hx('#2c3558') : hx('#7ad4ff')); rect(S, 33, 58, 2, 1, dim ? hx('#3a4266') : hx('#ffffff')); rect(S, 6, 63, 12, 2, hx('#3a5090'));
    rect(S, 6, 72, 32, 13, OUT); rect(S, 7, 73, 30, 11, hx('#101a3c')); rect(S, 7, 73, 30, 1, hx('#3a4a8a')); rect(S, 19, 78, 6, 1, hx('#3a4a8a'));
    rect(S, 1, 88, 42, 6, hx('#141f44')); rect(S, 1, 88, 42, 1, hx('#2c3558')); rect(S, 2, 93, 40, 1, OUT);
    if (state === 1) {   // cracks across the glass and a dent in the side
      line(S, 12, 11, 22, 30, OUT); line(S, 22, 30, 18, 46, OUT); line(S, 22, 30, 33, 40, OUT); line(S, 27, 10, 23, 20, hx('#5a7ab0'));
      for (let y = 36; y < 52; y++) { S.set(41, y, OUT); S.set(42, y, hx('#22407f')); }
    }
    if (state < 2) {
      if (!dim && !TH.day) { glow(L, OX + 22, OY + 30, 46, 52, '#9fd8ff', 34, 1.8); streak(L, OX + 4, OX + 40, OY + 95, OY + 107, '#c0e8ff', 50); streak(L, OX + 2, OX + 42, OY + 110, 145, '#c0e8ff', 70); }
      blit(L, S, OX, OY);
    } else {   // tipped over to the right, the glass dark, cans rolling out, a drink puddle
      const R = rot90cw(S); blit(L, R, OX, OY + 51);
      line(L, OX + 18, OY + 56, OX + 34, OY + 78, OUT); line(L, OX + 34, OY + 78, OX + 52, OY + 84, OUT);
      for (const [k, x, y] of [[0, 97, 90], [2, 93, 84], [1, 101, 86], [3, 89, 91], [4, 100, 80]]) { const [c, hi, lo] = CANS[k].map(hx); rect(L, OX + x, OY + y, 4, 3, c); L.set(OX + x, OY + y, hi); L.set(OX + x + 3, OY + y + 2, lo); }
      for (let x = OX + 84; x < OX + 104; x++) if (dith(x, OY + 94, 0.5)) L.set(x, OY + 94, hx('#3a4a8a'));
    }
    return L;
  }
  function paintLamp(state) {   // an 80×200 box: the halo around the 16×16 lamp at (32, 36), its light on the pillar, its streak on the ground
    const L = layer(80, 200);
    const ox = 32, oy = 36, P = (x, y, c) => L.set(ox + x, oy + y, c);
    if (state < 2 && !TH.day) {
      glow(L, ox + 8, oy + 8, 40, 34, '#ffd070', state ? 22 : 40, 1.7);
      streak(L, ox - 2, ox + 18, 170, 182, '#ffe0a0', state ? 26 : 48); streak(L, ox - 6, ox + 22, 185, 200, '#ffe0a0', state ? 40 : 70);
    }
    rect(L, ox + 1, oy, 14, 2, hx('#5a5070')); rect(L, ox, oy + 2, 16, 2, hx('#3a3050')); rect(L, ox + 7, oy - 2, 2, 2, hx('#3a3050'));   // roof + finial
    rect(L, ox, oy + 4, 1, 10, hx('#3a3050')); rect(L, ox + 15, oy + 4, 1, 10, hx('#3a3050')); rect(L, ox, oy + 14, 16, 2, hx('#3a3050')); rect(L, ox + 1, oy + 14, 14, 1, hx('#5a5070'));
    if (state < 2) {
      const a = state ? hx('#ffe8a8') : hx('#fff2c0'), b = state ? hx('#e8c060') : hx('#ffd870');
      for (let y = 4; y < 14; y++) for (let x = 1; x < 15; x++) P(x, y, dith(x, y, 0.5) ? a : b);
      rect(L, ox + 6, oy + 7, 4, 4, hx('#ffffff')); rect(L, ox + 7, oy + 6, 2, 1, hx('#ffffff'));
      P(7, 12, hx('#5a5070')); P(8, 12, hx('#5a5070'));
      if (state) { for (const [x, y] of [[3, 5], [4, 6], [5, 7], [6, 8], [6, 9], [7, 10], [8, 11], [10, 5], [11, 6]]) P(x, y, hx('#3a3050')); rect(L, ox + 12, oy + 4, 3, 3, hx('#2a2240')); }
    } else {
      rect(L, ox + 1, oy + 4, 14, 10, hx('#2a2240')); rect(L, ox + 7, oy + 5, 2, 3, hx('#5a5070')); rect(L, ox + 6, oy + 8, 4, 2, hx('#3a3050'));
      for (const [x, y] of [[1, 4], [2, 4], [1, 5], [1, 6], [14, 12], [13, 13], [14, 13], [14, 11], [8, 13]]) P(x, y, hx('#e0b850'));
    }
    return L;
  }
  function paintBin(state) {   // 23×47 (90 × 45 cm); broken: on its side with the garbage out
    const L = layer(70, 50); const S = layer(25, 47);
    for (let y = 4; y < 47; y++) for (let x = 1; x < 24; x++) {
      const edge = x === 1 || x === 23 || y === 46, band = y === 14 || y === 34;
      S.set(x, y, edge ? hx('#1a1d38') : band ? hx('#8a90b0') : y === 15 || y === 35 ? hx('#3f4666') : x <= 3 ? hx('#8a90b0') : x >= 20 ? hx('#3f4666') : x >= 17 ? hx('#4c5476') : hx('#5c6486'));
    }
    rect(S, 8, 8, 9, 5, hx('#1a1d38')); rect(S, 9, 7, 7, 1, hx('#1a1d38')); rect(S, 9, 13, 7, 1, hx('#2a2e52'));   // the throw-in hole
    rect(S, 7, 20, 11, 8, hx('#2a2e52')); rect(S, 8, 21, 9, 6, hx('#e8e8f0')); rect(S, 9, 23, 3, 2, hx('#2a2e52')); rect(S, 13, 23, 3, 2, hx('#2a2e52'));   // the label
    const lidY = state ? 1 : 2;
    rect(S, 0, lidY + 2, 25, 2, hx('#8a90b0')); rect(S, 1, lidY, 23, 2, hx('#a8acc8')); rect(S, 2, lidY - 1, 21, 1, hx('#b8bcd8')); rect(S, 10, lidY - 2, 5, 1, hx('#8a90b0'));   // the domed lid
    if (state) { rect(S, 17, 24, 5, 10, hx('#3f4666')); for (const [x, y] of [[18, 25], [20, 28], [19, 31], [21, 30]]) S.set(x, y, hx('#1a1d38')); rect(S, 0, lidY, 12, 2, hx('#a8acc8')); }
    if (state < 2) blit(L, S, 5, 3);
    else {
      const R = rot90cw(S); blit(L, R, 2, 25);
      rect(L, 50, 46, 5, 2, hx('#e8e8f0')); rect(L, 55, 44, 3, 3, hx('#e8e8f0')); rect(L, 59, 45, 5, 3, hx('#c9cce6')); L.set(59, 45, hx('#ffffff')); rect(L, 64, 47, 4, 2, hx('#ffd24a'));
      rect(L, 44, 42, 7, 3, hx('#7ad4ff')); rect(L, 51, 43, 2, 1, hx('#3a80b0'));                                         // a bottle
      rect(L, 32, 44, 16, 3, hx('#8a90b0')); rect(L, 33, 43, 14, 1, hx('#b8bcd8'));                                       // the lid, flat
    }
    return L;
  }
  function paintSign(state) {   // an A-frame 29×47 (90 × 55 cm) with a no-entry sign; broken: flat on the ground
    const L = layer(62, 47);
    if (state < 2) {
      const sh = (y) => (state && y < 20 ? 3 : state && y < 30 ? 1 : 0);   // damaged: the top leans to the right
      rect(L, 2, 30, 2, 17, hx('#5c6486')); rect(L, 33, 30, 2, 17, hx('#5c6486')); rect(L, 0, 45, 6, 2, hx('#3f4666')); rect(L, 31, 45, 6, 2, hx('#3f4666'));   // rear legs + feet
      for (let y = 0; y < 38; y++) for (let x = 4; x < 33; x++) {
        const edge = x === 4 || x === 32 || y === 0 || y === 37;
        L.set(x + sh(y), y, edge ? hx('#8a90b0') : y >= 2 && y <= 8 ? hx('#b8202c') : x === 5 ? hx('#ffffff') : hx('#f4ecd0'));
      }
      for (let k = 0; k < 4; k++) { rect(L, 8 + k * 6 + sh(3), 3, 4, 1, hx('#fff4e0')); rect(L, 8 + k * 6 + sh(5), 5, 4, 1, hx('#fff4e0')); rect(L, 9 + k * 6 + sh(4), 4, 1, 3, hx('#fff4e0')); rect(L, 11 + k * 6 + sh(6), 6, 1, 2, hx('#fff4e0')); }   // 立入禁止
      ring(L, 18 + sh(20), 20, 5.2, 7.5, hx('#d8202c')); rect(L, 13 + sh(20), 19, 11, 3, hx('#ffffff'));                 // no-entry
      for (let x = 8; x < 29; x++) { if (x % 4 !== 3) L.set(x + sh(30), 30, hx('#302a40')); if (x < 26 && x % 3 !== 2) L.set(x + sh(33), 33, hx('#302a40')); }
      rect(L, 6, 36, 2, 11, hx('#a8acc8')); rect(L, 29, 36, 2, 11, hx('#a8acc8'));                                        // front legs
      if (state) { line(L, 11, 3, 20, 30, hx('#302a40')); line(L, 20, 30, 15, 37, hx('#302a40')); line(L, 3, 30, 0, 46, hx('#5c6486')); }
    } else {
      rect(L, 4, 39, 47, 8, hx('#8a90b0')); rect(L, 5, 40, 45, 6, hx('#f4ecd0')); rect(L, 6, 40, 6, 6, hx('#b8202c'));
      ellipse(L, 26, 43, 6, 2.5, hx('#d8202c')); rect(L, 22, 43, 9, 1, hx('#ffffff'));
      for (let x = 36; x < 49; x += 2) L.set(x, 42, hx('#302a40'));
      line(L, 50, 38, 60, 32, hx('#5c6486')); rect(L, 1, 45, 4, 2, hx('#3f4666'));
    }
    return L;
  }
  function paintCone(state) {   // 20×36 (70 cm); knocked over: on its side, tip to the right
    const L = layer(40, 36); const S = layer(20, 36);
    rect(S, 0, 32, 20, 4, hx('#1a1a2a')); rect(S, 0, 32, 20, 1, hx('#3a3a50')); rect(S, 2, 31, 16, 1, hx('#2a2a3a'));
    for (let y = 0; y < 32; y++) {
      const hw = 1.5 + (y / 32) * 6, x0 = Math.round(10 - hw), x1 = Math.round(10 + hw), band = (y >= 8 && y <= 12) || (y >= 18 && y <= 21);
      for (let x = x0; x <= x1; x++) S.set(x, y, x === x0 || x === x1 ? hx('#6a2a10') : x === x0 + 1 ? (band ? hx('#ffffff') : hx('#ffb070')) : x >= x1 - 2 ? (band ? hx('#b8b8c8') : hx('#c04a10')) : band ? hx('#f4f4f8') : hx('#ff7a2a'));
    }
    S.set(10, 0, hx('#ffb070')); S.set(9, 1, hx('#ffb070'));
    if (state < 2) blit(L, S, 16, 0); else blit(L, rot90ccw(S), 4, 16);   // knocked over to the left, the base staying put
    return L;
  }
  function paintBike(state) {   // a mama-chari 91×52 (175 × 100 cm), red frame, front basket, rear rack; broken: fallen flat
    const L = layer(112, 60);
    const TYRE = hx('#0c0d1e'), RIM = hx('#9aa0c0'), SPOKE = hx('#5c6486'), HUB = hx('#c9cce6'), RED = hx('#e84a5f'), DRED = hx('#a02040'), HRED = hx('#ff8fa0'), DARK = hx('#302a40'), STEEL = hx('#b8bcd8');
    if (state < 2) {
      const S = layer(91, 52);
      const wheel = (cx, cy) => { ring(S, cx, cy, 15.2, 17.5, TYRE); ring(S, cx, cy, 13.2, 15.2, RIM); ring(S, cx, cy, 14.2, 15.2, hx('#c9cce6')); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 8; line(S, cx - Math.cos(a) * 13, cy - Math.sin(a) * 13, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, SPOKE); } ring(S, cx, cy, 0, 2.6, HUB); ring(S, cx, cy, 2.6, 3.6, DARK); };
      wheel(19, 34); wheel(72, 34);
      rect(S, 8, 11, 22, 3, DARK); rect(S, 9, 10, 20, 1, hx('#4a4a60')); rect(S, 28, 13, 2, 9, STEEL);                     // rear rack + stay
      line(S, 19, 34, 42, 38, DRED); line(S, 19, 33, 42, 37, RED); line(S, 19, 32, 42, 36, HRED);                          // chain stay
      line(S, 42, 37, 36, 8, DRED); line(S, 43, 37, 37, 8, RED);                                                           // seat tube
      line(S, 19, 32, 36, 9, RED); line(S, 20, 32, 37, 9, DRED);                                                           // seat stay
      for (let x = 37; x <= 62; x++) { const t = (x - 37) / 25, y = 10 + 22 * t * t; S.set(x, Math.round(y), RED); S.set(x, Math.round(y) + 1, DRED); S.set(x, Math.round(y) - 1, HRED); }   // the step-through down tube
      line(S, 62, 12, 68, 6, RED); line(S, 63, 12, 69, 6, DRED); line(S, 66, 8, 72, 34, RED); line(S, 67, 8, 73, 34, DRED);   // head tube + fork
      ellipse(S, 44, 38, 7, 5, DARK); ellipse(S, 44, 38, 5, 3.5, hx('#4a4a60')); rect(S, 47, 41, 5, 2, STEEL); rect(S, 39, 33, 4, 1, STEEL);   // chain guard, pedals
      rect(S, 30, 4, 12, 4, DARK); rect(S, 32, 3, 8, 1, hx('#4a4a60')); rect(S, 36, 8, 2, 3, STEEL);                        // saddle + post
      rect(S, 60, 2, 16, 2, STEEL); rect(S, 58, 2, 3, 3, DARK); rect(S, 75, 2, 3, 3, DARK); rect(S, 64, 0, 3, 2, hx('#ffd24a'));   // handlebar, grips, bell
      for (let y = 8; y < 22; y++) for (let x = 69; x < 91; x++) if (x === 69 || x === 90 || y === 8 || y === 21) S.set(x, y, RIM); else if ((x + y) & 1) S.set(x, y, SPOKE);   // the wire basket
      rect(S, 69, 8, 22, 1, STEEL); rect(S, 70, 22, 20, 1, DARK);
      rect(S, 62, 16, 8, 8, DARK); rect(S, 63, 17, 6, 6, hx('#c0a060')); rect(S, 64, 18, 4, 4, hx('#e8d090'));               // the headlamp
      if (state) { for (let y = 8; y < 22; y++) S.set(90, y, 0); line(S, 86, 6, 91, 20, RIM); line(S, 60, 2, 76, 5, STEEL); rect(S, 30, 5, 12, 3, DARK); }   // bent basket, twisted bar
      // leaning on the wall when damaged: rows shift by height
      for (let y = 0; y < 52; y++) for (let x = 0; x < 91; x++) { const c = S.c[y * 91 + x]; if (c) L.set(10 + x + (state ? Math.round((52 - y) * 0.22) : 0), 8 + y, c); }
    } else {   // fallen: the rear wheel flat on the ground, the front wheel still tilted, the frame lying low, the basket spilled
      ellipse(L, 26, 55, 17, 4, TYRE); ellipse(L, 26, 55, 15, 3, RIM); ellipse(L, 26, 55, 13, 2, hx('#1a1d38')); rect(L, 25, 54, 3, 2, HUB);
      ellipse(L, 82, 47, 12, 12, TYRE, 0.72); ellipse(L, 82, 47, 10.5, 10.5, RIM, 0.8); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 6; line(L, 82 - Math.cos(a) * 9, 47 - Math.sin(a) * 9, 82 + Math.cos(a) * 9, 47 + Math.sin(a) * 9, SPOKE); } rect(L, 81, 46, 3, 3, HUB);
      line(L, 26, 52, 70, 50, RED); line(L, 26, 53, 70, 51, DRED); line(L, 36, 52, 48, 40, RED); line(L, 48, 40, 68, 46, RED); line(L, 30, 50, 48, 40, DRED);
      rect(L, 44, 36, 12, 3, DARK); rect(L, 12, 44, 22, 3, DARK); rect(L, 86, 30, 2, 12, STEEL); rect(L, 84, 28, 16, 2, STEEL);   // saddle, rack, handlebar
      for (let y = 50; y < 58; y++) for (let x = 92; x < 112; x++) if (x === 92 || x === 111 || y === 50 || y === 57) L.set(x, y, RIM); else if ((x + y) & 1) L.set(x, y, SPOKE);
      rect(L, 100, 44, 8, 5, hx('#e8d090')); rect(L, 104, 41, 4, 3, hx('#ffd24a'));   // the headlamp and bell on the ground
    }
    return L;
  }
  const PAINTERS = { vend: paintVend, lamp: paintLamp, bin: paintBin, sign: paintSign, cone: paintCone, bike: paintBike };
  const propCache = new Map();
  function propImage(kind, state) {   // { w, h, c } for the prop kind in that state, painted once
    const key = kind + ':' + state + (TH.day ? ':day' : '');
    if (!propCache.has(key)) propCache.set(key, PAINTERS[kind](state));
    return propCache.get(key);
  }


  root.STAGE = { W, H, VW, GROUND, FAR_W, FRONT_W, MID_W, MID_RATE, PXM, paint, setTheme, THEMES, THEME_IDS, theme: () => TH, half, anim, breakables, propImage, name: '東京鬼高校・校門前', en: 'TOKYO ONI HIGH — SCHOOL GATE' };
})(typeof window !== 'undefined' ? window : globalThis);
