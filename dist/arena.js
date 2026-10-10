import * as THREE from './vendor/three.module.js';

// Battle gardens use the same material language as the exploration island.
// Everything inside radius 5 is flat and unobstructed; tall silhouettes live
// behind the fighters, not between the fighters and the (+X,+Z) camera.
export function buildArenaGarden(type = 'leaf') {
  if (!['leaf', 'tide', 'ember', 'star'].includes(type)) type = 'leaf';
  const group = new THREE.Group(); group.name = `Battle garden: ${type}`;
  const allocated = new Set(), batches = new Map(), motions = [];
  const own = value => { allocated.add(value); return value; };
  const colors = {
    wood: '#987351', bark: '#826652', paleWood: '#c3a178',
    grass: type === 'ember' ? '#bba87b' : type === 'tide' ? '#e7c88f' : type === 'star' ? '#9daab1' : '#acc78d',
    sand: '#e6c58e', bank: '#bc9871', cliff: '#9d927c',
    cream: '#fae7bc', white: '#f6ecd5', teal: '#6bada5', deepTeal: '#487c78',
    leaf: type === 'ember' ? '#d8a15b' : '#7caa76', lightLeaf: type === 'ember' ? '#edc57a' : '#a8c790',
    darkLeaf: type === 'ember' ? '#bc8357' : '#5d8b70',
    rose: '#e6acaf', coral: '#d79a80', blue: '#9cc7c4', rock: '#b2b9ac',
    gold: '#e9c16e', lavender: '#b7adca', rope: '#c9b68d',
  };
  const mats = Object.fromEntries(Object.entries(colors).map(([id, color]) => [id, own(new THREE.MeshStandardMaterial({color, roughness: .94}))]));
  mats.glow = own(new THREE.MeshStandardMaterial({color: '#ffe4a0', emissive: '#eeb665', emissiveIntensity: .55, roughness: .7}));
  mats.window = own(new THREE.MeshStandardMaterial({color: '#ffdca0', emissive: '#e2b675', emissiveIntensity: .25, roughness: .7}));
  const geo = {
    ball: own(new THREE.SphereGeometry(1, 12, 9)),
    cone: own(new THREE.ConeGeometry(1, 1, 10)),
    post: own(new THREE.CylinderGeometry(.76, 1, 1, 9)),
    cylinder: own(new THREE.CylinderGeometry(1, 1, 1, 14)),
    box: own(new THREE.BoxGeometry(1, 1, 1)),
    torus: own(new THREE.TorusGeometry(1, .09, 6, 28)),
    stone: own(new THREE.DodecahedronGeometry(1, 0)),
    leaf: own(leafGeometry()),
  };
  const dummy = new THREE.Object3D(), yAxis = new THREE.Vector3(0, 1, 0);
  function add(shape, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, shadow = true) {
    const geometry = typeof shape === 'string' ? geo[shape] : shape;
    const mat = typeof material === 'string' ? mats[material] : material;
    const key = `${geometry.uuid}/${mat.uuid}/${shadow}`;
    if (!batches.has(key)) batches.set(key, {geometry, material: mat, shadow, matrices: []});
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function beam(a, b, radius, material = 'wood') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(yAxis, delta.clone().normalize()));
    start.add(end).multiplyScalar(.5);
    add('post', material, start.x, start.y, start.z, radius, delta.length(), radius, euler.x, euler.y, euler.z);
  }
  const coast = a => 12.7 + .65 * Math.sin(a * 3 + .2) + .3 * Math.cos(a * 5);
  // Solid top, soft scalloped rim, then two visible earthy cliff layers.
  const surface = new THREE.Mesh(own(terrain(coast)), own(new THREE.MeshStandardMaterial({color: colors.grass, roughness: 1})));
  surface.receiveShadow = true; group.add(surface);
  for (const [top, bottom, offset, mat] of [[0, -.36, 0, 'sand'], [-.36, -1.32, -.15, 'bank'], [-1.32, -2.6, -.55, 'cliff']]) {
    const edge = new THREE.Mesh(own(cliff(coast, top, bottom, offset)), mats[mat]); edge.receiveShadow = true; group.add(edge);
  }
  // A subtle flattened clearing removes the toy pedestal impression without
  // adding a hard battle circle or protruding geometry under a character.
  add('cylinder', type === 'tide' ? 'cream' : type === 'star' ? 'lavender' : 'grass', 0, -.022, 0, 5.5, .045, 4.7, 0, .25, 0, false);

  if (type === 'tide') buildTide();
  else if (type === 'ember') buildEmber();
  else if (type === 'star') buildStar();
  else buildMeadow();

  // Low foreground garden edging frames, but never covers, the combatants.
  for (let j = 0; j < 24; j++) {
    const a = .15 + j / 23 * Math.PI * .82, r = 9.4 + Math.sin(j * 2.4) * .8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (type === 'tide') shell(x, z, .22 + j % 3 * .06, a);
    else if (type === 'ember') {
      add('leaf', j % 2 ? 'lightLeaf' : 'leaf', x, .035, z, .26, .06, .52, 0, a);
      if (j % 4 === 0) mushroom(x -.2, z, .36);
    } else flower(x, z, .33 + j % 3 * .09, type === 'star' ? 'lavender' : j % 2 ? 'rose' : 'white');
  }
  for (let j = 0; j < 13; j++) {
    const a = j / 12 * Math.PI + Math.PI, r = 12.5 + Math.sin(j) * .65;
    add('stone', 'rock', Math.cos(a) * r, .10, Math.sin(a) * r, .43 + j % 3 * .1, .36, .40, .1, a, .2);
  }

  for (const b of batches.values()) {
    const mesh = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length);
    b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = b.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  let disposed = false;
  group.userData.arenaType = type;
  group.userData.clearRadius = 5;
  group.userData.staticBatches = batches.size;
  return {
    group,
    animate(time) { if (!disposed) for (const motion of motions) motion(Number.isFinite(time) ? time : 0); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const value of allocated) value.dispose?.();
      group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    },
  };

  function tree(x, z, size = 1, gold = false) {
    const h = 4.7 * size;
    add('post', 'bark', x, h * .47, z, .45 * size, h * .94, .40 * size);
    for (const direction of [-1, 1]) beam([x, h * .52, z], [x + direction * 1.25 * size, h * .88, z -.10], .18 * size, 'bark');
    add('ball', 'leaf', x, h, z, 2.1 * size, 1.65 * size, 1.9 * size);
    add('ball', 'lightLeaf', x -1.15 * size, h -.65 * size, z + .15, 1.6 * size, 1.4 * size, 1.6 * size);
    add('ball', 'darkLeaf', x +1.15 * size, h -.55 * size, z -.15, 1.6 * size, 1.45 * size, 1.65 * size);
    if (gold) for (let j = 0; j < 3; j++) hangingLight(x + (j - 1) * 1.32 * size, h -.28, z + .5, .32 * size);
  }
  function bush(x, z, s = 1) {
    add('ball', 'darkLeaf', x, .4 * s, z, 1.08 * s, .75 * s, .85 * s);
    add('ball', 'leaf', x -.58 * s, .40 * s, z + .15, .70 * s, .66 * s, .70 * s);
    add('ball', 'lightLeaf', x + .48 * s, .41 * s, z -.12, .66 * s, .64 * s, .65 * s);
  }
  function flower(x, z, s, color) {
    add('post', 'darkLeaf', x, s * .45, z, .035, s * .9, .035, 0, 0, 0, false);
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * Math.PI * 2;
      add('ball', color, x + Math.cos(a) * s * .25, s, z + Math.sin(a) * s * .25, .22 * s, .075 * s, .15 * s, 0, -a, 0, false);
    }
    add('ball', 'gold', x, s + .04, z, .13 * s, .07 * s, .13 * s, 0, 0, 0, false);
  }
  function fence(points, material = 'paleWood') {
    for (let j = 0; j < points.length; j++) {
      const [x, z] = points[j];
      add('post', material, x, .75, z, .13, 1.5, .13);
      add('ball', 'cream', x, 1.52, z, .18, .16, .18);
      if (j) for (const y of [.58, 1.16]) beam([points[j - 1][0], y, points[j - 1][1]], [x, y, z], .073, material);
    }
  }
  function buildMeadow() {
    // A little gardener's cottage gives the clearing an inhabited, specific
    // place to belong to. Its door faces the battle and stays behind both actors.
    const x = -6.6, z = -8.6;
    add('cylinder', 'cream', x, 1.6, z, 2.25, 3.2, 2.25, 0, .1);
    add('cylinder', 'wood', x, .22, z, 2.4, .44, 2.4);
    add('cone', 'teal', x, 4.05, z, 3.15, 2.15, 3.15, 0, .1);
    add('cone', 'deepTeal', x, 3.1, z, 3.1, .4, 3.1, 0, .1);
    add('ball', 'teal', x, 5.14, z, .40, .25, .40);
    add('box', 'wood', x, 1.23, z +2.23, 1.18, 2.1, .12);
    add('ball', 'gold', x + .31, 1.2, z +2.32, .065, .065, .04);
    add('ball', 'window', x +1.45, 1.99, z +1.72, .50, .59, .08, 0, .55);
    add('torus', 'wood', x +1.48, 1.99, z +1.76, .56, .65, .4, 0, .55);
    add('box', 'paleWood', x, .12, z +2.72, 1.60, .24, .8);
    add('post', 'coral', x -1.78, .40, z +2.4, .44, .8, .44);
    for (let j = 0; j < 5; j++) add('leaf', 'leaf', x -1.78, .77, z +2.4, .45, .8, 1.0, -.6, j * 1.26);
    for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2; beam([x +Math.sin(a) * .3, 4.96, z +Math.cos(a) * .3], [x +Math.sin(a) * 2.9, 3.00, z +Math.cos(a) * 2.9], .047, 'deepTeal'); }
    tree(-11, -4.7, 1.10); tree(-10.5, -12, .85); tree(8.7, -8.7, 1.38); tree(3.3, -13, 1.08);
    // Living arbor: paired bent boughs meet above a wide empty path.
    const arc = new THREE.CatmullRomCurve3([new THREE.Vector3(1.5, 0, -8.8), new THREE.Vector3(1.6, 3.8, -9), new THREE.Vector3(3.5, 5.1, -9.4), new THREE.Vector3(5.6, 3.8, -9.2), new THREE.Vector3(5.9, 0, -8.8)]);
    const arch = new THREE.Mesh(own(new THREE.TubeGeometry(arc, 22, .22, 8, false)), mats.wood); arch.castShadow = true; group.add(arch);
    for (let j = 2; j < 10; j++) {
      const p = arc.getPoint(j / 12);
      add('ball', 'leaf', p.x, p.y + .10, p.z, .53, .34, .43);
      add('ball', j % 2 ? 'rose' : 'white', p.x + .13, p.y + .24, p.z + .28, .22, .19, .17);
    }
    fence([[-11, -.8], [-11.4, -3.2], [-9.9, -5.8]]);
    fence([[6.7, -6.2], [9, -4.8], [11, -2.4]]);
    for (const [x, z, s] of [[-9, -3.5, 1], [8, -6, 1.1], [11, -5, .8], [-2, -11, .8]]) bush(x, z, s);
    for (let j = 0; j < 28; j++) {
      const x = -10 + (j % 10) * 2.1, z = -6.4 - Math.floor(j / 10) * 1.4;
      if (Math.hypot(x, z) < 6.9) continue;
      flower(x + Math.sin(j) * .35, z, .48 + j % 3 * .15, j % 2 ? 'white' : 'rose');
    }
    bunting([-3.7, 4.1, -7.9], [.6, 4.0, -8.6]);
  }
  function buildTide() {
    const waterMat = own(new THREE.MeshStandardMaterial({color: '#8bcfc4', roughness: .28, metalness: .1}));
    const water = new THREE.Mesh(own(new THREE.CircleGeometry(70, 80)), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -.65; water.receiveShadow = true; group.add(water);
    const foamMat = own(new THREE.MeshBasicMaterial({color: '#def1d8', transparent: true, opacity: .48, depthWrite: false}));
    const foam = new THREE.Mesh(own(new THREE.RingGeometry(13.4, 13.54, 100)), foamMat); foam.rotation.x = -Math.PI / 2; foam.position.y = -.57; group.add(foam);
    motions.push(t => { foam.scale.setScalar(1 + Math.sin(t * .45) * .018); foamMat.opacity = .45 + Math.sin(t * .45) * .10; });
    // Four curving shell ribs form an open seaside shelter.
    const x = -6.5, z = -9.5;
    for (const dx of [-2.3, 2.3]) for (const dz of [-1.65, 1.65]) add('post', 'paleWood', x +dx, 1.7, z +dz, .15, 3.4, .15);
    for (let j = -3; j <= 3; j++) {
      add('ball', j % 2 ? 'white' : 'cream', x +j * .70, 4.0 - Math.abs(j) * .08, z, .66, .51, 2.7, 0, j * -.035, j * .04);
    }
    add('ball', 'coral', x, 4.68, z +1.4, .42, .35, .48);
    fence([[x -2.3, z -1.65], [x, z -1.65], [x +2.3, z -1.65]]);
    for (let j = -1; j <= 1; j++) hangingLight(x +j * .78, 3.8, z +1.8, .24, true);
    palm(-11.4, -4.3, 1.12, -.4); palm(7.7, -8.5, 1.30, .3); palm(11.7, -3, .96, -.7);
    // Friendly monumental shell spirals supply the counterpart to the tree.
    for (let j = 0; j < 3; j++) {
      const sx = 1.5 + j * 1.65, sz = -9.2 - Math.sin(j) * 1.0, scale = j === 1 ? 1.7 : 1.1;
      add('ball', j % 2 ? 'cream' : 'rose', sx, 1.35 * scale, sz, 1.0 * scale, 1.5 * scale, .75 * scale, 0, -.3, .13);
      add('torus', 'coral', sx + .13 * scale, 1.4 * scale, sz + .72 * scale, .59 * scale, .63 * scale, .80 * scale, .06, -.12, 0);
      add('torus', 'white', sx + .17 * scale, 1.4 * scale, sz + .75 * scale, .33 * scale, .36 * scale, .7 * scale, .06, -.12, 0);
    }
    for (let j = 0; j < 18; j++) {
      const x = -11 + j % 9 * 2.6, z = -5.8 - Math.floor(j / 9) * 4.8;
      if (Math.hypot(x, z) < 7) continue;
      shell(x, z, .30 + j % 3 * .09, j);
      for (let k = 0; k < 3; k++) add('leaf', k % 2 ? 'leaf' : 'lightLeaf', x + .45, 0, z, .18, .55, .75, -.8, k * 2.1 +j);
    }
    for (let j = 0; j < 6; j++) add('box', 'paleWood', -9.5 + j * .25, .045, -.4 +j * .48, 2.0, .08, .39, 0, -.4);
  }
  function buildEmber() {
    tree(-9, -7.2, 1.28, true); tree(5.8, -10.5, 1.53, true); tree(-1.7, -13, 1.18, true); tree(11.4, -4.5, .94, false);
    // A cozy little stone hearth house, intentionally unlit by actual fire.
    const x = -3.1, z = -9.2;
    add('ball', 'rock', x, 1.37, z, 1.7, 1.55, 1.5);
    add('cone', 'coral', x, 3.06, z, 2.13, 1.4, 2.13, 0, .08);
    add('cone', 'gold', x, 2.49, z, 2.1, .25, 2.1, 0, .08);
    add('box', 'wood', x, .91, z +1.42, .8, 1.52, .13);
    add('ball', 'window', x -.68, 1.7, z +1.33, .36, .41, .10);
    add('torus', 'wood', x -.68, 1.7, z +1.42, .40, .45, .50);
    add('post', 'rock', x + .54, 3.42, z -.3, .24, 1.45, .24);
    add('box', 'cream', x + .54, 4.15, z -.3, .55, .15, .55);
    for (const [x, z, h] of [[-8.4, -3.0, 3.5], [8.8, -4.6, 3.9], [1, -7.9, 3.2]]) lantern(x, z, h);
    fence([[-11.2, -2.6], [-10.9, -4.8], [-9.0, -6.1]], 'wood');
    for (let j = 0; j < 23; j++) {
      const x = -10.8 + j % 8 * 3.0, z = -5.6 - Math.floor(j / 8) * 2.1;
      if (Math.hypot(x, z) < 7) continue;
      mushroom(x, z, .55 + j % 3 * .23);
      add('leaf', 'lightLeaf', x + .35, .04, z + .3, .25, .05, .6, 0, j);
    }
    for (const [x, z] of [[-11, -4.0], [9.5, -6.5], [-6, -12]]) bush(x, z, 1.1);
    // A few lantern motes are background ornaments, never gameplay targets.
    const moteGeometry = own(new THREE.SphereGeometry(.055, 6, 4));
    const motes = new THREE.InstancedMesh(moteGeometry, mats.glow, 10); group.add(motes);
    motions.push(t => {
      for (let j = 0; j < 10; j++) { dummy.position.set(-8 + j *1.75 + Math.sin(t * .25 +j) * .3, 1.4 + Math.sin(t * .4 +j *2) * .7, -7.6 -j % 3); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); motes.setMatrixAt(j, dummy.matrix); }
      motes.instanceMatrix.needsUpdate = true;
    });
    motes.frustumCulled = false;
  }
  function buildStar() {
    tree(-10, -6.5, 1.15); tree(9, -7.7, 1.2);
    // Crescent garden, rather than a return to an abstract space background.
    for (let j = 0; j < 7; j++) {
      const a = Math.PI + j / 6 * Math.PI, x = Math.cos(a) * 6.7, z = -7 + Math.sin(a) * 3;
      const height = 1.9 + Math.sin(j / 6 * Math.PI) * 2.7;
      add('stone', 'rock', x, height * .5, z, .62, height * .65, .66, 0, a, .08);
      add('ball', 'lavender', x, height + .30, z, .28, .31, .28);
    }
    for (let j = 0; j < 27; j++) {
      const x = -11 + j % 9 * 2.7, z = -5.8 - Math.floor(j / 9) * 2.4;
      if (Math.hypot(x, z) > 7) flower(x, z, .5 + j % 3 * .15, j % 2 ? 'white' : 'lavender');
    }
    for (const [x, z] of [[-8.8, -3.5], [9, -4.5], [2, -12]]) bush(x, z, 1.0);
    lantern(-6.6, -4.5, 3.5); lantern(6.8, -4.7, 3.5);
  }
  function palm(x, z, s, angle) {
    for (let j = 0; j < 4; j++) {
      const a = j / 4, b = (j + 1) / 4;
      beam([x +a *a *s, a *5.2 *s, z], [x +b *b *s, b *5.2 *s, z], (.30 -.1 *a) *s, 'paleWood');
    }
    for (let j = 0; j < 7; j++) add('leaf', j % 2 ? 'darkLeaf' : 'leaf', x +s, 5.2 *s, z, 1.0 *s, 1.1 *s, 3.1 *s, .15, angle +j * .898, 0);
    add('ball', 'wood', x +s -.22, 5.0 *s, z + .17, .27 *s, .33 *s, .27 *s);
    add('ball', 'wood', x +s +.15, 4.8 *s, z -.15, .26 *s, .32 *s, .26 *s);
  }
  function shell(x, z, s, angle) {
    add('ball', 'cream', x, .25 *s, z, s, .55 *s, .75 *s, 0, angle, 0, false);
    for (let j = -1; j <= 1; j++) add('ball', 'coral', x +j *s *.28 *Math.cos(angle), .49 *s, z -j *s *.28 *Math.sin(angle), .06 *s, .11 *s, .55 *s, 0, angle, 0, false);
  }
  function mushroom(x, z, s) {
    add('post', 'cream', x, .36 *s, z, .12 *s, .72 *s, .12 *s);
    add('ball', 'coral', x, .72 *s, z, .50 *s, .27 *s, .50 *s, 0, 0, -.1);
    add('ball', 'white', x +.13 *s, .97 *s, z -.08, .08 *s, .02 *s, .09 *s);
  }
  function lantern(x, z, h) {
    add('post', 'wood', x, h *.5, z, .11, h, .11);
    beam([x, h -.15, z], [x + .65, h +.07, z], .085);
    hangingLight(x +.57, h, z, .34);
  }
  function hangingLight(x, y, z, s, tide = false) {
    add('post', 'rope', x, y -.36, z, .023, .72, .023);
    add('ball', tide ? 'blue' : 'glow', x, y -.98, z, s, s *1.45, s);
    add('cylinder', 'wood', x, y -.98 +s *1.36, z, s *.65, .09, s *.65);
    add('cylinder', 'wood', x, y -.98 -s *1.36, z, s *.65, .09, s *.65);
  }
  function bunting(a, b) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), middle = start.clone().add(end).multiplyScalar(.5); middle.y -= .7;
    const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
    const rope = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 14, .025, 4, false)), mats.rope); group.add(rope);
    const flagGeo = own(new THREE.BufferGeometry()); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.19, 0, 0, .19, 0, 0, 0, -.42, 0], 3)); flagGeo.computeVertexNormals();
    const flagMats = ['rose', 'gold', 'teal'].map(key => { const m = own(mats[key].clone()); m.side = THREE.DoubleSide; return m; });
    for (let j = 0; j < 6; j++) {
      const flag = new THREE.Mesh(flagGeo, flagMats[j % 3]); flag.position.copy(curve.getPoint((j +1) /7)); flag.rotation.y = -.15; group.add(flag);
      motions.push(t => { flag.rotation.x = Math.sin(t *1.4 + j) *.13; });
    }
  }
}

function terrain(coast) {
  const p = [0, 0, 0], indices = [], n = 96;
  for (let j = 0; j <= n; j++) { const a = j /n *Math.PI *2, r = coast(a); p.push(Math.cos(a) *r, 0, Math.sin(a) *r); if (j < n) indices.push(0, j +2, j +1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function cliff(coast, top, bottom, offset) {
  const p = [], indices = [], n = 96;
  for (let j = 0; j <= n; j++) { const a = j /n *Math.PI *2, r = coast(a) +offset; p.push(Math.cos(a) *r, top, Math.sin(a) *r, Math.cos(a) *(r -.28), bottom, Math.sin(a) *(r -.28)); if (j < n) { const k = j *2; indices.push(k, k +2, k +1, k +2, k +3, k +1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function leafGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, -.43,.18,.36, 0,.36,.50, .43,.18,.36, 0,.025,1, 0,-.02,0, -.43,.15,.36, 0,.30,.50, .43,.15,.36, 0,0,1], 3));
  g.setIndex([0,1,2, 0,2,3, 1,4,2, 2,4,3, 5,7,6, 5,8,7, 6,7,9, 7,8,9]); g.computeVertexNormals(); return g;
}
