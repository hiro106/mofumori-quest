import * as THREE from './vendor/three.module.js';

// Original storm guardian. Shapes are baked by articulated part, keeping the
// silhouette rich without adding one draw call for every scale or claw.
const clamp = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
class Sculpt {
  constructor(low = true) {
    this.group = new THREE.Group(); this.parts = []; this.geometries = new Set();
    this.solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .19 });
    this.glow = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#24475a', emissiveIntensity: .8, roughness: .4 });
    this.sources = { ball: new THREE.SphereGeometry(1, low ? 10 : 16, low ? 7 : 10), rock: new THREE.IcosahedronGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1), cone: new THREE.ConeGeometry(1, 1, 8), cylinder: new THREE.CylinderGeometry(1, 1, 1, 16), ring: new THREE.TorusGeometry(1, .035, 5, 48) };
  }
  part(name, at = [0, 0, 0], parent = this.group) {
    const p = new THREE.Group(); p.name = name; p.position.fromArray(at); parent.add(p);
    p.userData.batches = [{ p: [], n: [], c: [] }, { p: [], n: [], c: [] }]; this.parts.push(p); return p;
  }
  shape(part, type, at, scale, color, rotation = [0, 0, 0], glow = false) {
    const source = typeof type === 'string' ? this.sources[type] : type;
    const g = source.index ? source.toNonIndexed() : source;
    const quaternion = rotation.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), quaternion, new THREE.Vector3(...scale));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix), v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(color);
    const batch = part.userData.batches[glow ? 1 : 0];
    for (let i = 0; i < g.attributes.position.count; i++) {
      v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(matrix); n.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      batch.p.push(v.x, v.y, v.z); batch.n.push(n.x, n.y, n.z); batch.c.push(c.r, c.g, c.b);
    }
    if (g !== source) g.dispose(); if (typeof type !== 'string') source.dispose();
  }
  rod(part, a, b, radius, color, glow = false) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    this.shape(part, 'cylinder', start.add(end).multiplyScalar(.5).toArray(), [radius, delta.length(), radius], color, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()), glow);
  }
  finish() {
    for (const p of this.parts) {
      p.userData.batches.forEach((b, i) => {
        if (!b.p.length) return;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.computeBoundingSphere();
        this.geometries.add(g); const mesh = new THREE.Mesh(g, i ? this.glow : this.solid); mesh.castShadow = !i; mesh.receiveShadow = !i; p.add(mesh);
      });
      delete p.userData.batches;
    }
    Object.values(this.sources).forEach(g => g.dispose()); this.sources = null;
  }
  dispose() { this.geometries.forEach(g => g.dispose()); this.geometries.clear(); this.solid.dispose(); this.glow.dispose(); }
}
function membrane(points) {
  const p = []; for (let i = 1; i < points.length - 1; i++) p.push(...points[0], ...points[i], ...points[i + 1], ...points[0], ...points[i + 1], ...points[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}

export function buildBoss({ scale = 1, detail = 'low' } = {}) {
  const s = new Sculpt(detail === 'low'), group = s.group; group.name = 'boss-storm-volga'; group.userData.bossId = 'storm';
  group.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
  const body = s.part('storm-body'), head = s.part('crowned-head', [0, 2.69, .58], body), jaw = s.part('hinged-jaw', [0, -.14, .22], head);
  const C = { hide: '#292c51', armor: '#444567', dark: '#171c37', cyan: '#59dce9', bone: '#b3bccb', amber: '#ffb24e' };
  s.shape(body, 'ball', [0, 1.72, -.05], [.99, 1.1, .78], C.hide);
  s.shape(body, 'rock', [0, 2.23, .31], [1.08, .73, .67], C.armor);
  s.shape(body, 'ball', [0, 1.48, .57], [.72, .88, .24], C.dark);
  for (const side of [-1, 1]) {
    s.shape(body, 'rock', [side * 1.06, 2.16, 0], [.48, .51, .58], C.armor, [0, 0, side * -.2]);
    s.shape(body, 'cone', [side * 1.33, 2.48, -.04], [.17, .49, .2], C.bone, [0, 0, -side * .7]);
    for (let i = 0; i < 3; i++) s.shape(body, 'rock', [side * .49, 1.15 + i * .35, .75], [.32, .16, .15], C.armor, [0, 0, side * .22]);
  }
  const core = s.part('amber-thunderheart', [0, 1.94, .79], body);
  s.shape(core, 'rock', [0, 0, 0], [.31, .38, .16], C.amber, [0, 0, Math.PI / 4], true);
  s.shape(body, 'ring', [0, 1.94, .79], [.46, .48, .5], C.bone);
  s.shape(head, 'rock', [0, .15, .03], [.63, .55, .5], C.hide);
  s.shape(head, 'rock', [0, -.04, .48], [.57, .24, .41], C.armor);
  s.shape(head, 'box', [0, -.21, .55], [.81, .14, .46], C.dark);
  for (const side of [-1, 1]) {
    s.shape(head, 'rock', [side * .4, .14, .43], [.24, .13, .13], C.dark, [0, 0, side * .25]);
    s.shape(head, 'ball', [side * .4, .13, .54], [.145, .073, .04], C.cyan, [0, 0, side * .25], true);
    s.shape(head, 'box', [side * .4, .13, .58], [.022, .115, .019], C.dark);
    s.shape(head, 'rock', [side * .43, .29, .47], [.3, .11, .12], C.armor, [0, 0, side * -.23]);
    s.shape(head, 'cone', [side * .39, .64, -.11], [.15, .71, .17], C.cyan, [-.35, 0, -side * .4], true);
    s.shape(head, 'cone', [side * .58, .38, -.23], [.12, .42, .13], C.bone, [-.65, 0, -side * .9]);
    s.shape(head, 'ball', [side * .24, -.025, .83], [.07, .04, .025], C.dark);
    for (let i = 0; i < 2; i++) s.shape(head, 'cone', [side * (.24 + .15 * i), -.22, .69], [.06, .18, .06], C.bone, [Math.PI, 0, 0]);
  }
  s.shape(jaw, 'rock', [0, -.11, .28], [.53, .17, .43], C.hide);
  for (const side of [-1, 1]) s.shape(jaw, 'cone', [side * .37, .04, .44], [.055, .15, .055], C.bone);
  const legs = [], wings = [];
  for (const side of [-1, 1]) {
    const leg = s.part(`heavy-leg-${side}`, [side * .63, .9, .03], body); legs.push(leg);
    s.shape(leg, 'ball', [0, -.18, 0], [.42, .66, .46], C.hide);
    s.shape(leg, 'rock', [0, -.69, .23], [.47, .2, .6], C.armor);
    for (let i = -1; i <= 1; i++) s.shape(leg, 'cone', [i * .22, -.73, .73], [.085, .3, .09], C.bone, [Math.PI / 2, 0, 0]);
    const arm = s.part(`clawed-arm-${side}`, [side * 1.08, 2.1, .1], body);
    s.shape(arm, 'ball', [side * .09, -.41, .15], [.29, .59, .29], C.hide, [0, 0, side * .2]);
    s.shape(arm, 'rock', [side * .12, -.77, .23], [.34, .25, .33], C.armor);
    for (let i = -1; i <= 1; i++) s.shape(arm, 'cone', [side * .12 + i * .17, -.98, .35], [.075, .32, .085], C.bone, [.5, 0, 0]);
    const wing = s.part(`storm-wing-${side}`, [side * .81, 2.38, -.45], body); wings.push(wing);
    const points = [[0, 0, 0], [side * .95, .59, -.13], [side * 1.85, .45, -.2], [side * 1.52, -.04, -.35], [side * 1.68, -.67, -.26], [side * .98, -.42, -.11], [side * .48, -.91, .02]];
    s.shape(wing, membrane(points), [0, 0, 0], [1, 1, 1], '#35345a');
    for (const idx of [1, 2, 4, 6]) s.rod(wing, points[0], points[idx], idx === 1 ? .095 : .045, C.armor);
    s.rod(wing, points[1], points[2], .06, C.cyan, true);
    s.shape(wing, 'cone', points[2], [.085, .32, .085], C.cyan, [0, 0, -side * 1.2], true);
  }
  const tail = s.part('barbed-tail', [0, 1.15, -.66], body);
  s.rod(tail, [0, 0, 0], [.25, -.35, -.94], .24, C.hide); s.rod(tail, [.25, -.35, -.94], [.57, -.38, -1.8], .14, C.hide);
  s.shape(tail, 'rock', [.59, -.37, -1.86], [.29, .24, .43], C.armor);
  s.shape(tail, 'cone', [.6, -.15, -1.9], [.13, .42, .14], C.cyan, [0, 0, -.25], true);
  s.finish(); let disposed = false;
  return { group, animate(time, { attack = 0, mood = 'idle', phase = 1, defeated = false } = {}) {
    if (disposed) return; const t = Number.isFinite(time) ? time : 0, a = clamp(attack), angry = phase >= 2 || mood === 'angry', d = defeated ? 1 : 0;
    body.position.y = d ? -.32 : Math.sin(t * 1.7) * .045; body.rotation.x = d ? .25 : -a * .13;
    body.scale.set(1 + Math.sin(t * 1.7) * .014, 1, 1 + Math.sin(t * 1.7) * .02);
    head.rotation.x = d ? .35 : Math.sin(t * 1.3) * .035 - a * .19; head.rotation.y = d ? -.08 : Math.sin(t * .6) * .045;
    jaw.rotation.x = d ? .06 : a * .52 + (angry ? .1 : 0);
    wings.forEach((w, i) => { const side = i ? 1 : -1; w.rotation.y = side * (d ? .9 : Math.sin(t * (angry ? 3.2 : 1.4)) * .14 + a * .4); w.rotation.z = side * (d ? -.35 : Math.sin(t * 1.4) * .045); });
    legs.forEach(l => { l.rotation.x = d ? -.26 : 0; }); tail.rotation.y = Math.sin(t * 1.1) * (d ? .02 : .16);
    core.scale.setScalar(d ? .78 : 1 + Math.sin(t * (angry ? 7 : 2.4)) * .075 + a * .18);
    s.glow.emissiveIntensity = d ? .08 : (angry ? 1.3 : .8) + a * 1.2;
  }, dispose() { if (!disposed) { disposed = true; s.dispose(); } } };
}

export function buildStormArena() {
  const s = new Sculpt(true), group = s.group; group.name = 'storm-sanctum-arena';
  const floor = s.part('sanctum-platform'), ruins = s.part('ruined-storm-crown'), energy = s.part('storm-runes');
  s.shape(floor, 'cylinder', [0, -.24, 0], [9.3, .46, 9.3], '#282a40');
  s.shape(floor, 'cylinder', [0, -.035, 0], [4.5, .06, 4.5], '#45475e');
  for (const r of [4.5, 6.1, 8.9]) s.shape(energy, 'ring', [0, .01, 0], [r, r, 1], '#53c6d8', [Math.PI / 2, 0, 0], true);
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2, x = Math.sin(angle) * 8, z = Math.cos(angle) * 8;
    s.shape(ruins, 'rock', [x, .23, z], [.8, .32, .7], '#36394e', [0, angle, 0]);
    if (z > 4) continue;
    const height = 1.7 + (i % 3) * .45;
    s.shape(ruins, 'box', [x, height / 2, z], [.57, height, .61], '#50516b', [0, angle, (i % 2 ? 1 : -1) * .045]);
    s.shape(ruins, 'rock', [x, height, z], [.42, .23, .44], '#35394f');
    s.shape(energy, 'box', [x, height * .6, z + .32], [.08, height * .51, .022], '#68d4dc', [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    s.shape(ruins, 'box', [side * 3.2, 2.2, -7.5], [.8, 4.4, .9], '#424560', [0, 0, side * .09]);
    s.rod(ruins, [side * 3.2, 4.1, -7.5], [side * .85, 5, -7.5], .4, '#424560');
    s.rod(energy, [side * 2.9, 4.22, -7.01], [side * 1.03, 4.94, -7.01], .055, '#70d9ed', true);
    s.shape(ruins, 'rock', [side * 2.2, .18, -6.6], [.7, .27, .4], '#555670', [0, side, .3]);
  }
  // A broken central keystone leaves a jagged gap in the storm arch.
  s.shape(energy, 'rock', [0, 4.85, -7.5], [.29, .39, .2], '#ffbd60', [0, 0, Math.PI / 4], true);
  s.finish(); let disposed = false;
  return { group, animate(time) { if (!disposed) s.glow.emissiveIntensity = .52 + Math.sin((Number.isFinite(time) ? time : 0) * 1.8) * .16; }, dispose() { if (!disposed) { disposed = true; s.dispose(); } } };
}
