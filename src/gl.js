// gl.js — the three.js renderer (WebGL), written the way three.js examples are: a Scene, a PerspectiveCamera,
// Meshes with textures, an EffectComposer chain. src/game.js builds one draw list per frame (screen pixels,
// y down, camera already applied) and either executes it on the 2D canvas or hands it here:
//   { k:'img', img, x, y, a, fx?, glow?, refl? }  a canvas at its top-left; fx = effect-only canvas (bloom source)
//   { k:'skew', img, m:[a,b,c,d,e,f], a }         a canvas through a 2D affine matrix (the ground shadow)
//   { k:'blob', x, y, w }                          the soft blob under the feet
//   { k:'rect', x, y, w, h, col }                  particles
//   { k:'ring', x, y, r, col, a }                  hit rings
// Here the items become textured planes: the fighters' plane (z = 0) maps 1:1 onto the 480×270 render target so
// the pixel art stays crisp, the far stage layer sits at real depth so the camera itself produces the parallax,
// the KO dolly moves the camera, the fighters get a faint reflection on the wet road, and a second pass blooms
// only the energy effects, afterimages, the moon and the lamps (the three.js "selective bloom" recipe, done with
// camera layers: layer 1 = things that glow).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GLOW = 1;

export function createGL(o) {
  const { canvas, VW, VH, G, farRate, front, frontRate } = o;
  let { far, near, mid, midRate } = o;
  const RS = o.RS || 1;   // render target scale: world units stay VW × VH, the target has RS× the pixels
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(VW * RS, VH * RS, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  // a camera whose z = 0 plane is exactly VW × VH world units: world x = screen x, world y = -screen y
  const FOV = 30;
  const D = (VH / 2) / Math.tan((FOV / 2) * Math.PI / 180);
  const camera = new THREE.PerspectiveCamera(FOV, VW / VH, 4, 40000);
  camera.layers.enable(GLOW);

  // ---------------------------------------------------------------- textures
  const texOf = new WeakMap();
  function tex(cv, linear) {
    let t = texOf.get(cv);
    if (!t) {
      t = new THREE.CanvasTexture(cv);
      t.magFilter = t.minFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      texOf.set(cv, t);
    }
    return t;
  }
  // bright pixels of a painted layer (moon, lamps, lit windows) as a glow source
  function emissive(cv) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d'); g.drawImage(cv, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height), p = id.data;
    // only the sky's lights: the moon, lamp bulbs and lit windows (nothing on the road, no blossoms)
    // everything that does not glow stays in the bloom pass as BLACK with its own alpha: an occluder, so the glow of a
    // lit window behind a wall (or behind a fighter) cannot bleed through what covers it
    for (let i = 0; i < p.length; i += 4) {
      const y = (i / 4 / c.width) | 0;
      const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
      const lamp = p[i] > 235 && p[i + 1] > 200 && p[i + 2] < 160;
      if (y > 205 || (l < 238 && !lamp) || (p[i] - p[i + 1] > 40 && p[i + 2] > 150)) { p[i] = 0; p[i + 1] = 0; p[i + 2] = 0; }
    }
    g.putImageData(id, 0, 0);
    return c;
  }
  const quad = new THREE.PlaneGeometry(1, 1);
  const white = document.createElement('canvas'); white.width = white.height = 2;
  { const g = white.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); }
  const blobCv = document.createElement('canvas'); blobCv.width = 32; blobCv.height = 8;
  { const g = blobCv.getContext('2d'); const grd = g.createRadialGradient(16, 4, 1, 16, 4, 16); grd.addColorStop(0, 'rgba(4,6,20,1)'); grd.addColorStop(0.55, 'rgba(4,6,20,0.7)'); grd.addColorStop(1, 'rgba(4,6,20,0)'); g.fillStyle = grd; g.save(); g.scale(1, 0.25); g.beginPath(); g.arc(16, 16, 16, 0, Math.PI * 2); g.fill(); g.restore(); }
  const fadeCv = document.createElement('canvas'); fadeCv.width = 2; fadeCv.height = 32;
  { const g = fadeCv.getContext('2d'); const grd = g.createLinearGradient(0, 0, 0, 32); grd.addColorStop(0, '#000'); grd.addColorStop(0.35, '#333'); grd.addColorStop(1, '#fff'); g.fillStyle = grd; g.fillRect(0, 0, 2, 32); }
  const fadeTex = new THREE.CanvasTexture(fadeCv); fadeTex.magFilter = fadeTex.minFilter = THREE.LinearFilter;

  // ---------------------------------------------------------------- stage layers
  function layerMesh(cv, linear) {
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex(cv, linear), transparent: true, depthTest: false, depthWrite: false }));
    const glow = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: tex(emissive(cv), linear), transparent: true, depthTest: false, depthWrite: false }));
    glow.layers.set(GLOW);
    m.add(glow);
    scene.add(m);
    return m;
  }
  const nearMesh = layerMesh(near, false), farMesh = layerMesh(far, true);
  const s = 1 / farRate, d = D * (s - 1);
  farMesh.renderOrder = -2; nearMesh.renderOrder = -1;
  farMesh.scale.set(far.width * s, VH * s, 1); farMesh.position.z = -d;
  nearMesh.scale.set(near.width, near.height, 1);
  // the mid layer: between the skyline and the street at its own depth (parallax midRate)
  const sm = 1 / (midRate || 0.6), dm = D * (sm - 1);
  const midMesh = mid ? layerMesh(mid, false) : null;
  if (midMesh) { midMesh.renderOrder = -1.5; midMesh.scale.set(mid.width * sm, VH * sm, 1); midMesh.position.z = -dm; }
  // a stage change swaps the pictures on the planes (the textures of a mesh and of its glow child)
  function retex(m, cv, linear) { m.material.map = tex(cv, linear); m.material.needsUpdate = true; const g = m.children[0]; if (g) { g.material.map = tex(emissive(cv), linear); g.material.needsUpdate = true; } }
  function setLayers(L) {
    if (L.far) { far = L.far; retex(farMesh, far, true); farMesh.scale.set(far.width * s, VH * s, 1); }
    if (L.near) { near = L.near; retex(nearMesh, near, false); nearMesh.scale.set(near.width, near.height, 1); }
    if (L.mid && midMesh) { mid = L.mid; retex(midMesh, mid, false); midMesh.scale.set(mid.width * sm, VH * sm, 1); }
    if (L.front && frontMesh) { retex(frontMesh, L.front, false); }
  }
  // the front layer sits nearer than the fight plane (z > 0, scaled down to look the same size) so it scrolls faster and
  // draws over the fighters
  const sf = front ? 1 / (frontRate || 1.25) : 1, df = D * (sf - 1);
  const frontMesh = front ? layerMesh(front, false) : null;
  if (frontMesh) { frontMesh.renderOrder = 100000; frontMesh.scale.set(front.width * sf, VH * sf, 1); frontMesh.position.z = -df; }

  // ---------------------------------------------------------------- pools
  class Pool {
    constructor(make) { this.make = make; this.items = []; this.n = 0; }
    get() { let it = this.items[this.n]; if (!it) { it = this.make(); this.items.push(it); } this.n++; it.visible = true; return it; }
    reset() { for (let i = this.n; i < this.items.length; i++) this.items[i].visible = false; this.n = 0; }
  }
  const mat = (extra) => new THREE.MeshBasicMaterial(Object.assign({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }, extra || {}));
  const imgPool = new Pool(() => { const m = new THREE.Mesh(quad, mat()); scene.add(m); return m; });
  const fxPool = new Pool(() => { const m = new THREE.Mesh(quad, mat()); m.layers.set(GLOW); scene.add(m); return m; });
  const reflPool = new Pool(() => { const m = new THREE.Mesh(quad, mat({ alphaMap: fadeTex, opacity: 0.28, color: new THREE.Color(0.55, 0.68, 0.95) })); scene.add(m); return m; });
  const skewPool = new Pool(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    const m = new THREE.Mesh(g, mat()); scene.add(m); return m;
  });
  const blobPool = new Pool(() => { const m = new THREE.Mesh(quad, mat({ map: tex(blobCv, true), opacity: 0.8 })); scene.add(m); return m; });
  const rectPool = new Pool(() => { const m = new THREE.Mesh(quad, mat({ map: tex(white) })); scene.add(m); return m; });
  // a sprite's black silhouette for the bloom pass: it hides the glow of whatever is behind the sprite
  const occlOf = new WeakMap();
  function occl(cv) {
    let t = occlOf.get(cv);
    if (!t) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); t = tex(c); occlOf.set(cv, t); }
    return t;
  }
  const occlPool = new Pool(() => { const m = new THREE.Mesh(quad, mat()); m.layers.set(GLOW); scene.add(m); return m; });
  const ring = new THREE.RingGeometry(0.86, 1, 28);
  const ringPool = new Pool(() => { const m = new THREE.Mesh(ring, mat()); scene.add(m); return m; });
  const pools = [imgPool, fxPool, reflPool, skewPool, blobPool, rectPool, ringPool, occlPool];
  const colOf = new Map();
  const color = (c) => { let k = colOf.get(c); if (!k) { k = new THREE.Color(c); colOf.set(c, k); } return k; };

  // ---------------------------------------------------------------- post: base + bloom(glow layer)
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(VW, VH), 0.7, 0.45, 0.0);
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderPass); bloomComposer.addPass(bloomPass);
  const mixPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }',
  }), 'baseTexture');
  mixPass.needsSwap = true;
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderPass); finalComposer.addPass(mixPass); finalComposer.addPass(new OutputPass());

  // ---------------------------------------------------------------- per frame
  function place(m, x, y, w, h, order) { m.position.set(x + w / 2, -(y + h / 2), 0); m.scale.set(w, h, 1); m.renderOrder = order; }
  function render(state) {
    const { camX, list, shake, zoom } = state;
    const cx = VW / 2 + shake[0], cy = -VH / 2 - shake[1];
    camera.position.set(cx, cy, D / (zoom || 1));
    camera.lookAt(cx, cy, 0);
    nearMesh.position.set(-camX + near.width / 2, -near.height / 2, 0);
    farMesh.position.set(VW / 2 - camX - VW * s / 2 + far.width * s / 2, -VH / 2, -d);
    if (midMesh) midMesh.position.set(VW / 2 - camX - VW * sm / 2 + mid.width * sm / 2, -VH / 2, -dm);
    if (frontMesh) frontMesh.position.set(VW / 2 - camX - VW * sf / 2 + front.width * sf / 2, -VH / 2, -df);
    for (const p of pools) p.reset();
    let order = 0, depthN = 0, mainN = 0;
    const farList = state.farList || [], midList = state.midList || [];
    for (const it of farList.concat(midList, list)) {   // far items sit between the far and mid planes, mid items between mid and near
      order = it.depth === 'far' ? -1.9 + 1e-4 * (++depthN) : it.depth === 'mid' ? -1.4 + 1e-4 * (++depthN) : ++mainN;
      if (it.k === 'img') {
        const t = tex(it.img), w = it.w || it.img.width, h = it.h || it.img.height;   // world size (164-px sheets draw at 0.5)
        const m = imgPool.get(); m.material.map = t; m.material.opacity = it.a; place(m, it.x, it.y, w, h, order);
        m.layers.set(0); if (it.glow) m.layers.enable(GLOW);
        else { const o = occlPool.get(); o.material.map = occl(it.img); o.material.opacity = it.a; place(o, it.x, it.y, w, h, order - 0.5); }   // hides glow behind the sprite in the bloom pass
        if (it.fx) { const f = fxPool.get(); f.material.map = tex(it.fx); f.material.opacity = 1; place(f, it.x, it.y, w, h, order); }
        if (it.refl) { const r = reflPool.get(); r.material.map = t; r.position.set(it.x + w / 2, -(2 * G - it.y - h / 2), 0); r.scale.set(w, -h, 1); r.renderOrder = -0.5; }
      } else if (it.k === 'skew') {
        const [a, b, c, dd, e, f] = it.m, w = it.img.width, h = it.img.height;
        const m = skewPool.get(); m.material.map = tex(it.img); m.material.opacity = it.a; m.renderOrder = order;
        const P = m.geometry.attributes.position.array;
        const pts = [[0, 0], [w, 0], [w, h], [0, h]];
        for (let i = 0; i < 4; i++) { const [x, y] = pts[i]; P[i * 3] = a * x + c * y + e; P[i * 3 + 1] = -(b * x + dd * y + f); P[i * 3 + 2] = 0; }
        m.geometry.attributes.position.needsUpdate = true;
      } else if (it.k === 'blob') {
        const m = blobPool.get(); place(m, it.x - it.w, it.y, it.w * 2, 5, order);
      } else if (it.k === 'rect') {
        const m = rectPool.get(); m.material.color.copy(color(it.col)); m.material.opacity = it.a === undefined ? 1 : it.a; place(m, it.x, it.y, it.w, it.h, order);
      } else if (it.k === 'ring') {
        const m = ringPool.get(); m.material.color.copy(color(it.col)); m.material.opacity = it.a; m.position.set(it.x, -it.y, 0); m.scale.set(it.r, it.r, 1); m.renderOrder = order;
      }
    }
    camera.layers.set(GLOW); bloomComposer.render();
    camera.layers.set(0); finalComposer.render();
  }
  return { render, renderer, scene, camera, THREE, setLayers };
}
