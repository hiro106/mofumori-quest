import * as THREE from './vendor/three.module.js';

// A hand-authored, continuous island. The walking surface stays at y = 0
// through radius 58; small decorative clearings and paths are only overlays.
// All repeated scenery uses instancing, including the individual flower petals.
export function buildIsland() {
  const group = new THREE.Group();
  group.name = 'Mofumori island';
  const obstacles = [];
  const resources = new Set();
  const batches = new Map();
  const animated = [];
  const palettes = {
    earth: '#b5a779', sand: '#edcf95', chalk: '#f5deb1', path: '#dbc49a',
    wood: '#8c6650', bark: '#846452', darkWood: '#66554a', paleWood: '#b89169',
    pine: '#527866', leaf: '#7caa77', leafLight: '#a8c58b', leafDark: '#557e67',
    bloom: '#e9a7b4', cream: '#fff0c5', white: '#f5eddd',
    coral: '#dd967d', teal: '#67a9a1', darkTeal: '#3e7878',
    amber: '#d9a45f', gold: '#ebbd65', orange: '#c88756',
    rock: '#93a09b', paleRock: '#b9bcb0', blueRock: '#90aaa9',
    violet: '#a0a0bd', rope: '#c1ad86', door: '#465c5d',
    flag: '#e6b965', pondGlass: '#92ccc1',
  };
  const materials = {};
  for (const [key, color] of Object.entries(palettes)) {
    materials[key] = own(new THREE.MeshStandardMaterial({color, roughness: .9}));
  }
  materials.glow = own(new THREE.MeshStandardMaterial({color: '#ffdf92', emissive: '#f9b451', emissiveIntensity: .48, roughness: .65}));
  materials.star = own(new THREE.MeshStandardMaterial({color: '#dfd7ee', emissive: '#978bbb', emissiveIntensity: .15, roughness: .8}));
  materials.window = own(new THREE.MeshStandardMaterial({color: '#ffe2a3', emissive: '#ffbe6b', emissiveIntensity: .26, roughness: .65}));
  const geometry = {
    box: own(new THREE.BoxGeometry(1, 1, 1)),
    ball: own(new THREE.SphereGeometry(1, 10, 8)),
    smooth: own(new THREE.SphereGeometry(1, 16, 12)),
    cylinder: own(new THREE.CylinderGeometry(1, 1, 1, 12)),
    trunk: own(new THREE.CylinderGeometry(.72, 1, 1, 9)),
    cone: own(new THREE.ConeGeometry(1, 1, 10)),
    rock: own(new THREE.DodecahedronGeometry(1, 0)),
    torus: own(new THREE.TorusGeometry(1, .105, 6, 24)),
    leaf: own(makeLeaf()),
    petal: own(new THREE.SphereGeometry(1, 7, 5)),
  };
  const transform = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  let seed = 482713;
  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  function own(value) { resources.add(value); return value; }
  function inst(shape, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], shadow = true) {
    const geo = typeof shape === 'string' ? geometry[shape] : shape;
    const mat = typeof material === 'string' ? materials[material] : material;
    const key = `${geo.uuid}|${mat.uuid}|${shadow}`;
    if (!batches.has(key)) batches.set(key, {geometry: geo, material: mat, matrices: [], shadow});
    transform.position.set(...position);
    transform.rotation.set(...rotation);
    transform.scale.set(...scale);
    transform.updateMatrix();
    batches.get(key).matrices.push(transform.matrix.clone());
  }
  function beam(a, b, radius, material = 'wood', shape = 'cylinder') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const vector = end.clone().sub(start);
    const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, vector.clone().normalize()));
    inst(shape, material, start.add(end).multiplyScalar(.5).toArray(), [radius, vector.length(), radius], [euler.x, euler.y, euler.z]);
  }
  function solid(x, z, r) { obstacles.push({x, z, r}); }
  const protectedPoints = [
    [0, 12], [0, 17], [-25, -15], [-39, -28], [-17, -12], [-32, -5], [-38, -16], [-17, -31],
    [28, 17], [44, 25], [17, 20], [35, 6], [35, 32], [48, 9],
    [17, -30], [32, -38], [5, -22], [20, -16], [37, -20], [7, -42], [-5, -47],
  ];
  const pathSamples = [];
  function canPlace(x, z, radius = .7, paths = true) {
    if (Math.hypot(x, z) > 57.5 - radius) return false;
    if (protectedPoints.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.15 + radius)) return false;
    if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + radius + 1)) return false;
    if (paths && pathSamples.some(p => Math.hypot(p.x - x, p.z - z) < 2.0 + radius)) return false;
    return true;
  }

  // Gently scalloped coastline. Its innermost point is outside the walkable disk.
  const coast = angle => 61.6 + 1.2 * Math.sin(angle * 3 + .7) + .55 * Math.sin(angle * 7 - .5);
  const land = own(makeLand(coast));
  const landMaterial = own(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1}));
  const landMesh = new THREE.Mesh(land, landMaterial);
  landMesh.receiveShadow = true;
  group.add(landMesh);
  const bankMaterial = own(new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1, flatShading: true}));
  const bank = new THREE.Mesh(own(makeBank(coast)), bankMaterial);
  bank.receiveShadow = true;
  group.add(bank);

  // The sea is outside solid land; the island is never a translucent water disk.
  const oceanMaterial = own(new THREE.ShaderMaterial({
    uniforms: {time: {value: 0}},
    vertexShader: `varying vec3 point; void main(){ vec4 w=modelMatrix*vec4(position,1.); point=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float time; varying vec3 point;
      void main(){
        float d=length(point.xz); float h=clamp((d-60.)/100.,0.,1.);
        vec3 water=mix(vec3(.40,.72,.71),vec3(.39,.62,.66),h);
        float ripple=sin(point.x*.38+sin(point.z*.21+time*.23)*1.2+time*.33)*sin(point.z*.51-time*.27);
        float line=smoothstep(.90,.99,ripple)*.075;
        gl_FragColor=vec4(water+line,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const sea = new THREE.Mesh(own(new THREE.CircleGeometry(600, 100)), oceanMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -.68;
  group.add(sea);
  const foamMaterial = own(new THREE.MeshBasicMaterial({color: '#d4eee0', transparent: true, opacity: .62, depthWrite: false}));
  const foam = new THREE.Group();
  for (let i = 0; i < 13; i++) {
    const angle = i / 13 * Math.PI * 2;
    const arc = own(makeCoastFoam(coast, angle, .19 + random() * .16, 1.25 + random() * 1.5));
    const mesh = new THREE.Mesh(arc, foamMaterial);
    mesh.position.y = -.59;
    foam.add(mesh);
  }
  group.add(foam);

  // Broad, unbroken paths establish a recognizable route to each region.
  path([[0, 24], [0, 15], [-2, 3], [-12, -7], [-25, -15], [-34, -23], [-39, -28]], 2.7);
  path([[0, 12], [10, 13], [20, 17], [28, 17], [38, 21], [44, 25]], 2.8);
  path([[0, 6], [6, -6], [13, -19], [17, -30], [25, -34], [32, -38]], 2.65);
  path([[-25, -15], [-24, -28], [-18, -39], [-5, -47], [7, -43], [17, -30]], 1.75);
  path([[28, 17], [33, 11], [35, 6], [40, -6], [37, -20], [32, -38]], 1.8);
  path([[-25, -15], [-33, -14], [-41, -17], [-46, -17]], 1.9);
  path([[28, 17], [32, 29], [38, 35], [42.8, 35.9]], 1.9);
  path([[17, -30], [19, -39], [24, -46]], 1.8);

  // Camp: an open gathering place framed by a shingled round cabin, canvas
  // sleeping tent, welcome arch, crates, planted beds, and string pennants.
  disk(0, 12, 6.4, 'chalk', .009);
  cabin(-10.6, 11.8);
  tent(8.8, 7.4, -.20);
  arch(-.1, 4.7, 6.2, 5.6, 'teal');
  woodenSign(-4.5, 17.6, .25, 'leaf');
  supplyCart(-7.1, 22.0);
  bench(7.5, 18.8, -.2);
  planter(-6.4, 8.3, 1.3);
  planter(-13.8, 9.4, 1.15);
  campPennants();
  fireflyHouse(-14.8, 15.5, 1.1);

  // Three large silhouettes give each biome a destination of its own.
  flowerShrine(-49, -18);
  tidePavilion(42.8, 35.9);
  lanternTree(25.5, -48.4);
  starAltar(-5, -47);

  // Wayposts are offset from the exact interaction spots so a player can stand
  // on the pin without colliding with their scenery.
  woodenSign(-29.2, -18.5, -.4, 'leaf');
  woodenSign(23.6, 15.9, .3, 'wave');
  woodenSign(13.3, -33.1, .5, 'spark');

  // Keeper courts remain open and level. The rings are simple floor inlays,
  // rather than raised terrain that would disagree with the player controller.
  keeperCourt(-39, -28, 'leaf');
  keeperCourt(44, 25, 'teal');
  keeperCourt(32, -38, 'amber');

  // The outer tree line follows authored clearings and paths. Deterministic
  // scatter makes reloads match saved creature/waypoint positions exactly.
  let trees = 0;
  for (let attempt = 0; attempt < 2400 && trees < 49; attempt++) {
    const x = (random() - .5) * 112, z = (random() - .5) * 112;
    if (!canPlace(x, z, 1.0) || Math.hypot(x, z) < 15) continue;
    const region = regionAt(x, z);
    if (region === 'beach' && random() < .48) continue;
    const size = .8 + random() * .4;
    if (region === 'beach') palm(x, z, size, random() * 6.28);
    else tree(x, z, size, region === 'grove');
    trees++;
  }
  let rocks = 0;
  for (let attempt = 0; attempt < 800 && rocks < 27; attempt++) {
    const x = (random() - .5) * 116, z = (random() - .5) * 116;
    const radius = .65 + random() * .85;
    if (!canPlace(x, z, radius) || Math.hypot(x, z) < 19) continue;
    inst('rock', regionAt(x, z) === 'beach' ? 'blueRock' : 'rock', [x, radius * .48, z], [radius, radius * .7, radius * .88], [.1, random() * 6.28, .2]);
    solid(x, z, radius * .83);
    if (regionAt(x, z) !== 'beach') inst('ball', 'leaf', [x -.15, radius * .94, z], [radius * .78, .13, radius * .62], [0, random() * 6.28, .1], false);
    rocks++;
  }
  // Low details have no collision and are kept off the traveled paths.
  for (let i = 0; i < 510; i++) {
    const x = (random() - .5) * 118, z = (random() - .5) * 118;
    if (!canPlace(x, z, .12)) continue;
    const region = regionAt(x, z);
    if (region === 'beach') {
      if (random() < .47) shell(x, z, .14 + random() * .15, random() * 6.28);
      else beachGrass(x, z, .6 + random() * .4);
    } else if (region === 'grove') {
      if (random() < .3) mushroom(x, z, .45 + random() * .4);
      else leafPatch(x, z);
    } else {
      if (random() < .72) flower(x, z, .35 + random() * .55, random() < .5 ? 'bloom' : 'cream');
      else bush(x, z, .4 + random() * .35);
    }
  }
  // Small authored discoveries: a boat, oversized garden blooms, softly lit
  // archways, and a wooden footway above a dry sandy inlet (no hidden water).
  boat(52.1, 22, .5);
  driftwood(47, -2, -.35);
  windGarden(-44.4, -35.6);
  bench(-42.2, -8.5, .4);
  lantern(-7.8, -36.8, 2.7);
  lantern(10.8, -31, 2.7);
  lantern(25.4, -27.2, 2.9);
  lantern(34.3, -30.6, 2.6);
  littleBridge(17, 8.2);

  // Off-shore islets are scenery only and are deliberately beyond the walkable
  // coast. Their silhouettes add depth without suggesting reachable encounters.
  offshore(-87, -60, 9.5, 'leaf');
  offshore(96, -42, 7.7, 'gold');
  offshore(69, 84, 5.8, 'leaf');

  for (const entry of batches.values()) {
    const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, entry.matrices.length);
    for (let i = 0; i < entry.matrices.length; i++) mesh.setMatrixAt(i, entry.matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = entry.shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  const props = {
    walkingRadius: 58,
    camp: {x: 0, z: 12},
    landmarks: [
      {id: 'flower-shrine', x: -49, z: -18},
      {id: 'tide-pavilion', x: 42.8, z: 35.9},
      {id: 'lantern-tree', x: 25.5, z: -48.4},
      {id: 'star-altar', x: -5, z: -47},
    ],
    staticBatches: batches.size,
  };
  let disposed = false;
  return {
    group, props, obstacles,
    animate(time) {
      if (disposed) return;
      const t = Number.isFinite(time) ? time : 0;
      oceanMaterial.uniforms.time.value = t;
      foamMaterial.opacity = .5 + Math.sin(t * .38) * .10;
      foam.scale.setScalar(1 + Math.sin(t * .28) * .003);
      for (const fn of animated) fn(t);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const value of resources) value.dispose?.();
      // InstancedMesh owns an instance buffer distinct from its shared geometry.
      group.traverse(node => { if (node.isInstancedMesh) node.dispose(); });
    },
  };

  function disk(x, z, radius, material, y = .018) {
    inst('cylinder', material, [x, y - .016, z], [radius, .032, radius], [0, 0, 0], false);
  }
  function path(points, width) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, .026, z)), false, 'catmullrom', .35);
    const samples = curve.getPoints(Math.max(28, points.length * 15));
    pathSamples.push(...samples);
    const outer = new THREE.Mesh(own(ribbon(samples, width + .22)), materials.sand);
    outer.position.y = -.006;
    outer.receiveShadow = true;
    const inner = new THREE.Mesh(own(ribbon(samples, width)), materials.path);
    inner.receiveShadow = true;
    group.add(outer, inner);
    for (let i = 2; i < samples.length; i += 7) {
      const p = samples[i];
      inst('rock', 'chalk', [p.x + (random() - .5) * width * .8, .055, p.z + (random() - .5) * .5], [.09 + random() * .09, .028, .08], [0, random() * 6, 0], false);
    }
  }
  function tree(x, z, s, autumn = false) {
    const h = (4.8 + random() * 1.7) * s;
    inst('trunk', 'bark', [x, h * .44, z], [.47 * s, h * .88, .46 * s]);
    beam([x, h * .45, z], [x - 1.4 * s, h * .82, z + .3], .19 * s, 'bark', 'trunk');
    beam([x, h * .56, z], [x + 1.2 * s, h * .9, z -.4], .16 * s, 'bark', 'trunk');
    const colors = autumn ? ['amber', 'gold', 'orange'] : ['leaf', 'leafLight', 'leafDark'];
    inst('ball', colors[0], [x, h, z], [2.45 * s, 1.8 * s, 2.18 * s]);
    inst('ball', colors[1], [x - 1.4 * s, h - .75 * s, z + .35 * s], [1.62 * s, 1.40 * s, 1.69 * s]);
    inst('ball', colors[2], [x + 1.4 * s, h - .60 * s, z -.35 * s], [1.64 * s, 1.55 * s, 1.75 * s]);
    inst('ball', colors[1], [x -.25 * s, h + 1.18 * s, z], [1.45 * s, .87 * s, 1.40 * s]);
    for (let j = 0; j < 3; j++) {
      const a = j * 2.1;
      beam([x, .08, z], [x + Math.cos(a) * .92 * s, .055, z + Math.sin(a) * .92 * s], .20 * s, 'bark', 'trunk');
    }
    solid(x, z, .71 * s);
  }
  function palm(x, z, s, angle) {
    const h = 5.4 * s;
    const dx = Math.cos(angle) * 1.1 * s, dz = Math.sin(angle) * 1.1 * s;
    for (let j = 0; j < 5; j++) {
      const a = j / 5, b = (j + 1) / 5;
      beam([x + dx * a * a, h * a, z + dz * a * a], [x + dx * b * b, h * b, z + dz * b * b], (.34 -.13 * a) * s, j % 2 ? 'paleWood' : 'wood', 'trunk');
    }
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * Math.PI * 2 + angle;
      inst('leaf', j % 2 ? 'leaf' : 'pine', [x + dx, h, z + dz], [1.2 * s, 1.1 * s, 3.4 * s], [.15 + j % 2 * .17, a, 0]);
    }
    for (let j = 0; j < 3; j++) inst('ball', 'wood', [x + dx + Math.cos(j * 2) * .35, h -.4, z + dz + Math.sin(j * 2) * .35], [.3 * s, .38 * s, .3 * s]);
    solid(x, z, .65 * s);
  }
  function flower(x, z, s, color = 'bloom') {
    inst('trunk', 'leafDark', [x, s * .45, z], [.035, s * .9, .035], [0, 0, .1], false);
    inst('leaf', 'leaf', [x, s * .35, z], [.13 * s, .13 * s, .5 * s], [-.2, 1.1, -.7], false);
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * Math.PI * 2;
      inst('petal', color, [x + Math.cos(a) * .18 * s, s, z + Math.sin(a) * .18 * s], [.20 * s, .075 * s, .135 * s], [0, -a, 0], false);
    }
    inst('ball', 'gold', [x, s + .027, z], [.11 * s, .075 * s, .11 * s], [0, 0, 0], false);
  }
  function bush(x, z, s) {
    inst('ball', 'leaf', [x, .37 * s, z], [.85 * s, .65 * s, .7 * s]);
    inst('ball', 'leafLight', [x + .48 * s, .33 * s, z -.12], [.52 * s, .43 * s, .5 * s]);
    if (random() < .45) for (let j = 0; j < 3; j++) inst('ball', 'bloom', [x + (j - 1) * .3 * s, .76 * s, z + .1], [.08, .08, .08], [0, 0, 0], false);
  }
  function beachGrass(x, z, s) {
    for (let j = 0; j < 3; j++) inst('leaf', j % 2 ? 'leafLight' : 'leaf', [x, .015, z], [.13 * s, .65 * s, .8 * s], [-.9, j * 2.0, 0], false);
  }
  function shell(x, z, s, angle) {
    inst('ball', 'cream', [x, .11 * s, z], [s, .52 * s, s * .78], [0, angle, 0], false);
    for (let j = -1; j <= 1; j++) inst('ball', 'coral', [x + Math.cos(angle) * j * s * .28, .34 * s, z - Math.sin(angle) * j * s * .28], [.04 * s, .12 * s, .60 * s], [0, angle, 0], false);
  }
  function mushroom(x, z, s) {
    inst('trunk', 'cream', [x, .31 * s, z], [.095 * s, .63 * s, .095 * s], [0, 0, -.09], false);
    inst('ball', 'orange', [x, .61 * s, z], [.39 * s, .23 * s, .39 * s], [0, 0, -.08], false);
    inst('ball', 'cream', [x -.08 * s, .81 * s, z], [.06 * s, .023 * s, .06 * s], [0, 0, 0], false);
  }
  function leafPatch(x, z) {
    for (let j = 0; j < 3; j++) inst('leaf', j % 2 ? 'amber' : 'gold', [x + (random() -.5) * .5, .035, z + (random() -.5) * .5], [.18, .08, .43], [0, random() * 6.28, 0], false);
  }
  function bench(x, z, angle) {
    inst('box', 'paleWood', [x, .65, z], [2.6, .22, .82], [0, angle, 0]);
    const dx = Math.cos(angle) * .89, dz = -Math.sin(angle) * .89;
    for (const n of [-1, 1]) inst('trunk', 'wood', [x + dx * n, .27, z + dz * n], [.19, .54, .19]);
    inst('box', 'wood', [x -.38 * Math.sin(angle), 1.12, z -.38 * Math.cos(angle)], [2.6, .40, .12], [0, angle, -.03]);
    solid(x, z, 1.15);
  }
  function cabin(x, z) {
    solid(x, z, 3.4);
    disk(x, z, 4, 'sand');
    inst('cylinder', 'cream', [x, 1.55, z], [2.7, 3.1, 2.7], [0, Math.PI / 12, 0]);
    inst('cylinder', 'paleWood', [x, .24, z], [2.94, .48, 2.94]);
    inst('cone', 'teal', [x, 4.17, z], [3.66, 2.5, 3.66], [0, Math.PI / 12, 0]);
    inst('cone', 'darkTeal', [x, 3.35, z], [3.63, .60, 3.63], [0, Math.PI / 12, 0]);
    inst('ball', 'teal', [x, 5.4, z], [.46, .32, .46]);
    // Roof ribs form petal-like shingles instead of a single featureless cone.
    for (let j = 0; j < 10; j++) {
      const a = j / 10 * Math.PI * 2;
      beam([x + Math.sin(a) * .35, 5.18, z + Math.cos(a) * .35], [x + Math.sin(a) * 3.36, 3.13, z + Math.cos(a) * 3.36], .065, 'darkTeal');
    }
    // Front door faces the open center of camp (+X).
    inst('box', 'wood', [x + 2.7, 1.33, z], [.11, 2.1, 1.35]);
    inst('ball', 'gold', [x + 2.79, 1.22, z + .36], [.065, .08, .065]);
    inst('ball', 'window', [x + 1.02, 1.92, z + 2.42], [.60, .66, .08]);
    inst('torus', 'wood', [x + 1.02, 1.92, z + 2.48], [.67, .72, .45]);
    inst('box', 'wood', [x + 1.02, 1.92, z + 2.54], [.075, 1.20, .06]);
    inst('box', 'wood', [x + 1.02, 1.92, z + 2.54], [1.08, .075, .06]);
    inst('box', 'paleWood', [x + 3.05, .23, z], [1.10, .30, 2.0]);
    inst('box', 'wood', [x + 1.2, 4.8, z -.6], [.50, 1.40, .55]);
    inst('box', 'paleWood', [x + 1.2, 5.52, z -.6], [.68, .17, .73]);
    lantern(x + 3.2, z -1.5, 2.65);
  }
  function tent(x, z, angle) {
    solid(x, z, 2.65);
    const rotation = new THREE.Matrix4().makeRotationY(angle);
    const local = (a, y, b) => new THREE.Vector3(a, y, b).applyMatrix4(rotation).add(new THREE.Vector3(x, 0, z)).toArray();
    const canvas = own(new THREE.CylinderGeometry(0, 2.6, 3.8, 4, 1, false));
    inst(canvas, 'coral', [x, 1.94, z], [1, 1, 1.08], [0, angle + Math.PI / 4, 0]);
    inst('box', 'cream', local(0, 1.09, 1.43), [1.28, 1.93, .12], [0, angle, 0]);
    inst('box', 'door', local(0, .87, 1.51), [.76, 1.55, .13], [0, angle, 0]);
    for (const sign of [-1, 1]) {
      beam(local(0, 3.90, 0), local(sign * 2.8, .12, 1.8), .045, 'rope');
      inst('trunk', 'wood', local(sign * 2.8, .26, 1.8), [.07, .5, .07], [0, angle, sign * .2]);
    }
    inst('trunk', 'wood', [x, 4.06, z], [.065, .75, .065]);
    smallFlag(x, 4.30, z, 'flag', .9);
    planter(x + 2.5, z -1.5, .9);
  }
  function arch(x, z, width, height, color) {
    for (const direction of [-1, 1]) {
      const px = x + width * .5 * direction;
      inst('trunk', 'wood', [px, height * .5, z], [.24, height, .24]);
      inst('ball', 'paleWood', [px, height, z], [.34, .25, .34]);
      solid(px, z, .42);
    }
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x - width * .5, height -.3, z), new THREE.Vector3(x, height + .40, z), new THREE.Vector3(x + width * .5, height -.3, z));
    const mesh = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 16, .16, 6, false)), materials.wood);
    mesh.castShadow = true;
    group.add(mesh);
    inst('box', color, [x, height -.54, z], [2.40, .85, .13]);
    // A smiling leaf medallion; no language-dependent texture is needed.
    inst('ball', 'cream', [x, height -.5, z + .085], [.40, .30, .08]);
    for (const d of [-1, 1]) inst('ball', 'darkTeal', [x + d * .12, height -.46, z + .16], [.045, .055, .025]);
    inst('leaf', 'leaf', [x, height -.15, z + .09], [.25, .3, .52], [-.8, -.35, 0]);
  }
  function planter(x, z, s) {
    inst('trunk', 'coral', [x, .33 * s, z], [.53 * s, .66 * s, .53 * s]);
    inst('cylinder', 'darkWood', [x, .66 * s, z], [.39 * s, .03, .39 * s]);
    for (let j = 0; j < 3; j++) {
      const a = j * 2.1;
      inst('leaf', 'leaf', [x, .65 * s, z], [.4 * s, .8 * s, 1.15 * s], [-.5, a, 0]);
    }
  }
  function supplyCart(x, z) {
    solid(x, z, 1.6);
    inst('box', 'paleWood', [x, .70, z], [2.35, .24, 1.38]);
    for (const d of [-1, 1]) {
      inst('box', 'wood', [x, 1.18, z + d * .67], [2.40, .52, .12]);
      inst('torus', 'darkWood', [x -.60, .55, z + d * .84], [.55, .55, .80]);
      inst('cylinder', 'paleWood', [x -.60, .55, z + d * .84], [.11, .23, .11], [Math.PI / 2, 0, 0]);
      beam([x + 1.10, .75, z + d * .4], [x + 2.30, .32, z + d * .4], .075);
    }
    inst('box', 'coral', [x -.5, 1.27, z], [.7, .88, .84], [0, .16, 0]);
    inst('box', 'teal', [x +.35, 1.09, z], [.73, .54, .74], [0, -.09, 0]);
    inst('box', 'rope', [x -.5, 1.27, z], [.73, .12, .87], [0, .16, 0]);
  }
  function campPennants() {
    const a = new THREE.Vector3(-5.2, 4.5, 18), b = new THREE.Vector3(6, 4.6, 22);
    for (const p of [a, b]) { inst('trunk', 'wood', [p.x, p.y * .5, p.z], [.11, p.y, .11]); solid(p.x, p.z, .24); }
    const curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, 2.9, 20), b);
    const rope = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 20, .033, 4, false)), materials.rope);
    group.add(rope);
    for (let j = 1; j <= 9; j++) {
      const p = curve.getPoint(j / 10);
      const flagGeo = own(new THREE.BufferGeometry());
      flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.28, 0, 0, .28, 0, 0, 0, -.65, .035], 3));
      flagGeo.computeVertexNormals();
      const color = ['teal', 'coral', 'flag'][j % 3];
      const material = own(materials[color].clone()); material.side = THREE.DoubleSide;
      const flag = new THREE.Mesh(flagGeo, material);
      flag.position.copy(p); flag.rotation.y = -.34;
      group.add(flag);
      animated.push(t => { flag.rotation.x = Math.sin(t * 1.7 + j * .45) * .13; });
    }
  }
  function smallFlag(x, y, z, color, s = 1) {
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.1 * s, -.1 * s, 0, 0, -.56 * s, 0], 3));
    geo.computeVertexNormals();
    const mat = own(materials[color].clone()); mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z);
    group.add(mesh);
    animated.push(t => { mesh.rotation.y = Math.sin(t * 1.4 + x) * .18; });
  }
  function woodenSign(x, z, rotation, icon) {
    inst('trunk', 'wood', [x, 1.15, z], [.11, 2.3, .11]);
    inst('box', 'paleWood', [x, 1.88, z], [1.15, .72, .16], [0, rotation, .04]);
    // Direction arrow and a region-specific sculpted symbol.
    inst('cone', 'cream', [x + .54 * Math.cos(rotation), 1.88, z -.54 * Math.sin(rotation)], [.29, .43, .10], [0, rotation, -Math.PI / 2]);
    if (icon === 'leaf') inst('leaf', 'leafDark', [x -.2, 1.70, z + .12], [.28, .28, .68], [-1.1, .1, -.15]);
    else if (icon === 'wave') {
      for (let j = 0; j < 3; j++) inst('ball', 'darkTeal', [x -.32 + j * .2, 1.86 + Math.sin(j * 1.7) * .075, z + .12], [.16, .055, .05]);
    } else inst('cone', 'gold', [x -.13, 1.88, z + .13], [.21, .42, .06]);
    solid(x, z, .20);
  }
  function fireflyHouse(x, z, s) {
    inst('trunk', 'wood', [x, 1.5 * s, z], [.11 * s, 3 * s, .11 * s]);
    inst('box', 'cream', [x, 2.65 * s, z], [.74 * s, .83 * s, .61 * s]);
    inst('cone', 'coral', [x, 3.2 * s, z], [.71 * s, .65 * s, .71 * s], [0, Math.PI / 4, 0]);
    inst('ball', 'door', [x, 2.72 * s, z + .315 * s], [.17 * s, .21 * s, .055 * s]);
    inst('box', 'wood', [x, 2.34 * s, z + .41 * s], [.42 * s, .09 * s, .42 * s]);
    solid(x, z, .25 * s);
  }
  function flowerShrine(x, z) {
    solid(x, z, 2.65);
    inst('trunk', 'bark', [x, 3.1, z], [2.15, 6.2, 1.8]);
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * Math.PI * 2;
      beam([x, 2.7, z], [x + Math.sin(a) * 3.1, 6.0, z + Math.cos(a) * 2.7], .55, 'bark', 'trunk');
      inst('ball', j % 2 ? 'leafLight' : 'leaf', [x + Math.sin(a) * 3.05, 7.1 + j % 2 * .45, z + Math.cos(a) * 2.6], [3.9, 2.25, 3.4]);
      beam([x, .3, z], [x + Math.sin(a) * 3.4, .12, z + Math.cos(a) * 2.9], .43, 'bark', 'trunk');
    }
    inst('ball', 'leafLight', [x, 8.8, z], [3.8, 2.1, 3.25]);
    for (let j = 0; j < 19; j++) {
      const a = j * 2.4, r = 1.9 + random() * 3.3;
      const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r, by = 7.5 + random() * 2.4;
      for (let p = 0; p < 5; p++) {
        const pa = p / 5 * Math.PI * 2;
        inst('petal', 'bloom', [bx + Math.cos(pa) * .36, by, bz + Math.sin(pa) * .36], [.42, .17, .25], [0, -pa, .1]);
      }
      inst('ball', 'cream', [bx, by + .10, bz], [.21, .16, .21]);
    }
    // A little sealed root door, framed by an actual curved wooden arch.
    inst('ball', 'door', [x + 1.7, 1.30, z + .9], [.12, 1.22, .70], [0, -.65, 0]);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + 1.8, .10, z + .12), new THREE.Vector3(x + 2, 1.75, z + .3),
      new THREE.Vector3(x + 1.8, 2.40, z + .88), new THREE.Vector3(x + 1.20, 1.7, z + 1.6), new THREE.Vector3(x + 1.08, .10, z + 1.73),
    ]);
    const arch = new THREE.Mesh(own(new THREE.TubeGeometry(curve, 20, .14, 6, false)), materials.paleWood);
    group.add(arch);
    for (const dz of [-3.5, 3.6]) lantern(x + 4.2, z + dz, 2.4);
    for (let j = 0; j < 8; j++) flower(x + 3 + Math.cos(j * .6) * 2, z - 3.6 + j * 1.0, 1.1, 'bloom');
  }
  function tidePavilion(x, z) {
    // A shell-shaped lookout with a scalloped roof and an open central aisle.
    disk(x, z, 3.6, 'chalk');
    for (const [dx, dz] of [[-2.4, -1.9], [2.4, -1.9], [-2.4, 1.9], [2.4, 1.9]]) {
      inst('trunk', 'paleWood', [x + dx, 1.73, z + dz], [.16, 3.46, .16]);
      solid(x + dx, z + dz, .28);
    }
    for (let j = -3; j <= 3; j++) {
      const angle = j * .20;
      inst('ball', j % 2 ? 'cream' : 'chalk', [x + Math.sin(angle) * 3.4, 3.8 + Math.cos(angle) * .45, z + .2], [.76, .44, 3.0], [0, -angle * .40, angle * .16]);
    }
    inst('ball', 'coral', [x, 4.65, z + 1.7], [.48, .43, .55]);
    beam([x -2.4, 1.0, z +1.9], [x +2.4, 1.0, z +1.9], .08, 'rope');
    for (const d of [-1, 1]) {
      inst('ball', 'blueRock', [x + d * 3.8, .60, z + 1.7], [.68, .8, .8]);
      shell(x + d * 3.8, z + 1.7, .60, d * .5);
      solid(x + d * 3.8, z + 1.7, .75);
    }
    // Three tide chimes hang from the roof edge; each pendulum moves softly.
    for (let j = -1; j <= 1; j++) {
      const pendulum = new THREE.Group(); pendulum.position.set(x + j * .9, 3.63, z -2.2);
      const cord = new THREE.Mesh(geometry.cylinder, materials.rope); cord.scale.set(.022, .7, .022); cord.position.y = -.35;
      const chime = new THREE.Mesh(geometry.ball, materials.pondGlass); chime.scale.set(.15, .34, .15); chime.position.y = -.88;
      pendulum.add(cord, chime); group.add(pendulum);
      animated.push(t => { pendulum.rotation.z = Math.sin(t * 1.1 + j) * .055; });
    }
  }
  function lanternTree(x, z) {
    solid(x, z, 1.8);
    inst('trunk', 'bark', [x, 3.0, z], [1.2, 6, 1.10]);
    for (let j = 0; j < 5; j++) {
      const a = j * 1.26, bx = x + Math.cos(a) * 3.0, bz = z + Math.sin(a) * 2.9;
      beam([x, 3.4, z], [bx, 6.8, bz], .35, 'bark', 'trunk');
      inst('ball', j % 2 ? 'gold' : 'amber', [bx, 7.2 + j % 2 * .7, bz], [3.2, 1.9, 2.6]);
      const ly = 3.4 + j % 2 * .7;
      beam([bx, 6.7, bz], [bx, ly + .65, bz], .025, 'rope');
      inst('ball', 'glow', [bx, ly, bz], [.44, .64, .44]);
      inst('cylinder', 'wood', [bx, ly -.60, bz], [.24, .12, .24]);
      inst('cylinder', 'wood', [bx, ly +.60, bz], [.24, .12, .24]);
    }
    inst('ball', 'gold', [x, 9, z], [3.9, 1.95, 3.4]);
    for (let j = 0; j < 5; j++) {
      const a = j * 1.26;
      beam([x, .12, z], [x + Math.cos(a) * 2.5, .04, z + Math.sin(a) * 2.5], .32, 'bark');
    }
    // Autumn wind spirals a handful of leaves; most foliage remains instanced.
    for (let j = 0; j < 7; j++) {
      const leaf = new THREE.Mesh(geometry.leaf, materials[j % 2 ? 'gold' : 'orange']);
      leaf.scale.set(.20, .13, .46); group.add(leaf);
      animated.push(t => {
        const phase = (t * .11 + j / 7) % 1, a = t * .22 + j * 2.4;
        leaf.position.set(x + Math.cos(a) * (2 + phase * 2), 6.5 * (1 - phase) + .3, z + Math.sin(a) * (2 + phase * 2));
        leaf.rotation.set(Math.sin(a) * .6, a * 1.7, Math.sin(a * .7) * .4);
      });
    }
  }
  function starAltar(x, z) {
    disk(x, z, 4.3, 'paleRock', .010);
    disk(x, z, 3.85, 'violet', .022);
    disk(x, z, 3.65, 'paleRock', .028);
    const star = own(makeStar(2.6, 1.2, .034));
    const mesh = new THREE.Mesh(star, materials.star); mesh.position.set(x, 0, z); group.add(mesh);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      // Only four small stones, well beyond the encounter's four-meter space.
      const px = x + Math.cos(angle) * 5.6, pz = z + Math.sin(angle) * 5.6;
      inst('rock', 'paleRock', [px, .52, pz], [.67, 1.10, .62], [0, angle, -.06]);
      inst('ball', 'star', [px, 1.48, pz], [.25, .23, .25]);
      solid(px, pz, .66);
    }
    // Low crescent behind the altar, with an open foreground for the player.
    for (let j = 0; j < 9; j++) {
      const a = Math.PI + j / 8 * Math.PI;
      const px = x + Math.cos(a) * 6.7, pz = z + Math.sin(a) * 6.7;
      inst('rock', j % 2 ? 'blueRock' : 'paleRock', [px, .28 + Math.sin(j * .7) * .06, pz], [.67, .42, .46], [0, -a, .1]);
      solid(px, pz, .65);
    }
  }
  function keeperCourt(x, z, color) {
    disk(x, z, 3.4, 'sand', .009);
    inst('torus', color, [x, .035, z], [3.15, 3.15, .17], [Math.PI / 2, 0, 0], false);
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * Math.PI * 2;
      inst('leaf', color, [x + Math.cos(a) * 2.58, .045, z + Math.sin(a) * 2.58], [.12, .03, .38], [0, -a, 0], false);
    }
  }
  function lantern(x, z, height) {
    inst('trunk', 'wood', [x, height * .5, z], [.10, height, .10]);
    beam([x, height -.15, z], [x + .57, height + .02, z], .07);
    beam([x + .53, height, z], [x + .53, height -.40, z], .025, 'rope');
    inst('ball', 'glow', [x + .53, height -.72, z], [.28, .40, .28]);
    inst('cylinder', 'wood', [x + .53, height -1.08, z], [.19, .08, .19]);
    inst('cylinder', 'wood', [x + .53, height -.36, z], [.19, .08, .19]);
    solid(x, z, .20);
  }
  function boat(x, z, angle) {
    solid(x, z, 2.1);
    const q = new THREE.Quaternion().setFromAxisAngle(up, angle);
    const pos = (dx, y, dz) => new THREE.Vector3(dx, y, dz).applyQuaternion(q).add(new THREE.Vector3(x, 0, z)).toArray();
    inst('ball', 'teal', [x, .57, z], [1.14, .69, 2.25], [.02, angle, .08]);
    inst('ball', 'darkWood', [x, .93, z], [.88, .10, 1.88], [.02, angle, .08]);
    inst('box', 'paleWood', pos(0, 1.03, -.48), [1.60, .14, .37], [0, angle, .08]);
    inst('box', 'paleWood', pos(0, 1.00, .77), [1.60, .14, .37], [0, angle, .08]);
    beam(pos(-1.45, 1.17, -1.5), pos(1.1, .75, 1.45), .048, 'paleWood');
    inst('ball', 'paleWood', pos(1.22, .72, 1.58), [.19, .035, .47], [0, angle -.65, 0]);
    inst('torus', 'rope', pos(-.68, 1.05, .9), [.30, .30, .7], [Math.PI / 2, 0, 0]);
  }
  function driftwood(x, z, angle) {
    inst('trunk', 'paleWood', [x, .38, z], [.42, 3.9, .42], [Math.PI / 2, angle, .1]);
    beam([x, .42, z], [x + 1.1, .92, z + .75], .15, 'paleWood', 'trunk');
    solid(x, z, 1.5);
  }
  function windGarden(x, z) {
    for (let j = 0; j < 3; j++) {
      const px = x + (j - 1) * 2.1, pz = z + Math.sin(j * 2) * 1.1, height = 2.1 + j % 2 * .8;
      inst('trunk', 'leafDark', [px, height * .5, pz], [.11, height, .11], [0, 0, .12]);
      const head = new THREE.Group(); head.position.set(px, height, pz);
      const petals = new THREE.InstancedMesh(geometry.petal, materials[j % 2 ? 'cream' : 'bloom'], 6);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        transform.position.set(Math.cos(a) * .45, Math.sin(a) * .45, 0);
        transform.rotation.set(0, 0, a); transform.scale.set(.58, .25, .14); transform.updateMatrix();
        petals.setMatrixAt(k, transform.matrix);
      }
      petals.instanceMatrix.needsUpdate = true; petals.computeBoundingSphere(); head.add(petals);
      const center = new THREE.Mesh(geometry.ball, materials.gold); center.scale.set(.22, .22, .15); center.position.z = .1; head.add(center);
      group.add(head);
      animated.push(t => { head.rotation.z = t * .12 + j; });
    }
  }
  function littleBridge(x, z) {
    // A charming little boardwalk, flush to the walking surface, across dry
    // golden reeds. It has no false holes and no raised controller barrier.
    for (let j = 0; j < 11; j++) inst('box', j % 2 ? 'paleWood' : 'wood', [x, .06, z + (j - 5) * .35], [2.5, .10, .30]);
    for (const dx of [-1.35, 1.35]) {
      for (const dz of [-1.9, 1.9]) {
        inst('trunk', 'wood', [x + dx, .66, z + dz], [.09, 1.32, .09]);
        solid(x + dx, z + dz, .16);
      }
      beam([x + dx, 1.1, z -1.9], [x + dx, 1.1, z +1.9], .065, 'rope');
    }
  }
  function offshore(x, z, s, color) {
    inst('rock', 'sand', [x, -1.8, z], [s, 3.3, s * .8]);
    inst('ball', 'leaf', [x, .25, z], [s * .75, 1.0, s * .58]);
    inst('trunk', 'wood', [x, 2.2, z], [.40, 4.4, .40]);
    inst('ball', color, [x, 5, z], [2.8, 2.1, 2.4]);
    inst('ball', color, [x + 1.8, 4.6, z + .2], [1.8, 1.3, 1.6]);
  }
}

function regionAt(x, z) {
  if (z < -19 && x > -1) return 'grove';
  if (x > 18 && z > -14) return 'beach';
  return 'grass';
}

function makeLand(coast) {
  const vertices = [], colors = [], indices = [];
  const segments = 128, rings = 22;
  const grass = new THREE.Color('#a8bd86'), light = new THREE.Color('#b4c791');
  const sand = new THREE.Color('#ecd29b'), amber = new THREE.Color('#c7b184');
  const c = new THREE.Color();
  const blend = (a, b, t) => { t = Math.max(0, Math.min(1, t)); return a + (b - a) * t * t * (3 - 2 * t); };
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const r = coast(angle) * j / rings;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      vertices.push(x, 0, z);
      c.copy(grass).lerp(light, (Math.sin(x * .21) * Math.sin(z * .17) + 1) * .22);
      const beach = blend(0, 1, (x - 13) / 15) * blend(0, 1, (z + 21) / 18);
      const grove = blend(0, 1, (x + 4) / 18) * blend(0, 1, (-z -12) / 20);
      c.lerp(sand, beach).lerp(amber, grove * .82);
      // A warm continuous rim makes the solid shoreline easy to read.
      c.lerp(sand, blend(0, 1, (r - 56.7) / 4.2) * .87);
      colors.push(c.r, c.g, c.b);
      if (j < rings && i < segments) {
        const a = j * (segments + 1) + i, b = a + segments + 1;
        indices.push(a, b + 1, b, a, a + 1, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

function makeBank(coast) {
  const p = [], c = [], index = [], count = 128;
  const levels = [{y: .002, add: 0, color: '#e3c891'}, {y: -.34, add: .3, color: '#d6b47e'}, {y: -1.5, add: -.8, color: '#b89976'}, {y: -4, add: -3, color: '#95a098'}];
  for (let j = 0; j < levels.length; j++) {
    const color = new THREE.Color(levels[j].color);
    for (let i = 0; i <= count; i++) {
      const a = i / count * Math.PI * 2, r = coast(a) + levels[j].add;
      p.push(Math.cos(a) * r, levels[j].y, Math.sin(a) * r);
      c.push(color.r, color.g, color.b);
      if (j < levels.length - 1 && i < count) { const k = j * (count + 1) + i; index.push(k, k + 1, k + count + 1, k + 1, k + count + 2, k + count + 1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.setIndex(index); g.computeVertexNormals(); return g;
}

function ribbon(points, width) {
  const position = [], index = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
    const tangent = after.clone().sub(before).normalize();
    const dx = -tangent.z * width * .5, dz = tangent.x * width * .5;
    position.push(p.x + dx, p.y, p.z + dz, p.x - dx, p.y, p.z - dz);
    if (i < points.length - 1) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); g.setIndex(index); g.computeVertexNormals(); return g;
}

function makeLeaf() {
  const g = new THREE.BufferGeometry();
  // A curved, slightly cupped lance shape, pointing along local +Z.
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -.43, .20, .37, 0, .35, .52, .43, .20, .37, 0, .04, 1,
    0, -.015, 0, -.43, .17, .37, 0, .30, .52, .43, .17, .37, 0, .015, 1,
  ], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3, 5, 7, 6, 5, 8, 7, 6, 7, 9, 7, 8, 9]);
  g.computeVertexNormals(); return g;
}

function makeCoastFoam(coast, start, length, offset) {
  const p = [], indices = [], count = 14;
  for (let i = 0; i <= count; i++) {
    const a = start + i / count * length;
    const center = coast(a) + offset;
    const w = Math.sin(i / count * Math.PI) * .20;
    for (const r of [center - w, center + w]) p.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    if (i < count) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

function makeStar(outer, inner, y) {
  const p = [0, y, 0], indices = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? inner : outer; p.push(Math.cos(a) * r, y, Math.sin(a) * r); if (i < 10) indices.push(0, i + 2, i + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
