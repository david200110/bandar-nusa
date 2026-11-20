// Bandar Nusa — main game: player, cars, police, combat, missions,
// HUD, minimap, day/night cycle and save/load. All visible text is English.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, PLAYER, CAR, WANTED, DAY, SAVE_KEY, COLORS } from './config.js';
import {
  createState, currentMission, currentStepId, completeStep, addWanted,
  tickWanted, bustFine, formatRupiah, starsText, clamp, distance2D,
  angleLerp, serializeSave, parseSave,
} from './logic.js';
import { buildWorld, makeCarMesh, makePersonMesh, PLACES } from './world.js';
import { createInput } from './input.js';
import { createMusic } from './audio.js';
import { mulberry32, range, pick } from './random.js';

const SHIRT_COLORS = [0x3f7d4e, 0x7d3f3f, 0x3f5a7d, 0x8a6d2f, 0x6a4a7d, 0x4a7d7a];
const COP_COLOR = 0x1c3a5e;

function el(id) {
  return document.getElementById(id);
}

function resolveCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = clamp(pos.x, c.minX, c.maxX);
    const nz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        pos.z = c.maxZ + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    }
  }
}

export function startGame(canvas, options = {}) {
  const seed = options.seed ?? 20261120;
  const rng = mulberry32(seed);
  const state = createState();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.skyDay);
  scene.fog = new THREE.Fog(COLORS.skyDay, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 26, 40);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sunDay, 1.6);
  sun.position.set(80, 120, 40);
  scene.add(sun);
  scene.add(sun.target);

  const world = buildWorld(scene, seed);

  const input = createInput(canvas);
  const music = createMusic();

  // --- Player ------------------------------------------------------------
  const playerMesh = makePersonMesh(0x2e6fc2, 0xd9a066);
  scene.add(playerMesh);
  const player = {
    pos: new THREE.Vector3(PLACES.spawn.x, 0, PLACES.spawn.z),
    heading: 0,
    speed: 0,
    health: 100,
    punchTimer: 0,
    walkPhase: 0,
  };

  // --- Cars ---------------------------------------------------------------
  const cars = [];
  function addCar(x, z, color, angle, isPolice) {
    const mesh = makeCarMesh(color, isPolice);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    scene.add(mesh);
    const car = {
      mesh, x, z, angle, speed: 0, color, isPolice: !!isPolice,
      isPlayerCar: false, traffic: false, loop: null, loopIndex: 0,
      stuck: 0,
    };
    cars.push(car);
    return car;
  }

  for (const spot of world.parkedSpots) {
    addCar(spot.x, spot.z, spot.color, spot.angle, false);
  }
  // Traffic cars on the loops.
  for (let li = 0; li < world.trafficLoops.length; li += 1) {
    const loop = world.trafficLoops[li];
    for (let k = 0; k < 3; k += 1) {
      const p = loop[(li + k) % loop.length];
      const car = addCar(p.x + range(rng, -2, 2), p.z + range(rng, -2, 2), pick(rng, [0xc23b2e, 0x2e6fc2, 0xe0a52e, 0xe8e8e8]), 0, false);
      car.traffic = true;
      car.loop = loop;
      car.loopIndex = (li + k + 1) % loop.length;
      car.speed = CAR.trafficSpeed;
    }
  }
  const playerCar = { current: null };

  // --- Pedestrians ----------------------------------------------------------
  const pedestrians = [];
  for (const spot of world.pedSpots) {
    const mesh = makePersonMesh(pick(rng, SHIRT_COLORS));
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    pedestrians.push({
      mesh, x: spot.x, z: spot.z, heading: range(rng, 0, Math.PI * 2),
      target: null, speed: 1.4, flee: 0, punchTimer: 0,
    });
  }

  // --- Thugs (mission 4) -----------------------------------------------------
  const thugs = [];
  function spawnThugs() {
    if (thugs.length) return;
    const spots = [
      { x: -56, z: 156 }, { x: -64, z: 160 }, { x: -52, z: 162 },
    ];
    for (const s of spots) {
      const mesh = makePersonMesh(0x8a1f1f, 0xc98a5a);
      mesh.position.set(s.x, 0, s.z);
      mesh.scale.set(1.15, 1.15, 1.15);
      scene.add(mesh);
      thugs.push({ mesh, x: s.x, z: s.z, heading: 0, hp: 100, punchTimer: 0, alive: true });
    }
  }

  // --- Police ------------------------------------------------------------------
  const police = [];
  function spawnPolice() {
    if (police.length >= 3 || state.wanted < 1) return;
    const angle = range(rng, 0, Math.PI * 2);
    const px = clamp(player.pos.x + Math.cos(angle) * 45, -170, 170);
    const pz = clamp(player.pos.z + Math.sin(angle) * 45, -150, 150);
    const car = addCar(px, pz, 0x1c3a5e, 0, true);
    car.isPolice = true;
    police.push({ car, bustTimer: 0 });
  }

  // --- Mission marker ------------------------------------------------------------
  const marker = new THREE.Group();
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 15;
  marker.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  marker.add(ring);
  scene.add(marker);

  function stepPlace() {
    const step = currentStepId(state);
    if (!step) return null;
    if (step === 'steal-car') {
      let best = null;
      let bestD = Infinity;
      for (const c of cars) {
        if (c.isPolice || c.traffic || c.isPlayerCar) continue;
        const d = distance2D(player.pos.x, player.pos.z, c.x, c.z);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best ? { x: best.x, z: best.z, label: 'A car to take' } : PLACES.garage;
    }
    if (step === 'thug-1' || step === 'thug-2' || step === 'thug-3') return PLACES.harbor;
    return PLACES[step] || null;
  }

  // --- HUD ----------------------------------------------------------------------
  const hud = {
    money: el('money'), debt: el('debt'), stars: el('stars'),
    healthFill: el('health-fill'), objective: el('objective'),
    missionTitle: el('mission-title'), toast: el('toast'),
    clock: el('clock'), speed: el('speed'),
  };
  const minimap = el('minimap');
  const mapCtx = minimap ? minimap.getContext('2d') : null;
  let toastTimer = null;
  function toast(text, ms = 4200) {
    if (!hud.toast) return;
    hud.toast.textContent = text;
    hud.toast.style.opacity = '1';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { hud.toast.style.opacity = '0'; }, ms);
  }

  function refreshHud() {
    if (hud.money) hud.money.textContent = formatRupiah(state.money);
    if (hud.debt) hud.debt.textContent = formatRupiah(state.debt);
    if (hud.stars) {
      hud.stars.textContent = starsText(state.wanted);
      hud.stars.style.color = state.wanted > 0 ? '#ffd23e' : '#cfd6dd';
    }
    if (hud.healthFill) hud.healthFill.style.width = `${clamp(state.health, 0, 100)}%`;
    const mission = currentMission(state);
    if (hud.missionTitle) hud.missionTitle.textContent = mission ? `Mission ${state.missionIndex + 1}/5 — ${mission.title}` : 'All missions complete';
    if (hud.objective) hud.objective.textContent = mission ? mission.target : 'Debt paid. Bandar Nusa is yours, Raka.';
  }

  // --- Screens --------------------------------------------------------------------
  let running = false;
  let finished = false;
  function show(id) {
    for (const s of ['screen-start', 'screen-busted', 'screen-win']) {
      const node = el(s);
      if (node) node.style.display = s === id ? 'flex' : 'none';
    }
  }
  function startPlaying() {
    show(null);
    running = true;
    music.start();
    refreshHud();
    const mission = currentMission(state);
    if (mission) toast(`${mission.title}: ${mission.brief}`, 6000);
  }

  const startBtn = el('btn-start');
  if (startBtn) startBtn.addEventListener('click', () => { applyFreshStart(); startPlaying(); });
  const continueBtn = el('btn-continue');
  if (continueBtn) {
    const saved = window.localStorage.getItem(SAVE_KEY);
    if (saved && parseSave(saved)) continueBtn.style.display = 'inline-block';
    continueBtn.addEventListener('click', () => {
      const data = parseSave(window.localStorage.getItem(SAVE_KEY));
      if (data) {
        Object.assign(state, data.state);
        player.pos.set(data.playerPos.x, 0, data.playerPos.z);
        player.health = state.health;
        if (state.missionIndex === 3) spawnThugs();
        startPlaying();
        toast('Save loaded. Welcome back, Raka.');
      }
    });
  }
  const bustedBtn = el('btn-busted');
  if (bustedBtn) bustedBtn.addEventListener('click', () => { show(null); running = true; });
  const winBtn = el('btn-again');
  if (winBtn) winBtn.addEventListener('click', () => { applyFreshStart(); startPlaying(); });

  function applyFreshStart() {
    const fresh = createState();
    Object.assign(state, fresh);
    player.pos.set(PLACES.spawn.x, 0, PLACES.spawn.z);
    player.health = 100;
    finished = false;
    for (const t of thugs) scene.remove(t.mesh);
    thugs.length = 0;
    for (const p of police) scene.remove(p.car.mesh);
    police.length = 0;
    if (playerCar.current) exitCar();
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, serializeSave(state, { x: player.pos.x, z: player.pos.z }));
    } catch { /* storage unavailable — the game still plays */ }
  }

  // --- Busted / win ---------------------------------------------------------------
  function bustPlayer(reason) {
    const fine = bustFine(state);
    state.health = 100;
    player.health = 100;
    player.pos.set(PLACES.hospital.x, 0, PLACES.hospital.z);
    if (playerCar.current) exitCar();
    for (const p of police) scene.remove(p.car.mesh);
    police.length = 0;
    running = false;
    saveGame();
    refreshHud();
    const fineEl = el('busted-fine');
    if (fineEl) {
      fineEl.textContent = reason === 'beaten'
        ? `The harbor thugs beat you down. Hospital bill and fine: ${formatRupiah(fine)} (10% of your cash).`
        : `The police caught you. Hospital bill and fine: ${formatRupiah(fine)} (10% of your cash).`;
    }
    show('screen-busted');
    toast(reason === 'beaten' ? 'Beaten up! You woke up at the hospital.' : 'Busted! You woke up at the hospital.');
  }

  function winGame() {
    finished = true;
    running = false;
    saveGame();
    const stats = el('win-stats');
    if (stats) {
      stats.textContent = `Debt repaid: Rp 1,400,000. Time played: ${Math.floor(state.playSeconds / 60)} min ${Math.floor(state.playSeconds % 60)} s. Times busted: ${state.bustedCount}.`;
    }
    show('screen-win');
  }

  // --- Car enter / exit ---------------------------------------------------------------
  function nearestCar(maxDist) {
    let best = null;
    let bestD = Infinity;
    for (const c of cars) {
      if (c.isPolice || c.traffic) continue;
      const d = distance2D(player.pos.x, player.pos.z, c.x, c.z);
      if (d < maxDist && d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    playerCar.current = car;
    car.isPlayerCar = true;
    car.speed = 0;
    playerMesh.visible = false;
    state.inCar = true;
    if (currentStepId(state) === 'steal-car') {
      addWanted(state, WANTED.stealCarStars);
      completeStep(state);
      toast('You took the car! The garage is marked — deliver it there. (+1 wanted star)');
      refreshHud();
    } else {
      addWanted(state, WANTED.stealCarStars);
      toast('You stole a car! (+1 wanted star)');
      refreshHud();
    }
  }

  function exitCar() {
    const car = playerCar.current;
    if (!car) return;
    car.isPlayerCar = false;
    car.speed = 0;
    player.pos.set(car.x + 2.5, 0, car.z + 2.5);
    playerMesh.visible = true;
    playerCar.current = null;
    state.inCar = false;
  }

  // --- Combat ---------------------------------------------------------------------------
  function punch() {
    if (player.punchTimer > 0 || playerCar.current) return;
    player.punchTimer = PLAYER.punchCooldown;
    // Thugs first.
    for (const t of thugs) {
      if (!t.alive) continue;
      if (distance2D(player.pos.x, player.pos.z, t.x, t.z) < PLAYER.punchRange + 0.6) {
        t.hp -= PLAYER.punchDamage;
        t.x += Math.sin(player.heading) * 1.2;
        t.z += Math.cos(player.heading) * 1.2;
        if (t.hp <= 0) {
          t.alive = false;
          t.mesh.visible = false;
          state.thugsDown += 1;
          const res = completeStep(state);
          if (res.missionDone) {
            toast(`Thug down! Mission complete — earned ${formatRupiah(res.paid)}.`);
            saveGame();
          } else {
            toast(`Thug down! ${3 - state.thugsDown} left.`);
          }
          refreshHud();
        }
        return;
      }
    }
    // Police take a hit too — and notice.
    for (const p of police) {
      if (distance2D(player.pos.x, player.pos.z, p.car.x, p.car.z) < PLAYER.punchRange + 1) {
        addWanted(state, WANTED.punchCopStars);
        toast('You hit a cop! (+2 wanted stars)');
        refreshHud();
        return;
      }
    }
    // Pedestrians flee and report the assault.
    for (const ped of pedestrians) {
      if (distance2D(player.pos.x, player.pos.z, ped.x, ped.z) < PLAYER.punchRange) {
        ped.flee = 4;
        addWanted(state, WANTED.punchPedStars);
        toast('You hit a pedestrian! They called the police. (+1 wanted star)');
        refreshHud();
        return;
      }
    }
  }

  // --- Day / night -------------------------------------------------------------------------
  let dayTime = 0.32; // 0..1, 0.32 = morning
  const skyDay = new THREE.Color(COLORS.skyDay);
  const skyNight = new THREE.Color(COLORS.skyNight);
  const skyDawn = new THREE.Color(COLORS.skyDawn);
  const tmpColor = new THREE.Color();

  function updateDayNight(dt) {
    dayTime = (dayTime + dt / DAY.lengthSeconds) % 1;
    const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(sunAngle);
    const nightFactor = clamp(1 - (sunHeight + 0.15) / 0.5, 0, 1);
    sun.position.set(Math.cos(sunAngle) * 140, Math.max(8, sunHeight * 160), 60);
    sun.intensity = 1.7 - nightFactor * 1.25;
    hemi.intensity = 0.9 - nightFactor * 0.55;
    if (sunHeight > 0.25) tmpColor.copy(skyDay);
    else if (sunHeight > -0.05) tmpColor.copy(skyDawn).lerp(skyDay, (sunHeight + 0.05) / 0.3);
    else tmpColor.copy(skyNight);
    scene.background.copy(tmpColor);
    scene.fog.color.copy(tmpColor);
    world.setNight(nightFactor);
    return { nightFactor, sunHeight };
  }

  function hourText() {
    const hours = Math.floor(dayTime * 24);
    const mins = Math.floor((dayTime * 24 - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // --- Minimap --------------------------------------------------------------------------------
  function drawMinimap() {
    if (!mapCtx) return;
    const S = 170;
    const scale = S / (WORLD.halfSize * 2 + 40);
    const toMap = (x, z) => [(x + WORLD.halfSize + 20) * scale, (z + WORLD.halfSize + 20) * scale];
    mapCtx.fillStyle = '#20262b';
    mapCtx.fillRect(0, 0, S, S);
    mapCtx.fillStyle = '#1d6f8f';
    mapCtx.fillRect(0, toMap(0, WORLD.seaStartZ - 6)[1], S, S);
    mapCtx.fillStyle = '#d9c28a';
    mapCtx.fillRect(0, toMap(0, WORLD.beachStartZ)[1], S, toMap(0, WORLD.seaStartZ)[1] - toMap(0, WORLD.beachStartZ)[1]);
    mapCtx.strokeStyle = '#555c63';
    mapCtx.lineWidth = 3;
    for (const line of [-132, -88, -44, 0, 44, 88, 132]) {
      const [ax] = toMap(line, 0);
      mapCtx.beginPath(); mapCtx.moveTo(ax, 0); mapCtx.lineTo(ax, S); mapCtx.stroke();
      const [, bz] = toMap(0, line);
      mapCtx.beginPath(); mapCtx.moveTo(0, bz); mapCtx.lineTo(S, bz); mapCtx.stroke();
    }
    mapCtx.fillStyle = '#8a929a';
    for (const c of world.colliders) {
      const [x1, z1] = toMap(c.minX, c.minZ);
      const [x2, z2] = toMap(c.maxX, c.maxZ);
      mapCtx.fillRect(x1, z1, x2 - x1, z2 - z1);
    }
    const place = stepPlace();
    if (place) {
      const [mx, mz] = toMap(place.x, place.z);
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, mz - 6); mapCtx.lineTo(mx + 5, mz); mapCtx.lineTo(mx, mz + 6); mapCtx.lineTo(mx - 5, mz);
      mapCtx.closePath(); mapCtx.fill();
    }
    for (const p of police) {
      const [px, pz] = toMap(p.car.x, p.car.z);
      mapCtx.fillStyle = '#3f8cff';
      mapCtx.beginPath(); mapCtx.arc(px, pz, 3.5, 0, Math.PI * 2); mapCtx.fill();
    }
    const [px, pz] = toMap(player.pos.x, player.pos.z);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.arc(px, pz, 4, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.strokeStyle = '#ffffff';
    mapCtx.beginPath(); mapCtx.moveTo(px, pz);
    mapCtx.lineTo(px + Math.sin(player.heading) * 8, pz + Math.cos(player.heading) * 8);
    mapCtx.stroke();
    // North marker
    mapCtx.fillStyle = '#e8e8e8';
    mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', 4, 12);
  }

  // --- Main loop ----------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  let camYaw = Math.PI;
  let camPitch = 0.32;
  let wantedTimer = 0;
  let policeTimer = 0;
  let mapTimer = 0;
  let frames = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    frames += 1;

    const { nightFactor } = updateDayNight(dt);
    if (running) state.playSeconds += dt;

    // Boats bob gently.
    for (let i = 0; i < world.boats.length; i += 1) {
      world.boats[i].position.y = 0.1 + Math.sin(frames * 0.02 + i * 2) * 0.12;
    }
    // Sea shimmer.
    world.sea.material.opacity = 0.88 + Math.sin(frames * 0.01) * 0.04;

    if (running) {
      const look = input.consumeLook();
      camYaw += look.yaw;
      camPitch = clamp(camPitch + look.pitch, 0.08, 0.9);
      const axis = input.axis();
      player.punchTimer = Math.max(0, player.punchTimer - dt);

      // --- Player on foot ---------------------------------------------------
      if (!playerCar.current) {
        const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
        const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
        let mx = 0;
        let mz = 0;
        if (axis.x !== 0 || axis.z !== 0) {
          const len = Math.hypot(axis.x, axis.z);
          const fx = -Math.sin(camYaw);
          const fz = -Math.cos(camYaw);
          const rx = -fz;
          const rz = fx;
          mx = (fx * (axis.z / len) + rx * (axis.x / len)) * speed;
          mz = (fz * (axis.z / len) + rz * (axis.x / len)) * speed;
          player.heading = Math.atan2(mx, mz);
        }
        player.pos.x += mx * dt;
        player.pos.z += mz * dt;
        player.pos.x = clamp(player.pos.x, -WORLD.halfSize, WORLD.halfSize);
        const onPier = Math.abs(player.pos.x - 4) < 4.2 && player.pos.z > 148;
        player.pos.z = clamp(player.pos.z, -WORLD.halfSize, onPier ? 187 : 166);
        resolveCircle(player.pos, PLAYER.radius, world.colliders);
        playerMesh.position.copy(player.pos);
        playerMesh.rotation.y = player.heading;
        const moving = Math.hypot(mx, mz) > 0.1;
        player.walkPhase += dt * (moving ? 9 : 0);
        playerMesh.position.y = moving ? Math.abs(Math.sin(player.walkPhase)) * 0.08 : 0;
        if (input.held('KeyF')) punch();
        if (input.pressed('KeyE')) {
          const car = nearestCar(4);
          if (car) enterCar(car);
        }
      } else {
        // --- Driving ----------------------------------------------------------
        const car = playerCar.current;
        const throttle = axis.z !== 0 ? -axis.z : 0; // W = forward
        if (throttle > 0) car.speed = Math.min(CAR.maxSpeed, car.speed + CAR.accel * dt);
        else if (throttle < 0) car.speed = Math.max(-CAR.reverseSpeed, car.speed - CAR.brake * dt);
        else car.speed *= Math.max(0, 1 - 1.6 * dt);
        if (Math.abs(car.speed) > 0.5) car.angle += axis.x * CAR.steerRate * dt * Math.sign(car.speed) * -1;
        car.x += Math.sin(car.angle) * car.speed * dt;
        car.z += Math.cos(car.angle) * car.speed * dt;
        car.x = clamp(car.x, -WORLD.halfSize, WORLD.halfSize);
        car.z = clamp(car.z, -WORLD.halfSize, 150);
        const carPos = { x: car.x, z: car.z };
        resolveCircle(carPos, 2.2, world.colliders);
        car.x = carPos.x;
        car.z = carPos.z;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.angle;
        player.pos.set(car.x, 0, car.z);
        player.heading = car.angle;
        if (input.pressed('KeyE')) exitCar();
      }

      // --- Traffic ------------------------------------------------------------
      for (const c of cars) {
        if (!c.traffic) continue;
        const target = c.loop[c.loopIndex];
        const dx = target.x - c.x;
        const dz = target.z - c.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3) {
          c.loopIndex = (c.loopIndex + 1) % c.loop.length;
          continue;
        }
        const wantAngle = Math.atan2(dx, dz);
        c.angle = angleLerp(c.angle, wantAngle, Math.min(1, dt * 2.5));
        let blocked = false;
        if (playerCar.current) {
          const d = distance2D(c.x, c.z, player.pos.x, player.pos.z);
          if (d < 7) blocked = true;
        }
        const sp = blocked ? 0 : CAR.trafficSpeed;
        c.x += Math.sin(c.angle) * sp * dt;
        c.z += Math.cos(c.angle) * sp * dt;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.angle;
      }

      // --- Pedestrians ---------------------------------------------------------
      for (const ped of pedestrians) {
        if (ped.flee > 0) {
          ped.flee -= dt;
          const away = Math.atan2(ped.x - player.pos.x, ped.z - player.pos.z);
          ped.x += Math.sin(away) * 4 * dt;
          ped.z += Math.cos(away) * 4 * dt;
        } else {
          if (!ped.target || distance2D(ped.x, ped.z, ped.target.x, ped.target.z) < 2) {
            const spot = world.pedSpots[Math.floor(rng() * world.pedSpots.length)];
            ped.target = spot;
          }
          const dx = ped.target.x - ped.x;
          const dz = ped.target.z - ped.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.1) {
            ped.heading = Math.atan2(dx, dz);
            ped.x += (dx / dist) * ped.speed * dt;
            ped.z += (dz / dist) * ped.speed * dt;
          }
        }
        ped.x = clamp(ped.x, -WORLD.halfSize, WORLD.halfSize);
        ped.z = clamp(ped.z, -WORLD.halfSize, 166);
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }

      // --- Thugs ---------------------------------------------------------------
      if (currentMission(state) && state.missionIndex === 3) spawnThugs();
      for (const t of thugs) {
        if (!t.alive) continue;
        t.punchTimer = Math.max(0, t.punchTimer - dt);
        const d = distance2D(t.x, t.z, player.pos.x, player.pos.z);
        if (!playerCar.current && d < 26) {
          t.heading = Math.atan2(player.pos.x - t.x, player.pos.z - t.z);
          if (d > 1.8) {
            t.x += Math.sin(t.heading) * 3.4 * dt;
            t.z += Math.cos(t.heading) * 3.4 * dt;
          } else if (t.punchTimer <= 0) {
            t.punchTimer = 1.1;
            state.health = Math.max(0, state.health - 8);
            player.health = state.health;
            toast('A thug hit you! (-8 health)');
            if (state.health <= 0) {
              state.health = 100;
              player.health = 100;
              bustPlayer('beaten');
              return;
            }
          }
        }
        t.mesh.position.set(t.x, 0, t.z);
        t.mesh.rotation.y = t.heading;
      }

      // --- Wanted / police -------------------------------------------------------
      wantedTimer += dt;
      if (wantedTimer >= 1) {
        tickWanted(state, wantedTimer, false);
        wantedTimer = 0;
        refreshHud();
      }
      policeTimer += dt;
      if (policeTimer > 2.5) {
        policeTimer = 0;
        if (state.wanted >= WANTED.chaseFrom) spawnPolice();
      }
      for (const p of police) {
        const car = p.car;
        const dx = player.pos.x - car.x;
        const dz = player.pos.z - car.z;
        const dist = Math.hypot(dx, dz);
        const wantAngle = Math.atan2(dx, dz);
        car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 3));
        const speed = dist > 4 ? 13 : 6;
        car.x += Math.sin(car.angle) * speed * dt;
        car.z += Math.cos(car.angle) * speed * dt;
        car.x = clamp(car.x, -WORLD.halfSize, WORLD.halfSize);
        car.z = clamp(car.z, -WORLD.halfSize, 150);
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.angle;
        const bar = car.mesh.getObjectByName('lightbar');
        if (bar) bar.material.color.setHex(Math.floor(frames / 12) % 2 === 0 ? 0xff2222 : 0x2244ff);
        if (dist < WANTED.bustRange) {
          p.bustTimer += dt;
          if (p.bustTimer > WANTED.bustHoldSeconds) {
            bustPlayer();
            return;
          }
        } else {
          p.bustTimer = 0;
        }
      }

      // --- Mission triggers ---------------------------------------------------------
      const place = stepPlace();
      if (place) {
        marker.visible = true;
        marker.position.set(place.x, 0, place.z);
        ring.scale.setScalar(1 + Math.sin(frames * 0.06) * 0.15);
        const step = currentStepId(state);
        const inZone = distance2D(player.pos.x, player.pos.z, place.x, place.z) < 4.5;
        if (inZone && step !== 'steal-car' && !(step && step.startsWith('thug'))) {
          const res = completeStep(state);
          if (res.missionDone) {
            toast(`Mission complete — ${currentMission(state) ? 'next mission unlocked' : 'debt settled'}! Earned ${formatRupiah(res.paid)}.`, 6000);
            saveGame();
            if (res.gameDone) {
              refreshHud();
              winGame();
              return;
            }
            const next = currentMission(state);
            if (next) setTimeout(() => toast(`${next.title}: ${next.brief}`, 6000), 1500);
          } else {
            toast('Step done — keep going.');
          }
          refreshHud();
        }
      } else {
        marker.visible = false;
      }

      // Health slowly recovers when the heat is off.
      if (state.wanted === 0 && state.health < 100) {
        state.health = Math.min(100, state.health + dt * 2);
        player.health = state.health;
      }

      if (input.pressed('KeyM')) music.toggle();
      if (input.pressed('KeyP')) { saveGame(); toast('Game saved.'); }
      if (hud.speed) hud.speed.textContent = playerCar.current ? `${Math.abs(Math.round(playerCar.current.speed * 3.6))} km/h` : '';
      if (hud.clock) hud.clock.textContent = `${hourText()}${nightFactor > 0.6 ? ' — Night' : ' — Day'}`;
      mapTimer += dt;
      if (mapTimer > 0.15) {
        mapTimer = 0;
        drawMinimap();
      }
      refreshHud();
    }

    // --- Camera ----------------------------------------------------------------
    const camTarget = playerCar.current
      ? new THREE.Vector3(playerCar.current.x, 1.2, playerCar.current.z)
      : player.pos.clone().setY(1.4);
    const dist = playerCar.current ? 13 : 9;
    const cx = camTarget.x + Math.sin(camYaw) * dist * Math.cos(camPitch);
    const cz = camTarget.z + Math.cos(camYaw) * dist * Math.cos(camPitch);
    const cy = camTarget.y + Math.sin(camPitch) * dist + 2;
    camera.position.set(cx, Math.max(1.5, cy), cz);
    camera.lookAt(camTarget);

    renderer.render(scene, camera);
    if (frames === 5) window.__shotReady = true;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Shot mode (used for screenshots): auto-start with a staged scene.
  function applyShot(shotName) {
    if (shotName === 'street') {
      // Mid-road on the north-south avenue, camera behind the player
      // looking down the street with traffic and buildings on both sides.
      player.pos.set(0, 0, -66);
      camYaw = Math.PI;
      dayTime = 0.35;
    } else if (shotName === 'chase') {
      player.pos.set(0, 0, 0);
      camYaw = Math.PI;
      dayTime = 0.82;
      state.wanted = 3;
      spawnPolice();
      spawnPolice();
    } else if (shotName === 'night') {
      player.pos.set(4, 0, 158);
      camYaw = Math.PI * 1.15;
      dayTime = 0.85;
      state.missionIndex = 0;
      state.missionStep = 0;
    } else {
      // start: wide view of the plaza and the tower
      player.pos.set(0, 0, -8);
      camYaw = Math.PI * 0.98;
      dayTime = 0.3;
    }
    refreshHud();
    startPlaying();
  }

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    applyShot(shot);
  } else {
    show('screen-start');
  }

  animate();

  return {
    state, player, cars, police, pedestrians, thugs, world,
    startPlaying, bustPlayer, winGame, saveGame,
    teleport(x, z) { player.pos.set(x, 0, z); },
    setWanted(n) { state.wanted = clamp(n, 0, 5); refreshHud(); },
    completeCurrentStep() { return completeStep(state); },
  };
}
