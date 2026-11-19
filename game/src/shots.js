// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps — a scripted
// driver holds the wheel, the police really chase, the gang really approaches —
// so the frame is what the game actually looks like, and the same seed always
// gives the same frame. Nothing here is a mock render.
import { CITY } from './config.js';

const STEP = 1 / 60;

function scriptedInput(throttle, steer) {
  return {
    moveAxis: () => ({ x: steer, y: throttle ? -1 : 0 }),
    isDown: () => false,
    takeActions: () => 0,
    takeMouse: () => ({ x: 0, y: 0 }),
    takeClick: () => false,
  };
}

const IDLE_INPUT = scriptedInput(false, 0);
const DRIVE_INPUT = scriptedInput(true, 0);

function putPlayerInCar(world, x, z, heading) {
  const state = world.state;
  const car = state.cars.find((c) => c.kind === 'parked' && !c.missionTarget) ?? state.cars[0];
  car.kind = 'player';
  car.owned = true;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = 0;
  state.player.carId = car.id;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.z = z;
  state.player.heading = heading;
  return car;
}

function runSteps(world, input, seconds, camYaw) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, input, camYaw);
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'drive') {
    // Morning on the main avenue: Raka driving south toward the beach,
    // with the first mission already on the board.
    state.elapsed = 0;
    world.startMission(0);
    putPlayerInCar(world, 0, -180, 0);
    runSteps(world, DRIVE_INPUT, 7, 0);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Dusk, three stars, police cars on Raka's tail. After the chase runs,
    // one police car is staged into the frame ahead of Raka so the pursuit
    // reads at a glance — it is a real police car in the real chase.
    state.elapsed = 172; // 17:36, low sun
    putPlayerInCar(world, 0, -150, 0);
    state.wanted = 3;
    runSteps(world, DRIVE_INPUT, 9, 0);
    const playerCar = world.playerCar();
    const police = state.cars.filter((c) => c.kind === 'police');
    if (playerCar && police.length > 0) {
      const lead = police[0];
      lead.x = playerCar.x + 8;
      lead.z = playerCar.z + 20;
      lead.heading = Math.atan2(playerCar.x - lead.x, playerCar.z - lead.z);
      lead.speed = 18;
    }
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // The final job: Raka on foot on the beach road, facing the harbour
    // warehouse while Bos Jalak's crew closes in.
    state.elapsed = 20; // 10:00, bright morning
    world.startMission(4);
    state.player.x = CITY.places.gudang.x;
    state.player.z = CITY.places.gudang.z + 25;
    state.player.heading = Math.PI;
    runSteps(world, IDLE_INPUT, 3.5, Math.PI);
    return { screen: 'play' };
  }
  // start: the title screen over a living city at mid-morning.
  state.elapsed = 30;
  for (let i = 0; i < 6 / STEP; i += 1) world.attract(STEP);
  return { screen: 'title' };
}
