// Three.js rendering: the city, the sea, the pier, cars, people, police,
// the day/night sun and the live top-down minimap. The renderer only reads
// world state; all rules live in world.js.
import * as THREE from '../vendor/three.module.min.js';
import { BEACH_X, BLOCK, HALF, LANDMARKS, PITCH, ROADS, SEA_X, WORLD_EAST } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const FACADES = {
  sand: '#d9c39a',
  brick: '#b05a3c',
  teal: '#2e7f7a',
  cream: '#efe6cf',
  slate: '#5d6d7e',
  ochre: '#c98a2e',
};

function facadeTexture(facade, floors, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = FACADES[facade] || '#999';
  g.fillRect(0, 0, 128, 128);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const rows = Math.max(2, floors);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      g.fillStyle = rnd() < 0.35 ? '#ffe9a8' : '#20242e';
      g.fillRect(12 + c * 28, 14 + r * (112 / rows), 16, 18);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export function createRenderer(canvas, minimap) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#87b5d9');
  scene.fog = new THREE.Fog('#a8c4d8', 220, 520);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  const hemi = new THREE.HemisphereLight('#cfe8ff', '#3d5a3a', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2cc', 1.6);
  scene.add(sun);
  scene.add(sun.target);

  const dyn = {
    player: null,
    cars: new Map(),
    peds: new Map(),
    gang: new Map(),
    pickups: new Map(),
    marker: null,
    beacon: null,
    lights: [],
  };
  let cityBuilt = false;

  function buildCity(state) {
    if (cityBuilt) return;
    cityBuilt = true;
    const city = state.city;
    // Ground, beach and sea.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 8, HALF * 2 + 8),
      new THREE.MeshLambertMaterial({ color: '#4c7a45' }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(SEA_X - BEACH_X + 8, HALF * 2 + 8),
      new THREE.MeshLambertMaterial({ color: '#e0c98f' }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((BEACH_X + SEA_X) / 2, 0.02, 0);
    scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_EAST - SEA_X + 60, HALF * 2 + 8),
      new THREE.MeshLambertMaterial({ color: '#1d6f9e' }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(SEA_X + (WORLD_EAST - SEA_X) / 2 + 20, 0.01, 0);
    scene.add(sea);
    // Roads.
    const roadMat = new THREE.MeshLambertMaterial({ color: '#33373d' });
    for (const r of ROADS) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 8, 12), roadMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(0, 0.03, r);
      scene.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(12, HALF * 2 + 8), roadMat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(r, 0.03, 0);
      scene.add(b);
    }
    // Buildings.
    const texCache = new Map();
    for (const b of city.buildings) {
      const key = `${b.facade}:${b.floors}`;
      if (!texCache.has(key)) texCache.set(key, facadeTexture(b.facade, b.floors, b.seed));
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        new THREE.MeshLambertMaterial({ map: texCache.get(key) }),
      );
      mesh.position.set(b.x, b.h / 2, b.z);
      scene.add(mesh);
    }
    // Landmarks.
    const hall = box(34, 16, 24, '#e8dcc0', LANDMARKS.cityHall.x, 8, LANDMARKS.cityHall.z);
    scene.add(hall);
    const hospital = box(30, 20, 20, '#f2f2f2', LANDMARKS.hospital.x, 10, LANDMARKS.hospital.z);
    scene.add(hospital);
    const cross = box(8, 2, 1, '#c0392b', LANDMARKS.hospital.x, 22, LANDMARKS.hospital.z - 10.2);
    scene.add(cross);
    const cross2 = box(2, 8, 1, '#c0392b', LANDMARKS.hospital.x, 22, LANDMARKS.hospital.z - 10.2);
    scene.add(cross2);
    const warehouse = box(36, 14, 26, '#7d6a4f', LANDMARKS.warehouse.x, 7, LANDMARKS.warehouse.z);
    scene.add(warehouse);
    // Market stalls: a box and a coloured awning each.
    for (const s of city.stalls) {
      scene.add(box(5, 2.4, 4, '#8a6d4b', s.x, 1.2, s.z));
      const awn = box(6, 0.3, 5, s.color, s.x, 2.8, s.z);
      awn.rotation.y = 0.3;
      scene.add(awn);
    }
    // Palms: trunk plus a low-poly crown.
    const trunkMat = new THREE.MeshLambertMaterial({ color: '#7a5230' });
    const crownMat = new THREE.MeshLambertMaterial({ color: '#2f8f4e' });
    for (const palm of city.palms) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 5), trunkMat);
      trunk.position.set(palm.x, 3, palm.z);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(3, 3.4, 6), crownMat);
      crown.position.set(palm.x, 7.2, palm.z);
      scene.add(crown);
    }
    // Streetlights.
    const poleMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
    for (const l of city.lights) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5), poleMat);
      pole.position.set(l.x, 2.5, l.z);
      scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshLambertMaterial({ color: '#fff6c9', emissive: '#ffedb0', emissiveIntensity: 0.15 }),
      );
      lamp.position.set(l.x, 5.1, l.z);
      scene.add(lamp);
      dyn.lights.push(lamp);
    }
    // Pier: planks out into the sea.
    for (let i = 0; i < 10; i += 1) {
      scene.add(box(5, 0.6, 7, '#8a6d4b', HALF + 8 + i * 6.5, 0.8, 0));
    }
    // Mission marker: a glowing beacon column and a floating diamond.
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 30, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    scene.add(beacon);
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.4),
      new THREE.MeshBasicMaterial({ color: '#ffd23f' }),
    );
    scene.add(marker);
    dyn.beacon = beacon;
    dyn.marker = marker;
  }

  function carMesh(car) {
    const group = new THREE.Group();
    const body = box(CAR_LEN, 1, 2, car.color, 0, 0.75, 0);
    group.add(body);
    const cabin = box(2.2, 0.8, 1.7, '#222c3a', -0.2, 1.6, 0);
    group.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: '#111111' });
    for (const [wx, wz] of [[-1.4, 1], [1.4, 1], [-1.4, -1], [1.4, -1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 8), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      group.add(wheel);
    }
    if (car.kind === 'police') {
      const bar = box(1.6, 0.25, 0.6, '#ffffff', 0, 2.1, 0);
      bar.name = 'lightbar';
      group.add(bar);
      const red = box(0.7, 0.3, 0.65, '#ff2020', -0.4, 2.1, 0);
      red.name = 'sirenR';
      group.add(red);
      const blue = box(0.7, 0.3, 0.65, '#2040ff', 0.4, 2.1, 0);
      blue.name = 'sirenB';
      group.add(blue);
    }
    return group;
  }
  const CAR_LEN = 4.4;

  function personMesh(color) {
    const group = new THREE.Group();
    const body = box(0.7, 1.1, 0.4, color, 0, 1.05, 0);
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshLambertMaterial({ color: '#e8b98a' }),
    );
    head.position.set(0, 1.85, 0);
    group.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: '#2c3e50' });
    for (const lx of [-0.18, 0.18]) {
      const leg = box(0.22, 0.6, 0.22, '#2c3e50', lx, 0.3, 0);
      leg.material = legMat;
      group.add(leg);
    }
    return group;
  }

  function draw(state, screen) {
    buildCity(state);
    const p = state.player;
    // Player.
    if (!dyn.player) {
      dyn.player = personMesh('#e67e22');
      scene.add(dyn.player);
    }
    dyn.player.position.set(p.x, 0, p.z);
    dyn.player.rotation.y = p.heading;
    dyn.player.visible = p.onFoot;
    // Cars.
    const seen = new Set();
    for (const car of state.cars) {
      seen.add(car.id);
      let mesh = dyn.cars.get(car.id);
      if (!mesh) {
        mesh = carMesh(car);
        dyn.cars.set(car.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      if (car.kind === 'police') {
        const flash = Math.sin(state.time * 12) > 0;
        const r = mesh.getObjectByName('sirenR');
        const b = mesh.getObjectByName('sirenB');
        if (r) r.material.emissive = new THREE.Color(flash ? '#ff2020' : '#400000');
        if (b) b.material.emissive = new THREE.Color(flash ? '#101040' : '#2040ff');
      }
    }
    for (const [id, mesh] of dyn.cars) {
      if (!seen.has(id)) {
        scene.remove(mesh);
        dyn.cars.delete(id);
      }
    }
    // Pedestrians.
    const seenPeds = new Set();
    for (const ped of state.peds) {
      if (ped.down) continue;
      seenPeds.add(ped.id);
      let mesh = dyn.peds.get(ped.id);
      if (!mesh) {
        mesh = personMesh(['#3498db', '#e74c3c', '#9b59b6', '#1abc9c'][ped.id.charCodeAt(4) % 4]);
        dyn.peds.set(ped.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(ped.x, 0, ped.z);
      mesh.rotation.y = ped.heading;
    }
    for (const [id, mesh] of dyn.peds) {
      if (!seenPeds.has(id)) {
        scene.remove(mesh);
        dyn.peds.delete(id);
      }
    }
    // Gang.
    const seenGang = new Set();
    for (const g of state.gang) {
      if (g.defeated) continue;
      seenGang.add(g.id);
      let mesh = dyn.gang.get(g.id);
      if (!mesh) {
        mesh = personMesh('#1a1a1a');
        dyn.gang.set(g.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(g.x, 0, g.z);
      mesh.rotation.y = g.heading;
    }
    for (const [id, mesh] of dyn.gang) {
      if (!seenGang.has(id)) {
        scene.remove(mesh);
        dyn.gang.delete(id);
      }
    }
    // Pickups: spinning gold coins.
    const seenPk = new Set();
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      seenPk.add(pk.id);
      let mesh = dyn.pickups.get(pk.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.6, 0.15, 12),
          new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#a88400', emissiveIntensity: 0.4 }),
        );
        dyn.pickups.set(pk.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(pk.x, 0.9 + Math.sin(state.time * 3 + pk.x) * 0.15, pk.z);
      mesh.rotation.y = state.time * 2;
    }
    for (const [id, mesh] of dyn.pickups) {
      if (!seenPk.has(id)) {
        scene.remove(mesh);
        dyn.pickups.delete(id);
      }
    }
    // Mission marker.
    const target = state.missionTarget;
    const showMarker = !!target && !state.storyComplete && screen === SCREEN_PLAY;
    dyn.beacon.visible = showMarker;
    dyn.marker.visible = showMarker;
    if (showMarker) {
      dyn.beacon.position.set(target.x, 15, target.z);
      dyn.marker.position.set(target.x, 6 + Math.sin(state.time * 2.5) * 0.6, target.z);
      dyn.marker.rotation.y = state.time;
    }
    // Sun, sky and lights by the game clock.
    const hour = (state.clock / 3600) % 24;
    const dayF = hour >= 6 && hour < 18 ? 1 : 0;
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(sunAngle) * 200, Math.max(20, Math.sin(sunAngle) * 220), 80);
    sun.intensity = dayF ? 1.6 : 0.25;
    hemi.intensity = dayF ? 0.9 : 0.35;
    scene.background.set(dayF ? '#87b5d9' : '#0d1b2e');
    scene.fog.color.set(dayF ? '#a8c4d8' : '#0d1b2e');
    const night = !dayF;
    for (const lamp of dyn.lights) {
      lamp.material.emissiveIntensity = night ? 1.6 : 0.15;
    }
    // Camera: third-person orbit around the player. Keep every building out
    // of the line of sight: pull the camera in first, and if the view is
    // still blocked, raise it so it looks down over the roofs.
    const cam = state.camera;
    // Solid boxes the camera must not look through: every building plus the
    // big special meshes (Balai Kota, warehouse, hospital, mosque).
    const blockers = state.city.buildings.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, h: b.h }));
    blockers.push({ x: 26, z: -26, w: 34, d: 32, h: 16 }); // Balai Kota
    blockers.push({ x: 178, z: 52, w: 36, d: 36, h: 16 }); // harbour warehouse
    blockers.push({ x: 52, z: 78, w: 28, d: 20, h: 12 }); // hospital
    blockers.push({ x: -104, z: -104, w: 30, d: 24, h: 14 }); // mosque
    const segmentBlocked = (d, pitch) => {
      const dirX = Math.sin(cam.yaw) * Math.cos(pitch);
      const dirZ = Math.cos(cam.yaw) * Math.cos(pitch);
      const camY = 4 + d * Math.sin(pitch) + 3;
      for (let t = 0.15; t <= 1.001; t += 0.15) {
        const x = p.x + dirX * d * t;
        const z = p.z + dirZ * d * t;
        const y = 2 + (camY - 2) * t;
        for (const b of blockers) {
          if (Math.abs(x - b.x) < b.w / 2 + 0.5 && Math.abs(z - b.z) < b.d / 2 + 0.5 && y < b.h) return true;
        }
      }
      return false;
    };
    let dist = cam.dist;
    let pitch = cam.pitch;
    let clear = !segmentBlocked(dist, pitch);
    if (!clear) {
      for (let pi = cam.pitch; pi <= 1.05 && !clear; pi += 0.15) {
        for (let d = cam.dist; d >= 5; d -= 1) {
          if (!segmentBlocked(d, pi)) { pitch = pi; dist = d; clear = true; break; }
        }
      }
      if (!clear) { pitch = 1.05; dist = 5; }
    }
    const dirX = Math.sin(cam.yaw) * Math.cos(pitch);
    const dirZ = Math.cos(cam.yaw) * Math.cos(pitch);
    const cx = p.x + dirX * dist;
    const cz = p.z + dirZ * dist;
    const cy = 4 + dist * Math.sin(pitch) + 3;
    camera.position.set(cx, cy, cz);
    camera.lookAt(p.x, 2, p.z);
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    if (renderer.getSize(new THREE.Vector2()).x !== w || renderer.getSize(new THREE.Vector2()).y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    drawMinimap(state);
  }

  function drawMinimap(state) {
    if (!minimap) return;
    const g = minimap.getContext('2d');
    const S = minimap.width;
    const scale = S / (HALF * 2 + 120);
    const toX = (x) => (x + HALF + 60) * scale;
    const toZ = (z) => (z + HALF + 60) * scale;
    g.fillStyle = '#1d2b1f';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#2e7f7a';
    g.fillRect(toX(SEA_X), 0, S - toX(SEA_X), S);
    g.fillStyle = '#e0c98f';
    g.fillRect(toX(BEACH_X), 0, toX(SEA_X) - toX(BEACH_X), S);
    g.strokeStyle = '#3a3f45';
    g.lineWidth = 5;
    for (const r of ROADS) {
      g.beginPath();
      g.moveTo(toX(-HALF), toZ(r));
      g.lineTo(toX(HALF), toZ(r));
      g.stroke();
      g.beginPath();
      g.moveTo(toX(r), toZ(-HALF));
      g.lineTo(toX(r), toZ(HALF));
      g.stroke();
    }
    const p = state.player;
    if (state.missionTarget) {
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.arc(toX(state.missionTarget.x), toZ(state.missionTarget.z), 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ff4040';
    for (const car of state.police) {
      g.beginPath();
      g.arc(toX(car.x), toZ(car.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(toX(p.x), toZ(p.z), 4.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.beginPath();
    g.moveTo(toX(p.x), toZ(p.z));
    g.lineTo(toX(p.x + -Math.sin(p.heading) * 14), toZ(p.z + -Math.cos(p.heading) * 14));
    g.stroke();
  }

  return { draw, scene, renderer, camera };
}
