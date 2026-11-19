// Procedural city data: blocks, buildings, landmarks, stalls, palms,
// streetlights, parked-car spots and cash pickups. Pure data — no THREE,
// no DOM — so the logic tests can import it in Node.
import { BLOCK, GRID, HALF, LANDMARKS, PARKED_COUNT, PICKUP_COUNT, PITCH, ROADS } from './config.js';

const SPECIAL_BLOCKS = new Set(['-2,0', '1,-1', '-3,-2']);

function blockCenter(bx, bz) {
  return { x: -HALF + ROAD_HALF(bx), z: -HALF + ROAD_HALF(bz) };
}
function ROAD_HALF(i) {
  return 12 + i * PITCH + BLOCK / 2;
}

const FACADES = ['sand', 'brick', 'teal', 'cream', 'slate', 'ochre'];

export function createCity(rng) {
  const buildings = [];
  for (let bx = 0; bx < GRID; bx += 1) {
    for (let bz = 0; bz < GRID; bz += 1) {
      const key = `${bx - 3},${bz - 3}`;
      if (SPECIAL_BLOCKS.has(key)) continue;
      const c = blockCenter(bx, bz);
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const x = c.x + rng.range(-6, 6);
        const z = c.z + rng.range(-6, 6);
        buildings.push({
          x,
          z,
          w,
          d,
          h: rng.range(7, 30),
          floors: rng.int(2, 8),
          facade: rng.pick(FACADES),
          seed: rng.int(0, 999999),
        });
      }
    }
  }

  // Market stalls crowd the block by the fish market.
  const stalls = [];
  for (let i = 0; i < 8; i += 1) {
    stalls.push({
      x: LANDMARKS.market.x - 14 + (i % 4) * 9 + rng.range(-1, 1),
      z: LANDMARKS.market.z - 10 + Math.floor(i / 4) * 12 + rng.range(-1, 1),
      color: rng.pick(['#e4572e', '#17a398', '#f2a541', '#5b8def']),
    });
  }

  // Palms line the beach and dot the plaza.
  const palms = [];
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: HALF + 6 + rng.range(0, 30), z: -HALF + 10 + (i / 26) * (HALF * 2 - 20) + rng.range(-4, 4) });
  }
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: rng.range(-30, 30), z: rng.range(-30, 30) });
  }

  // Streetlights along every road, every 26 units.
  const lights = [];
  for (const r of ROADS) {
    for (let t = -HALF + 20; t < HALF - 10; t += 26) {
      lights.push({ x: r + 5.5, z: t });
      lights.push({ x: t, z: r + 5.5 });
    }
  }

  // Parked cars on roadside spots; spot 0 is the red sedan for mission 3.
  const parkedSpots = [];
  const used = new Set();
  const spotRoads = [ROADS[1], ROADS[2], ROADS[4], ROADS[5]];
  let guard = 0;
  while (parkedSpots.length < PARKED_COUNT && guard < 200) {
    guard += 1;
    const road = rng.pick(spotRoads);
    const along = rng.range(-HALF + 30, HALF - 30);
    const key = `${Math.round(road / 10)}:${Math.round(along / 20)}`;
    if (used.has(key)) continue;
    used.add(key);
    const horizontal = rng.next() < 0.5;
    parkedSpots.push({
      x: horizontal ? along : road + 4,
      z: horizontal ? road + 4 : along,
      heading: horizontal ? 0 : Math.PI / 2,
      red: parkedSpots.length === 0,
    });
  }
  // The red sedan sits on the east road, where mission 3 says it is.
  parkedSpots[0] = { x: 104, z: -52, heading: Math.PI / 2, red: true };

  // Cash pickups on sidewalks and plaza corners.
  const pickups = [];
  for (let i = 0; i < PICKUP_COUNT; i += 1) {
    const road = rng.pick(ROADS);
    const along = rng.range(-HALF + 20, HALF - 20);
    pickups.push({
      x: rng.next() < 0.5 ? road + 8 : along,
      z: rng.next() < 0.5 ? along : road + 8,
    });
  }

  return { buildings, stalls, palms, lights, parkedSpots, pickups };
}

export { ROADS };
