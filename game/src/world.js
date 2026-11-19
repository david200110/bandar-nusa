// The world simulation: player, cars, pedestrians, police, gang, pickups,
// wanted level, busts, collisions and the day clock. Pure logic — no THREE,
// no DOM — so Node tests can step it with plain input objects.
import {
  BLOCK, CAR, CLOCK_RATE, CLOCK_START, GANG, HALF, LANDMARKS, PICKUP_VALUE,
  PICKUP_COUNT, PLAYER, ROADS, STEP, TRAFFIC, PEDS, WANTED, WORLD_EAST,
} from './config.js';
import { createCity } from './city.js';
import { completeMission, currentMission, failMission, startMission, updateMissions } from './missions.js';

export { STEP };

export function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
function angleTo(a, b) {
  // Heading h faces (-sin h, -cos h); to face (dx, dz) is atan2(-dx, -dz).
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function nearestRoad(v) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

function makeCar(id, kind, x, z, heading, color) {
  return { id, kind, x, z, heading, speed: 0, color, parked: kind === 'parked', red: false, axis: 'x', dir: 1 };
}

export function createWorld(rng, opts = {}) {
  const city = createCity(rng);
  const state = {
    rng,
    time: 0,
    clock: opts.clock ?? CLOCK_START,
    money: opts.money ?? 0,
    health: PLAYER.maxHealth,
    wanted: 0,
    lastRaise: -1e9,
    decayTimer: 0,
    quietTime: 0,
    storyComplete: false,
    missionIndex: 0,
    mission: { status: 'active', timer: null, survive: 0, gangLeft: 0 },
    gang: [],
    city,
    player: {
      x: LANDMARKS.spawn.x,
      z: LANDMARKS.spawn.z,
      heading: 0,
      speed: 0,
      onFoot: true,
      car: null,
      punchCooldown: 0,
      lastDamage: -1e9,
      bustHold: 0,
    },
    cars: [],
    peds: [],
    police: [],
    pickups: city.pickups.map((p, i) => ({ id: `pickup-${i}`, x: p.x, z: p.z, taken: false })),
    events: [],
    pedRespawn: 0,
    policeSpawn: 0,
  };

  // Traffic on the roads.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const horizontal = rng.next() < 0.5;
    const road = rng.pick(ROADS);
    const along = rng.range(-HALF + 20, HALF - 20);
    const car = makeCar(`traffic-${i}`, 'traffic', horizontal ? along : road, horizontal ? road : along, 0, rng.pick(['#c0392b', '#2980b9', '#f1c40f', '#7f8c8d', '#8e44ad', '#16a085']));
    car.axis = horizontal ? 'x' : 'z';
    car.dir = rng.next() < 0.5 ? 1 : -1;
    // Face along the direction of travel: +x is -PI/2, -x is PI/2, +z is PI, -z is 0.
    car.heading = horizontal ? (car.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (car.dir > 0 ? Math.PI : 0);
    car.speed = rng.range(TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    state.cars.push(car);
  }
  // Parked cars, spot 0 is the red sedan.
  city.parkedSpots.forEach((s, i) => {
    const car = makeCar(`parked-${i}`, 'parked', s.x, s.z, s.heading, s.red ? '#d21f1f' : rng.pick(['#34495e', '#95a5a6', '#2c3e50', '#b7950b']));
    car.red = s.red;
    state.cars.push(car);
  });
  // Pedestrians on the sidewalks.
  for (let i = 0; i < PEDS.count; i += 1) {
    const road = rng.pick(ROADS);
    const along = rng.range(-HALF + 15, HALF - 15);
    state.peds.push({
      id: `ped-${i}`,
      x: rng.next() < 0.5 ? road + 8.5 : along,
      z: rng.next() < 0.5 ? along : road + 8.5,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2),
      flee: 0,
      down: false,
      axis: rng.next() < 0.5 ? 'x' : 'z',
      dir: rng.next() < 0.5 ? 1 : -1,
    });
  }
  startMission(state, 0);
  return state;
}

function insideBuilding(state, x, z, pad) {
  for (const b of state.city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
  }
  return false;
}

function moveWithCollision(state, obj, nx, nz, pad) {
  // Slide along walls: try x, then z.
  if (!insideBuilding(state, nx, obj.z, pad) && Math.abs(nx) < HALF + 40 && nz > -HALF - 10 && nz < HALF + 10) obj.x = nx;
  if (!insideBuilding(state, obj.x, nz, pad) && Math.abs(nz) < HALF + 10) obj.z = nz;
  obj.x = clamp(obj.x, -HALF - 8, WORLD_EAST - 10);
  obj.z = clamp(obj.z, -HALF - 8, HALF + 8);
}

function raiseWanted(state, n) {
  state.wanted = Math.min(WANTED.max, state.wanted + n);
  state.lastRaise = state.time;
  state.decayTimer = 0;
}

function hurtPlayer(state, amount) {
  state.player.lastDamage = state.time;
  state.health = Math.max(0, state.health - amount);
  state.events.push({ type: 'hurt', amount });
  if (state.health <= 0) bustPlayer(state, 'down');
}

function bustPlayer(state, reason) {
  const fine = Math.floor(state.money * WANTED.fine);
  state.money -= fine;
  const p = state.player;
  if (p.car) {
    p.car.parked = true;
    p.car.speed = 0;
    p.car = null;
  }
  p.onFoot = true;
  p.x = LANDMARKS.hospital.x;
  p.z = LANDMARKS.hospital.z;
  p.heading = 0;
  p.speed = 0;
  p.bustHold = 0;
  state.health = PLAYER.maxHealth;
  state.wanted = 0;
  state.police = [];
  state.events.push({ type: 'busted', reason, fine });
  if (currentMission(state)?.id === 'razia') failMission(state, 'busted');
}

function enterCar(state, car) {
  const p = state.player;
  p.onFoot = false;
  p.car = car;
  car.parked = false;
  car.speed = 0;
  car.heading = p.heading;
  if (car.kind !== 'police') {
    raiseWanted(state, WANTED.steal);
    state.events.push({ type: 'stolen', car: car.id });
  }
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  car.parked = true;
  const sx = car.x + Math.cos(car.heading + Math.PI / 2) * 2.5;
  const sz = car.z + Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.x = sx;
  p.z = sz;
  p.heading = car.heading;
  p.onFoot = true;
  p.car = null;
}

function stepPlayer(state, input, dt) {
  const p = state.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);

  if (input.enter) {
    if (p.onFoot) {
      let best = null;
      let bestD = 3.5;
      for (const c of state.cars) {
        if (c.kind === 'police') continue;
        const d = dist2(p, c);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best) enterCar(state, best);
    } else {
      exitCar(state);
    }
  }

  if (p.onFoot) {
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0;
    let mz = 0;
    // Camera-relative movement; cameraYaw 0 faces -z (north).
    const yaw = input.cameraYaw ?? 0;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    if (input.forward) {
      mx += fwdX;
      mz += fwdZ;
    }
    if (input.back) {
      mx -= fwdX;
      mz -= fwdZ;
    }
    if (input.right) {
      mx += rightX;
      mz += rightZ;
    }
    if (input.left) {
      mx -= rightX;
      mz -= rightZ;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const nx = p.x + (mx / len) * speed * dt;
      const nz = p.z + (mz / len) * speed * dt;
      const targetHeading = Math.atan2(-(mx / len), -(mz / len));
      p.heading += angleDiff(targetHeading, p.heading) * Math.min(1, dt * 12);
      moveWithCollision(state, p, nx, nz, PLAYER.radius);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    if (input.punch && p.punchCooldown <= 0) {
      p.punchCooldown = PLAYER.punchCooldown;
      state.events.push({ type: 'punch' });
      for (const g of state.gang) {
        if (g.defeated) continue;
        const d = dist2(p, g);
        if (d < PLAYER.punchRange && Math.abs(angleDiff(angleTo(p, g), p.heading)) < PLAYER.punchArc) {
          g.health -= 1;
          if (g.health <= 0) {
            g.defeated = true;
            state.events.push({ type: 'gangDown', gang: g.id });
          }
        }
      }
    }
    return;
  }

  // Driving.
  const car = p.car;
  if (!car) {
    p.onFoot = true;
    return;
  }
  if (input.forward) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
  else if (input.back) {
    car.speed = car.speed > 0.5 ? Math.max(0, car.speed - CAR.brake * dt) : Math.max(-CAR.reverseSpeed, car.speed - CAR.accel * 0.6 * dt);
  } else if (input.handbrake) {
    car.speed = Math.max(0, car.speed - CAR.brake * 1.4 * dt);
  } else {
    car.speed = Math.max(0, car.speed - 4 * dt);
  }
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / CAR.maxSpeed, 0, 1);
  car.heading += steer * CAR.steerRate * speedFactor * dt * (car.speed >= 0 ? 1 : -1);
  // Forward is (-sin h, -cos h).
  const fx = -Math.sin(car.heading);
  const fz = -Math.cos(car.heading);
  const nextX = car.x + fx * car.speed * dt;
  const nextZ = car.z + fz * car.speed * dt;
  moveWithCollision(state, car, nextX, nextZ, 1.4);
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  p.speed = Math.abs(car.speed);

  // Running over a pedestrian while driving fast.
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (dist2(car, ped) < 1.7 && Math.abs(car.speed) > 3) {
      ped.down = true;
      state.pedRespawn = 12;
      raiseWanted(state, WANTED.hitPed);
      state.events.push({ type: 'hitPed', ped: ped.id });
      state.events.push({ type: 'crash' });
    }
  }
}

function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    // At an intersection, sometimes turn onto the cross road.
    const along = car.axis === 'x' ? car.x : car.z;
    const cross = nearestRoad(along);
    if (Math.abs(along - cross) < 1.2 && state.rng.next() < 0.004) {
      car.axis = car.axis === 'x' ? 'z' : 'x';
      if (car.axis === 'x') {
        car.z = cross;
        car.heading = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        car.x = cross;
        car.heading = car.dir > 0 ? Math.PI : 0;
      }
    }
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.x += step;
    else car.z += step;
    const pos = car.axis === 'x' ? car.x : car.z;
    if (pos > HALF + 6) {
      if (car.axis === 'x') car.x = -HALF - 6;
      else car.z = -HALF - 6;
    } else if (pos < -HALF - 6) {
      if (car.axis === 'x') car.x = HALF + 6;
      else car.z = HALF + 6;
    }
    // Bumping the player on foot hurts.
    const p = state.player;
    if (p.onFoot && dist2(car, p) < 2 && !p.car) {
      hurtPlayer(state, 10);
      p.x += (p.x - car.x) * 0.5;
      p.z += (p.z - car.z) * 0.5;
    }
  }
}

function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    // Flee a fast car nearby.
    let threat = null;
    let threatD = 9;
    for (const car of state.cars) {
      if (car.kind === 'parked' || Math.abs(car.speed) < 8) continue;
      const d = dist2(car, ped);
      if (d < threatD) {
        threatD = d;
        threat = car;
      }
    }
    const pc = state.player.car;
    if (pc && Math.abs(pc.speed) > 8) {
      const d = dist2(pc, ped);
      if (d < threatD) {
        threatD = d;
        threat = pc;
      }
    }
    if (threat) {
      ped.flee = 2;
      ped.heading = Math.atan2(ped.x - threat.x, -(ped.z - threat.z));
    } else if (ped.flee > 0) {
      ped.flee -= dt;
    }
    const speed = ped.flee > 0 ? PEDS.fleeSpeed : ped.speed;
    const nx = ped.x + -Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + -Math.cos(ped.heading) * speed * dt;
    if (Math.abs(nx) > HALF || Math.abs(nz) > HALF) {
      ped.heading += Math.PI / 2;
    } else {
      ped.x = nx;
      ped.z = nz;
    }
    // Wander: occasionally change direction on the sidewalk grid.
    if (state.rng.next() < 0.001) ped.heading = state.rng.range(0, Math.PI * 2);
  }
  if (state.pedRespawn > 0) {
    state.pedRespawn -= dt;
    if (state.pedRespawn <= 0) {
      const down = state.peds.find((p) => p.down);
      if (down) {
        const road = state.rng.pick(ROADS);
        down.x = road + 8.5;
        down.z = state.rng.range(-HALF + 15, HALF - 15);
        down.down = false;
      }
    }
  }
}

function stepPolice(state, dt) {
  const p = state.player;
  const want = Math.min(state.wanted, 3);
  state.policeSpawn -= dt;
  if (state.police.length < want && state.policeSpawn <= 0) {
    state.policeSpawn = 3;
    const road = state.rng.pick(ROADS);
    const angle = state.rng.range(0, Math.PI * 2);
    const car = makeCar(`police-${state.time.toFixed(0)}-${state.police.length}`, 'police', p.x + Math.cos(angle) * 70, p.z + Math.sin(angle) * 70, 0, '#f4f6f7');
    car.x = clamp(car.x, -HALF, HALF);
    car.z = clamp(car.z, -HALF, HALF);
    car.speed = 10;
    state.cars.push(car);
    state.police.push(car);
  }
  if (state.wanted === 0) {
    // Drive off: remove police far away.
    state.police = state.police.filter((c) => dist2(c, p) < 130);
    state.cars = state.cars.filter((c) => c.kind !== 'police' || dist2(c, p) < 130);
  }
  for (const car of state.police) {
    const target = angleTo(car, p);
    car.heading += angleDiff(target, car.heading) * Math.min(1, dt * 2.2);
    const maxSpeed = 17 + state.wanted * 1.5;
    const d = dist2(car, p);
    car.speed = d > 4 ? Math.min(maxSpeed, car.speed + 8 * dt) : Math.max(0, car.speed - 10 * dt);
    const nx = car.x + -Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + -Math.cos(car.heading) * car.speed * dt;
    if (!insideBuilding(state, nx, nz, 1.4)) {
      car.x = nx;
      car.z = nz;
    }
    if (p.onFoot && d < 2.6 && car.speed < 2.5) {
      p.bustHold += dt;
      if (p.bustHold >= WANTED.bustHold) {
        bustPlayer(state, 'busted');
        return;
      }
    } else {
      p.bustHold = Math.max(0, p.bustHold - dt);
    }
    // Ramming the player's car.
    if (!p.onFoot && p.car && d < 3.2 && car.speed > 4) {
      p.car.speed *= 0.55;
      car.speed *= 0.6;
      state.events.push({ type: 'crash' });
    }
  }
}

function stepGang(state, dt) {
  const p = state.player;
  for (const g of state.gang) {
    if (g.defeated) continue;
    g.attackCooldown = Math.max(0, g.attackCooldown - dt);
    const d = dist2(g, p);
    if (d < 25) {
      g.heading = angleTo(g, p);
      if (d > GANG.range) {
        g.x += -Math.sin(g.heading) * GANG.speed * dt;
        g.z += -Math.cos(g.heading) * GANG.speed * dt;
      } else if (g.attackCooldown <= 0 && p.onFoot) {
        g.attackCooldown = GANG.cooldown;
        hurtPlayer(state, GANG.damage);
      }
    }
  }
}

export function stepWorld(state, input, dt = STEP) {
  state.events = [];
  state.time += dt;
  state.clock = (state.clock + CLOCK_RATE * dt) % 86400;

  stepPlayer(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepGang(state, dt);

  // Cash pickups.
  const p = state.player;
  for (const pk of state.pickups) {
    if (!pk.taken && dist2(p, pk) < 1.8) {
      pk.taken = true;
      state.money += PICKUP_VALUE;
      state.events.push({ type: 'pickup', value: PICKUP_VALUE });
    }
  }

  // Wanted cools down when quiet and unseen.
  if (state.wanted > 0 && state.time - state.lastRaise > WANTED.quietAfter) {
    const nearPolice = state.police.some((c) => dist2(c, p) < WANTED.unseenRange);
    if (!nearPolice) {
      state.decayTimer += dt;
      if (state.decayTimer >= WANTED.decayEvery) {
        state.decayTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        state.events.push({ type: 'wantedDown', wanted: state.wanted });
      }
    }
  }

  // Health regenerates out of trouble.
  if (state.time - p.lastDamage > PLAYER.regenDelay && state.health > 0 && state.health < PLAYER.maxHealth) {
    state.health = Math.min(PLAYER.maxHealth, state.health + PLAYER.regenRate * dt);
  }

  updateMissions(state, dt);
  return state.events;
}

export { completeMission, failMission, startMission };
