// Headless play-test for Bandar Nusa using Chrome DevTools Protocol.
// Launches the local server and headless Chromium, loads the game, drives
// it with real key events, checks the mission/car/police flows, and takes
// the four screenshots from shots.json.
//
// Usage: node tools/playtest.mjs
// Exits non-zero if any console error appears or any check fails.

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(here, '..');
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`;
const PORT = 8091;
const DEBUG_PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

const KEY_CODES = {
  KeyW: { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 },
  KeyA: { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 },
  KeyS: { key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 },
  KeyD: { key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 },
  KeyE: { key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 },
  KeyF: { key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 },
  ShiftLeft: { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 },
};

// ---- CDP client ---------------------------------------------------------------
let ws;
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJs(expression) {
  const res = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(`evaluate failed: ${JSON.stringify(res.exceptionDetails)}`);
  return res.result.value;
}

async function keyDown(code) {
  const k = KEY_CODES[code];
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
}
async function keyUp(code) {
  const k = KEY_CODES[code];
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
}
async function tapKey(code) {
  await keyDown(code);
  await sleep(120);
  await keyUp(code);
}
async function holdKey(code, ms) {
  await keyDown(code);
  await sleep(ms);
  await keyUp(code);
}

// ---- Main -----------------------------------------------------------------------
const server = spawn('node', ['serve.ts'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
// Wait until the server actually answers before launching the browser.
let serverUp = false;
for (let i = 0; i < 30; i += 1) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/game/index.html`);
    if (res.status === 200) { serverUp = true; break; }
  } catch { /* not up yet */ }
}
if (!serverUp) throw new Error('local server did not start — cannot play-test');

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--window-size=1280,720',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--user-data-dir=/tmp/bn-chrome-profile',
  'about:blank',
], { stdio: 'ignore' });

let target = null;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const list = await res.json();
    target = list.find((t) => t.type === 'page');
  } catch { /* not up yet */ }
}
if (!target) throw new Error('Chromium did not start a debug target');

ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(JSON.stringify(msg.params.args));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(JSON.stringify(msg.params.exceptionDetails));
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push(msg.params.entry.text);
  }
};

await cdp('Runtime.enable');
await cdp('Page.enable');
await cdp('Log.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

async function load(url) {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  await cdp('Page.navigate', { url });
  // First run can be slow: SwiftShader compiles the WebGL shaders in
  // software, so allow up to two minutes for the scene to become ready.
  for (let i = 0; i < 240; i += 1) {
    await sleep(500);
    try {
      const ready = await evalJs('window.__shotReady === true');
      if (ready) return true;
    } catch { /* page still loading */ }
  }
  return false;
}

const base = `http://127.0.0.1:${PORT}/game/index.html`;

// ---- 1. Street shot: boots, runs, HUD visible ---------------------------------
let ok = await load(`${base}?shot=street&seed=59`);
check('game boots and renders (street shot)', ok);
check('no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));
check('no page exceptions on load', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
check('game handle is exposed', await evalJs('!!window.__game'));
check('mission 1 is active', await evalJs('window.__game.state.missionIndex === 0'));
check('HUD is visible', await evalJs('document.getElementById("hud").classList.contains("on")'));
check('minimap canvas exists', await evalJs('!!document.getElementById("minimap")'));
check('money starts at Rp 0', await evalJs('window.__game.state.money === 0'));

// ---- 2. Movement -----------------------------------------------------------------
const before = await evalJs('({x: window.__game.player.pos.x, z: window.__game.player.pos.z})');
await holdKey('KeyW', 4000);
const after = await evalJs('({x: window.__game.player.pos.x, z: window.__game.player.pos.z})');
const moved = Math.hypot(after.x - before.x, after.z - before.z);
check('player walks forward with W', moved > 3, `moved ${moved.toFixed(2)}m`);

// ---- 3. Mission 1: pier then market ----------------------------------------------
await evalJs('window.__game.teleport(4, 176)');
await sleep(1200);
check('pier step completes at the pier', await evalJs('window.__game.state.missionStep === 1'));
await evalJs('window.__game.teleport(-40, -40)');
await sleep(1200);
check('mission 1 pays Rp 150,000', await evalJs('window.__game.state.money === 150000'));
check('mission 2 is now active', await evalJs('window.__game.state.missionIndex === 1'));
check('debt drops to Rp 1,250,000', await evalJs('window.__game.state.debt === 1250000'));

// ---- 4. Steal a car and drive -------------------------------------------------------
await evalJs(`(() => {
  const g = window.__game;
  const car = g.cars.find((c) => !c.isPolice && !c.traffic);
  g.teleport(car.x + 2, car.z + 2);
  return true;
})()`);
await sleep(300);
await tapKey('KeyE');
await sleep(500);
check('entering a car works (E)', await evalJs('!!window.__game.state.inCar'));
check('stealing a car adds a wanted star', await evalJs('window.__game.state.wanted >= 1'));
const carBefore = await evalJs('({x: window.__game.player.pos.x, z: window.__game.player.pos.z})');
await holdKey('KeyW', 5000);
const carAfter = await evalJs('({x: window.__game.player.pos.x, z: window.__game.player.pos.z})');
const drove = Math.hypot(carAfter.x - carBefore.x, carAfter.z - carBefore.z);
check('car drives forward with W', drove > 5, `drove ${drove.toFixed(2)}m`);
await tapKey('KeyE');
await sleep(400);
check('exiting a car works (E)', await evalJs('!window.__game.state.inCar'));

// ---- 5. Police chase and bust ---------------------------------------------------------
await evalJs('window.__game.setWanted(3)');
await sleep(9000);
check('police spawn while wanted', await evalJs('window.__game.police.length > 0'));
// Keep a cop glued to the player until the bust timer (1.2 s of game
// time) fills — at software-rendering frame rates this takes a while.
let busted = false;
for (let i = 0; i < 8 && !busted; i += 1) {
  await evalJs(`(() => {
    const g = window.__game;
    if (!g.police.length) return false;
    const cop = g.police[0].car;
    cop.x = g.player.pos.x + 1;
    cop.z = g.player.pos.z + 1;
    return true;
  })()`);
  await sleep(2000);
  busted = await evalJs('document.getElementById("screen-busted").style.display === "flex"');
}
check('busted screen appears when a cop holds you', busted);
check('bust clears wanted stars', await evalJs('window.__game.state.wanted === 0'));
check('bust takes a 10 percent fine', await evalJs('window.__game.state.money === 135000'));

// ---- 6. Save / load -----------------------------------------------------------------------
await evalJs('window.__game.saveGame()');
const saved = await evalJs('JSON.parse(localStorage.getItem("bandar-nusa-save-v1")).money');
check('save writes money to localStorage', saved === 135000, `saved ${saved}`);
check('no console errors during the whole play-test', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));
check('no page exceptions during the whole play-test', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

// ---- 7. Screenshots --------------------------------------------------------------------------
await mkdir(join(ROOT, 'screenshots'), { recursive: true });
const shots = JSON.parse(await readFile(join(ROOT, 'shots.json'), 'utf8'));
for (const shot of shots) {
  const ready = await load(`${base}${shot.query}`);
  check(`screenshot scene loads (${shot.name})`, ready);
  await sleep(1800); // let the scene settle and the day/night light settle
  let quality = 82;
  let data = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shotRes = await cdp('Page.captureScreenshot', { format: 'jpeg', quality });
    data = Buffer.from(shotRes.data, 'base64');
    if (data.length <= 262144) break;
    quality -= 14;
  }
  const path = join(ROOT, 'screenshots', shot.name);
  await writeFile(path, data);
  check(`screenshot ${shot.name} is 1280x720 JPEG under 256 KiB`,
    data.length <= 262144, `${data.length} bytes at quality ${quality}`);
  console.log(`      ${shot.name}: ${data.length} bytes`);
}

console.log(`\n${passed} passed, ${failed} failed`);
function cleanup() {
  try { ws.close(); } catch {}
  try { chrome.kill(); } catch {}
  try { server.kill(); } catch {}
}
cleanup();
process.exit(failed > 0 ? 1 : 0);
