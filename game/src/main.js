// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, the renderer paints what is there, and the HUD follows.
// Screens: title, play, paused, busted, complete.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { applySave, loadGame, saveGame } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const state = createWorld(createRandom(seed));
state.camera = { yaw: Math.PI, pitch: 0.32, dist: 14 };
state.missionTarget = null;

const renderer = createRenderer(canvas, minimap);
const hud = createHud();
const audio = createAudio();
const saved = loadGame();
if (saved && saved.missionIndex < 5) {
  hud.els.continueBtn.classList.remove('hidden');
}

let screen = SCREEN_TITLE;
let accumulator = 0;
let last = performance.now();

function show(screenName) {
  screen = screenName;
  const all = [hud.els.screenTitle, hud.els.screenPause, hud.els.screenBusted, hud.els.screenComplete];
  if (screenName === SCREEN_PLAY) {
    for (const el of all) if (el) el.classList.add('hidden');
    return;
  }
  // hud.showScreen keys screens by their element suffix: 'pause', not the
  // render constant 'paused'.
  hud.showScreen(screenName === SCREEN_PAUSED ? 'pause' : screenName);
}

function startGame(fromSave) {
  if (fromSave && saved) {
    applySave(state, saved);
    // Re-arm the mission chain at the saved step; banked money stays banked.
    const idx = Math.min(saved.missionIndex, 4);
    if (idx > 0) startMission(state, idx);
  }
  show(SCREEN_PLAY);
  audio.unlock();
}

function handleEvents(events) {
  for (const e of events) {
    if (e.type === 'pickup') {
      hud.showToast(`+Rp ${e.value.toLocaleString('id-ID')}`);
      audio.pickup();
    } else if (e.type === 'missionComplete') {
      hud.showToast(`${e.mission.name} selesai! +Rp ${e.mission.reward.toLocaleString('id-ID')}`);
      audio.jingle();
      saveGame(state);
    } else if (e.type === 'missionStart') {
      hud.showToast(e.mission.brief);
    } else if (e.type === 'missionFailed') {
      hud.showToast(`${e.mission.name} gagal (${e.reason}) — coba lagi!`);
    } else if (e.type === 'busted') {
      audio.busted();
      show(SCREEN_BUSTED);
      hud.els.bustedFine.textContent = `Denda Rp ${e.fine.toLocaleString('id-ID')} — kamu ditangkap polisi dan dibawa ke Rumah Sakit.`;
      saveGame(state);
    } else if (e.type === 'storyComplete') {
      audio.fanfare();
      show(SCREEN_COMPLETE);
      hud.els.completeMoney.textContent = `Total uang: Rp ${state.money.toLocaleString('id-ID')} — utang Rp 1.400.000 lunas!`;
      saveGame(state);
    } else if (e.type === 'punch') {
      audio.punch();
    } else if (e.type === 'crash') {
      audio.crash();
    } else if (e.type === 'stolen') {
      hud.showToast('Mobil dicuri! Polisi waspada.');
    } else if (e.type === 'hitPed') {
      hud.showToast('Kamu menabrak pejalan kaki!');
    }
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  if (scene.screen !== SCREEN_TITLE) {
    // No title overlay over a gameplay shot, and the camera sits behind the
    // player so the car, the chase or the gang is actually in frame.
    show(SCREEN_PLAY);
    state.camera.yaw = state.player.heading;
  }
  hud.update(state);
  window.__debugState = () => ({
    player: { x: +state.player.x.toFixed(1), z: +state.player.z.toFixed(1), heading: +state.player.heading.toFixed(2), onFoot: state.player.onFoot },
    camera: { yaw: +state.camera.yaw.toFixed(2), pitch: state.camera.pitch, dist: state.camera.dist },
    wanted: state.wanted,
    mission: state.missionIndex,
    money: state.money,
    cars: state.cars.length,
    police: state.police.length,
    playerInBuilding: state.city.buildings.filter((b) => Math.abs(state.player.x - b.x) < b.w / 2 && Math.abs(state.player.z - b.z) < b.d / 2).map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h })),
  });
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  show(SCREEN_TITLE);

  document.getElementById('btn-start').addEventListener('click', () => startGame(false));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
  document.getElementById('btn-resume').addEventListener('click', () => show(SCREEN_PLAY));
  document.getElementById('btn-restart').addEventListener('click', () => {
    const fresh = createWorld(createRandom(seed));
    Object.assign(state, fresh);
    state.camera = { yaw: Math.PI, pitch: 0.32, dist: 14 };
    show(SCREEN_PLAY);
  });
  document.getElementById('btn-roam').addEventListener('click', () => show(SCREEN_PLAY));
  document.getElementById('btn-busted-ok').addEventListener('click', () => show(SCREEN_PLAY));

  function frame(now) {
    requestAnimationFrame(frame);
    const held = input.poll();
    const once = input.consume();
    state.camera.yaw += once.dragYaw;
    state.camera.pitch = Math.max(0.05, Math.min(1.1, state.camera.pitch + once.dragPitch));
    state.camera.dist = Math.max(8, Math.min(30, state.camera.dist + once.zoom));
    if (screen === SCREEN_PLAY) {
      // The camera eases back behind the player so driving never leaves the
      // car out of frame; mouse drag still orbits freely.
      let dy = state.player.heading - state.camera.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      state.camera.yaw += dy * Math.min(1, ((now - last) / 1000) * 2.2);
    }
    if (once.mute) {
      const muted = audio.toggleMute();
      hud.showToast(muted ? 'Suara mati' : 'Suara hidup');
    }
    if (once.pause) {
      if (screen === SCREEN_PLAY) {
        show(SCREEN_PAUSED);
        saveGame(state);
      } else if (screen === SCREEN_PAUSED) {
        show(SCREEN_PLAY);
      }
    }
    if (screen === SCREEN_TITLE && once.confirm) startGame(false);
    if (screen === SCREEN_PLAY) {
      audio.unlock();
      const dt = Math.min(MAX_FRAME, (now - last) / 1000);
      last = now;
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 5) {
        const events = stepWorld(state, {
          forward: held.forward,
          back: held.back,
          left: held.left,
          right: held.right,
          run: held.run,
          handbrake: held.handbrake,
          enter: once.enter,
          punch: once.punch,
          cameraYaw: state.camera.yaw,
        });
        handleEvents(events);
        once.enter = false;
        once.punch = false;
        accumulator -= STEP;
        steps += 1;
      }
      audio.update(dt, { speed: state.player.speed, wanted: state.wanted, driving: !state.player.onFoot });
      hud.update(state);
      renderer.draw(state, SCREEN_PLAY);
    } else {
      last = now;
      if (screen === SCREEN_TITLE) {
        hud.update(state);
        renderer.draw(state, SCREEN_TITLE);
      }
    }
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
