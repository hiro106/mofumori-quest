import * as THREE from './vendor/three.module.js';

// Original clay-toy characters. Geometry is merged inside each articulated part:
// one opaque material and one small emissive material per independent model.
const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
const PALETTE = { eye: '#243344', white: '#fffaf0', pink: '#eea29c', mouth: '#72505b', gold: '#edbc66' };
const IDS = ['sprig', 'puff', 'fawn', 'moss', 'otter', 'fin', 'shell', 'manta', 'ember', 'moth', 'ram', 'drake', 'star'];

function leafGeometry() {
  const edge = [[0, 0, 0], [-.3, .22, 0], [-.45, .52, 0], [-.3, .78, 0], [0, 1, 0], [.3, .78, 0], [.45, .52, 0], [.3, .22, 0]];
  const points = [];
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    points.push(...a, 0, .48, .14, ...b, ...b, 0, .48, -.09, ...a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}

function polygonGeometry(outline, depth = .04, bevel = .025) {
  const shape = new THREE.Shape();
  outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function starGeometry() {
  const outline = [];
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .44 : 1; outline.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return polygonGeometry(outline, .2, .06);
}

class Model {
  constructor(id, options = {}) {
    this.id = id; this.low = options.detail === 'low'; this.options = options;
    this.group = new THREE.Group(); this.group.name = `creature-${id}`;
    this.pose = new THREE.Group(); this.pose.name = 'pose'; this.group.add(this.pose);
    this.parts = []; this.motions = []; this.blinks = []; this.geometry = new Set();
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .67, metalness: .025 });
    this.glowMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0, emissive: '#ffe0a1', emissiveIntensity: .28 });
    const segments = this.low ? 10 : 14;
    this.primitives = {
      sphere: new THREE.SphereGeometry(1, segments, this.low ? 6 : 9),
      dome: new THREE.SphereGeometry(1, segments, 7, 0, TAU, 0, Math.PI / 2),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, segments, 1),
      cone: new THREE.ConeGeometry(1, 1, segments, 1),
      rock: new THREE.IcosahedronGeometry(1, 1),
      box: new THREE.BoxGeometry(1, 1, 1),
      leaf: leafGeometry(), star: starGeometry(),
      ring: new THREE.TorusGeometry(1, .13, 6, this.low ? 14 : 20),
    };
    this.base = this.part('body');
  }
  part(name, pivot = [0, 0, 0], parent = this.base || this.pose) {
    const node = new THREE.Group(); node.name = name; node.position.fromArray(pivot); parent.add(node);
    node.userData.batch = { solid: { p: [], n: [], c: [] }, glow: { p: [], n: [], c: [] } };
    this.parts.push(node); return node;
  }
  add(part, type, at, scale, color, rotation = [0, 0, 0], glow = false) {
    const source = typeof type === 'string' ? this.primitives[type] : type;
    const geom = source.index ? source.toNonIndexed() : source;
    const q = rotation?.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...at), q, new THREE.Vector3(...scale));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const c = new THREE.Color(color), p = new THREE.Vector3(), n = new THREE.Vector3();
    const batch = part.userData.batch[glow ? 'glow' : 'solid'];
    const position = geom.attributes.position, normal = geom.attributes.normal;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix);
      n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      batch.p.push(p.x, p.y, p.z); batch.n.push(n.x, n.y, n.z); batch.c.push(c.r, c.g, c.b);
    }
    if (geom !== source) geom.dispose();
    if (typeof type !== 'string') source.dispose();
  }
  ball(part, at, scale, color, rotation, glow) { this.add(part, 'sphere', at, scale, color, rotation, glow); }
  leaf(part, at, scale, color, rotation, glow) { this.add(part, 'leaf', at, scale, color, rotation, glow); }
  rod(part, start, end, radius, color, glow = false) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), d = b.clone().sub(a), length = d.length();
    if (length < 1e-6) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    this.add(part, 'cylinder', a.add(b).multiplyScalar(.5).toArray(), [radius, length, radius], color, q, glow);
  }
  curve(part, points, radius, color, glow = false) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const geom = new THREE.TubeGeometry(path, this.low ? 10 : 16, radius, 5, false);
    this.add(part, geom, [0, 0, 0], [1, 1, 1], color, [0, 0, 0], glow);
  }
  eyes(parent, at, spread, size = .085, iris = '#3e5f66') {
    const eyes = this.part('eyes', at, parent);
    for (const side of [-1, 1]) {
      this.ball(eyes, [side * spread, 0, 0], [size * .8, size, size * .46], PALETTE.eye);
      this.ball(eyes, [side * spread, -size * .26, size * .34], [size * .51, size * .5, size * .13], iris);
      this.ball(eyes, [side * spread - size * .23, size * .33, size * .43], [size * .23, size * .25, size * .13], PALETTE.white);
      this.ball(eyes, [side * spread + size * .22, -size * .35, size * .43], [size * .1, size * .11, size * .09], '#cee9d9');
    }
    this.blinks.push(eyes); return eyes;
  }
  face(parent, { y = 0, z = .3, spread = .15, size = .09, blush = .25, nose = true, smile = true, iris } = {}) {
    this.eyes(parent, [0, y, z], spread, size, iris);
    if (blush) for (const s of [-1, 1]) this.ball(parent, [s * blush, y - size * .7, z - .015], [size * .57, size * .25, .014], PALETTE.pink);
    if (nose) this.ball(parent, [0, y - size * .55, z + .025], [size * .3, size * .22, size * .23], PALETTE.mouth);
    if (smile) this.curve(parent, [[-.057, y - .095, z + .016], [0, y - .12, z + .023], [.057, y - .095, z + .016]], .008, PALETTE.mouth);
  }
  sway(part, axis = 'z', amount = .08, speed = 1.6, phase = 0) { this.motions.push((t, m, a, mood) => { part.rotation[axis] += Math.sin(t * speed + phase) * amount * (1 + m * .35); }); }
  legs({ spots, color, footColor = color, height = .28, width = .095, toe = .035, parent = this.base }) {
    return spots.map(([x, y, z], i) => {
      const leg = this.part(`leg-${i}`, [x, y, z], parent);
      this.ball(leg, [0, -height * .43, 0], [width, height * .64, width], color);
      this.ball(leg, [0, -height + width * .58, .035], [width * 1.2, width * .65, width * 1.65], footColor);
      if (toe) for (const s of [-1, 0, 1]) this.ball(leg, [s * width * .58, -height + width * .52, width * 1.3], [toe, toe * .75, toe * .9], footColor);
      this.motions.push((t, moving) => { leg.rotation.x += Math.sin(t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * .52 * moving; });
      return leg;
    });
  }
  arms({ spots, color, handColor = color, length = .28, width = .075, parent = this.base, angle = .12 }) {
    return spots.map(([x, y, z], i) => {
      const arm = this.part(`arm-${i}`, [x, y, z], parent), s = x < 0 ? -1 : 1;
      arm.rotation.z = s * angle;
      this.ball(arm, [0, -length * .43, 0], [width, length * .6, width], color);
      this.ball(arm, [0, -length * .84, .025], [width * 1.16, width * 1.08, width * 1.08], handColor);
      this.motions.push((t, moving, attack, mood) => { arm.rotation.x -= Math.sin(t * 9 + i * Math.PI) * .42 * moving + attack * .95; if (mood === 'happy' || mood === 'celebrate') arm.rotation.z += s * (.22 + .1 * Math.sin(t * 8)); });
      return arm;
    });
  }
  flower(parent, at, scale = .1, petal = '#f4bdc9', center = '#efca66') {
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; this.ball(parent, [at[0] + Math.sin(a) * scale * .56, at[1] + Math.cos(a) * scale * .56, at[2]], [scale * .42, scale * .42, scale * .22], petal); }
    this.ball(parent, [at[0], at[1], at[2] + scale * .15], [scale * .34, scale * .34, scale * .23], center);
  }
  finish(height = 1.3) {
    for (const part of this.parts) {
      for (const [key, batch] of Object.entries(part.userData.batch)) {
        if (!batch.p.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(batch.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(batch.n, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(batch.c, 3));
        g.computeBoundingSphere(); this.geometry.add(g);
        const mesh = new THREE.Mesh(g, key === 'glow' ? this.glowMaterial : this.material);
        mesh.name = `${part.name}-${key}`; mesh.castShadow = true; mesh.receiveShadow = true; part.add(mesh);
      }
      delete part.userData.batch;
      part.userData.bindPosition = part.position.clone(); part.userData.bindRotation = part.rotation.clone(); part.userData.bindScale = part.scale.clone();
    }
    for (const geom of Object.values(this.primitives)) geom.dispose();
    this.primitives = null;
    const bounds = new THREE.Box3().setFromObject(this.group), size = bounds.getSize(new THREE.Vector3());
    const optionScale = Number.isFinite(this.options.scale) && this.options.scale > 0 ? this.options.scale : 1;
    const scale = height / Math.max(.01, size.y) * optionScale;
    this.pose.scale.setScalar(scale); this.pose.position.y = -bounds.min.y * scale;
    const baseY = this.pose.position.y, phase = Math.max(0, IDS.indexOf(this.id)) * .37;
    this.group.userData = { species: this.id, height: height * optionScale, forward: '+Z', originalAsset: true };
    let disposed = false;
    return {
      group: this.group,
      animate: (time, { moving = 0, mood = 'idle', attack = 0 } = {}) => {
        if (disposed) return;
        const t = Number.isFinite(time) ? time : 0, m = clamp(moving), a = clamp(attack);
        for (const part of this.parts) { part.position.copy(part.userData.bindPosition); part.rotation.copy(part.userData.bindRotation); part.scale.copy(part.userData.bindScale); }
        const pleased = mood === 'happy' || mood === 'celebrate';
        this.pose.position.y = baseY + (Math.abs(Math.sin(t * 9)) * .045 * m + (pleased ? Math.max(0, Math.sin(t * 6)) * .055 : 0)) * scale;
        this.pose.rotation.set(0, 0, 0);
        this.base.scale.y = 1 + Math.sin(t * 2.25 + phase) * .012;
        this.base.rotation.x += m * .07 - a * .16;
        this.base.position.z += a * .12;
        if (mood === 'hurt' || mood === 'sad') { this.base.rotation.x -= .1; this.base.rotation.z += Math.sin(t * 20) * (mood === 'hurt' ? .035 : .012); }
        const cycle = ((t + phase) % 4.8 + 4.8) % 4.8;
        const blink = 1 - .94 * Math.exp(-(((cycle - 4.43) / .07) ** 2));
        for (const eyes of this.blinks) eyes.scale.y = mood === 'sleep' ? .12 : blink * (mood === 'sad' ? .72 : 1);
        for (const motion of this.motions) motion(t, m, a, mood);
      },
      dispose: () => {
        if (disposed) return; disposed = true;
        for (const geom of this.geometry) geom.dispose(); this.geometry.clear();
        this.material.dispose(); this.glowMaterial.dispose();
      },
    };
  }
}

function sprig(m) {
  const b = m.base, green = '#9fc9a7', dark = '#527e69', cream = '#f5ecd3';
  m.ball(b, [0, .51, 0], [.29, .39, .25], green);
  m.ball(b, [0, .49, .19], [.215, .28, .09], cream);
  m.legs({ spots: [[-.17, .24, .015], [.17, .24, .015]], color: green, footColor: cream, height: .23, width: .12 });
  m.arms({ spots: [[-.26, .67, .015], [.26, .67, .015]], color: green, handColor: '#d0dec0', length: .29, width: .085 });
  const head = m.part('head', [0, .97, .03]);
  m.ball(head, [0, 0, 0], [.37, .32, .31], green);
  m.ball(head, [0, -.1, .238], [.25, .145, .115], cream);
  m.face(head, { y: .035, z: .287, spread: .142, size: .09, blush: .26, iris: '#779567' });
  m.ball(head, [0, -.039, .362], [.035, .028, .025], '#71646a');
  for (const s of [-1, 1]) {
    const ear = m.part(`leaf-ear-${s}`, [s * .19, .2, -.035], head); ear.rotation.z = -s * .22;
    m.leaf(ear, [0, 0, 0], [.34, .66, .31], dark);
    m.leaf(ear, [0, .045, .038], [.235, .54, .12], '#bcd89e');
    m.curve(ear, [[0, .07, .055], [0, .31, .078], [0, .54, .033]], .011, '#e6e8b6');
    for (const y of [.19, .3, .41]) m.rod(ear, [0, y, .073], [s * .074, y + .064, .057], .006, '#e6e8b6');
    m.sway(ear, 'z', .075, 2.1, s);
  }
  m.leaf(head, [-.055, .24, .1], [.1, .22, .2], '#7ba779', [0, 0, -.55]);
  m.flower(head, [.19, .205, .195], .077, '#f4ca94', '#b9a362');
  const tail = m.part('cotton-tail', [0, .42, -.26]);
  m.ball(tail, [0, 0, 0], [.145, .155, .14], cream); m.ball(tail, [.06, .07, -.03], [.08, .075, .08], '#ecdfbf'); m.sway(tail, 'y', .2, 3.4);
  m.curve(b, [[-.23, .76, .05], [-.13, .59, .265], [.05, .38, .279], [.15, .27, .19]], .018, '#9a775d');
  m.ball(b, [.11, .32, .275], [.1, .12, .06], '#d5b376', [0, 0, -.14]);
  m.ball(b, [.11, .405, .28], [.11, .045, .065], '#9a775d');
  m.leaf(b, [.12, .436, .28], [.08, .08, .12], '#76956d', [0, 0, -.5]);
  m.sway(head, 'z', .045, 1.35); return m.finish(1.38);
}

function puff(m) {
  const b = m.base, cream = '#ead8b0', brown = '#a8785b';
  m.ball(b, [0, .39, -.06], [.43, .37, .41], brown);
  m.ball(b, [0, .47, -.125], [.43, .36, .35], '#d2a96d');
  m.legs({ spots: [[-.22, .18, .1], [.22, .18, .1]], color: brown, footColor: '#735e56', height: .18, width: .09 });
  m.arms({ spots: [[-.33, .4, .22], [.33, .4, .22]], color: brown, handColor: cream, length: .18, width: .07 });
  const head = m.part('face', [0, .39, .255]);
  m.ball(head, [0, 0, 0], [.3, .245, .21], cream);
  m.ball(head, [0, -.045, .162], [.16, .12, .14], '#f1e3c7');
  m.face(head, { y: .044, z: .171, spread: .145, size: .073, blush: .238, nose: false, iris: '#a98c51' });
  m.ball(head, [0, -.015, .279], [.057, .045, .036], '#68565a');
  for (const s of [-1, 1]) { m.ball(head, [s * .255, .155, -.023], [.1, .11, .06], brown); m.ball(head, [s * .255, .157, .023], [.057, .067, .02], '#dfac98'); }
  const quills = m.part('dandelion-quills', [0, .45, -.08]);
  for (let ring = 0; ring < 3; ring++) {
    const count = 7 + ring * 2, theta = .24 + ring * .4;
    for (let i = 0; i < count; i++) {
      const phi = i * TAU / count + ring * .42, x = Math.sin(theta) * Math.cos(phi), z = Math.sin(theta) * Math.sin(phi);
      const start = [x * .35, Math.cos(theta) * .26, z * .33 - .06], end = [x * .51, Math.cos(theta) * (.46 + .025 * Math.sin(i * 2)), z * .49 - .065];
      // Front-most lower quills never obstruct the eyes.
      if (end[2] > .26 && ring > 0) continue;
      m.rod(quills, start, end, .012, '#bd975f');
      m.ball(quills, end, [.057, .055, .057], '#faf0cd');
      if (!m.low) for (let p = 0; p < 4; p++) { const a = p * Math.PI / 2; m.rod(quills, end, [end[0] + Math.sin(a) * .062, end[1] + .027, end[2] + Math.cos(a) * .062], .008, '#fff6dc'); }
    }
  }
  m.sway(quills, 'z', .035, 2); m.sway(head, 'z', .045, 1.7);
  m.flower(b, [-.28, .57, .15], .064, '#f9e3a1', '#ab8154'); return m.finish(1.1);
}

function fawn(m) {
  const b = m.base, coat = '#c99c74', pale = '#f5e0bf';
  m.ball(b, [0, .58, -.045], [.28, .3, .47], coat);
  m.ball(b, [0, .61, .285], [.2, .3, .175], pale);
  m.legs({ spots: [[-.18, .43, .25], [.18, .43, .25], [-.18, .43, -.31], [.18, .43, -.31]], color: coat, footColor: '#78685a', height: .42, width: .066, toe: 0 });
  m.ball(b, [0, .85, .24], [.155, .31, .18], coat, [-.18, 0, 0]);
  const head = m.part('head', [0, 1.07, .34]);
  m.ball(head, [0, .015, 0], [.23, .23, .25], coat);
  m.ball(head, [0, -.06, .2], [.185, .135, .18], pale);
  m.face(head, { y: .04, z: .206, spread: .112, size: .078, blush: .2, nose: false, iris: '#586e5b' });
  m.ball(head, [0, -.027, .362], [.053, .032, .029], '#745c59');
  for (const s of [-1, 1]) {
    const ear = m.part(`ear-${s}`, [s * .17, .16, -.06], head); ear.rotation.z = -s * .86;
    m.leaf(ear, [0, 0, 0], [.2, .38, .32], coat); m.leaf(ear, [0, .032, .032], [.12, .285, .1], '#e9c2a6'); m.sway(ear, 'x', .06, 2.4, s);
    const antler = m.part(`flower-antler-${s}`, [s * .13, .16, -.045], head);
    m.curve(antler, [[0, 0, 0], [s * .035, .16, -.028], [s * .025, .34, .003], [s * .075, .41, .018]], .022, '#8c896a');
    m.curve(antler, [[s * .031, .18, -.02], [s * .155, .23, 0], [s * .175, .32, .01]], .016, '#8c896a');
    m.flower(antler, [s * .075, .405, .023], .07, '#f0b3bc', '#e2bc65');
    m.flower(antler, [s * .177, .317, .022], .054, '#f7d5ba', '#dbab61');
    m.leaf(antler, [s * .024, .21, -.018], [.09, .17, .14], '#8aa375', [0, 0, s * .72]);
  }
  for (const s of [-1, 1]) for (const [y, z, r] of [[.64, -.23, .04], [.72, -.055, .035], [.6, .09, .038], [.73, -.25, .025]]) m.ball(b, [s * .263, y, z], [.014, r, r * 1.4], pale);
  const tail = m.part('tail', [0, .66, -.445]); m.leaf(tail, [0, 0, 0], [.14, .25, .5], pale, [-.7, 0, 0]); m.sway(tail, 'z', .14, 3.3);
  m.sway(head, 'z', .045, 1.8); return m.finish(1.48);
}

function moss(m) {
  const b = m.base, skin = '#a4bb83', shell = '#628375';
  m.ball(b, [0, .22, 0], [.45, .18, .49], skin);
  m.add(b, 'dome', [0, .24, -.04], [.49, .32, .5], shell);
  m.add(b, 'ring', [0, .255, -.04], [.46, .5, .28], '#b8c391', [Math.PI / 2, 0, 0]);
  const plate = new THREE.CylinderGeometry(1, 1.06, 1, 6, 1);
  // Six shell scutes are separate raised facets, not a plain smooth ball.
  for (const [x, y, z, sx, sz] of [[0, .562, -.05, .135, .145], [-.22, .507, -.07, .12, .15], [.22, .507, -.07, .12, .15], [0, .5, -.29, .14, .1], [-.14, .477, .21, .12, .12], [.14, .477, .21, .12, .12]]) m.add(b, plate.clone(), [x, y, z], [sx, .022, sz], '#82a28a', [z * .7, 0, -x * .75]);
  plate.dispose();
  m.legs({ spots: [[-.34, .2, .3], [.34, .2, .3], [-.34, .2, -.3], [.34, .2, -.3]], color: skin, footColor: '#c6cea0', height: .19, width: .105, toe: .022 });
  const head = m.part('head', [0, .26, .48]);
  m.ball(head, [0, .005, .03], [.22, .18, .23], skin);
  m.ball(head, [0, -.055, .205], [.16, .085, .05], '#dbe0b4');
  m.face(head, { y: .035, z: .213, spread: .101, size: .066, blush: .167, nose: false, iris: '#82773f' });
  m.sway(head, 'y', .07, 1.35);
  const garden = m.part('shell-garden', [0, .54, -.11]);
  for (const [x, y, z, r, color] of [[-.14, .15, -.02, .115, '#d9aa88'], [.02, .21, -.07, .14, '#d6c4a2'], [.15, .09, .025, .08, '#d3a894']]) {
    m.rod(garden, [x, -.005, z], [x, y, z], .023, '#ebdec0'); m.add(garden, 'dome', [x, y, z], [r, r * .65, r], color);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; m.ball(garden, [x + Math.sin(a) * r * .48, y + r * .47, z + Math.cos(a) * r * .48], [.017, .008, .017], '#f5e9cf'); }
  }
  for (const [x, z, r] of [[-.27, -.1, -.5], [.18, -.15, .6], [.05, .16, -.3]]) { m.leaf(garden, [x, -.05, z], [.16, .25, .25], '#6f9865', [r * .3, 0, r]); m.leaf(garden, [x, -.05, z], [.1, .19, .21], '#abc078', [-.2, 1, -r]); }
  m.sway(garden, 'z', .022, 2.2); return m.finish(1.05);
}

function otter(m) {
  const b = m.base, fur = '#839eac', dark = '#526d7c', cream = '#f0e5cc';
  m.ball(b, [0, .52, 0], [.265, .4, .255], fur);
  m.ball(b, [0, .5, .195], [.198, .285, .09], cream);
  m.legs({ spots: [[-.16, .2, .06], [.16, .2, .06]], color: fur, footColor: dark, height: .19, width: .11, toe: .038 });
  const tail = m.part('river-tail', [0, .3, -.19]);
  m.ball(tail, [0, -.12, -.27], [.16, .095, .36], dark, [-.16, 0, 0]);
  m.ball(tail, [0, -.15, -.49], [.135, .06, .17], fur); m.sway(tail, 'y', .24, 2.4);
  const arms = m.arms({ spots: [[-.23, .71, .075], [.23, .71, .075]], color: fur, handColor: dark, length: .27, width: .08, angle: -.42 });
  for (const arm of arms) arm.rotation.x = -.35;
  const head = m.part('head', [0, .97, .04]);
  m.ball(head, [0, 0, 0], [.34, .31, .29], fur);
  for (const s of [-1, 1]) {
    m.ball(head, [s * .279, .145, -.02], [.101, .112, .07], dark); m.ball(head, [s * .282, .148, .03], [.058, .064, .025], '#bea9a4');
    m.ball(head, [s * .096, -.075, .231], [.145, .105, .087], cream);
    for (let i = 0; i < 3; i++) m.curve(head, [[s * .12, -.054 - i * .035, .286], [s * .215, -.049 - i * .036, .28], [s * (.34 + (i % 2) * .028), -.05 - i * .032 + (i === 0 ? .025 : -.01), .235]], .006, '#546772');
  }
  m.face(head, { y: .026, z: .269, spread: .137, size: .085, blush: .244, nose: false, iris: '#5e9399' });
  m.ball(head, [0, -.05, .32], [.041, .029, .024], '#3e535f');
  m.curve(head, [[-.032, -.101, .313], [0, -.121, .319], [.032, -.101, .313]], .008, '#6b6161');
  m.add(b, 'ring', [0, .797, .018], [.23, .235, .32], '#478e97', [Math.PI / 2, 0, 0]);
  const scarf = m.part('scarf-tip', [.2, .79, -.06]);
  m.leaf(scarf, [0, 0, 0], [.17, .34, .23], '#61a5a4', [0, 0, -2.55]); m.sway(scarf, 'x', .18, 3.2);
  const keepsake = m.part('shell-keepsake', [0, .465, .292]);
  m.ball(keepsake, [0, .03, 0], [.108, .112, .025], '#edc49b');
  m.ball(keepsake, [0, -.055, .01], [.039, .047, .025], '#dbaa86');
  for (let i = -2; i <= 2; i++) { const a = i * .34; m.curve(keepsake, [[0, -.06, .03], [Math.sin(a) * .046, .012, .033], [Math.sin(a) * .098, Math.cos(a) * .095, .015]], .006, '#f9e6c0'); }
  m.sway(head, 'z', .052, 1.65); return m.finish(1.32);
}

function fin(m) {
  const b = m.base, pink = '#eab3bc', pale = '#f5d5cb';
  m.ball(b, [0, .32, -.12], [.255, .23, .45], pink);
  m.ball(b, [0, .29, .21], [.25, .17, .24], pale);
  m.legs({ spots: [[-.23, .19, .21], [.23, .19, .21], [-.23, .19, -.31], [.23, .19, -.31]], color: pink, footColor: '#d38da3', height: .18, width: .075, toe: .025 });
  const tail = m.part('ribbon-tail', [0, .31, -.42]);
  m.curve(tail, [[0, 0, 0], [.08, -.015, -.2], [.11, .02, -.4], [.015, .055, -.59]], .087, pink);
  m.leaf(tail, [0, .04, -.03], [.43, .62, .42], '#aad7ca', [-Math.PI / 2, 0, -.1]);
  m.sway(tail, 'y', .2, 2.7);
  const head = m.part('head', [0, .52, .24]);
  m.ball(head, [0, 0, 0], [.39, .245, .28], pink);
  m.ball(head, [0, -.05, .226], [.285, .14, .052], pale);
  m.face(head, { y: .025, z: .265, spread: .185, size: .077, blush: .282, nose: false, smile: false, iris: '#628ba6' });
  m.curve(head, [[-.084, -.086, .278], [0, -.119, .292], [.084, -.086, .278]], .009, '#9d697e');
  for (const s of [-1, 1]) {
    const gills = m.part(`feather-gills-${s}`, [s * .3, .025, -.055], head);
    for (let i = 0; i < 3; i++) {
      const angle = (i - 1) * .54, end = [s * (.32 * Math.cos(angle)), .33 * Math.sin(angle) + .03, -.055 + i * .05];
      m.rod(gills, [0, 0, 0], end, .025, '#c46d92');
      m.leaf(gills, [end[0] * .34, end[1] * .34, end[2]], [.115, .255, .24], '#ef9fb6', [0, 0, -s * Math.PI / 2 + angle * s]);
      for (let k = 1; k <= 3; k++) { const f = k / 4; m.rod(gills, [end[0] * f, end[1] * f, end[2]], [end[0] * f, end[1] * f + .052, end[2] + .013], .012, '#f2c5c2'); }
    }
    m.sway(gills, 'y', .12, 3.3, s);
  }
  for (let i = 0; i < 4; i++) m.ball(b, [(i % 2 ? -1 : 1) * .2, .42, -.08 - i * .07], [.028, .011, .032], '#b581ab');
  m.sway(head, 'z', .04, 1.5); return m.finish(1.03);
}

function shell(m) {
  const b = m.base, coral = '#d99883', claw = '#c77b6d';
  m.ball(b, [0, .215, .07], [.35, .17, .32], coral);
  m.ball(b, [0, .232, .301], [.225, .103, .05], '#edbda2');
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leg = m.part(`crab-leg-${s}-${i}`, [s * .27, .22, .18 - i * .17]);
    m.curve(leg, [[0, 0, 0], [s * .18, -.025, .018], [s * .26, -.15, .061]], .032, coral);
    m.ball(leg, [s * .26, -.15, .061], [.055, .031, .067], claw);
    m.motions.push((t, moving) => { leg.rotation.z += Math.sin(t * 11 + i * 1.8 + s) * .14 * moving; });
  }
  const home = m.part('shell-cottage', [0, .49, -.095]);
  m.ball(home, [0, .03, -.04], [.41, .38, .385], '#e4cfaa');
  m.ball(home, [0, .035, .306], [.255, .235, .045], '#f5e3bb');
  // A carved door, little round window and leafy roof make the carried home readable.
  m.add(home, 'box', [0, -.04, .344], [.155, .17, .035], '#778979');
  m.ball(home, [0, .043, .347], [.077, .079, .02], '#778979');
  m.rod(home, [-.066, -.12, .37], [-.066, .035, .37], .012, '#b29872');
  m.rod(home, [.066, -.12, .37], [.066, .035, .37], .012, '#b29872');
  m.ball(home, [.045, -.045, .378], [.014, .014, .012], '#e6bb69');
  m.add(home, 'ring', [.16, .084, .318], [.051, .051, .1], '#9c8764');
  m.ball(home, [.16, .084, .319], [.044, .044, .009], '#f7d394', [0, 0, 0], true);
  for (let i = -2; i <= 2; i++) m.leaf(home, [i * .103, .095, .265], [.17, .28, .35], i % 2 ? '#668e83' : '#80a397', [-.7, 0, -i * .28]);
  const coil = [];
  for (let i = 0; i <= 32; i++) { const t = i / 32, a = t * TAU * 1.65, r = .275 * (1 - t) + .028; coil.push([.35 + .025 * t, .045 + Math.sin(a) * r, -.085 + Math.cos(a) * r]); }
  m.curve(home, coil, .024, '#bdab85');
  m.add(home, 'cylinder', [-.18, .355, -.15], [.044, .14, .047], '#ae967a');
  m.ball(home, [-.18, .429, -.15], [.056, .024, .054], '#8d7d6d');
  m.leaf(home, [-.178, .449, -.15], [.085, .13, .15], '#9fc09a', [0, 0, -.2]);
  for (const s of [-1, 1]) {
    const eye = m.part(`eyestalk-${s}`, [s * .143, .287, .285]);
    m.rod(eye, [0, 0, 0], [s * .022, .171, .025], .035, coral);
    m.ball(eye, [s * .022, .17, .025], [.073, .074, .063], '#efc7a9');
    const pupil = m.part(`pupil-${s}`, [s * .022, .176, .079], eye);
    m.ball(pupil, [0, 0, 0], [.04, .051, .019], PALETTE.eye); m.ball(pupil, [-.011, .017, .019], [.012, .014, .006], PALETTE.white); m.blinks.push(pupil); m.sway(eye, 'z', .08, 2.6, s);
    const pincer = m.part(`pincer-${s}`, [s * .315, .23, .257]);
    m.curve(pincer, [[0, 0, 0], [s * .15, .017, .035], [s * .19, .1, .083]], .053, coral);
    const size = s > 0 ? 1.15 : .86;
    m.ball(pincer, [s * .19, .15, .1], [.12 * size, .13 * size, .11 * size], claw);
    m.ball(pincer, [s * .235, .25, .109], [.053 * size, .115 * size, .073 * size], '#e7aa8b', [0, 0, -s * .24]);
    m.ball(pincer, [s * .115, .224, .12], [.05 * size, .075 * size, .065 * size], '#e7aa8b', [0, 0, s * .4]);
    m.motions.push((t, moving, attack) => { pincer.rotation.x -= .14 * Math.sin(t * 2.3 + s) + attack * .8; });
  }
  m.curve(b, [[-.043, .22, .346], [0, .2, .361], [.043, .22, .346]], .009, '#8f625d');
  m.sway(home, 'z', .02, 2.2); return m.finish(1.18);
}

function manta(m) {
  const b = m.base, sea = '#859ec9', pale = '#d9e5e4';
  m.ball(b, [0, .47, .02], [.36, .16, .46], sea);
  m.ball(b, [0, .415, .195], [.3, .102, .275], pale);
  m.face(b, { y: .48, z: .415, spread: .164, size: .065, blush: .259, nose: false, iris: '#818daf' });
  for (const s of [-1, 1]) {
    const wing = m.part(`ray-wing-${s}`, [s * .19, .465, -.035]);
    // Wing outline lies in XZ, with a small sculpted ridge along its center.
    const outline = [[0, -.28], [.28, -.35], [.71, -.17], [.99, .2], [.67, .14], [.38, .34], [0, .29]].map(([x, z]) => [s * x, z]);
    const geom = polygonGeometry(outline, .05, .025); geom.rotateX(Math.PI / 2);
    m.add(wing, geom, [0, 0, 0], [1, 1, 1], sea);
    m.curve(wing, [[s * .05, .043, -.21], [s * .33, .043, -.11], [s * .71, .045, .08]], .014, '#b9ccd9');
    for (let i = 0; i < 3; i++) m.ball(wing, [s * (.22 + i * .145), .045, .14 - i * .037], [.032, .014, .039], '#d8e9df');
    m.motions.push((t, moving, attack) => { wing.rotation.z = s * (.1 + Math.sin(t * (2.3 + moving * 2)) * .15 - attack * .2); });
    m.curve(b, [[s * .16, .46, .39], [s * .235, .51, .49], [s * .212, .585, .495]], .043, '#a5bdd5');
  }
  const tail = m.part('ribbon-tail', [0, .47, -.32]);
  m.curve(tail, [[0, 0, 0], [.06, .03, -.33], [.13, .13, -.68], [.07, .2, -.86]], .032, '#6f82ae');
  m.leaf(tail, [.07, .2, -.86], [.15, .24, .3], '#c5d7d8', [-Math.PI / 2, 0, -.2]); m.sway(tail, 'y', .15, 2.4);
  // A ray is broad rather than tall. Keep the wings close to 2.2 m wide;
  // scaling its shallow body to a humanoid height would make a 5 m creature.
  m.motions.push(t => { b.position.y += .35 + Math.sin(t * 2.1) * .055; }); return m.finish(.36);
}

function ember(m) {
  const b = m.base, orange = '#d78c66', russet = '#b76756', cream = '#f5ddae';
  m.ball(b, [0, .48, -.015], [.265, .305, .36], orange);
  m.ball(b, [0, .51, .235], [.196, .255, .11], cream);
  m.legs({ spots: [[-.18, .265, .215], [.18, .265, .215], [-.18, .255, -.255], [.18, .255, -.255]], color: orange, footColor: russet, height: .25, width: .078, toe: .026 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) m.leaf(b, [s * .12, .65 - i * .035, .2], [.15, .19, .26], cream, [0, 0, s * (1.75 + i * .3)]);
  const head = m.part('head', [0, .88, .21]);
  m.ball(head, [0, 0, -.012], [.32, .29, .285], orange);
  for (const s of [-1, 1]) {
    m.ball(head, [s * .17, -.09, .18], [.185, .117, .12], cream, [0, 0, s * .23]);
    const ear = m.part(`fox-ear-${s}`, [s * .18, .16, -.055], head); ear.rotation.z = -s * .24;
    m.leaf(ear, [0, 0, 0], [.33, .42, .39], russet); m.leaf(ear, [0, .055, .045], [.205, .295, .14], '#ecc4aa'); m.sway(ear, 'z', .045, 2.3, s);
  }
  m.ball(head, [0, -.087, .265], [.13, .092, .11], cream);
  m.face(head, { y: .035, z: .264, spread: .138, size: .082, blush: .233, nose: false, iris: '#ae8052' });
  m.ball(head, [0, -.051, .364], [.037, .028, .025], '#655454');
  const flame = m.part('forehead-spark', [0, .21, .162], head);
  m.leaf(flame, [-.052, 0, 0], [.1, .21, .19], '#efb468', [0, 0, .25]);
  m.leaf(flame, [.03, -.01, -.014], [.15, .3, .21], '#f3ca87', [0, 0, -.24]);
  m.leaf(flame, [.042, .006, .015], [.07, .17, .12], '#ffe1a4', [0, 0, -.21], true);
  const tail = m.part('plume-tail', [0, .39, -.295]);
  m.ball(tail, [0, .12, -.22], [.14, .15, .27], russet, [.38, 0, 0]);
  m.ball(tail, [0, .34, -.4], [.22, .3, .19], orange, [.4, 0, 0]);
  m.leaf(tail, [0, .39, -.49], [.42, .53, .85], cream, [.35, 0, -.08]);
  m.leaf(tail, [-.06, .57, -.37], [.24, .32, .5], '#ebbc7d', [.4, 0, -.25]);
  m.leaf(tail, [.05, .66, -.33], [.12, .29, .45], '#f7d59b', [.36, 0, .3]);
  m.sway(tail, 'y', .27, 2.4); m.sway(head, 'z', .047, 1.5); return m.finish(1.35);
}

function moth(m) {
  const b = m.base, dark = '#65758a', fur = '#d7d6bd';
  m.ball(b, [0, .6, .015], [.19, .34, .155], dark);
  for (let i = 0; i < 4; i++) m.ball(b, [0, .42 + i * .091, .023], [.167 + i * .001, .064, .155], i % 2 ? '#a79973' : '#d7bd7d');
  m.ball(b, [0, .56, .151], [.094, .17, .025], '#f5d995', [0, 0, 0], true);
  for (const s of [-1, 1]) {
    const wing = m.part(`lantern-wing-${s}`, [s * .115, .66, -.045]);
    m.leaf(wing, [0, -.1, 0], [.79, .99, .28], '#7f9e9b', [0, s * .07, -s * .71]);
    m.leaf(wing, [s * .045, -.24, -.01], [.48, .64, .28], '#a5b5a0', [0, 0, -s * 2.0]);
    const a = -s * .71, px = -Math.sin(a) * .47, py = Math.cos(a) * .47;
    m.ball(wing, [px, py - .07, .047], [.17, .205, .024], '#e1c990', [0, 0, a]);
    m.ball(wing, [px, py - .07, .071], [.105, .14, .016], '#758688', [0, 0, a]);
    m.ball(wing, [px, py - .07, .088], [.052, .071, .012], '#f5dda5', [0, 0, a], true);
    for (let i = 0; i < 3; i++) m.curve(wing, [[0, -.02, .046], [s * (.16 + i * .06), .13, .07], [s * (.29 + i * .11), .25 + i * .08, .04]], .007, '#d6d5af');
    m.motions.push((t, moving, attack) => { wing.rotation.y = s * (.2 + Math.sin(t * (2.8 + moving * 4)) * .22 + attack * .28); });
    for (let i = 0; i < 3; i++) m.curve(b, [[s * .125, .65 - i * .105, .08], [s * .21, .55 - i * .095, .18], [s * .17, .5 - i * .087, .24]], .025, dark);
  }
  m.legs({ spots: [[-.08, .28, .015], [.08, .28, .015]], color: dark, footColor: '#a5a491', height: .17, width: .06, toe: 0 });
  const head = m.part('head', [0, .995, .025]);
  m.ball(head, [0, 0, 0], [.255, .215, .21], fur); m.face(head, { y: .002, z: .19, spread: .114, size: .077, blush: .196, nose: false, iris: '#8a976a' });
  for (const s of [-1, 1]) {
    m.curve(head, [[s * .104, .14, -.025], [s * .156, .285, -.02], [s * .25, .335, .012]], .015, dark);
    m.leaf(head, [s * .235, .307, .01], [.1, .2, .15], '#e7d49b', [0, 0, -s * .9]);
    m.ball(head, [s * .25, .335, .01], [.047, .043, .039], '#f4da98', [0, 0, 0], true);
  }
  m.sway(head, 'z', .03, 1.8); return m.finish(1.36);
}

function ram(m) {
  const b = m.base, wool = ['#d3c6b1', '#c6baa6', '#e4d8bf'], stone = '#8f8a82';
  m.ball(b, [0, .49, -.07], [.34, .34, .41], wool[0]);
  for (let i = 0; i < 13; i++) { const a = i * 2.39996, y = .36 + (i % 3) * .13, x = Math.cos(a) * .285, z = Math.sin(a) * .32 - .075; m.add(b, 'rock', [x, y, z], [.18, .19, .185], wool[i % 3], [i * .2, i, 0]); }
  m.legs({ spots: [[-.2, .23, .22], [.2, .23, .22], [-.2, .23, -.27], [.2, .23, -.27]], color: stone, footColor: '#626769', height: .22, width: .074, toe: 0 });
  const head = m.part('head', [0, .65, .31]);
  m.ball(head, [0, -.012, .02], [.234, .253, .232], stone);
  m.ball(head, [0, -.11, .198], [.15, .112, .062], '#b1a391');
  m.face(head, { y: .032, z: .222, spread: .108, size: .074, blush: .197, nose: false, iris: '#a79262' });
  m.ball(head, [0, -.083, .258], [.034, .025, .018], '#635e5c');
  for (const s of [-1, 1]) {
    m.leaf(head, [s * .185, .05, -.055], [.18, .265, .3], '#bcae97', [0, 0, -s * 1.4]);
    const horn = m.part(`curled-horn-${s}`, [s * .19, .15, -.04], head), points = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26, a = -.3 + t * TAU * 1.15, r = .19 * (1 - t * .75); points.push([s * (.1 + Math.cos(a) * r), Math.sin(a) * r, .015 + t * .08]); }
    m.curve(horn, points, .052, '#b99070');
    for (let i = 2; i < 24; i += 4) m.ball(horn, points[i], [.057, .053, .047], '#c8a481');
  }
  for (const [x, z, r] of [[-.14, .03, .15], [.12, .02, .17], [0, -.09, .155]]) m.add(head, 'rock', [x, .208, z], [r, r * .75, r], wool[2]);
  m.curve(b, [[-.24, .71, -.17], [-.12, .81, -.12], [-.08, .78, .01], [.02, .825, .08]], .011, '#e8b96f', true);
  m.curve(b, [[.26, .65, -.27], [.19, .756, -.2], [.23, .76, -.11]], .01, '#e8b96f', true);
  m.add(b, 'ring', [0, .511, .257], [.215, .18, .33], '#a26f5e', [Math.PI / 2, 0, 0]);
  m.ball(b, [0, .329, .297], [.061, .067, .035], '#cea966');
  m.sway(head, 'z', .04, 1.4); return m.finish(1.2);
}

function drake(m) {
  const b = m.base, red = '#c97870', dark = '#9b6068', gold = '#e3b581';
  m.ball(b, [0, .48, -.04], [.28, .38, .285], red);
  m.ball(b, [0, .49, .205], [.201, .29, .073], '#edc79d');
  for (let i = 0; i < 4; i++) m.curve(b, [[-.12, .32 + i * .092, .258], [0, .31 + i * .095, .28], [.12, .32 + i * .092, .258]], .009, '#ca9b81');
  m.legs({ spots: [[-.185, .225, .025], [.185, .225, .025]], color: red, footColor: dark, height: .22, width: .113, toe: .029 });
  m.arms({ spots: [[-.24, .69, .04], [.24, .69, .04]], color: red, handColor: '#e5ae8b', length: .21, width: .076, angle: -.1 });
  const head = m.part('head', [0, .969, .035]);
  m.ball(head, [0, 0, 0], [.315, .28, .285], red);
  m.ball(head, [0, -.085, .241], [.22, .128, .16], '#ddab89');
  m.face(head, { y: .047, z: .265, spread: .145, size: .085, blush: .246, nose: false, iris: '#9982a6' });
  for (const s of [-1, 1]) {
    m.ball(head, [s * .086, -.033, .384], [.022, .013, .015], '#9e6f70');
    m.curve(head, [[s * .19, .17, -.08], [s * .245, .29, -.12], [s * .223, .383, -.075]], .05, '#e4cda9');
    m.leaf(head, [s * .24, .042, -.088], [.24, .245, .25], dark, [0, 0, -s * 1.05]);
  }
  const tail = m.part('dragon-tail', [0, .31, -.24]);
  m.curve(tail, [[0, 0, 0], [.08, -.12, -.24], [.28, -.12, -.45], [.39, .017, -.46], [.32, .14, -.38]], .083, red);
  for (let i = 0; i < 4; i++) m.leaf(tail, [.075 + i * .077, -.015 + i * .019, -.18 - i * .075], [.095, .14, .3], gold, [-.15, 0, -.15]);
  m.leaf(tail, [.32, .14, -.38], [.18, .26, .32], '#ecc395', [0, 0, -.35]); m.sway(tail, 'y', .19, 2.2);
  for (const s of [-1, 1]) {
    const wing = m.part(`dragon-wing-${s}`, [s * .18, .75, -.17]);
    const outline = [[0, 0], [.13, .42], [.34, .49], [.6, .28], [.42, .24], [.39, .03], [.25, .13], [.13, -.05]].map(([x, y]) => [s * x, y]);
    m.add(wing, polygonGeometry(outline, .03, .014), [0, 0, 0], [1, 1, 1], '#dba582');
    m.curve(wing, [[0, 0, .018], [s * .13, .42, .018], [s * .34, .49, .018], [s * .59, .28, .018]], .018, dark);
    m.rod(wing, [s * .13, .41, .022], [s * .39, .04, .022], .012, '#b77770');
    m.rod(wing, [s * .13, .41, .022], [s * .13, -.035, .022], .01, '#b77770');
    m.motions.push((t, moving, attack) => { wing.rotation.y = s * (.45 + Math.sin(t * 2.5) * .14 + attack * .55); });
  }
  m.leaf(head, [0, .22, -.065], [.12, .2, .25], gold); m.sway(head, 'z', .045, 1.65); return m.finish(1.39);
}

function star(m) {
  const b = m.base, coat = '#ada9cf', pale = '#ece5ef', gold = '#edd6a4';
  m.ball(b, [0, .47, -.075], [.25, .31, .36], coat);
  m.ball(b, [0, .5, .202], [.18, .25, .09], pale);
  m.legs({ spots: [[-.16, .215, .18], [.16, .215, .18], [-.16, .215, -.28], [.16, .215, -.28]], color: coat, footColor: pale, height: .21, width: .072, toe: .021 });
  const head = m.part('head', [0, .879, .19]);
  m.ball(head, [0, 0, 0], [.333, .278, .281], coat);
  for (const s of [-1, 1]) {
    m.ball(head, [s * .089, -.087, .231], [.128, .084, .07], pale);
    const ear = m.part(`star-ear-${s}`, [s * .245, .223, -.055], head); ear.rotation.z = -s * .19;
    m.add(ear, 'star', [0, 0, 0], [.226, .243, .24], '#c5beda');
    m.add(ear, 'star', [0, .005, .062], [.136, .154, .09], '#e9d2c8'); m.sway(ear, 'z', .035, 2.4, s);
    for (let i = 0; i < 2; i++) m.curve(head, [[s * .16, -.065 - i * .031, .268], [s * .26, -.06 - i * .039, .248], [s * .345, -.045 - i * .058, .206]], .005, '#7c7d9b');
    m.add(head, 'star', [s * .231, -.044, .228], [.024, .028, .055], gold);
  }
  m.face(head, { y: .029, z: .262, spread: .139, size: .086, blush: .247, nose: false, iris: '#6999a9' });
  m.ball(head, [0, -.061, .308], [.029, .022, .021], '#9d799d');
  // Crescent is a shaped ribbon, so it remains a crescent from an oblique view.
  const moon = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * .25 + i / 16 * Math.PI * 1.5; moon.push([Math.cos(a) * .065 + .025, .17 + Math.sin(a) * .065, .254]); }
  m.curve(head, moon, .016, gold, true);
  const tail = m.part('moon-tail', [0, .45, -.35]);
  m.curve(tail, [[0, 0, 0], [.13, .015, -.2], [.26, .18, -.23], [.23, .39, -.17], [.1, .44, -.14]], .057, coat);
  m.add(tail, 'star', [.09, .438, -.14], [.108, .108, .16], gold, [0, 0, -.3], true); m.sway(tail, 'y', .24, 2.1);
  m.sway(head, 'z', .037, 1.35); return m.finish(1.34);
}

const BUILDERS = { sprig, puff, fawn, moss, otter, fin, shell, manta, ember, moth, ram, drake, star };

export function buildCreature(id, options = {}) {
  if (!Object.hasOwn(BUILDERS, id)) throw new RangeError(`Unknown creature species: ${String(id)}`);
  return BUILDERS[id](new Model(id, options));
}

export function buildExplorer(options = {}) {
  const m = new Model('explorer', options), b = m.base, skin = '#e8bd9f', hair = '#6e5c50', shirt = '#eee4c8', teal = '#6c9693';
  m.ball(b, [0, .65, 0], [.203, .285, .153], shirt);
  m.add(b, 'box', [0, .435, 0], [.34, .15, .25], '#718a7b');
  m.legs({ spots: [[-.095, .385, .013], [.095, .385, .013]], color: skin, footColor: '#bf9366', height: .36, width: .073, toe: 0 });
  for (const s of [-1, 1]) { m.ball(b, [s * .095, .105, .012], [.085, .095, .088], '#bd966b'); m.ball(b, [s * .095, .167, .012], [.084, .025, .086], '#e1c498'); }
  const arms = m.arms({ spots: [[-.192, .83, 0], [.192, .83, 0]], color: shirt, handColor: skin, length: .29, width: .065, angle: .05 });
  for (const arm of arms) m.ball(arm, [0, -.083, 0], [.073, .094, .073], teal);
  for (const s of [-1, 1]) {
    m.add(b, 'box', [s * .109, .68, .116], [.106, .302, .06], teal, [0, 0, -s * .07]);
    m.rod(b, [s * .137, .876, .07], [s * .14, .48, .16], .019, '#c5b088');
    m.add(b, 'box', [s * .14, .568, .178], [.031, .044, .016], '#e5c782');
  }
  m.leaf(b, [0, .904, .094], [.128, .245, .16], '#cb8968', [0, 0, Math.PI]);
  m.ball(b, [0, .864, .153], [.041, .042, .028], '#b9785e');
  const pack = m.part('backpack', [0, .675, -.149]);
  m.ball(pack, [0, 0, -.038], [.178, .232, .103], '#c59170');
  m.add(pack, 'box', [0, -.023, -.13], [.238, .15, .061], '#d7aa82');
  m.ball(pack, [0, .141, -.074], [.179, .091, .1], '#d7aa82');
  m.add(pack, 'box', [0, .123, -.16], [.04, .056, .021], '#947656');
  m.curve(pack, [[-.045, .2, -.035], [-.039, .269, -.02], [.043, .269, -.02], [.045, .2, -.035]], .018, '#95785c');
  m.ball(pack, [.177, -.029, -.07], [.051, .141, .063], '#7eaaa4'); m.ball(pack, [.177, .117, -.07], [.035, .025, .036], '#e4dbc0');
  m.sway(pack, 'z', .015, 2.5);
  const head = m.part('head', [0, 1.089, .012]);
  m.ball(head, [0, 0, 0], [.225, .253, .218], skin);
  for (const s of [-1, 1]) m.ball(head, [s * .211, -.005, 0], [.045, .072, .057], skin);
  m.ball(head, [0, .114, -.045], [.227, .174, .19], hair);
  for (const s of [-1, 1]) { m.ball(head, [s * .196, .021, -.018], [.044, .127, .09], hair); m.ball(head, [s * .102, .145, .128], [.095, .079, .06], hair, [0, 0, s * .2]); }
  m.face(head, { y: -.006, z: .203, spread: .088, size: .047, blush: .156, nose: false, iris: '#725d4c' });
  m.ball(head, [0, -.046, .227], [.026, .03, .022], '#d7a787');
  m.curve(head, [[-.033, -.104, .194], [0, -.119, .207], [.033, -.104, .194]], .007, '#9c6f65');
  const hat = m.part('sunhat', [0, .196, -.015], head);
  m.add(hat, 'cylinder', [0, 0, 0], [.35, .028, .32], '#dbc08b');
  m.add(hat, 'dome', [0, .015, 0], [.248, .147, .227], '#e6cf9e');
  m.add(hat, 'cylinder', [0, .038, 0], [.249, .042, .228], '#87a59a');
  m.add(hat, 'ring', [0, -.002, 0], [.326, .299, .045], '#c6ab78', [Math.PI / 2, 0, 0]);
  m.leaf(hat, [-.203, .037, .096], [.076, .156, .15], '#668e74', [.1, 0, -.55]);
  m.flower(hat, [-.204, .057, .112], .027, '#ecddbb', '#c6a268');
  m.sway(head, 'z', .027, 1.7); return m.finish(1.4);
}
