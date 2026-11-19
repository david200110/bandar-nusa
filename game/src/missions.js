// The five chained story missions. Pure logic over the world state: no DOM,
// no THREE, so the Node tests can drive it directly.
import { LANDMARKS, MISSIONS, WANTED } from './config.js';

export function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  state.missionIndex = index;
  state.mission = { status: 'active', timer: def.timeLimit ?? null, survive: 0, gangLeft: def.gang ?? 0 };
  state.gang = [];
  if (def.wanted) {
    state.wanted = def.wanted;
    state.lastRaise = state.time;
  }
  if (def.gang) {
    for (let i = 0; i < def.gang; i += 1) {
      state.gang.push({
        id: `gang-${index}-${i}`,
        x: LANDMARKS.warehouse.x - 12 + i * 10,
        z: LANDMARKS.warehouse.z - 8 + (i % 2) * 14,
        heading: 0,
        health: 3,
        attackCooldown: 0,
        defeated: false,
      });
    }
  }
  state.events.push({ type: 'missionStart', mission: def });
}

export function completeMission(state) {
  const def = MISSIONS[state.missionIndex];
  state.money += def.reward;
  state.mission.status = 'done';
  state.events.push({ type: 'missionComplete', mission: def });
  state.missionIndex += 1;
  if (state.missionIndex >= MISSIONS.length) {
    state.storyComplete = true;
    state.events.push({ type: 'storyComplete' });
  } else {
    startMission(state, state.missionIndex);
  }
}

export function failMission(state, reason) {
  const def = MISSIONS[state.missionIndex];
  state.events.push({ type: 'missionFailed', mission: def, reason });
  startMission(state, state.missionIndex);
}

// Called once per fixed step from the world loop.
export function updateMissions(state, dt) {
  const def = currentMission(state);
  if (!def || state.mission.status !== 'active' || state.storyComplete) return;
  const p = state.player;

  if (def.timeLimit && state.mission.timer !== null) {
    state.mission.timer -= dt;
    if (state.mission.timer <= 0) {
      failMission(state, 'timeout');
      return;
    }
  }

  if (def.id === 'paket' || def.id === 'setoran') {
    if (dist2(p, def.target) < 6) completeMission(state);
    return;
  }

  if (def.id === 'mobil') {
    if (!p.onFoot && p.car && p.car.red) completeMission(state);
    return;
  }

  if (def.id === 'razia') {
    if (!p.onFoot && state.wanted >= 3) {
      state.mission.survive += dt;
      if (state.mission.survive >= def.survive) {
        state.wanted = 0;
        completeMission(state);
      }
    }
    return;
  }

  if (def.id === 'lunas') {
    const left = state.gang.filter((g) => !g.defeated).length;
    state.mission.gangLeft = left;
    if (left === 0 && dist2(p, def.target) < 7) completeMission(state);
  }
}

export function missionObjective(state) {
  const def = currentMission(state);
  if (!def) return { label: 'Utang lunas — bebas berkeliling Bandar Nusa!', x: null, z: null };
  if (def.id === 'lunas' && state.mission.gangLeft > 0) {
    return { label: `Kalahkan ${state.mission.gangLeft} anak buah Bos Jalak di gudang`, x: LANDMARKS.warehouse.x, z: LANDMARKS.warehouse.z };
  }
  if (def.id === 'razia') {
    return { label: `Bertahan ${Math.ceil(def.survive - state.mission.survive)} detik dengan 3 bintang — tetap mengemudi!`, x: null, z: null };
  }
  if (def.target) return { label: def.name, x: def.target.x, z: def.target.z };
  return { label: def.name, x: null, z: null };
}

export { WANTED };
