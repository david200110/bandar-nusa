// The DOM HUD: money, health, wanted stars, clock, objective, speedometer,
// prompts, toast messages and the title / pause / busted / complete screens.
import { DEBT } from './config.js';
import { missionObjective } from './missions.js';

function rupiah(n) {
  return `Rp ${Math.floor(n).toLocaleString('id-ID')}`;
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    money: $('money'),
    debt: $('debt'),
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    stars: $('stars'),
    clock: $('clock'),
    objective: $('objective'),
    distance: $('distance'),
    speed: $('speed'),
    prompt: $('prompt'),
    toast: $('toast'),
    screenTitle: $('screen-title'),
    screenPause: $('screen-pause'),
    screenBusted: $('screen-busted'),
    screenComplete: $('screen-complete'),
    bustedFine: $('busted-fine'),
    completeMoney: $('complete-money'),
    continueBtn: $('btn-continue'),
  };
  let toastTimer = 0;

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  function showScreen(name) {
    const map = { title: els.screenTitle, pause: els.screenPause, busted: els.screenBusted, complete: els.screenComplete };
    for (const [k, el] of Object.entries(map)) {
      if (el) el.classList.toggle('hidden', k !== name);
    }
  }

  function update(state) {
    const p = state.player;
    els.money.textContent = rupiah(state.money);
    els.debt.textContent = `Utang: ${rupiah(Math.max(0, DEBT - state.money))}`;
    els.healthFill.style.width = `${Math.max(0, state.health)}%`;
    els.healthText.textContent = `${Math.ceil(state.health)}`;
    els.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    els.stars.classList.toggle('hot', state.wanted > 0);
    const h = Math.floor(state.clock / 3600) % 24;
    const m = Math.floor((state.clock % 3600) / 60);
    els.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const obj = missionObjective(state);
    state.missionTarget = obj.x === null ? null : { x: obj.x, z: obj.z };
    els.objective.textContent = obj.label;
    if (obj.x === null) {
      els.distance.textContent = '';
    } else {
      const d = Math.hypot(p.x - obj.x, p.z - obj.z);
      els.distance.textContent = `${Math.round(d)} m`;
    }
    const kmh = Math.round(Math.abs(p.car ? p.car.speed : 0) * 3.6);
    els.speed.textContent = p.onFoot ? '—' : `${kmh} km/h`;
    let prompt = '';
    if (p.onFoot) {
      const near = state.cars.find((c) => c.kind !== 'police' && Math.hypot(p.x - c.x, p.z - c.z) < 3.5);
      if (near) prompt = '[E] Naik mobil' + (near.red ? ' — sedan merah!' : '');
      else if (state.gang.some((g) => !g.defeated && Math.hypot(p.x - g.x, p.z - g.z) < 6)) prompt = '[F] Pukul!';
      else prompt = 'WASD jalan · Shift lari · E naik mobil';
    } else {
      prompt = '[E] Keluar mobil · [Spasi] Rem tangan';
    }
    if (state.wanted > 0) prompt += ` · Polisi mengejar! (${state.wanted}★)`;
    els.prompt.textContent = prompt;
  }

  return { update, showToast, showScreen, els };
}
