// Procedural city for Bandar Nusa: grid roads, low-poly buildings with
// generated window textures, a beach, sea and wooden pier, palms and
// streetlights. Everything is built from the seed, so the city is the
// same on every load.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, COLORS } from './config.js';
import { mulberry32, range, intRange, pick } from './random.js';

const ROAD_LINES = [-132, -88, -44, 0, 44, 88, 132];

const BUILDING_COLORS = [0xc9a06a, 0x9fb4c7, 0xb98a7a, 0x8fa98f, 0xc7b299, 0x7d8aa0, 0xd0c0a0];
const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0a52e, 0x3fae6a, 0xe8e8e8, 0x222831];

// Named places the missions use. All sit beside a road so the player and
// the minimap can reach them.
export const PLACES = {
  spawn: { x: 0, z: -8, label: 'Central Plaza' },
  pier: { x: 4, z: 176, label: 'Old Pier' },
  market: { x: -40, z: -40, label: 'Market' },
  'shop-a': { x: 40, z: -84, label: 'Corner Shop' },
  'shop-b': { x: -84, z: 40, label: 'Grocery' },
  'shop-c': { x: 84, z: 84, label: 'Phone Shop' },
  garage: { x: 84, z: -40, label: 'Garage' },
  'boss-office': { x: -84, z: -84, label: "Boss Jalak's Office" },
  harbor: { x: -60, z: 158, label: 'Harbor' },
  hospital: { x: 0, z: 84, label: 'Hospital' },
};

function makeFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#2c3e55';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      g.fillRect(10 + col * 30, 14 + row * 30, 18, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const lampLights = [];
  const windowMats = [];
  const trafficLoops = [];
  const parkedSpots = [];
  const pedSpots = [];

  const facadeTex = makeFacadeTexture();

  // --- Ground: grass base, city slab, sand beach, sea -------------------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.05;
  scene.add(grass);

  const citySlab = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfSize * 2, 300),
    new THREE.MeshLambertMaterial({ color: COLORS.sidewalk }),
  );
  citySlab.rotation.x = -Math.PI / 2;
  citySlab.position.set(0, 0, -20);
  scene.add(citySlab);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 22),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 159);
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 260),
    new THREE.MeshLambertMaterial({ color: COLORS.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 300);
  scene.add(sea);

  // --- Roads ------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.asphalt });
  for (const line of ROAD_LINES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, 320), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(line, 0.03, -20);
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(380, WORLD.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.03, line);
    scene.add(hRoad);
  }

  // --- Buildings ----------------------------------------------------------
  // Blocks sit between neighbouring road lines. One or two buildings per
  // block, kept clear of the named mission places.
  function nearPlace(x, z) {
    for (const key of Object.keys(PLACES)) {
      const p = PLACES[key];
      if (Math.abs(p.x - x) < 16 && Math.abs(p.z - z) < 16) return true;
    }
    return false;
  }

  for (let i = 0; i < ROAD_LINES.length - 1; i += 1) {
    for (let j = 0; j < ROAD_LINES.length - 1; j += 1) {
      const x0 = ROAD_LINES[i] + WORLD.roadWidth / 2 + 3;
      const x1 = ROAD_LINES[i + 1] - WORLD.roadWidth / 2 - 3;
      const z0 = ROAD_LINES[j] + WORLD.roadWidth / 2 + 3;
      const z1 = ROAD_LINES[j + 1] - WORLD.roadWidth / 2 - 3;
      if (z0 > 140) continue; // beach side stays open
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (nearPlace(cx, cz)) continue;
      const count = rng() < 0.55 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        const w = range(rng, 12, Math.min(20, x1 - x0 - 2));
        const d = range(rng, 12, Math.min(20, z1 - z0 - 2));
        const h = range(rng, 8, 34);
        const bx = count === 1 ? cx : x0 + w / 2 + (b * (x1 - x0 - w)) / 1;
        const bz = count === 1 ? cz : z0 + d / 2 + (b * (z1 - z0 - d)) / 1;
        if (nearPlace(bx, bz)) continue;
        const color = pick(rng, BUILDING_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color, map: facadeTex, emissive: 0x222222 });
        windowMats.push(mat);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        scene.add(mesh);
        const roof = box(w + 0.6, 0.8, d + 0.6, 0x4a4a4a, bx, h + 0.4, bz);
        scene.add(roof);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }

  // Boss Jalak's office: the tall dark tower on the north-west hill.
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x2e3440, map: facadeTex, emissive: 0x111111 });
  windowMats.push(towerMat);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(22, 52, 22), towerMat);
  tower.position.set(-84, 26, -84);
  scene.add(tower);
  colliders.push({ minX: -95, maxX: -73, minZ: -95, maxZ: -73 });
  const towerSign = box(24, 2, 1, 0xc23b2e, -84, 52, -72);
  scene.add(towerSign);

  // --- Pier ---------------------------------------------------------------
  for (let z = 150; z <= 186; z += 3) {
    const plank = box(8, 0.5, 2.8, 0x8a6b42, 4, 0.6, z);
    scene.add(plank);
  }
  for (const px of [0.5, 7.5]) {
    for (let z = 152; z <= 186; z += 8) {
      scene.add(box(0.6, 2.2, 0.6, 0x6b4f30, px, -0.4, z));
    }
  }
  // Small boats bobbing near the pier.
  const boats = [];
  for (let i = 0; i < 3; i += 1) {
    const boat = box(3, 1, 7, pick(rng, [0xe8e8e8, 0x2e6fc2, 0xc23b2e]), -14 - i * 12, 0.1, 178 + i * 6);
    scene.add(boat);
    boats.push(boat);
  }

  // --- Palms along the beach ----------------------------------------------
  for (let x = -170; x <= 170; x += 14) {
    if (Math.abs(x - 4) < 10) continue;
    const px = x + range(rng, -3, 3);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x7a5a34 }),
    );
    trunk.position.set(px, 3.5, 152 + range(rng, -2, 4));
    trunk.rotation.z = range(rng, -0.12, 0.12);
    scene.add(trunk);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 4.5, 7),
      new THREE.MeshLambertMaterial({ color: 0x2e7d32 }),
    );
    top.position.set(px, 8.4, trunk.position.z);
    scene.add(top);
  }

  // --- Streetlights ---------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const line of ROAD_LINES) {
    for (let t = -150; t <= 140; t += 36) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(line + 6, 3, t);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat.clone());
      bulb.position.set(line + 6, 6.1, t);
      scene.add(bulb);
      lampLights.push(bulb.material);
    }
  }

  // --- Market stalls ---------------------------------------------------------
  for (let i = 0; i < 4; i += 1) {
    const sx = -52 + i * 8;
    const stall = box(6, 2.4, 4, pick(rng, [0xc23b2e, 0xe0a52e, 0x3fae6a, 0x2e6fc2]), sx, 1.2, -40);
    scene.add(stall);
    const awning = box(6.6, 0.3, 4.6, 0xf5f0e0, sx, 2.8, -40);
    scene.add(awning);
    colliders.push({ minX: sx - 3, maxX: sx + 3, minZ: -42, maxZ: -38 });
  }

  // --- Traffic loops (rectangular circuits on the road grid) ------------------
  trafficLoops.push([
    { x: -132, z: -88 }, { x: 132, z: -88 }, { x: 132, z: 88 }, { x: -132, z: 88 },
  ]);
  trafficLoops.push([
    { x: -88, z: -132 }, { x: -88, z: 132 }, { x: 88, z: 132 }, { x: 88, z: -132 },
  ]);
  trafficLoops.push([
    { x: -44, z: -44 }, { x: 44, z: -44 }, { x: 44, z: 44 }, { x: -44, z: 44 },
  ]);

  // Parked cars along the roads.
  for (let i = 0; i < 10; i += 1) {
    parkedSpots.push({
      x: pick(rng, ROAD_LINES) + 7,
      z: range(rng, -120, 130),
      color: pick(rng, CAR_COLORS),
      angle: rng() < 0.5 ? 0 : Math.PI / 2,
    });
  }
  // Pedestrian wander spots on sidewalks.
  for (let i = 0; i < 14; i += 1) {
    pedSpots.push({
      x: pick(rng, ROAD_LINES) + range(rng, -8, 8),
      z: range(rng, -130, 140),
    });
  }

  return {
    colliders,
    lampLights,
    windowMats,
    trafficLoops,
    parkedSpots,
    pedSpots,
    boats,
    sea,
    setNight(factor) {
      for (const m of lampLights) m.color.setScalar(0.35 + factor * 0.65);
      for (const m of windowMats) m.emissive.setScalar(0.03 + factor * 0.22);
    },
  };
}

// Build a low-poly car mesh. `isPolice` adds a light bar.
export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2733 }),
  );
  cabin.position.set(0, 1.2, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.65, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const white = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.5, 4.0),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    white.position.y = 0.62;
    white.scale.set(1, 1, 1);
    group.add(white);
  }
  return group;
}

// Build a simple low-poly person: body, head, legs.
export function makePersonMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshLambertMaterial({ color: skinColor || 0xd9a066 }),
  );
  head.position.y = 1.75;
  group.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b3a4a });
  for (const lx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.3), legMat);
    leg.position.set(lx, 0.3, 0);
    group.add(leg);
  }
  const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });
  for (const ax of [-0.48, 0.48]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.25), armMat);
    arm.position.set(ax, 1.05, 0);
    arm.name = ax < 0 ? 'armL' : 'armR';
    group.add(arm);
  }
  return group;
}

export function randomCarColor(rng) {
  return pick(rng, CAR_COLORS);
}

export { intRange };
