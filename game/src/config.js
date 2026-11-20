// Bandar Nusa — tuning constants and world layout numbers.
// All values are original to this game. Units: metres, seconds, rupiah.

export const WORLD = {
  // Playable city area is a square centred on the origin.
  halfSize: 190,
  // The beach strip sits along the south edge (negative Z side).
  beachStartZ: 150,
  seaStartZ: 168,
  blockSize: 34,
  roadWidth: 10,
  // Roads run on a regular grid; road centre lines are multiples of this.
  roadSpacing: 44,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.7,
  height: 1.8,
  punchRange: 2.2,
  punchDamage: 34,
  punchCooldown: 0.45,
  maxHealth: 100,
};

export const CAR = {
  accel: 14,
  brake: 22,
  maxSpeed: 26,
  reverseSpeed: 8,
  steerRate: 1.9,
  trafficSpeed: 7,
};

export const WANTED = {
  max: 5,
  // Wanted decays by one star after this many quiet seconds.
  decaySeconds: 45,
  stealCarStars: 1,
  punchPedStars: 1,
  punchCopStars: 2,
  // Police spawn and chase while wanted is at least this.
  chaseFrom: 1,
  // A cop that stays this close for this long busts the player.
  bustRange: 3.2,
  bustHoldSeconds: 1.2,
  bustFineRate: 0.1,
};

export const DEBT_TOTAL = 1400000;

export const DAY = {
  // One full day/night cycle, in seconds.
  lengthSeconds: 240,
  // Sun elevation range; night is when the sun is below the horizon.
  dawnHour: 6,
  duskHour: 18,
};

export const SAVE_KEY = 'bandar-nusa-save-v1';

export const COLORS = {
  skyDay: 0x87bfe8,
  skyNight: 0x0b1026,
  skyDawn: 0xe8a56b,
  sunDay: 0xfff2d8,
  sunNight: 0x8fa3ff,
  sea: 0x1d6f8f,
  sand: 0xd9c28a,
  grass: 0x5d8a4a,
  asphalt: 0x3a3d42,
  sidewalk: 0x9a9a92,
};
