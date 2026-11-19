// Bandar Nusa itself: a procedural coastal city built from boxes, canvas
// textures and a little seeded randomness. Roads form a grid, the south edge is a
// beach with a pier, and the centre is a taller downtown. Nothing here is copied
// from any real map — every street, shop and tower is invented for this game.
import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { range, pick } from './random.js';

const WALL_COLORS = ['#e8dcc0', '#d9a06b', '#7fa8a0', '#c96f4a', '#e5e0d5', '#a8b8c8', '#d8c08a', '#b0705a'];
const ROOF_COLORS = ['#8a4a3a', '#5a6a72', '#7a5a3a', '#4a5a6a', '#96503f'];

function facadeTexture(random, base, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 64, 6);
  for (let floor = 0; floor < floors; floor += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = 6 + col * ((64 - 12) / cols);
      const y = 12 + floor * ((128 - 20) / floors);
      const w = (64 - 12) / cols - 4;
      const h = (128 - 20) / floors - 5;
      g.fillStyle = random() < 0.22 ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, w, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A building's footprint as an axis-aligned box, for collisions.
function collider(x, z, w, d) {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

export function buildCity(scene, random) {
  const colliders = [];
  const lampMaterials = [];
  const group = new THREE.Group();
  scene.add(group);

  const roads = CITY.roads;
  const half = CITY.half;

  // Ground: grass base, then road strips, sidewalks and sand on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 120, half * 2 + 120),
    new THREE.MeshLambertMaterial({ color: COLORS.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
  const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const sandMat = new THREE.MeshLambertMaterial({ color: COLORS.sand });
  const seaMat = new THREE.MeshLambertMaterial({ color: COLORS.sea });

  for (const c of roads) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, half * 2), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0, c);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    // Sidewalk ribbons along each road.
    for (const off of [-CITY.roadWidth / 2 - 2, CITY.roadWidth / 2 + 2]) {
      const vWalk = new THREE.Mesh(new THREE.PlaneGeometry(4, half * 2), walkMat);
      vWalk.rotation.x = -Math.PI / 2;
      vWalk.position.set(c + off, 0.02, 0);
      vWalk.receiveShadow = true;
      group.add(vWalk);
      const hWalk = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 4), walkMat);
      hWalk.rotation.x = -Math.PI / 2;
      hWalk.position.set(0, 0.02, c + off);
      hWalk.receiveShadow = true;
      group.add(hWalk);
    }
  }

  // Beach and sea along the south edge, plus the wooden pier at the dermaga.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 120, 60), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, CITY.beachStart + 28);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 400, 200), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.seaStart + 100);
  group.add(sea);
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const pier = box(8, 0.6, 46, pierMat);
  pier.position.set(0, 0.6, 238);
  group.add(pier);
  for (let i = 0; i < 6; i += 1) {
    const post = box(0.8, 2.4, 0.8, pierMat);
    post.position.set(i % 2 === 0 ? -3.6 : 3.6, 0, 220 + i * 7);
    group.add(post);
  }

  // Buildings, one to three per block. Downtown blocks grow taller.
  const textureCache = new Map();
  function facade(base, floors, cols) {
    const key = `${base}|${floors}|${cols}`;
    if (!textureCache.has(key)) textureCache.set(key, facadeTexture(random, base, floors, cols));
    return textureCache.get(key);
  }

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  for (let bi = 0; bi < roads.length - 1; bi += 1) {
    for (let bj = 0; bj < roads.length - 1; bj += 1) {
      const cx = (roads[bi] + roads[bi + 1]) / 2;
      const cz = (roads[bj] + roads[bj + 1]) / 2;
      if (cz > CITY.beachStart - 30) continue; // beach blocks stay open
      const downtown = Math.abs(cx) <= 60 && Math.abs(cz) <= 60;
      const count = downtown ? 1 : 1 + Math.floor(random() * 3);
      for (let k = 0; k < count; k += 1) {
        const w = range(random, 14, 26);
        const d = range(random, 14, 26);
        const h = downtown ? range(random, 24, 58) : range(random, 8, 24);
        const ox = count === 1 ? 0 : range(random, -10, 10);
        const oz = count === 1 ? 0 : range(random, -10, 10);
        const x = cx + ox;
        const z = cz + oz;
        const base = pick(random, WALL_COLORS);
        const floors = Math.max(2, Math.round(h / 4));
        const mat = new THREE.MeshLambertMaterial({ map: facade(base, Math.min(floors, 12), 4) });
        const building = box(w, h, d, mat);
        building.position.set(x, h / 2, z);
        group.add(building);
        const roof = box(w + 0.6, 0.8, d + 0.6, roofMat);
        roof.position.set(x, h + 0.4, z);
        group.add(roof);
        // A few rooftops get a water tank or antenna for silhouette.
        if (random() < 0.4) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 8), new THREE.MeshLambertMaterial({ color: 0x4a5a6a }));
          tank.position.set(x + w / 4, h + 1.6, z - d / 4);
          tank.castShadow = true;
          group.add(tank);
        }
        colliders.push(collider(x, z, w, d));
      }
    }
  }

  // Landmark buildings the story names, placed on purpose rather than by chance.
  function landmark(x, z, w, h, d, color, label) {
    const mat = new THREE.MeshLambertMaterial({ map: facade(color, Math.min(Math.max(2, Math.round(h / 4)), 12), 5) });
    const building = box(w, h, d, mat);
    building.position.set(x, h / 2, z);
    group.add(building);
    colliders.push(collider(x, z, w, d));
    return { x, z, label };
  }
  const landmarks = [
    landmark(CITY.places.hotel.x, CITY.places.hotel.z, 30, 52, 22, '#a8b8c8', 'Hotel Nusa Raya'),
    landmark(CITY.places.gudang.x, CITY.places.gudang.z, 34, 12, 20, '#b0705a', 'Gudang Pelabuhan'),
    landmark(CITY.places.rumahSakit.x, CITY.places.rumahSakit.z, 28, 16, 20, '#e5e0d5', 'Rumah Sakit Nusa'),
    landmark(CITY.places.warung.x, CITY.places.warung.z, 12, 6, 10, '#d9a06b', 'Warung Bu Sari'),
    landmark(CITY.places.bengkel.x, CITY.places.bengkel.z, 20, 8, 14, '#7fa8a0', 'Bengkel Dodi'),
  ];

  // Market stalls near the pasar: striped awnings on thin posts.
  for (let i = 0; i < 6; i += 1) {
    const sx = CITY.places.pasar.x - 18 + i * 7;
    const sz = CITY.places.pasar.z + 14;
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0xc96f4a : 0x3f7f6a }),
    );
    awning.position.set(sx, 2.6, sz);
    awning.castShadow = true;
    group.add(awning);
    for (const px of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
      post.position.set(sx + px, 1.3, sz);
      group.add(post);
    }
  }

  // Palm trees along the beach and a few in the alun-alun.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4a });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5, 6), trunkMat);
    trunk.position.set(x, 2.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 7), leafMat);
    crown.position.set(x, 5.8, z);
    crown.castShadow = true;
    group.add(crown);
  }
  for (let x = -200; x <= 200; x += 40) palm(x + range(random, -6, 6), CITY.beachStart + range(random, 2, 18));
  for (let i = 0; i < 8; i += 1) palm(range(random, -24, 24), range(random, -24, 24));

  // Streetlights at intersections; their lamps glow after dark.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  for (const rx of roads) {
    for (const rz of roads) {
      if (rz > CITY.beachStart - 30) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), poleMat);
      pole.position.set(rx + 8, 3, rz + 8);
      group.add(pole);
      const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2cf, emissive: 0x000000 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(rx + 8, 6.1, rz + 8);
      group.add(lamp);
      lampMaterials.push(lampMat);
    }
  }

  // Parked cars waiting at curbs, and cash pickup spots on sidewalks.
  const parkedSpots = [
    { x: 67, z: 30, heading: Math.PI / 2, color: 0xc0392b, model: 'sedan' },
    { x: -67, z: -90, heading: -Math.PI / 2, color: 0x2e6da4, model: 'sedan' },
    { x: 127, z: -30, heading: Math.PI / 2, color: 0xd8c23a, model: 'taxi' },
    { x: -7, z: 127, heading: 0, color: 0x7a7a7a, model: 'sedan' },
    { x: 67, z: 150, heading: Math.PI / 2, color: 0x3f7f6a, model: 'pickup' },
    { x: -127, z: 30, heading: -Math.PI / 2, color: 0x8a2f6a, model: 'sedan' },
    { x: 187, z: 90, heading: Math.PI / 2, color: 0xdddddd, model: 'sedan' },
    { x: -67, z: 187, heading: -Math.PI / 2, color: 0x2a2a2a, model: 'sedan' },
  ];
  const pickupSpots = [
    { x: -52, z: -68 }, { x: 8, z: -8 }, { x: 68, z: 52 }, { x: 128, z: -112 },
    { x: -112, z: 128 }, { x: -172, z: 188 }, { x: 8, z: 232 }, { x: 188, z: 98 },
    { x: -52, z: 128 }, { x: 128, z: 188 }, { x: -188, z: -112 }, { x: 68, z: -128 },
  ];

  return { colliders, lampMaterials, landmarks, parkedSpots, pickupSpots, group };
}

// The nearest point on a road centreline to (x, z), for spawning and routing.
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of CITY.roads) {
    const d1 = Math.abs(x - c);
    if (d1 < bestD) { bestD = d1; best = { x: c, z, vertical: true }; }
    const d2 = Math.abs(z - c);
    if (d2 < bestD) { bestD = d2; best = { x, z: c, vertical: false }; }
  }
  return best;
}

export function isOnRoad(x, z) {
  for (const c of CITY.roads) {
    if (Math.abs(x - c) < CITY.roadWidth / 2 || Math.abs(z - c) < CITY.roadWidth / 2) return true;
  }
  return false;
}

export function randomStreetPosition(random) {
  const road = CITY.roads[Math.floor(random() * CITY.roads.length)];
  const along = range(random, -CITY.half + 20, CITY.half - 20);
  if (random() < 0.5) return { x: road, z: along, vertical: true };
  return { x: along, z: road, vertical: false };
}
