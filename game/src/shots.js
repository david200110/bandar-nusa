// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { LANDMARKS, ROADS, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';
import { stepWorld } from './world.js';

function nearestRoad(v) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

// Road waypoints from A to B: nearest intersection, along one road, across
// the other, then into the target. Keeps the car on the roads.
function route(from, to) {
  const sx = nearestRoad(from.x);
  const sz = nearestRoad(from.z);
  const tx = nearestRoad(to.x);
  const tz = nearestRoad(to.z);
  return [
    { x: sx, z: sz },
    { x: tx, z: sz },
    { x: tx, z: tz },
    { x: to.x, z: to.z },
  ];
}

function autopilotInput(state, target) {
  const p = state.player;
  const dx = target.x - p.x;
  const dz = target.z - p.z;
  const wantHeading = Math.atan2(-dx, -dz);
  let diff = wantHeading - p.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    forward: true,
    back: false,
    left: diff > 0.15,
    right: diff < -0.15,
    run: false,
    handbrake: false,
    enter: false,
    punch: false,
    cameraYaw: p.heading,
  };
}

function driveRoute(state, targets, seconds) {
  const steps = Math.floor(seconds / STEP);
  let ti = 0;
  let wps = route(state.player, targets[0]);
  let wi = 0;
  for (let i = 0; i < steps; i += 1) {
    const p = state.player;
    const wp = wps[wi];
    if (Math.hypot(p.x - wp.x, p.z - wp.z) < 8) {
      wi += 1;
      if (wi >= wps.length) {
        ti += 1;
        if (ti >= targets.length) ti = 0;
        wps = route(p, targets[ti]);
        wi = 0;
      }
    }
    stepWorld(state, autopilotInput(state, wps[wi]));
  }
}

function driveTo(state, target, seconds) {
  driveRoute(state, [target], seconds);
}

function putInCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 1e9;
  for (const c of state.cars) {
    if (c.kind !== 'parked') continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) {
    p.x = best.x;
    p.z = best.z;
    stepWorld(state, { forward: false, back: false, left: false, right: false, run: false, handbrake: false, enter: true, punch: false, cameraYaw: p.heading });
    // Stealing raises wanted; the drive scene is a clean one.
    state.wanted = 0;
    state.police = [];
    state.cars = state.cars.filter((c) => c.kind !== 'police');
  }
}

export function stageShot(name, state) {
  if (name === 'start') {
    state.clock = 8 * 3600;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'drive') {
    state.clock = 9.5 * 3600;
    putInCar(state);
    // Stay on the roads: drive between intersections so mission 1 is still
    // the banner mid-drive and the camera never sits inside a block.
    driveRoute(state, [{ x: 0, z: 0 }, { x: 104, z: 52 }, { x: -52, z: -52 }], 16);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    state.clock = 16.8 * 3600; // dusk: low sun, still daylight after the drive
    state.wanted = 3;
    state.lastRaise = state.time;
    putInCar(state);
    // Let two police cars close in, then drive on.
    for (let i = 0; i < 60 * 4; i += 1) stepWorld(state, { forward: false, back: false, left: false, right: false, run: false, handbrake: false, enter: false, punch: false, cameraYaw: state.player.heading });
    state.camera.pitch = 0.5;
    state.camera.dist = 18;
    // Straight east along the main road so the car never cuts a corner
    // through a block (and through Balai Kota) at full speed.
    driveRoute(state, [{ x: 104, z: 0 }], 8);
    state.wanted = 3;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    state.clock = 14 * 3600;
    startMission(state, 4);
    state.player.x = LANDMARKS.warehouse.x - 24;
    state.player.z = LANDMARKS.warehouse.z - 6;
    state.player.heading = -Math.PI / 2; // face east, toward the warehouse
    state.camera.pitch = 0.55;
    state.camera.dist = 20;
    for (let i = 0; i < 60 * 3; i += 1) {
      stepWorld(state, { forward: false, back: false, left: false, right: false, run: false, handbrake: false, enter: false, punch: false, cameraYaw: state.player.heading });
    }
    return { screen: SCREEN_PLAY };
  }
  return { screen: SCREEN_TITLE };
}
