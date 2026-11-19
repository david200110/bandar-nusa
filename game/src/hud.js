// The DOM layer over the 3D view: money, health, wanted stars, the clock, the
// mission objective, the minimap and the menus. The game never draws text in
// WebGL — the HUD is plain HTML, so it stays crisp at any size.
import { MONEY } from './config.js';

export function formatRupiah(amount) {
  return 'Rp ' + Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createHud(callbacks) {
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('money');
  const healthFill = $('health-fill');
  const healthText = $('health-text');
  const starsEl = $('stars');
  const clockEl = $('clock');
  const objectiveEl = $('objective');
  const objectiveDist = $('objective-dist');
  const speedEl = $('speed');
  const promptEl = $('prompt');
  const bannerEl = $('banner');
  const bannerTitle = $('banner-title');
  const bannerSub = $('banner-sub');
  const damageEl = $('damage');
  const mapCanvas = $('minimap');
  let bannerTimer = 0;

  function update(state, objective, carSpeed) {
    moneyEl.textContent = formatRupiah(state.player.money);
    const health = Math.max(0, Math.round(state.player.health));
    healthFill.style.width = `${health}%`;
    healthFill.style.background = health > 50 ? '#2fae5f' : health > 25 ? '#e8a13a' : '#d83a3a';
    healthText.textContent = `${health}`;
    starsEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    starsEl.classList.toggle('hot', state.wanted > 0);
    clockEl.textContent = formatClock(state.time);
    objectiveEl.textContent = objective.text;
    objectiveDist.textContent = objective.distance > 0 ? `${objective.distance} m` : '';
    if (carSpeed !== null && carSpeed !== undefined) {
      speedEl.style.display = 'block';
      speedEl.textContent = `${Math.round(Math.abs(carSpeed) * 3.6)} km/h`;
    } else {
      speedEl.style.display = 'none';
    }
    damageEl.style.opacity = state.player.health < 30 ? String(0.25 + (30 - state.player.health) / 100) : '0';
  }

  function setPrompt(text) {
    if (text) {
      promptEl.textContent = text;
      promptEl.style.display = 'block';
    } else {
      promptEl.style.display = 'none';
    }
  }

  function showBanner(title, sub, ms = 3600) {
    bannerTitle.textContent = title;
    bannerSub.textContent = sub ?? '';
    bannerEl.classList.add('show');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => bannerEl.classList.remove('show'), ms);
  }

  function hideBanner() {
    bannerEl.classList.remove('show');
  }

  function showScreen(name) {
    for (const screen of document.querySelectorAll('.screen')) screen.classList.remove('show');
    if (name) $(`screen-${name}`).classList.add('show');
  }

  function setContinueVisible(visible) {
    $('btn-continue').style.display = visible ? 'inline-block' : 'none';
  }

  function bindButtons() {
    $('btn-start').addEventListener('click', () => callbacks.onStart(false));
    $('btn-continue').addEventListener('click', () => callbacks.onStart(true));
    $('btn-resume').addEventListener('click', () => callbacks.onResume());
    $('btn-save').addEventListener('click', () => callbacks.onSave());
    $('btn-quit').addEventListener('click', () => callbacks.onQuitToTitle());
    $('btn-busted').addEventListener('click', () => callbacks.onResumeAfterBusted());
    $('btn-complete').addEventListener('click', () => callbacks.onFreeRoam());
    $('btn-mute').addEventListener('click', () => callbacks.onMute());
  }

  function setMuteLabel(muted) {
    $('btn-mute').textContent = muted ? '🔇 Suara: Mati' : '🔊 Suara: Hidup';
  }

  function setBustedText(reason) {
    $('busted-text').textContent = reason;
  }

  return {
    update, setPrompt, showBanner, hideBanner, showScreen, setContinueVisible,
    bindButtons, setMuteLabel, setBustedText, mapCanvas,
  };
}
