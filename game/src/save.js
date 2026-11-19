// Save / load through localStorage, with a storage object injected so the
// Node logic tests can use a fake one.
import { SAVE_KEY } from './config.js';

export function saveGame(state, storage) {
  const store = storage || window.localStorage;
  try {
    store.setItem(
      SAVE_KEY,
      JSON.stringify({
        money: state.money,
        missionIndex: state.missionIndex,
        health: state.health,
        x: state.player.x,
        z: state.player.z,
        heading: state.player.heading,
        clock: state.clock,
        wanted: state.wanted,
        savedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage) {
  const store = storage || window.localStorage;
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(state, data) {
  state.money = data.money;
  state.health = data.health ?? 100;
  state.clock = data.clock ?? state.clock;
  state.wanted = 0; // a fresh start is never wanted
  state.player.x = data.x;
  state.player.z = data.z;
  state.player.heading = data.heading ?? 0;
  state.player.onFoot = true;
  state.player.car = null;
}
