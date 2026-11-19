// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens: title, play, paused, busted and story-complete.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import {
  createWorld,
  EVENT_PICKUP, EVENT_CRASH, EVENT_PUNCH, EVENT_WANTED_UP, EVENT_STAGE,
  EVENT_MISSION_COMPLETE, EVENT_MISSION_FAILED, EVENT_BUSTED, EVENT_STORY_COMPLETE,
  EVENT_GANG_DOWN,
} from './world.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { createHud, formatRupiah } from './hud.js';
import { hasSave, saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';
import { MISSIONS, STORY_INTRO, STORY_COMPLETE, objectiveText } from './missions.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const hudRoot = document.getElementById('hud');

const random = createRandom(seed);
const renderer = createRenderer(canvas);
const city = buildCity(renderer.scene, random);
const world = createWorld(random, city);
const input = createInput(canvas);
const audio = createAudio();

function announce(message) {
  statusEl.textContent = message;
}

const hud = createHud({
  onStart: (useSave) => startGame(useSave),
  onResume: () => resumeGame(),
  onSave: () => {
    if (saveGame(world.serialize())) hud.showBanner('Tersimpan', 'Progres Raka tersimpan di browser ini.');
  },
  onQuitToTitle: () => showTitle(),
  onResumeAfterBusted: () => resumeGame(),
  onFreeRoam: () => resumeGame(),
  onMute: () => {
    audio.ensure();
    hud.setMuteLabel(audio.setMuted(!audio.isMuted()));
  },
});
hud.bindButtons();

let screen = 'title';

function setHudVisible(visible) {
  hudRoot.classList.toggle('show', visible);
}

function showTitle() {
  screen = 'title';
  world.reset();
  hud.showScreen('title');
  hud.setContinueVisible(hasSave());
  setHudVisible(false);
  audio.setMusic(false);
  audio.siren(false);
  audio.engine(0, false);
  announce('Bandar Nusa. Press Enter or click Mula to play.');
}

function startGame(useSave) {
  audio.ensure();
  audio.setMusic(true);
  audio.click();
  world.reset();
  if (useSave) {
    const data = loadGame();
    if (data) {
      world.deserialize(data);
      if (!data.storyDone && data.missionIndex < MISSIONS.length) world.startMission(data.missionIndex);
    }
  } else {
    world.startMission(0);
    hud.showBanner(MISSIONS[0].title, MISSIONS[0].briefing, 5200);
  }
  screen = 'play';
  hud.showScreen(null);
  setHudVisible(true);
  announce('Playing. Follow the yellow marker.');
}

function resumeGame() {
  audio.click();
  screen = 'play';
  hud.showScreen(null);
  setHudVisible(true);
  announce('Playing.');
}

function pauseGame() {
  screen = 'paused';
  hud.showScreen('paused');
  announce('Paused.');
}

function handleEvents(events) {
  for (const event of events) {
    if (event === EVENT_PICKUP) {
      audio.pickup();
      hud.showBanner('Uang ditemukan', `+${formatRupiah(25000)}`, 1800);
    } else if (event === EVENT_CRASH) {
      audio.crash();
    } else if (event === EVENT_PUNCH) {
      audio.punch();
    } else if (event === EVENT_WANTED_UP) {
      hud.showBanner('Buronan!', `Bintang buronanmu naik menjadi ${world.state.wanted}.`, 2600);
    } else if (event === EVENT_STAGE) {
      audio.pickup();
      const mission = world.currentMission();
      const stage = world.currentStage();
      if (mission && stage) hud.showBanner(mission.title, stage.text, 3200);
    } else if (event === EVENT_MISSION_COMPLETE) {
      const done = MISSIONS[world.state.missionIndex];
      audio.jingle();
      hud.showBanner('Misi selesai!', `${done.title} — hadiah ${formatRupiah(done.reward)}.`, 4200);
      saveGame(world.serialize());
      const next = world.state.missionIndex + 1;
      if (next < MISSIONS.length && !world.state.storyDone) {
        world.startMission(next);
        const upcoming = MISSIONS[next];
        window.setTimeout(() => {
          if (screen === 'play') hud.showBanner(upcoming.title, upcoming.briefing, 5200);
        }, 4300);
      }
    } else if (event === EVENT_MISSION_FAILED) {
      audio.fail();
      if (!world.state.missionActive) {
        world.startMission(world.state.missionIndex);
        hud.showBanner('Misi gagal', 'Coba lagi — misinya dimulai dari awal.', 3200);
      } else {
        hud.showBanner('Misi gagal', 'Kamu tertangkap — misi dimulai dari awal.', 3200);
      }
    } else if (event === EVENT_BUSTED) {
      audio.fail();
      audio.siren(false);
      hud.setBustedText(world.state.bustReason ?? 'Kamu tertangkap.');
      screen = 'busted';
      hud.showScreen('busted');
      setHudVisible(false);
      announce('Busted.');
    } else if (event === EVENT_GANG_DOWN) {
      hud.showBanner('Satu tumbang!', 'Teruskan, Raka.', 1600);
    } else if (event === EVENT_STORY_COMPLETE) {
      audio.jingle();
      document.getElementById('complete-text').textContent = STORY_COMPLETE;
      screen = 'complete';
      hud.showScreen('complete');
      setHudVisible(false);
      saveGame(world.serialize());
      announce('Story complete.');
    }
  }
}

function currentObjective() {
  const mission = world.currentMission();
  const stage = world.currentStage();
  const player = world.state.player;
  return objectiveText(mission, stage, player.x, player.z);
}

function interactionPrompt() {
  const player = world.state.player;
  if (player.onFoot) {
    const car = world.nearestCar(player.x, player.z, 4.5);
    if (!car) return null;
    if (car.missionTarget && !car.owned) return '[E] Curi sedan merah';
    return car.owned ? '[E] Masuk mobil' : '[E] Masuk mobil (mencuri = +1 bintang)';
  }
  return '[E] Keluar mobil';
}

function runShot(name) {
  const scene = stageShot(name, world);
  hud.setContinueVisible(false);
  // Stage the chase camera behind the player: the two paint calls do not
  // run long enough for the orbit to settle on its own.
  if (name === 'drive' || name === 'chase') renderer.setOrbit(0);
  if (name === 'mission') renderer.setOrbit(Math.PI);
  if (name !== 'start') renderer.setDistance(15);
  if (scene.screen === 'title') {
    hud.showScreen('title');
    setHudVisible(false);
    document.getElementById('story-intro').textContent = STORY_INTRO;
  } else {
    hud.showScreen(null);
    setHudVisible(true);
    const objective = currentObjective();
    hud.update(world.state, objective, world.state.player.onFoot ? null : world.playerCar()?.speed ?? 0);
    hud.setPrompt(null);
    const mission = world.currentMission();
    const stage = world.currentStage();
    if (mission && stage) hud.showBanner(mission.title, stage.text, 60000);
  }
  let painted = 0;
  function paint() {
    renderer.sync(STEP, input, world.state.time, world, city);
    const mission = world.currentMission();
    const stage = world.currentStage();
    renderer.drawMinimap(hud.mapCanvas, world.state, stage?.target ?? null, city);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  showTitle();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.ensure();
      hud.setMuteLabel(audio.setMuted(!audio.isMuted()));
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) startGame(false);
      while (accumulator >= STEP) {
        world.attract(STEP);
        accumulator -= STEP;
      }
      renderer.sync(STEP, input, world.state.time, world, city);
      return;
    }
    if (screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) resumeGame();
      accumulator = 0;
      renderer.sync(0, input, world.state.time, world, city);
      return;
    }
    if (screen === 'busted' || screen === 'complete') {
      if (actions & ACTION_CONFIRM) resumeGame();
      accumulator = 0;
      renderer.sync(0, input, world.state.time, world, city);
      return;
    }
    // screen === 'play'
    if (actions & ACTION_PAUSE) {
      pauseGame();
      renderer.sync(0, input, world.state.time, world, city);
      return;
    }
    while (accumulator >= STEP) {
      const events = world.step(STEP, input, renderer.orbitYaw, actions);
      handleEvents(events);
      accumulator -= STEP;
    }
    const car = world.playerCar();
    audio.engine(car ? Math.abs(car.speed) / 27 : 0, !!car);
    audio.siren(world.state.wanted > 0);
    audio.update();
    const objective = currentObjective();
    hud.update(world.state, objective, car ? car.speed : null);
    hud.setPrompt(interactionPrompt());
    const stage = world.currentStage();
    renderer.drawMinimap(hud.mapCanvas, world.state, stage?.target ?? null, city);
    renderer.sync(STEP, input, world.state.time, world, city);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') pauseGame();
  });

  announce('Bandar Nusa. Press Space or click to start.');
  requestAnimationFrame(frame);
}

document.getElementById('story-intro').textContent = STORY_INTRO;

if (shot) runShot(shot);
else runGame();
