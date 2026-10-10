import * as THREE from './vendor/three.module.js';

const NAMES = {meadow: '花守りのミモ', shore: '波守りのナギ', grove: '灯守りのアン'};
const PALETTES = {
  meadow: {skin: '#e9bc9d', hair: '#815f4b', coat: '#79a988', accent: '#e4a8b8', trousers: '#f4d9af', shoes: '#8e705a', hat: '#ead39b'},
  shore: {skin: '#c99577', hair: '#685847', coat: '#6eaab7', accent: '#eebd70', trousers: '#eee0b9', shoes: '#477f87', hat: '#e9cb8d'},
  grove: {skin: '#dda98e', hair: '#4f5059', coat: '#cb8d61', accent: '#8daba0', trousers: '#64757b', shoes: '#6f5f57', hat: '#dbac74'},
};
const COLOR = {eye: '#334749', white: '#fff5db', cheek: '#dd918e', wood: '#927258', leaf: '#73a17b', gold: '#e6bb64', cream: '#f5deb3', rope: '#c9b68f', lantern: '#ffe0a1'};

/**
 * Original island caretakers. All are +Z facing, feet at y=0 and around 1.7m
 * tall (a staff/hat flower may extend slightly above the head).
 * Options: scale (finite positive number), detail:'low', greeting:boolean.
 * The caller owns placement and orientation; animate never changes the root.
 */
export function buildKeeper(id, options = {}) {
  if (!Object.hasOwn(NAMES, id)) id = 'meadow';
  const p = PALETTES[id], low = options.detail === 'low';
  const group = new THREE.Group(); group.name = NAMES[id]; group.userData.keeper = id;
  const scale = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
  group.scale.setScalar(scale);
  const allocated = new Set();
  const own = value => { allocated.add(value); return value; };
  const material = own(new THREE.MeshStandardMaterial({vertexColors: true, roughness: .72, metalness: .015}));
  const lightMaterial = own(new THREE.MeshStandardMaterial({vertexColors: true, roughness: .75, emissive: '#edba6a', emissiveIntensity: .38}));
  const segments = low ? 10 : 14;
  const source = {
    sphere: new THREE.SphereGeometry(1, segments, low ? 7 : 10),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, segments),
    cone: new THREE.ConeGeometry(1, 1, segments),
    torus: new THREE.TorusGeometry(1, .095, 6, low ? 16 : 22),
    box: new THREE.BoxGeometry(1, 1, 1),
    leaf: leafGeometry(),
  };
  const primitives = {};
  for (const [name, g] of Object.entries(source)) { primitives[name] = own(g.index ? g.toNonIndexed() : g); if (g !== primitives[name]) g.dispose(); }
  const parts = [], motions = [];
  function part(name, at = [0, 0, 0], parent = group) {
    const node = new THREE.Group(); node.name = name; node.position.fromArray(at); parent.add(node);
    node.userData.keeperBatches = {solid: {p: [], n: [], c: []}, glow: {p: [], n: [], c: []}};
    parts.push(node); return node;
  }
  const feet = part('boots and stance');
  const torso = part('breathing coat');
  const head = part('face and hat', [0, 1.29, 0]);
  const eyes = part('blinking eyes', [0, .021, 0], head);
  const greeting = part('welcoming hand', [-.27, 1.02, .015]);
  const held = part('held tool', [.48, .91, .14]);

  function add(node, shape, position, sizes, color, rotation = [0, 0, 0], glow = false) {
    let geometry;
    if (typeof shape === 'string') geometry = primitives[shape];
    else { geometry = shape.index ? shape.toNonIndexed() : shape; if (geometry !== shape) shape.dispose(); }
    const q = rotation?.isQuaternion ? rotation : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...sizes));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const target = node.userData.keeperBatches[glow ? 'glow' : 'solid'];
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), tint = new THREE.Color(color);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      target.p.push(point.x, point.y, point.z); target.n.push(normal.x, normal.y, normal.z); target.c.push(tint.r, tint.g, tint.b);
    }
    if (typeof shape !== 'string') geometry.dispose();
  }
  const ball = (node, position, sizes, color, rotation, glow) => add(node, 'sphere', position, sizes, color, rotation, glow);
  function rod(node, start, end, radius, color) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    add(node, 'cylinder', a.add(b).multiplyScalar(.5).toArray(), [radius, direction.length(), radius], color, q);
  }
  function curve(node, points, radius, color, glow = false) {
    const spline = new THREE.CatmullRomCurve3(points.map(a => new THREE.Vector3(...a)));
    add(node, new THREE.TubeGeometry(spline, low ? 10 : 16, radius, 5, false), [0, 0, 0], [1, 1, 1], color, [0, 0, 0], glow);
  }
  function blossom(node, center, radius, color, face = false) {
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * Math.PI * 2;
      const pos = face ? [center[0] + Math.cos(a) * radius * .57, center[1] + Math.sin(a) * radius * .57, center[2]] : [center[0] + Math.cos(a) * radius * .57, center[1], center[2] + Math.sin(a) * radius * .57];
      ball(node, pos, face ? [radius * .59, radius * .29, radius * .20] : [radius * .59, radius * .20, radius * .29], color, face ? [0, 0, a] : [0, -a, 0]);
    }
    ball(node, face ? [center[0], center[1], center[2] + radius * .16] : [center[0], center[1] + radius * .16, center[2]], [radius * .32, radius * .28, radius * .28], COLOR.gold);
  }

  // Legs and broad rounded shoes make the contact with the ground unambiguous.
  for (const direction of [-1, 1]) {
    const x = direction * .118;
    add(feet, 'cylinder', [x, .31, 0], [.073, .37, .077], p.trousers);
    ball(feet, [x, .081, .038], [.116, .081, .173], p.shoes);
    add(feet, 'cylinder', [x, .19, -.003], [.083, .16, .09], p.shoes);
    ball(feet, [x, .144, .08], [.071, .014, .07], p.trousers);
  }
  // A pear-shaped cloth body, sleeves and neck. Cuffs read at map scale.
  ball(torso, [0, .75, 0], [.255, .33, .186], p.coat);
  add(torso, 'cylinder', [0, .52, 0], [.25, .09, .187], p.coat);
  add(torso, 'cylinder', [0, 1.063, 0], [.085, .16, .083], p.skin);
  for (const direction of [-1, 1]) {
    ball(torso, [direction * .105, 1.005, .091], [.096, .055, .077], COLOR.cream, [0, 0, direction * .35]);
  }
  // Right arm holds each keeper's distinguishing tool beside their body.
  rod(torso, [.227, .98, .006], [.38, .84, .04], .095, p.coat);
  rod(torso, [.38, .84, .04], [.48, .92, .16], .071, p.skin);
  ball(torso, [.48, .925, .16], [.078, .071, .077], p.skin);
  add(torso, 'cylinder', [.326, .87, .025], [.091, .075, .087], p.accent, [0, 0, -.8]);

  // Greeting hand rises to one side: readable from the standard top-down view,
  // with a little thumb silhouette, not a sphere merely spinning in place.
  rod(greeting, [0, 0, 0], [-.16, -.12, .03], .085, p.coat);
  rod(greeting, [-.16, -.12, .03], [-.25, .095, .045], .060, p.skin);
  ball(greeting, [-.26, .14, .043], [.081, .099, .048], p.skin, [0, 0, -.2]);
  ball(greeting, [-.193, .142, .074], [.035, .050, .031], p.skin, [0, 0, -.35]);
  add(greeting, 'cylinder', [-.158, -.098, .03], [.075, .065, .075], p.accent, [0, 0, -.35]);

  // Head with back hair, visible ears and friendly small features.
  ball(head, [0, -.005, -.044], [.296, .293, .268], p.hair);
  ball(head, [0, -.022, .036], [.262, .264, .23], p.skin);
  for (const direction of [-1, 1]) {
    ball(head, [direction * .268, -.010, .006], [.067, .086, .055], p.skin);
    ball(head, [direction * .278, -.010, .046], [.029, .042, .014], COLOR.cheek);
    ball(head, [direction * .15, -.074, .240], [.044, .024, .015], COLOR.cheek);
    ball(eyes, [direction * .09, 0, .269], [.025, .039, .017], COLOR.eye);
    ball(eyes, [direction * .09 -.007, .012, .282], [.0075, .010, .005], COLOR.white);
    curve(head, [[direction * .12, .088, .251], [direction * .09, .099, .258], [direction * .062, .091, .261]], .007, p.hair);
  }
  ball(head, [0, -.043, .270], [.026, .028, .027], p.skin);
  curve(head, [[-.043, -.102, .251], [0, -.118, .258], [.043, -.102, .251]], .009, '#916a61');
  for (let j = 0; j < 5; j++) {
    ball(head, [(j -2) * .083, .188 - Math.abs(j -2) * .012, .166], [.081, .069, .095], p.hair, [0, 0, -.2 + j *.1]);
  }

  if (id === 'meadow') meadow();
  else if (id === 'shore') shore();
  else grove();

  for (const node of parts) {
    const records = node.userData.keeperBatches;
    for (const [key, data] of Object.entries(records)) {
      if (!data.p.length) continue;
      const g = own(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(data.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(data.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(data.c, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, key === 'glow' ? lightMaterial : material);
      mesh.name = `${node.name}: ${key}`; mesh.castShadow = true; mesh.receiveShadow = true; node.add(mesh);
    }
    delete node.userData.keeperBatches;
  }
  const phase = id === 'meadow' ? .1 : id === 'shore' ? 1.8 : 3.3;
  let disposed = false;
  return {
    group,
    animate(time) {
      if (disposed) return;
      const t = Number.isFinite(time) ? time : 0;
      // Roots never move. Only upper-body parts breathe/gesture, so NPCs do not
      // drift away from their interaction marker and their boots stay grounded.
      torso.scale.y = 1 + Math.sin(t *1.25 + phase) * .006;
      head.rotation.z = Math.sin(t *.65 + phase) * .027;
      head.rotation.y = Math.sin(t *.31 + phase) * .045;
      greeting.rotation.z = -.03 + (options.greeting === false ? .035 : .13) * Math.sin(t *2.1 + phase);
      greeting.rotation.x = Math.sin(t *1.2 + phase) * .045;
      const cycle = (Math.max(0, t) + phase) % 5.7;
      const blink = cycle > 5.42 ? Math.max(.06, Math.abs((cycle -5.56) / .14)) : 1;
      eyes.scale.y = Math.min(1, blink);
      for (const motion of motions) motion(t);
    },
    dispose() { if (disposed) return; disposed = true; for (const value of allocated) value.dispose?.(); },
  };

  function meadow() {
    // A leaf cape and scalloped cream skirt, with a blossom for a brooch.
    for (let j = 0; j < 5; j++) {
      const a = (j -2) * .30;
      add(torso, 'leaf', [Math.sin(a) * .21, .90, .075 +Math.cos(a) * .12], [.14, .30, .06], p.coat, [0, 0, -a * .8]);
      ball(torso, [(j -2) * .088, .469, .109], [.067, .05, .109], COLOR.cream);
    }
    blossom(torso, [.07, .965, .198], .047, p.accent, true);
    // Petal hat: a green bowl with six unmistakable pink petal lobes.
    add(head, 'cylinder', [0, .272, -.015], [.43, .045, .40], p.hat, [0, 0, -.035]);
    ball(head, [0, .324, -.015], [.286, .128, .27], p.hat);
    for (let j = 0; j < 6; j++) {
      const a = j /6 *Math.PI *2;
      ball(head, [Math.cos(a) *.285, .28, Math.sin(a) *.255 -.015], [.23, .058, .14], p.accent, [0, -a, .045]);
    }
    blossom(head, [-.25, .378, .095], .115, COLOR.white);
    add(head, 'leaf', [-.31, .345, .015], [.16, .20, .045], COLOR.leaf, [-.25, -.2, .3]);
    // Short braids and ribbons are visible from both the front and behind.
    for (const d of [-1, 1]) {
      for (let j = 0; j < 3; j++) ball(head, [d *(.263 +j *.009), -.10 -j *.076, -.035], [.061 -j *.008, .063, .067], p.hair);
      ball(head, [d *.28, -.282, -.018], [.09, .027, .06], p.accent);
    }
    // Flower staff: lower end is close to the ground and a leaf curls below
    // the large flower. It remains a friendly gardening tool, not a weapon.
    curve(held, [[.02, -.86, .02], [.015, -.32, .00], [.03, .32, -.01], [.07, .70, 0]], .029, COLOR.wood);
    blossom(held, [.07, .77, .02], .17, p.accent, true);
    add(held, 'leaf', [.04, .38, .035], [.13, .25, .055], COLOR.leaf, [0, 0, -.5]);
    motions.push(t => { held.rotation.z = Math.sin(t *.6 + .3) *.018; });
  }
  function shore() {
    // Sailor vest and short trousers. Alternating stitches suggest cloth and
    // rope rather than a branded uniform.
    add(torso, 'box', [0, .77, .19], [.22, .29, .026], COLOR.cream);
    for (let j = 0; j < 3; j++) add(torso, 'box', [0, .68 +j *.08, .208], [.20, .019, .015], p.coat);
    for (const d of [-1, 1]) add(feet, 'cylinder', [d *.118, .41, 0], [.088, .19, .087], p.trousers);
    ball(torso, [.02, .997, .16], [.040, .063, .052], p.accent, [0, 0, -.15]);
    // Wide straw brim, shallow crown and a blue ribbon with long tails.
    add(head, 'cylinder', [0, .255, 0], [.455, .038, .405], p.hat, [0, 0, .035]);
    ball(head, [0, .310, -.018], [.30, .147, .265], p.hat);
    add(head, 'cylinder', [0, .287, -.018], [.299, .075, .263], p.coat);
    for (const radius of [.35, .39, .425]) add(head, 'torus', [0, .277, 0], [radius, radius *.87, .085], COLOR.rope, [Math.PI /2, 0, 0]);
    add(head, 'box', [-.28, .18, -.22], [.065, .25, .018], p.coat, [0, -.1, -.2]);
    add(head, 'box', [-.215, .17, -.24], [.065, .27, .018], p.coat, [0, .1, .2]);
    // Shell pin and a little pearl earring.
    for (let j = -2; j <= 2; j++) ball(head, [.26 +j *.022, .295 +Math.abs(j) *.009, .17], [.018, .060, .016], COLOR.white, [0, 0, -j *.18]);
    ball(head, [-.31, -.095, .014], [.027, .03, .027], COLOR.white);
    // A real open net, with a hanging cup of woven rope and handle. The hoop
    // is tilted a little toward the viewer so its structure reads clearly.
    rod(held, [0, -.76, 0], [.04, .35, 0], .027, COLOR.wood);
    add(held, 'torus', [.065, .54, .025], [.265, .26, .65], COLOR.wood, [-.16, -.15, -.04]);
    for (let j = -2; j <= 2; j++) {
      const x = j *.072, edgeY = Math.sqrt(Math.max(0, .24 **2 -x **2));
      curve(held, [[.065 +x, .54 +edgeY, .025], [.065 +x *.76, .49, -.11], [.065 +x, .54 -edgeY, .025]], .007, COLOR.rope);
      const y = j *.070, edgeX = Math.sqrt(Math.max(0, .24 **2 -y **2));
      curve(held, [[.065 -edgeX, .54 +y, .025], [.065, .54 +y *.70, -.13], [.065 +edgeX, .54 +y, .025]], .007, COLOR.rope);
    }
    // Small shell pouch at the belt, with a curved shoulder strap.
    ball(torso, [-.21, .62, .16], [.10, .11, .077], p.accent);
    curve(torso, [[.14, 1.02, .12], [.03, .89, .20], [-.10, .75, .20], [-.19, .68, .18]], .017, COLOR.cream);
    motions.push(t => { held.rotation.z = Math.sin(t *.62 +1.2) *.025; });
  }
  function grove() {
    // Long work apron with stitched pocket and two little brass fasteners.
    add(torso, 'box', [0, .748, .180], [.28, .46, .028], p.accent);
    add(torso, 'box', [0, .669, .202], [.185, .125, .025], p.coat);
    for (const d of [-1, 1]) {
      rod(torso, [d *.095, .96, .164], [d *.135, 1.015, .065], .019, p.accent);
      ball(torso, [d *.093, .93, .202], [.018, .018, .012], COLOR.gold);
    }
    for (const x of [-.045, .045]) rod(torso, [x, .70, .225], [x, .82, .225], .011, COLOR.wood);
    // Bun, headscarf and a tied side bow provide a silhouette without a brim.
    ball(head, [0, .294, -.115], [.14, .14, .13], p.hair);
    add(head, 'torus', [0, .284, -.115], [.14, .14, .33], p.accent, [Math.PI /2, 0, 0]);
    curve(head, [[-.282, .046, .025], [-.23, .18, .12], [0, .248, .153], [.23, .18, .12], [.282, .04, .025]], .044, p.coat);
    for (const d of [-1, 1]) ball(head, [.29 +d *.036, .078, -.035], [.068, .037, .026], p.coat, [0, 0, d *.42]);
    // Delicate round spectacles around the blinking eyes, plus their bridge.
    for (const d of [-1, 1]) add(head, 'torus', [d *.09, .021, .281], [.061, .062, .36], COLOR.wood);
    rod(head, [-.028, .021, .287], [.028, .021, .287], .008, COLOR.wood);
    // A hanging lantern in an actual wooden frame; it sways independently.
    curve(held, [[.01, -.03, .01], [.045, -.12, .015], [.11, -.135, .02]], .021, COLOR.wood);
    const lamp = part('swaying lantern', [.11, -.11, .025], held);
    add(lamp, 'torus', [0, -.09, 0], [.09, .12, .55], COLOR.wood);
    ball(lamp, [0, -.33, 0], [.138, .182, .12], COLOR.lantern, [0, 0, 0], true);
    add(lamp, 'cylinder', [0, -.17, 0], [.15, .045, .14], COLOR.wood);
    add(lamp, 'cylinder', [0, -.49, 0], [.15, .045, .14], COLOR.wood);
    for (let j = 0; j < 4; j++) {
      const a = j /4 *Math.PI *2 +Math.PI /4;
      rod(lamp, [Math.cos(a) *.13, -.18, Math.sin(a) *.12], [Math.cos(a) *.13, -.48, Math.sin(a) *.12], .012, COLOR.wood);
    }
    ball(lamp, [0, -.55, 0], [.026, .047, .026], p.accent);
    motions.push(t => { lamp.rotation.z = Math.sin(t *1.4 + .3) *.060; lamp.rotation.x = Math.sin(t *1.1) *.026; });
  }
}

function leafGeometry() {
  const outline = [[0, 0, 0], [-.34, .3, 0], [-.38, .59, 0], [0, 1, 0], [.38, .59, 0], [.34, .3, 0]];
  const p = [];
  for (let j = 0; j < outline.length; j++) {
    const a = outline[j], b = outline[(j +1) %outline.length];
    p.push(...a, 0, .45, .13, ...b, ...b, 0, .45, -.07, ...a);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
