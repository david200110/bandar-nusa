// Pure game rules for Bandar Nusa: missions, debt, wanted level, money,
// bust fines and save data. No rendering imports here, so Node can test it.

import { DEBT_TOTAL, WANTED } from './config.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Errand',
    brief: 'Boss Jalak wants a package picked up from the pier and delivered to the market stall. Walk to the glowing marker at the pier, then carry it to the market.',
    target: 'Pick up the package at the pier',
    reward: 150000,
    steps: ['pier', 'market'],
  },
  {
    id: 'm2',
    title: 'Night Collection',
    brief: 'Three shopkeepers around the city owe Boss Jalak protection money. Visit all three shops and collect the cash.',
    target: 'Collect cash from 3 shops',
    reward: 250000,
    steps: ['shop-a', 'shop-b', 'shop-c'],
  },
  {
    id: 'm3',
    title: 'The Getaway Driver',
    brief: 'A rival left a red sedan parked near the garage. Take it, any car will do, and deliver it to the garage across town.',
    target: 'Steal a car and deliver it to the garage',
    reward: 200000,
    steps: ['steal-car', 'garage'],
  },
  {
    id: 'm4',
    title: 'Harbor Trouble',
    brief: 'Three thugs are shaking down the harbor workers. Deal with them, fists only, and make sure the harbor is safe again.',
    target: 'Defeat 3 thugs at the harbor',
    reward: 300000,
    steps: ['thug-1', 'thug-2', 'thug-3'],
  },
  {
    id: 'm5',
    title: 'Settle the Debt',
    brief: 'This is it. Bring the money to Boss Jalak at his office on the hill and pay off the debt of Rp 1,400,000 once and for all.',
    target: 'Pay Boss Jalak at his office',
    reward: 500000,
    steps: ['boss-office'],
  },
];

export function totalMissionRewards() {
  return MISSIONS.reduce((sum, m) => sum + m.reward, 0);
}

export function createState() {
  return {
    money: 0,
    debt: DEBT_TOTAL,
    missionIndex: 0,
    missionStep: 0,
    wanted: 0,
    health: 100,
    quietSeconds: 0,
    bustedCount: 0,
    thugsDown: 0,
    inCar: false,
    finished: false,
    playSeconds: 0,
  };
}

export function currentMission(state) {
  if (state.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[state.missionIndex];
}

export function currentStepId(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.missionStep] ?? null;
}

export function debtRemaining(state) {
  return Math.max(0, state.debt);
}

// Completing a mission step advances the step counter; finishing the last
// step pays the reward and moves to the next mission.
export function completeStep(state) {
  const mission = currentMission(state);
  if (!mission) return { paid: 0, missionDone: false, gameDone: false };
  state.missionStep += 1;
  if (state.missionStep < mission.steps.length) {
    return { paid: 0, missionDone: false, gameDone: false };
  }
  const paid = mission.reward;
  state.money += paid;
  state.debt = Math.max(0, state.debt - paid);
  state.missionIndex += 1;
  state.missionStep = 0;
  const gameDone = state.missionIndex >= MISSIONS.length;
  if (gameDone) state.finished = true;
  return { paid, missionDone: true, gameDone };
}

export function addWanted(state, stars) {
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.quietSeconds = 0;
  return state.wanted;
}

// Call once per second with whether the player did anything loud.
export function tickWanted(state, dtSeconds, committedCrime) {
  if (committedCrime) {
    state.quietSeconds = 0;
    return state.wanted;
  }
  if (state.wanted <= 0) return 0;
  state.quietSeconds += dtSeconds;
  if (state.quietSeconds >= WANTED.decaySeconds) {
    state.wanted -= 1;
    state.quietSeconds = 0;
  }
  return state.wanted;
}

export function bustFine(state) {
  const fine = Math.floor(state.money * WANTED.bustFineRate);
  state.money -= fine;
  state.wanted = 0;
  state.health = 100;
  state.bustedCount += 1;
  state.quietSeconds = 0;
  return fine;
}

export function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('en-US').replace(/,/g, '.');
}

export function starsText(wanted) {
  let out = '';
  for (let i = 0; i < WANTED.max; i += 1) out += i < wanted ? '★' : '☆';
  return out;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function angleLerp(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ---- Save / load -------------------------------------------------------

export function serializeSave(state, playerPos) {
  return JSON.stringify({
    version: 1,
    money: state.money,
    debt: state.debt,
    missionIndex: state.missionIndex,
    missionStep: state.missionStep,
    wanted: state.wanted,
    health: state.health,
    bustedCount: state.bustedCount,
    thugsDown: state.thugsDown,
    finished: state.finished,
    playSeconds: state.playSeconds,
    playerPos: { x: playerPos.x, z: playerPos.z },
  });
}

export function parseSave(text) {
  if (typeof text !== 'string') return null;
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || data.version !== 1) return null;
  if (typeof data.money !== 'number' || typeof data.debt !== 'number') return null;
  if (typeof data.missionIndex !== 'number' || data.missionIndex < 0) return null;
  if (data.missionIndex > MISSIONS.length) return null;
  const state = createState();
  state.money = Math.max(0, Math.floor(data.money));
  state.debt = clamp(Math.floor(data.debt), 0, DEBT_TOTAL);
  state.missionIndex = Math.floor(data.missionIndex);
  state.missionStep = Math.max(0, Math.floor(data.missionStep || 0));
  state.wanted = clamp(Math.floor(data.wanted || 0), 0, WANTED.max);
  state.health = clamp(Math.floor(data.health ?? 100), 0, 100);
  state.bustedCount = Math.max(0, Math.floor(data.bustedCount || 0));
  state.thugsDown = Math.max(0, Math.floor(data.thugsDown || 0));
  state.finished = data.finished === true;
  state.playSeconds = Math.max(0, data.playSeconds || 0);
  const pos = data.playerPos && typeof data.playerPos.x === 'number'
    ? { x: data.playerPos.x, z: data.playerPos.z }
    : { x: 0, z: 0 };
  return { state, playerPos: pos };
}
