// Bandar Nusa — entry point. Boots the game and exposes a small handle
// for the play-test harness and the screenshot poses.

import { startGame } from './game.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

const params = new URLSearchParams(window.location.search);
const game = startGame(canvas, {
  seed: Number(params.get('seed') || 20261120),
});

window.__game = game;
window.__shotReady = false;

// Show the HUD whenever the game is actually playing (not on the title screen).
const observer = new MutationObserver(() => {
  const start = document.getElementById('screen-start');
  const visible = start && start.style.display !== 'none' && start.style.display !== '';
  hud.classList.toggle('on', !visible || params.has('shot'));
});
observer.observe(document.getElementById('screen-start'), { attributes: true, attributeFilter: ['style'] });
if (params.has('shot')) hud.classList.add('on');

window.addEventListener('error', (event) => {
  // Surface load errors in the status line so a headless run can see them.
  const status = document.getElementById('status');
  if (status) status.textContent = `Error: ${event.message}`;
});
