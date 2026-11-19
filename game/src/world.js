// Bandar Nusa's rules, with no drawing and no browser in it: Raka on foot and in
// cars, traffic, pedestrians, police and the wanted level, punches, cash pickups
// and the five-story mission chain. step() advances one fixed step and returns
// the events that happened, so the caller can play sounds and show banners.
import { CITY, PLAYER, CAR, WANTED, MONEY, COLORS, DAY_LENGTH_SECONDS, DAY_START_HOUR } from './config.js';
import { ACTION_INTERACT, ACTION_PUNCH } from './input.js';
import { MISSIONS } from './missions.js';
import { nearestRoadPoint, randomStreetPosition, isOnRoad } from './city.js';
import { range, pick } from './random.js';

export const EVENT_PICKUP = 'pickup';
export const EVENT_CRASH = 'crash';
export const EVENT_PUNCH = 'punch';
export const EVENT_WANTED_UP = 'wanted-up';
export const EVENT_STAGE = 'stage';
export const EVENT_MISSION_COMPLETE = 'mission-complete';
export const EVENT_MISSION_FAILED = 'mission-failed';
export const EVENT_BUSTED = 'busted';
export const EVENT_STORY_COMPLETE = 'story-complete';
export const EVENT_GANG_DOWN = 'gang-down';

const CAR_COLORS = [0x3f6fb5, 0xb5a23f, 0x7a4a8a, 0x4a8a5a, 0xc0c0c0, 0x2a2a2a, 0x8a4a2a, 0x5a7a8a];

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Push a circle out of every building it overlaps; returns true on a hard hit.
function collideBuildings(colliders, entity, radius) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(entity.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(entity.z, c.maxZ));
    const dx = entity.x - cx;
    const dz = entity.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 0.0001) {
      entity.x = c.maxX + radius;
      hit = true;
      continue;
    }
    const d = Math.sqrt(d2);
    entity.x = cx + (dx / d) * radius;
    entity.z = cz + (dz / d) * radius;
    hit = true;
  }
  return hit;
}

export function createWorld(random, city) {
  const colliders = city.colliders;
  let carId = 0;

  const player = {
    x: 0, z: -8, heading: 0, health: PLAYER.maxHealth, money: MONEY.start,
    onFoot: true, carId: null, punchCooldown: 0, lastDamage: -99, carrying: false,
  };
  const cars = [];
  const peds = [];
  const gang = [];
  const pickups = [];
  const state = {
    player, cars, peds, gang, pickups,
    wanted: 0, wantedQuiet: 0, bustProgress: 0, policeTimer: 0,
    missionIndex: 0, missionStage: 0, missionTimer: 0, missionActive: false,
    storyDone: false, time: DAY_START_HOUR, elapsed: 0,
    stats: { missionsDone: 0, carsStolen: 0, pedsHit: 0, cashCollected: 0 },
  };

  function addCar(kind, x, z, heading, color, model) {
    const car = {
      id: carId += 1, kind, x, z, heading, speed: 0, color, model: model ?? 'sedan',
      owned: false, missionTarget: false, vertical: true, direction: 1, lane: 3.5,
      cruise: range(random, CAR.trafficSpeed - 2, CAR.trafficSpeed + 2), stuck: 0,
    };
    cars.push(car);
    return car;
  }

  function addPed(x, z) {
    const road = randomStreetPosition(random);
    const ped = {
      x: x ?? road.x + (random() < 0.5 ? -10.5 : 10.5), z: z ?? road.z,
      heading: random() * Math.PI * 2, speed: range(random, 1.2, 2),
      state: 'walk', stateTimer: 0, downTimer: 0, color: pick(random, [0xd86a6a, 0x6a9ad8, 0x6ad88a, 0xd8b36a, 0x9a6ad8, 0xd8d8d8]),
    };
    if (x === undefined) {
      ped.x = road.vertical ? road.x + (random() < 0.5 ? -10.5 : 10.5) : road.x;
      ped.z = road.vertical ? road.z : road.z + (random() < 0.5 ? -10.5 : 10.5);
      ped.heading = road.vertical ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    }
    peds.push(ped);
    return ped;
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    gang.length = 0;
    pickups.length = 0;
    carId = 0;
    player.x = 0;
    player.z = -8;
    player.heading = 0;
    player.health = PLAYER.maxHealth;
    player.money = MONEY.start;
    player.onFoot = true;
    player.carId = null;
    player.punchCooldown = 0;
    player.lastDamage = -99;
    player.carrying = false;
    state.wanted = 0;
    state.wantedQuiet = 0;
    state.bustProgress = 0;
    state.policeTimer = 0;
    state.missionIndex = 0;
    state.missionStage = 0;
    state.missionTimer = 0;
    state.missionActive = false;
    state.storyDone = false;
    state.time = DAY_START_HOUR;
    state.elapsed = 0;
    state.stats = { missionsDone: 0, carsStolen: 0, pedsHit: 0, cashCollected: 0 };
    for (const spot of city.parkedSpots) {
      const car = addCar('parked', spot.x, spot.z, spot.heading, spot.color, spot.model);
      if (spot.x === 67 && spot.z === 30) car.missionTarget = true; // the red sedan of mission 3
    }
    for (let i = 0; i < 10; i += 1) {
      const road = randomStreetPosition(random);
      const car = addCar('traffic', road.x, road.z, road.vertical ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(random, CAR_COLORS), 'sedan');
      car.vertical = road.vertical;
      car.direction = random() < 0.5 ? 1 : -1;
      car.lane = (random() < 0.5 ? -1 : 1) * 3.5;
    }
    for (let i = 0; i < 22; i += 1) addPed();
    for (const spot of city.pickupSpots) pickups.push({ x: spot.x, z: spot.z, taken: false, respawn: 0 });
  }

  function playerCar() {
    return cars.find((c) => c.id === player.carId) ?? null;
  }

  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      if (car.kind === 'police') continue;
      const d = dist2(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function addWanted(amount, events) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.wantedQuiet = 0;
    events.push(EVENT_WANTED_UP);
  }

  function damagePlayer(amount, events) {
    player.health = Math.max(0, player.health - amount);
    player.lastDamage = state.elapsed;
    if (player.health <= 0) bust(events, 'Kamu dikalahkan dan dibawa ke Rumah Sakit Nusa.');
  }

  function bust(events, reason) {
    const fine = Math.floor(player.money * WANTED.bustFineFraction);
    player.money = Math.max(0, player.money - fine);
    player.health = PLAYER.maxHealth;
    player.x = CITY.places.rumahSakit.x;
    player.z = CITY.places.rumahSakit.z + 12;
    player.heading = Math.PI;
    player.onFoot = true;
    player.carId = null;
    state.wanted = 0;
    state.wantedQuiet = 0;
    state.bustProgress = 0;
    for (const car of cars) if (car.kind === 'police') car.active = false;
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      if (cars[i].kind === 'police') cars.splice(i, 1);
    }
    gang.length = 0;
    if (state.missionActive) {
      state.missionStage = 0;
      state.missionTimer = 0; // a bust restarts a timed mission, it does not finish it
      events.push(EVENT_MISSION_FAILED);
    }
    events.push(EVENT_BUSTED);
    state.bustReason = reason;
  }

  function currentMission() {
    return state.missionActive ? MISSIONS[state.missionIndex] : null;
  }

  function currentStage() {
    const mission = currentMission();
    return mission ? mission.stages[state.missionStage] : null;
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) return false;
    state.missionIndex = index;
    state.missionStage = 0;
    state.missionActive = true;
    state.missionTimer = mission.timeLimit ?? 0;
    if (mission.id === 'lolos-razia') state.wanted = 3;
    return true;
  }

  function completeStage(events) {
    const mission = currentMission();
    state.missionStage += 1;
    if (state.missionStage >= mission.stages.length) {
      player.money += mission.reward;
      player.carrying = false;
      state.stats.missionsDone += 1;
      state.missionActive = false;
      events.push(EVENT_MISSION_COMPLETE);
      if (state.missionIndex >= MISSIONS.length - 1) {
        state.storyDone = true;
        events.push(EVENT_STORY_COMPLETE);
      }
    } else {
      events.push(EVENT_STAGE);
    }
  }

  function spawnGang() {
    gang.length = 0;
    const base = CITY.places.gudang;
    for (let i = 0; i < 3; i += 1) {
      gang.push({
        x: base.x + range(random, -8, 8), z: base.z + range(random, -6, 6),
        heading: random() * Math.PI * 2, health: 65, attackCooldown: 0, state: 'fight',
      });
    }
  }

  function stepMission(dt, events) {
    const mission = currentMission();
    if (!mission) return;
    const stage = currentStage();
    if (!stage) return;
    if (mission.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.missionActive = false;
        state.missionStage = 0;
        events.push(EVENT_MISSION_FAILED);
        return;
      }
    }
    const px = player.onFoot ? player.x : (playerCar()?.x ?? player.x);
    const pz = player.onFoot ? player.z : (playerCar()?.z ?? player.z);
    if (stage.type === 'goto' || stage.type === 'deliver') {
      // 18 m: a target that is a building can never be reached to its centre,
      // the player stops at its wall, so the radius is measured generously.
      if (dist2(px, pz, stage.target.x, stage.target.z) < 324) {
        if (stage.type === 'goto' && stage.target === CITY.places.warung) player.carrying = true;
        completeStage(events);
      }
    } else if (stage.type === 'steal') {
      const car = playerCar();
      if (car && car.missionTarget) completeStage(events);
    } else if (stage.type === 'survive') {
      state.missionTimer = state.missionTimer || stage.seconds;
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) completeStage(events);
    } else if (stage.type === 'defeat') {
      if (gang.length === 0 && state.missionStage === 0 && mission.id === 'utang-lunas') spawnGang();
      if (gang.length > 0 && gang.every((g) => g.health <= 0)) {
        gang.length = 0;
        completeStage(events);
      }
    }
  }

  function stepPlayerOnFoot(dt, input, camYaw, events, actions) {
    const axis = input.moveAxis();
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0;
    let mz = 0;
    if (axis.x !== 0 || axis.y !== 0) {
      // Movement is relative to the camera: W walks away from the camera.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      mx = (axis.x * cos - axis.y * sin) * speed * dt;
      mz = (axis.x * sin + axis.y * cos) * speed * dt;
      const targetHeading = Math.atan2(mx, mz);
      player.heading = turnToward(player.heading, targetHeading, 10 * dt);
    }
    player.x += mx;
    player.z += mz;
    player.x = Math.max(-CITY.half - 30, Math.min(CITY.half + 30, player.x));
    player.z = Math.max(-CITY.half - 30, Math.min(256, player.z));
    collideBuildings(colliders, player, PLAYER.radius);
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (state.elapsed - player.lastDamage > PLAYER.regenDelay && player.health < PLAYER.maxHealth) {
      player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.regenRate * dt);
    }
    // Punch: F (or a mouse click) hits the nearest gang member in range.
    if (input.takeClick() || (actions & ACTION_PUNCH)) {
      if (player.punchCooldown <= 0) {
        player.punchCooldown = PLAYER.punchCooldown;
        const fx = player.x + Math.sin(player.heading) * 1.4;
        const fz = player.z + Math.cos(player.heading) * 1.4;
        let hitSomething = false;
        for (const g of gang) {
          if (g.health > 0 && dist2(fx, fz, g.x, g.z) < PLAYER.punchRange * PLAYER.punchRange) {
            g.health -= PLAYER.punchDamage;
            g.attackCooldown = 1.2; // a landed punch staggers the gang member
            g.x += Math.sin(player.heading) * 1.2;
            g.z += Math.cos(player.heading) * 1.2;
            hitSomething = true;
            if (g.health <= 0) events.push(EVENT_GANG_DOWN);
          }
        }
        if (hitSomething) events.push(EVENT_PUNCH);
      }
    }
  }

  function stepPlayerCar(dt, input, events) {
    const car = playerCar();
    if (!car) { player.onFoot = true; return; }
    const axis = input.moveAxis();
    const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
    const steer = axis.x;
    const handbrake = input.isDown('Space');
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.7) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = Math.max(-CAR.reverseTop, Math.min(CAR.topSpeed, car.speed));
    const steerAmount = steer * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
    car.heading += steerAmount;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    car.x = nx;
    car.z = nz;
    car.x = Math.max(-CITY.half - 30, Math.min(CITY.half + 30, car.x));
    car.z = Math.max(-CITY.half - 30, Math.min(256, car.z));
    const before = car.speed;
    if (collideBuildings(colliders, car, CAR.radius)) {
      if (Math.abs(before) > 9) events.push(EVENT_CRASH);
      car.speed *= 0.4;
    }
    // Running over pedestrians is a crime.
    for (const ped of peds) {
      if (ped.state !== 'down' && Math.abs(car.speed) > 3 && dist2(car.x, car.z, ped.x, ped.z) < 6.25) {
        ped.state = 'down';
        ped.downTimer = 3;
        state.stats.pedsHit += 1;
        addWanted(WANTED.hitPedestrian, events);
        events.push(EVENT_CRASH);
        car.speed *= 0.7;
      }
    }
    // Cash pickups can be grabbed from the car too.
    for (const pickup of pickups) {
      if (!pickup.taken && dist2(car.x, car.z, pickup.x, pickup.z) < 9) {
        pickup.taken = true;
        pickup.respawn = 45;
        player.money += MONEY.pickup;
        state.stats.cashCollected += 1;
        events.push(EVENT_PICKUP);
      }
    }
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      // Direction follows the heading, so the car ahead check never disagrees.
      const dir = car.vertical
        ? (Math.cos(car.heading) >= 0 ? 1 : -1)
        : (Math.sin(car.heading) >= 0 ? 1 : -1);
      // Slow down for a car ahead in the same lane.
      let blocked = false;
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        const ahead = car.vertical
          ? (other.z - car.z) * dir > 0 && Math.abs(other.x - car.x) < 4 && Math.abs(other.z - car.z) < 12
          : (other.x - car.x) * dir > 0 && Math.abs(other.z - car.z) < 4 && Math.abs(other.x - car.x) < 12;
        if (ahead) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 8 * dt);
      const nx = car.x + (car.vertical ? 0 : Math.sin(car.heading) * car.speed * dt);
      const nz = car.z + (car.vertical ? Math.cos(car.heading) * car.speed * dt : 0);
      car.x = nx;
      car.z = nz;
      // At an intersection, sometimes turn onto the cross street.
      const onCross = CITY.roads.some((c) => Math.abs((car.vertical ? car.z : car.x) - c) < 1.5);
      if (onCross && random() < 0.004) {
        car.vertical = !car.vertical;
        car.direction = random() < 0.5 ? 1 : -1;
        car.heading = car.vertical ? (car.direction > 0 ? 0 : Math.PI) : (car.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
        const p = nearestRoadPoint(car.x, car.z);
        car.x = p.x;
        car.z = p.z;
      }
      if (car.x < -CITY.half - 20 || car.x > CITY.half + 20 || car.z < -CITY.half - 20 || car.z > CITY.half + 20) {
        const road = randomStreetPosition(random);
        car.x = road.x;
        car.z = road.z;
        car.vertical = road.vertical;
        car.heading = road.vertical ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        car.direction = random() < 0.5 ? 1 : -1;
      }
      collideBuildings(colliders, car, CAR.radius);
    }
  }

  function stepPeds(dt, events) {
    const px = player.onFoot ? player.x : (playerCar()?.x ?? player.x);
    const pz = player.onFoot ? player.z : (playerCar()?.z ?? player.z);
    const playerSpeed = player.onFoot ? 0 : Math.abs(playerCar()?.speed ?? 0);
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          const road = randomStreetPosition(random);
          ped.x = road.x + (random() < 0.5 ? -10.5 : 10.5);
          ped.z = road.z;
          ped.state = 'walk';
        }
        continue;
      }
      const d = Math.sqrt(dist2(ped.x, ped.z, px, pz));
      if (d < 9 && playerSpeed > 4) {
        ped.state = 'flee';
        ped.stateTimer = 2;
        ped.heading = Math.atan2(ped.x - px, ped.z - pz);
      }
      if (ped.state === 'flee') {
        ped.stateTimer -= dt;
        if (ped.stateTimer <= 0) ped.state = 'walk';
      }
      const speed = ped.state === 'flee' ? 5 : ped.speed;
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      if (ped.state === 'walk' && random() < 0.002) ped.heading += (random() - 0.5) * Math.PI;
      ped.x = Math.max(-CITY.half, Math.min(CITY.half, ped.x));
      ped.z = Math.max(-CITY.half, Math.min(CITY.beachStart + 10, ped.z));
      collideBuildings(colliders, ped, 0.6);
    }
    // Cash pickups on foot.
    if (player.onFoot) {
      for (const pickup of pickups) {
        if (!pickup.taken && dist2(player.x, player.z, pickup.x, pickup.z) < 4) {
          pickup.taken = true;
          pickup.respawn = 45;
          player.money += MONEY.pickup;
          state.stats.cashCollected += 1;
          events.push(EVENT_PICKUP);
        }
      }
    }
    for (const pickup of pickups) {
      if (pickup.taken) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) pickup.taken = false;
      }
    }
  }

  function stepPolice(dt, events) {
    const wantedPolice = state.wanted;
    const alive = cars.filter((c) => c.kind === 'police');
    if (alive.length < wantedPolice) {
      state.policeTimer -= dt;
      if (state.policeTimer <= 0) {
        state.policeTimer = 2;
        const angle = random() * Math.PI * 2;
        const px = player.onFoot ? player.x : (playerCar()?.x ?? player.x);
        const pz = player.onFoot ? player.z : (playerCar()?.z ?? player.z);
        const p = nearestRoadPoint(px + Math.sin(angle) * 90, pz + Math.cos(angle) * 90);
        const car = addCar('police', p.x, p.z, 0, COLORS.police, 'police');
        car.cruise = CAR.policeBase + CAR.policePerStar * state.wanted;
      }
    }
    const px = player.onFoot ? player.x : (playerCar()?.x ?? player.x);
    const pz = player.onFoot ? player.z : (playerCar()?.z ?? player.z);
    for (const car of cars) {
      if (car.kind !== 'police') continue;
      const targetHeading = Math.atan2(px - car.x, pz - car.z);
      car.heading = turnToward(car.heading, targetHeading, 2.4 * dt);
      const top = CAR.policeBase + CAR.policePerStar * state.wanted;
      car.speed = Math.min(top, car.speed + 12 * dt);
      const d = Math.sqrt(dist2(car.x, car.z, px, pz));
      // A police car creeps up to a player on foot and holds them, instead of
      // driving straight through — that is how a bust actually happens.
      if (player.onFoot && d < 5) car.speed = Math.min(car.speed, 3);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      collideBuildings(colliders, car, CAR.radius);
      if (player.onFoot && d < 2.6) {
        state.bustProgress += dt;
        if (state.bustProgress >= WANTED.bustHoldSeconds) {
          bust(events, 'Polisi menangkapmu. Kamu dibawa ke Rumah Sakit Nusa.');
          return;
        }
      } else if (!player.onFoot && d < 3.4) {
        // A ram: shove the player's car and slow it down.
        const pc = playerCar();
        if (pc) {
          pc.speed *= 0.72;
          pc.x += Math.sin(car.heading) * 1.2;
          pc.z += Math.cos(car.heading) * 1.2;
          if (Math.abs(pc.speed) > 6) events.push(EVENT_CRASH);
        }
      }
    }
    // Wanted decays when the player stays quiet and unseen.
    const nearestPolice = Math.min(...cars.filter((c) => c.kind === 'police').map((c) => Math.sqrt(dist2(c.x, c.z, px, pz))), Infinity);
    if (state.wanted > 0 && nearestPolice > 45) {
      state.wantedQuiet += dt;
      if (state.wantedQuiet > WANTED.decayQuietSeconds + WANTED.decayStepSeconds) {
        state.wanted -= 1;
        state.wantedQuiet = WANTED.decayQuietSeconds;
      }
    } else {
      state.wantedQuiet = 0;
    }
    if (state.wanted === 0) state.bustProgress = 0;
  }

  function stepGang(dt, events) {
    const px = player.x;
    const pz = player.z;
    for (const g of gang) {
      if (g.health <= 0) continue;
      const d = Math.sqrt(dist2(g.x, g.z, px, pz));
      const targetHeading = Math.atan2(px - g.x, pz - g.z);
      g.heading = turnToward(g.heading, targetHeading, 3 * dt);
      if (d > 2) {
        g.x += Math.sin(g.heading) * 4.5 * dt;
        g.z += Math.cos(g.heading) * 4.5 * dt;
      }
      collideBuildings(colliders, g, 0.6);
      if (g.attackCooldown > 0) g.attackCooldown -= dt;
      if (d < 2.2 && g.attackCooldown <= 0 && player.onFoot) {
        g.attackCooldown = 1.4;
        damagePlayer(5, events);
        events.push(EVENT_PUNCH);
      }
    }
  }

  // One fixed step of the living city. Returns the events that happened.
  // Actions are read once by the caller and handed down, so no edge is lost.
  function step(dt, input, camYaw, actions) {
    const events = [];
    const acts = actions ?? input.takeActions();
    state.elapsed += dt;
    state.time = (DAY_START_HOUR + state.elapsed / DAY_LENGTH_SECONDS * 24) % 24;

    if (player.onFoot) stepPlayerOnFoot(dt, input, camYaw, events, acts);
    else stepPlayerCar(dt, input, events);

    // E: get in or out of the nearest car.
    if (acts & ACTION_INTERACT) {
      if (player.onFoot) {
        const car = nearestCar(player.x, player.z, 4.5);
        if (car) {
          if (!car.owned && car.kind !== 'parked') {
            // Taking a moving car is a theft too.
          }
          if (!car.owned) {
            car.owned = true;
            state.stats.carsStolen += 1;
            addWanted(WANTED.stealCar, events);
          }
          car.kind = 'player';
          player.carId = car.id;
          player.onFoot = false;
          car.speed = 0;
        }
      } else {
        const car = playerCar();
        if (car) {
          player.x = car.x - Math.sin(car.heading) * 2.5;
          player.z = car.z - Math.cos(car.heading) * 2.5;
          player.heading = car.heading;
          player.onFoot = true;
          player.carId = null;
          car.speed = 0;
        }
      }
    }

    stepTraffic(dt);
    stepPeds(dt, events);
    stepPolice(dt, events);
    stepGang(dt, events);
    stepMission(dt, events);
    return events;
  }

  // The title screen's backdrop: traffic and pedestrians move, nothing else.
  function attract(dt) {
    state.elapsed += dt;
    state.time = (DAY_START_HOUR + state.elapsed / DAY_LENGTH_SECONDS * 24) % 24;
    stepTraffic(dt);
    for (const ped of peds) {
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      if (random() < 0.002) ped.heading += (random() - 0.5) * Math.PI;
    }
  }

  function serialize() {
    return {
      money: player.money,
      health: player.health,
      x: player.x,
      z: player.z,
      heading: player.heading,
      missionIndex: state.missionIndex,
      missionsDone: state.stats.missionsDone,
      storyDone: state.storyDone,
      time: state.time,
      elapsed: state.elapsed,
      carsStolen: state.stats.carsStolen,
    };
  }

  function deserialize(data) {
    player.money = data.money ?? MONEY.start;
    player.health = data.health ?? PLAYER.maxHealth;
    player.x = data.x ?? 0;
    player.z = data.z ?? -8;
    player.heading = data.heading ?? 0;
    state.missionIndex = data.missionIndex ?? 0;
    state.stats.missionsDone = data.missionsDone ?? 0;
    state.storyDone = data.storyDone ?? false;
    state.time = data.time ?? DAY_START_HOUR;
    state.elapsed = data.elapsed ?? 0;
    state.stats.carsStolen = data.carsStolen ?? 0;
  }

  reset();
  return {
    state, reset, step, attract, startMission, currentMission, currentStage,
    playerCar, nearestCar, serialize, deserialize, addWanted,
  };
}
