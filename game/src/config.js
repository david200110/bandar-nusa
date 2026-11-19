// Shared constants for Bandar Nusa — Kisah Raka.
// One source of truth for the world geometry, the tuning numbers and the story.
export const STEP = 1 / 60;
export const SAVE_KEY = 'bandar-nusa-save-v1';

// City grid: 6 x 6 blocks of 40 units, roads 12 wide between them.
export const BLOCK = 40;
export const ROAD = 12;
export const GRID = 6;
export const PITCH = BLOCK + ROAD; // 52
export const HALF = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 162
export const ROADS = Array.from({ length: GRID + 1 }, (_, i) => -HALF + ROAD / 2 + i * PITCH);

// The beach and the sea sit east of the grid; the pier runs out from the shore.
export const BEACH_X = HALF; // sand starts here
export const SEA_X = HALF + 42;
export const WORLD_EAST = SEA_X + 90;

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 9.5,
  radius: 0.9,
  maxHealth: 100,
  punchRange: 2.4,
  punchArc: 1.25,
  punchCooldown: 0.45,
  regenDelay: 5,
  regenRate: 5,
};

export const CAR = {
  accel: 15,
  brake: 24,
  maxSpeed: 26,
  reverseSpeed: 8,
  steerRate: 2.3,
  length: 4.4,
  width: 2,
};

export const TRAFFIC = { count: 8, minSpeed: 9, maxSpeed: 13 };
export const PEDS = { count: 22, walkSpeed: 1.6, fleeSpeed: 5.5 };
export const PICKUP_VALUE = 25000;
export const PICKUP_COUNT = 12;
export const PARKED_COUNT = 8;

export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  quietAfter: 15, // seconds without raising it before it starts to cool
  decayEvery: 10, // seconds per star lost while quiet and unseen
  unseenRange: 45,
  bustHold: 2, // seconds a police car must hold the player on foot
  fine: 0.1, // 10% of the money on a bust
};

export const GANG = { health: 3, speed: 3.2, range: 1.8, damage: 10, cooldown: 1.2 };

export const CLOCK_START = 8 * 3600; // 08:00
export const CLOCK_RATE = 144; // game seconds per real second: a day lasts 10 minutes
export const NIGHT_START = 18 * 3600;
export const NIGHT_END = 6 * 3600;

// Landmark spots, by name, on the grid.
export const LANDMARKS = {
  spawn: { x: -104, z: 0, label: 'Terminal' },
  market: { x: -78, z: 26, label: 'Pasar Ikan' },
  cityHall: { x: 26, z: -26, label: 'Balai Kota' },
  hospital: { x: -130, z: -78, label: 'Rumah Sakit' },
  plaza: { x: 0, z: 0, label: 'Alun-alun' },
  warehouse: { x: 178, z: 52, label: 'Gudang Dermaga' },
  pier: { x: 215, z: 0, label: 'Dermaga' },
};

export const MISSIONS = [
  {
    id: 'paket',
    name: 'Misi 1 — Paket Pertama',
    brief: 'Antar paket ini ke Pasar Ikan. Jangan sampai terlambat.',
    target: { ...LANDMARKS.market, label: 'Pasar Ikan' },
    reward: 150000,
  },
  {
    id: 'setoran',
    name: 'Misi 2 — Setoran Kilat',
    brief: 'Setoran harus sampai di Balai Kota dalam 120 detik. Gas!',
    target: { x: 26, z: -12, label: 'Balai Kota' },
    reward: 250000,
    timeLimit: 120,
  },
  {
    id: 'mobil',
    name: 'Misi 3 — Mobil Titipan',
    brief: 'Bos Jalak mau sedan merah di jalan timur. Ambil mobilnya.',
    target: { x: 104, z: -52, label: 'Sedan Merah' },
    reward: 200000,
  },
  {
    id: 'razia',
    name: 'Misi 4 — Lolos dari Razia',
    brief: 'Polisi sedang razia besar. Bertahan 60 detik dengan 3 bintang sambil mengemudi!',
    target: null,
    reward: 300000,
    survive: 60,
    wanted: 3,
  },
  {
    id: 'lunas',
    name: 'Misi 5 — Utang Lunas',
    brief: 'Terakhir: kalahkan 3 anak buah Bos Jalak di gudang, lalu serahkan ke Dermaga.',
    target: { x: 160, z: 52, label: 'Gudang Dermaga' },
    reward: 500000,
    gang: 3,
  },
];

export const DEBT = 1400000; // the sum of all five rewards

export const SHOTS = ['start', 'drive', 'chase', 'mission'];
