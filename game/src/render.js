// What the player sees: the Three.js scene, the chase camera and the minimap.
// The world owns the numbers; this file only turns them into meshes, light and
// a top-down map. Nothing here decides rules.
import * as THREE from 'three';
import { CITY, COLORS } from './config.js';

function makePersonMesh(shirtColor, skinColor = 0xd8a077) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.94;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pants);
  legL.position.set(-0.16, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), shirt);
  armL.position.set(-0.42, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

function makeCarMesh(color, model) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.1), glass);
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  if (model === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.6), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
    bed.position.set(0, 1.05, 1.3);
    group.add(bed);
  }
  if (model === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x664400 }));
    sign.position.set(0, 1.72, -0.25);
    group.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff2cf, emissive: 0x887722 });
  for (const hx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    lamp.position.set(hx, 0.62, 2.22);
    group.add(lamp);
  }
  let lightBar = null;
  if (model === 'police') {
    const redMat = new THREE.MeshLambertMaterial({ color: 0xcc0000, emissive: 0x000000 });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x0033cc, emissive: 0x000000 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), redMat);
    red.position.set(-0.4, 1.68, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), blueMat);
    blue.position.set(0.4, 1.68, -0.25);
    group.add(blue);
    lightBar = { redMat, blueMat };
  }
  group.userData = { wheels, lightBar };
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.skyDay);
  scene.fog = new THREE.Fog(COLORS.skyDay, 130, 430);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // The city geometry is added to this scene by the caller.
  // The player on foot: Raka in a teal shirt and red cap.
  const playerMesh = makePersonMesh(0x1f8a7a);
  scene.add(playerMesh);

  // One mesh per car, created and removed as the world spawns them.
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const gangMeshes = new Map();
  const pickupMeshes = new Map();

  // Mission beacon: a column of light and a floating diamond over the target.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  diamond.visible = false;
  scene.add(diamond);

  // Camera: a chase camera the player orbits with the mouse.
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  let orbitYaw = Math.PI;
  let orbitPitch = 0.34;
  let camDistance = 11;
  let walkPhase = 0;

  canvas.addEventListener('wheel', (event) => {
    camDistance = Math.max(6, Math.min(22, camDistance + Math.sign(event.deltaY) * 1.5));
    event.preventDefault();
  }, { passive: false });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function skyFor(hour) {
    // 6:00 sunrise, 12:00 noon, 18:00 sunset, 0:00 midnight.
    const day = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const dusk = Math.max(0, 1 - Math.abs(hour - 18) / 2.5) + Math.max(0, 1 - Math.abs(hour - 6) / 2.5);
    const sky = new THREE.Color(COLORS.skyDay).lerp(new THREE.Color(COLORS.skyNight), 1 - day);
    if (dusk > 0) sky.lerp(new THREE.Color(COLORS.skyDusk), Math.min(0.7, dusk * 0.7));
    return { sky, day, dusk };
  }

  function sync(dt, input, time, world, cityData) {
    const state = world.state;
    const player = state.player;
    const car = player.onFoot ? null : world.playerCar();

    // Mouse orbit; the camera settles behind the direction of travel.
    const mouse = input.takeMouse();
    orbitYaw -= mouse.x * 0.005;
    orbitPitch = Math.max(0.08, Math.min(1.0, orbitPitch + mouse.y * 0.003));
    const moving = car ? Math.abs(car.speed) > 1 : (input.moveAxis().x !== 0 || input.moveAxis().y !== 0);
    const followHeading = car ? car.heading : player.heading;
    if (moving) {
      let diff = followHeading - orbitYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      orbitYaw += diff * Math.min(1, dt * 1.6);
    }

    const tx = car ? car.x : player.x;
    const tz = car ? car.z : player.z;
    const dist = car ? camDistance + 3 : camDistance;
    const height = dist * Math.sin(orbitPitch) + 2;
    const back = dist * Math.cos(orbitPitch);
    camera.position.set(
      tx - Math.sin(orbitYaw) * back,
      height,
      tz - Math.cos(orbitYaw) * back,
    );
    camera.lookAt(tx + Math.sin(orbitYaw) * 6, 2.2, tz + Math.cos(orbitYaw) * 6);

    // Sun, sky and streetlights follow the clock.
    const { sky, day } = skyFor(time);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    const sunAngle = ((time - 6) / 12) * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(sunAngle), Math.max(0.08, Math.sin(sunAngle)), 0.35).normalize();
    sun.position.set(tx + sunDir.x * 160, sunDir.y * 160 + 20, tz + sunDir.z * 160);
    sun.target.position.set(tx, 0, tz);
    sun.intensity = 0.35 + day * 1.9;
    hemi.intensity = 0.3 + day * 0.6;
    const lampsOn = day < 0.25;
    for (const mat of cityData.lampMaterials) mat.emissive.setHex(lampsOn ? 0xffd98a : 0x000000);

    // Raka, on foot with a walk cycle; hidden while he drives.
    playerMesh.visible = player.onFoot;
    if (player.onFoot) {
      playerMesh.position.set(player.x, 0, player.z);
      playerMesh.rotation.y = player.heading;
      const movingOnFoot = input.moveAxis().x !== 0 || input.moveAxis().y !== 0;
      if (movingOnFoot) walkPhase += dt * 9;
      const swing = movingOnFoot ? Math.sin(walkPhase) * 0.55 : 0;
      playerMesh.userData.legL.rotation.x = swing;
      playerMesh.userData.legR.rotation.x = -swing;
      playerMesh.userData.armL.rotation.x = -swing * 0.7;
      playerMesh.userData.armR.rotation.x = swing * 0.7;
    }

    // Cars.
    const seen = new Set();
    for (const c of state.cars) {
      seen.add(c.id);
      let mesh = carMeshes.get(c.id);
      if (!mesh) {
        mesh = makeCarMesh(c.color, c.model);
        scene.add(mesh);
        carMeshes.set(c.id, mesh);
      }
      mesh.position.set(c.x, 0, c.z);
      mesh.rotation.y = c.heading;
      const spin = c.speed * dt * 1.4;
      for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin;
      if (mesh.userData.lightBar) {
        const phase = Math.floor(state.elapsed * 1000 / 350) % 2 === 0;
        const on = state.wanted > 0;
        mesh.userData.lightBar.redMat.emissive.setHex(on && phase ? 0xff2222 : 0x000000);
        mesh.userData.lightBar.blueMat.emissive.setHex(on && !phase ? 0x2244ff : 0x000000);
      }
    }
    for (const [id, mesh] of carMeshes) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        carMeshes.delete(id);
      }
    }

    // Pedestrians.
    state.peds.forEach((ped, index) => {
      let mesh = pedMeshes.get(index);
      if (!mesh) {
        mesh = makePersonMesh(ped.color);
        mesh.scale.setScalar(0.94);
        scene.add(mesh);
        pedMeshes.set(index, mesh);
      }
      mesh.position.set(ped.x, 0, ped.z);
      if (ped.state === 'down') {
        mesh.rotation.set(-Math.PI / 2, 0, ped.heading);
        mesh.position.y = 0.3;
      } else {
        mesh.rotation.set(0, ped.heading, 0);
        mesh.position.y = Math.abs(Math.sin(state.elapsed * 6 + index)) * 0.05;
      }
    });

    // Gang members, in dark red.
    state.gang.forEach((g, index) => {
      let mesh = gangMeshes.get(index);
      if (!mesh) {
        mesh = makePersonMesh(0x8a2f2f);
        mesh.scale.setScalar(1.06);
        scene.add(mesh);
        gangMeshes.set(index, mesh);
      }
      mesh.visible = g.health > 0;
      mesh.position.set(g.x, 0, g.z);
      mesh.rotation.y = g.heading;
    });

    // Cash pickups: spinning green bundles.
    state.pickups.forEach((pickup, index) => {
      let mesh = pickupMeshes.get(index);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.25, 0.6),
          new THREE.MeshLambertMaterial({ color: 0x2fae5f, emissive: 0x0a5a2a }),
        );
        mesh.castShadow = true;
        scene.add(mesh);
        pickupMeshes.set(index, mesh);
      }
      mesh.visible = !pickup.taken;
      mesh.position.set(pickup.x, 0.7 + Math.sin(state.elapsed * 3 + index) * 0.15, pickup.z);
      mesh.rotation.y = state.elapsed * 2 + index;
    });

    // Mission beacon over the current target.
    const mission = world.currentMission();
    const stage = world.currentStage();
    if (mission && stage && stage.target) {
      beacon.visible = true;
      diamond.visible = true;
      beacon.position.set(stage.target.x, 20, stage.target.z);
      diamond.position.set(stage.target.x, 14 + Math.sin(state.elapsed * 4) * 0.6, stage.target.z);
      diamond.rotation.y = state.elapsed * 2;
    } else {
      beacon.visible = false;
      diamond.visible = false;
    }
    renderer.render(scene, camera);
  }

  // A top-down map: roads, buildings, the sea, the player arrow and the blips.
  function drawMinimap(mapCanvas, worldState, missionTarget, cityData) {
    const g = mapCanvas.getContext('2d');
    const size = mapCanvas.width;
    const scale = size / (CITY.half * 2 + 60);
    const toMap = (x, z) => [(x + CITY.half + 30) * scale, (z + CITY.half + 30) * scale];
    g.fillStyle = '#101c10';
    g.fillRect(0, 0, size, size);
    const [, seaY] = toMap(0, CITY.seaStart);
    g.fillStyle = '#1f7fa8';
    g.fillRect(0, seaY, size, size - seaY);
    const [, sandY] = toMap(0, CITY.beachStart);
    g.fillStyle = '#e3cf9e';
    g.fillRect(0, sandY, size, seaY - sandY);
    g.strokeStyle = '#5a6068';
    g.lineWidth = Math.max(2, 14 * scale);
    for (const c of CITY.roads) {
      const [x1, y1] = toMap(c, -CITY.half);
      const [x2, y2] = toMap(c, CITY.half);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(-CITY.half, c);
      const [x4, y4] = toMap(CITY.half, c);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    g.fillStyle = '#3a3f46';
    for (const c of cityData.colliders) {
      const [x, y] = toMap(c.minX, c.minZ);
      g.fillRect(x, y, (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
    }
    if (missionTarget) {
      const [x, y] = toMap(missionTarget.x, missionTarget.z);
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y);
      g.closePath(); g.fill();
    }
    for (const car of worldState.cars) {
      if (car.kind === 'player') continue;
      const [x, y] = toMap(car.x, car.z);
      g.fillStyle = car.kind === 'police' ? '#3f8cff' : '#9aa0a3';
      g.beginPath(); g.arc(x, y, car.kind === 'police' ? 3.5 : 2, 0, Math.PI * 2); g.fill();
    }
    const player = worldState.player;
    const [px, py] = toMap(player.x, player.z);
    const playerCar = worldState.cars.find((c) => c.id === player.carId);
    const heading = player.onFoot ? player.heading : (playerCar?.heading ?? player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(px + Math.sin(heading) * 7, py + Math.cos(heading) * 7);
    g.lineTo(px + Math.sin(heading + 2.5) * 5, py + Math.cos(heading + 2.5) * 5);
    g.lineTo(px + Math.sin(heading - 2.5) * 5, py + Math.cos(heading - 2.5) * 5);
    g.closePath(); g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  function setOrbit(yaw) {
    orbitYaw = yaw;
  }

  function setDistance(distance) {
    camDistance = distance;
  }

  return { scene, sync, drawMinimap, resize, setOrbit, setDistance, get orbitYaw() { return orbitYaw; } };
}
