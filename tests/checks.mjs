// Logic checks for Bandar Nusa — runs in Node against the pure rule
// modules (game/src/logic.js, game/src/random.js). No browser needed.
// Usage: node tests/checks.mjs

import {
  MISSIONS, totalMissionRewards, createState, currentMission, currentStepId,
  completeStep, addWanted, tickWanted, bustFine, formatRupiah, starsText,
  clamp, distance2D, angleLerp, serializeSave, parseSave, debtRemaining,
} from '../game/src/logic.js';
import { mulberry32, range, intRange, pick, shuffle, hashSeed } from '../game/src/random.js';
import { DEBT_TOTAL, WANTED } from '../game/src/config.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL  ${name}`);
  }
}

// --- Missions ---------------------------------------------------------------
check('five missions', MISSIONS.length === 5);
check('rewards add up to the debt', totalMissionRewards() === 1400000);
check('reward sequence is 150/250/200/300/500k',
  MISSIONS.map((m) => m.reward).join(',') === '150000,250000,200000,300000,500000');
check('mission ids are unique', new Set(MISSIONS.map((m) => m.id)).size === 5);
check('every mission has steps', MISSIONS.every((m) => m.steps.length > 0));
check('every mission has a title and brief',
  MISSIONS.every((m) => m.title.length > 2 && m.brief.length > 20));
check('mission text is plain ASCII English',
  MISSIONS.every((m) => /^[\x20-\x7E]+$/.test(m.title + m.brief + m.target)));
check('debt total constant is 1,400,000', DEBT_TOTAL === 1400000);

// --- Fresh state --------------------------------------------------------------
const s0 = createState();
check('fresh state: no money', s0.money === 0);
check('fresh state: full debt', s0.debt === 1400000);
check('fresh state: no wanted stars', s0.wanted === 0);
check('fresh state: full health', s0.health === 100);
check('fresh state: mission 1 active', currentMission(s0).id === 'm1');
check('fresh state: first step is the pier', currentStepId(s0) === 'pier');
check('debt remaining is full at start', debtRemaining(s0) === 1400000);

// --- Mission flow ---------------------------------------------------------------
const s1 = createState();
const r1 = completeStep(s1);
check('first step pays nothing yet', r1.paid === 0 && !r1.missionDone);
check('step advances to market', currentStepId(s1) === 'market');
const r2 = completeStep(s1);
check('finishing mission 1 pays 150,000', r2.paid === 150000 && r2.missionDone);
check('money grows by the reward', s1.money === 150000);
check('debt drops by the reward', s1.debt === 1250000);
check('next mission is m2', currentMission(s1).id === 'm2');

const sAll = createState();
let totalPaid = 0;
let done = false;
for (let i = 0; i < 40 && !done; i += 1) {
  const r = completeStep(sAll);
  totalPaid += r.paid;
  done = r.gameDone;
}
check('playing all missions finishes the game', done === true);
check('all rewards paid in full', totalPaid === 1400000);
check('debt is zero at the end', sAll.debt === 0 && debtRemaining(sAll) === 0);
check('no mission left after the last one', currentMission(sAll) === null);
check('completing a step after the end pays nothing', completeStep(sAll).paid === 0);

// --- Wanted level ---------------------------------------------------------------
const sW = createState();
check('stealing a car adds 1 star', addWanted(sW, 1) === 1);
check('hitting a cop adds 2 more stars', addWanted(sW, 2) === 3);
check('wanted clamps at 5 stars', addWanted(sW, 9) === 5 && sW.wanted === WANTED.max);
check('no decay before 45 quiet seconds', tickWanted(sW, 44, false) === 5);
check('one star decays after 45 quiet seconds', tickWanted(sW, 1, false) === 4);
check('crime resets the quiet timer', (() => {
  tickWanted(sW, 40, false);
  tickWanted(sW, 0, true);
  return tickWanted(sW, 10, false) === 4;
})());
check('stars text renders 3 of 5', starsText(3) === '★★★☆☆');
check('stars text renders 0 of 5', starsText(0) === '☆☆☆☆☆');
check('stars text renders 5 of 5', starsText(5) === '★★★★★');

// --- Busted -----------------------------------------------------------------------
const sB = createState();
sB.money = 100000;
sB.wanted = 4;
sB.health = 40;
const fine = bustFine(sB);
check('bust fine is 10 percent', fine === 10000);
check('fine is taken from cash', sB.money === 90000);
check('bust clears wanted stars', sB.wanted === 0);
check('bust restores health', sB.health === 100);
check('bust counts once', sB.bustedCount === 1);
check('bust with no cash fines nothing', bustFine(createState()) === 0);

// --- Formatting and math ------------------------------------------------------------
check('rupiah formats 1,400,000', formatRupiah(1400000) === 'Rp 1.400.000');
check('rupiah formats zero', formatRupiah(0) === 'Rp 0');
check('clamp holds the middle', clamp(5, 0, 10) === 5);
check('clamp holds the top', clamp(99, 0, 10) === 10);
check('clamp holds the bottom', clamp(-3, 0, 10) === 0);
check('distance 3-4-5 triangle', Math.abs(distance2D(0, 0, 3, 4) - 5) < 1e-9);
check('angle lerp wraps around pi', Math.abs(angleLerp(3.1, -3.1, 0.5) - Math.PI) < 0.2);

// --- Save / load ----------------------------------------------------------------------
const sS = createState();
sS.money = 400000;
sS.missionIndex = 2;
sS.missionStep = 1;
sS.wanted = 2;
sS.bustedCount = 1;
const text = serializeSave(sS, { x: 12, z: -34 });
const loaded = parseSave(text);
check('save round-trips money', loaded && loaded.state.money === 400000);
check('save round-trips mission progress', loaded && loaded.state.missionIndex === 2 && loaded.state.missionStep === 1);
check('save round-trips wanted stars', loaded && loaded.state.wanted === 2);
check('save round-trips player position', loaded && loaded.playerPos.x === 12 && loaded.playerPos.z === -34);
check('save stores version 1', JSON.parse(text).version === 1);
check('corrupt save is rejected', parseSave('not json') === null);
check('wrong version is rejected', parseSave('{"version":2,"money":0,"debt":0,"missionIndex":0}') === null);
check('save without money is rejected', parseSave('{"version":1,"debt":0,"missionIndex":0}') === null);
check('wanted above 5 is clamped on load',
  parseSave('{"version":1,"money":0,"debt":1400000,"missionIndex":0,"wanted":99}').state.wanted === 5);
check('mission index past the end is rejected',
  parseSave('{"version":1,"money":0,"debt":0,"missionIndex":99}') === null);

// --- Seeded random ----------------------------------------------------------------------
const a = mulberry32(23);
const b = mulberry32(23);
check('same seed gives the same sequence', a() === b() && a() === b());
check('different seeds differ', mulberry32(23)() !== mulberry32(24)());
const rr = mulberry32(59);
check('range stays in bounds', (() => {
  for (let i = 0; i < 200; i += 1) {
    const v = range(rr, -5, 5);
    if (v < -5 || v > 5) return false;
  }
  return true;
})());
check('int range stays in bounds', (() => {
  for (let i = 0; i < 200; i += 1) {
    const v = intRange(rr, 1, 6);
    if (v < 1 || v > 6) return false;
  }
  return true;
})());
check('pick returns a member', ['a', 'b', 'c'].includes(pick(rr, ['a', 'b', 'c'])));
check('shuffle keeps every element',
  shuffle(rr, [1, 2, 3, 4]).sort().join(',') === '1,2,3,4');
check('hash seed is deterministic', hashSeed('bandar-nusa') === hashSeed('bandar-nusa'));
check('hash seed differs per word', hashSeed('bandar-nusa') !== hashSeed('raka'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
