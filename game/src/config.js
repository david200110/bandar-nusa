// Bandar Nusa — shared tuning and city layout. Every number the game balances on
// lives here so the world, the renderer and the missions all agree on one city.
export const SAVE_KEY = 'bandar-nusa-save-v1';

// The city is a grid of streets. Roads run along these coordinates on both axes;
// blocks are the 60 m squares between them. South of the last road is the beach.
export const CITY = {
  roads: [-180, -120, -60, 0, 60, 120, 180],
  half: 210,
  roadWidth: 14,
  block: 60,
  beachStart: 210,
  seaStart: 258,
  // Named places the story sends Raka to (x east, z south).
  places: {
    warung: { x: -60, z: -60, label: 'Warung Bu Sari' },
    dermaga: { x: 0, z: 238, label: 'Dermaga Nusa' },
    pasar: { x: 60, z: 60, label: 'Pasar Ikan' },
    hotel: { x: 120, z: -120, label: 'Hotel Nusa Raya' },
    bengkel: { x: -120, z: 120, label: 'Bengkel Dodi' },
    gudang: { x: -180, z: 180, label: 'Gudang Pelabuhan' },
    rumahSakit: { x: -180, z: -180, label: 'Rumah Sakit Nusa' },
    alun: { x: 0, z: 0, label: 'Alun-alun' },
  },
};

// The player on foot.
export const PLAYER = {
  walkSpeed: 4.5,
  runSpeed: 7.5,
  radius: 0.6,
  maxHealth: 100,
  punchRange: 2.4,
  punchDamage: 34,
  punchCooldown: 0.45,
  regenDelay: 5,
  regenRate: 3,
};

// Cars: acceleration, top speed and steering. Police are a little faster at high stars.
export const CAR = {
  accel: 14,
  brake: 26,
  reverseTop: 9,
  topSpeed: 27,
  steer: 1.9,
  radius: 1.6,
  trafficSpeed: 11,
  policeBase: 25,
  policePerStar: 1.6,
};

// Wanted level: 0 to 5 stars. Crimes add stars; hiding and time take them away.
export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPedestrian: 1,
  hitPolice: 2,
  punchPolice: 2,
  decayQuietSeconds: 30,
  decayStepSeconds: 9,
  bustHoldSeconds: 1.6,
  bustFineFraction: 0.1,
};

// Money is in rupiah; the HUD formats it as Rp 150.000.
export const MONEY = {
  start: 50000,
  pickup: 25000,
  missionReward: [150000, 250000, 200000, 300000, 500000],
};

// A game day lasts 8 real minutes; the sun follows the clock.
export const DAY_LENGTH_SECONDS = 480;
export const DAY_START_HOUR = 9;

export const COLORS = {
  skyDay: 0x8ec9ee,
  skyDusk: 0xf2a65e,
  skyNight: 0x0e1a2e,
  sun: 0xfff2cf,
  road: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  sand: 0xe3cf9e,
  sea: 0x1f7fa8,
  grass: 0x5d8a4a,
  police: 0xe8eef2,
  gang: 0x8a2f2f,
};
