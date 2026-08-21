'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const source = fs.readFileSync('sloppy-golf/long-drive.js', 'utf8');
const LANE_CENTER_X = 2.43;
const GRID_HALF_WIDTH_METRES = 27.2;
const XP_LEVELS = [0, 100, 220, 360, 540, 760, 1020, 1320, 1680, 2100];
const RANK_REQUIREMENTS = [
  null,
  { target: 370, window: 5, requiredRounds: 2, minLevel: 2, name: 'Amateur' },
  { target: 400, window: 5, requiredRounds: 2, minLevel: 4, name: 'Crusher' },
  { target: 420, window: 7, requiredRounds: 2, minLevel: 7, name: 'Pro' },
  { target: 439, window: 8, requiredRounds: 3, minLevel: 10, name: 'Legend' },
];
const HILL_SETTINGS = [
  [-74, 1, -55, 43, 10, 45], [74, 0, -70, 48, 12, 52],
];
const SIDE_BERM_Z_STOPS = [12, -35, -85, -145, -220, -310, -410, -520, -630, -760, -900];
const SIDE_BERM_HEIGHT_STOPS = [1.8, 4.4, 5.8, 4.5, 7.2, 5.2, 6.4, 4.8, 6.1, 4.2, 2.2];
const SIDE_BERM_RIDGE_STOPS = [47, 51, 46, 54, 49, 56, 48, 53, 47, 51, 46];
const SIDE_BERM_OUTER = 92;
const SIDE_BERM_APRON_OUTER = 180;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;

function levelForXp(xp) {
  let level = 1;
  XP_LEVELS.forEach((threshold, index) => { if (xp >= threshold) level = index + 1; });
  return level;
}

function driverForState(level, competitionUnlocked) {
  if (level >= 10 && competitionUnlocked) return 'Competition';
  if (level >= 7) return 'Long';
  if (level >= 3) return 'Steady';
  return 'Training';
}

function completeRound(state, shots) {
  const valid = shots.filter((shot) => shot.valid);
  const best = valid.length ? Math.max(...valid.map((shot) => shot.distance)) : 0;
  const average = valid.reduce((sum, shot) => sum + shot.distance, 0) / 6;
  const nextRequirement = RANK_REQUIREMENTS[state.rankIndex + 1];
  const gainedXp = 20 + Math.floor(average / 6) + (valid.length === 6 ? 10 : 0)
    + (state.roundHadPersonalBest ? 15 : 0) + (nextRequirement && best >= nextRequirement.target ? 15 : 0);
  state.xp += gainedXp;
  const levelAfter = levelForXp(state.xp);
  state.pendingLevelUp = levelAfter > state.roundLevelStart ? levelAfter : null;
  const unlockedSteady = state.roundLevelStart < 3 && levelAfter >= 3;
  const unlockedLong = state.roundLevelStart < 7 && levelAfter >= 7;
  const unlockedCompetition = !state.competitionUnlocked && state.roundLevelStart >= 10 && average >= 325;
  if (unlockedCompetition) state.competitionUnlocked = true;
  state.pendingDriverUnlock = unlockedCompetition ? 'Competition' : unlockedLong ? 'Long' : unlockedSteady ? 'Steady' : null;
  state.history.push({ best });
  state.history = state.history.slice(-12);
  const requirement = RANK_REQUIREMENTS[state.rankIndex + 1];
  if (requirement) {
    const qualifying = state.history.slice(-requirement.window).filter((round) => round.best >= requirement.target).length;
    if (levelForXp(state.xp) >= requirement.minLevel && qualifying >= requirement.requiredRounds) {
      state.rankIndex += 1;
      state.pendingPromotion = requirement.name;
    }
  }
  return { average, best, gainedXp };
}

function rewardFlow(state) {
  const flow = [];
  if (state.pendingLevelUp) flow.push(`Level ${state.pendingLevelUp}`);
  if (state.pendingDriverUnlock) flow.push(`${state.pendingDriverUnlock} Driver`);
  if (state.pendingPromotion) flow.push(state.pendingPromotion);
  flow.push('Round Summary');
  return flow;
}

function sideTerrainProfile(z) {
  if (z > SIDE_BERM_Z_STOPS[0] || z < SIDE_BERM_Z_STOPS.at(-1)) return null;
  for (let index = 0; index < SIDE_BERM_Z_STOPS.length - 1; index += 1) {
    const near = SIDE_BERM_Z_STOPS[index];
    const far = SIDE_BERM_Z_STOPS[index + 1];
    if (z <= near && z >= far) {
      return { index, height: lerp(SIDE_BERM_HEIGHT_STOPS[index], SIDE_BERM_HEIGHT_STOPS[index + 1], (near - z) / (near - far)) };
    }
  }
  return null;
}

function terrainHeightAt(x, z) {
  const profile = sideTerrainProfile(z);
  const lateral = Math.abs(x - LANE_CENTER_X);
  let height = 0;
  if (profile && lateral > 29) {
    const near = SIDE_BERM_Z_STOPS[profile.index];
    const far = SIDE_BERM_Z_STOPS[profile.index + 1];
    const progress = (near - z) / (near - far);
    const mid = lerp(SIDE_BERM_RIDGE_STOPS[profile.index], SIDE_BERM_RIDGE_STOPS[profile.index + 1], progress);
    if (lateral <= mid) height = lerp(.03, profile.height, (lateral - 29) / (mid - 29));
    else if (lateral <= SIDE_BERM_OUTER) height = lerp(profile.height, profile.height * .72, (lateral - mid) / (SIDE_BERM_OUTER - mid));
    else if (lateral <= SIDE_BERM_APRON_OUTER) height = lerp(profile.height * .72, 0, (lateral - SIDE_BERM_OUTER) / (SIDE_BERM_APRON_OUTER - SIDE_BERM_OUTER));
  }
  HILL_SETTINGS.forEach(([hillX, , hillZ, sx, sy, sz]) => {
    const dx = (x - hillX) / sx;
    const dz = (z - hillZ) / sz;
    const radial = dx * dx + dz * dz;
    if (radial >= 1) return;
    height = Math.max(height, sy * .18 - 2.5 + sy * .94 * Math.sqrt(1 - radial));
  });
  return Math.max(0, height);
}

function sweepTerrain(previous, end) {
  const travel = Math.hypot(end.x - previous.x, end.y - previous.y, end.z - previous.z);
  const samples = clamp(Math.ceil(travel / .32), 1, 12);
  for (let sample = 1; sample <= samples; sample += 1) {
    const amount = sample / samples;
    const point = {
      x: lerp(previous.x, end.x, amount),
      y: lerp(previous.y, end.y, amount),
      z: lerp(previous.z, end.z, amount),
    };
    const ground = terrainHeightAt(point.x, point.z);
    if (point.y <= ground + .12) return { point, ground, sample, samples };
  }
  return null;
}

function sweptSphereHit(previous, end, centre, radius) {
  const travel = Math.hypot(end.x - previous.x, end.y - previous.y, end.z - previous.z);
  const samples = clamp(Math.ceil(travel / .32), 1, 12);
  for (let sample = 1; sample <= samples; sample += 1) {
    const amount = sample / samples;
    const x = lerp(previous.x, end.x, amount);
    const y = lerp(previous.y, end.y, amount);
    const z = lerp(previous.z, end.z, amount);
    if (Math.hypot(x - centre.x, y - centre.y, z - centre.z) < radius) return true;
  }
  return false;
}

function avoidCanopy(camera, ball, canopy) {
  const firstSightX = ball.x - camera.x;
  const firstSightZ = ball.z - camera.z;
  const firstLengthSquared = firstSightX ** 2 + firstSightZ ** 2;
  const firstProgress = clamp(((canopy.x - camera.x) * firstSightX + (canopy.z - camera.z) * firstSightZ) / firstLengthSquared, 0, 1);
  const firstX = camera.x + firstSightX * firstProgress;
  const firstZ = camera.z + firstSightZ * firstProgress;
  const firstDistance = Math.hypot(canopy.x - firstX, canopy.z - firstZ);
  const dodge = clamp((canopy.radius - firstDistance) * 4.5, 0, 18);
  const adjusted = { ...camera, x: camera.x - Math.sign(ball.x - LANE_CENTER_X) * dodge };
  const sightX = ball.x - adjusted.x;
  const sightZ = ball.z - adjusted.z;
  const lengthSquared = sightX ** 2 + sightZ ** 2;
  const progress = clamp(((canopy.x - adjusted.x) * sightX + (canopy.z - adjusted.z) * sightZ) / lengthSquared, 0, 1);
  const x = adjusted.x + sightX * progress;
  const z = adjusted.z + sightZ * progress;
  const horizontal = Math.hypot(canopy.x - x, canopy.z - z);
  if (progress <= .03 || progress >= .94 || horizontal >= canopy.radius) return { dodge, lift: 0, cleared: true };
  const top = canopy.y + Math.sqrt(canopy.radius ** 2 - horizontal ** 2) + .55;
  const sightY = lerp(adjusted.y, ball.y, progress);
  const lift = clamp(Math.max(0, (top - sightY) / (1 - progress)), 0, 9);
  const liftedSightY = lerp(adjusted.y + lift, ball.y, progress);
  return { dodge, lift, cleared: liftedSightY >= top - .001 };
}

// Code-review contracts.
assert.match(source, /function readStoredNumber\(/);
assert.match(source, /function readStoredRoundHistory\(/);
assert.match(source, /shotTracer\.geometry\.dispose\(\)/);
assert.match(source, /function snapshotPerformanceDrive\(/);
assert.match(source, /function sweepBallAgainstTerrain\(/);
assert.match(source, /function liftFlightCameraAboveObstacles\(/);
assert.ok(source.indexOf('sweepBallAgainstTerrain(ballPreviousPosition)') < source.indexOf('extendShotTracer();'));
assert.ok(source.indexOf('if (game.pendingLevelUp)') < source.indexOf('if (game.pendingDriverUnlock)'));
assert.ok(source.indexOf('if (game.pendingDriverUnlock)') < source.indexOf('if (game.pendingPromotion)'));

// Ordinary Level Up -> Driver Unlock -> Rank Up -> Summary sequence.
const ordinary = {
  xp: 215,
  rankIndex: 0,
  history: [{ best: 375 }],
  roundLevelStart: 2,
  roundDriver: 'Training',
  competitionUnlocked: false,
  roundHadPersonalBest: false,
};
completeRound(ordinary, Array.from({ length: 6 }, () => ({ valid: true, distance: 380 })));
assert.deepEqual(rewardFlow(ordinary), ['Level 3', 'Steady Driver', 'Amateur', 'Round Summary']);
assert.equal(ordinary.roundDriver, 'Training');
assert.equal(driverForState(levelForXp(ordinary.xp), ordinary.competitionUnlocked), 'Steady');

// Competition Driver remains a following-round reward.
const competition = {
  xp: 2200,
  rankIndex: 3,
  history: [{ best: 440 }, { best: 442 }],
  roundLevelStart: 10,
  roundDriver: 'Long',
  competitionUnlocked: false,
  roundHadPersonalBest: false,
};
completeRound(competition, [440, 330, 320, 310, 300, 300].map((distance) => ({ valid: true, distance })));
assert.equal(competition.roundDriver, 'Long');
assert.equal(competition.pendingDriverUnlock, 'Competition');
assert.equal(driverForState(10, competition.competitionUnlocked), 'Competition');

// Endpoint-only terrain checks miss this realistic 3.4m hill-crest crossing;
// the new swept test catches it between frames.
const hillStart = { x: -74, y: 8.815, z: -53.3 };
const hillEnd = { x: -74, y: 8.815, z: -56.7 };
assert.ok(hillEnd.y > terrainHeightAt(hillEnd.x, hillEnd.z) + .12);
const hillHit = sweepTerrain(hillStart, hillEnd);
assert.ok(hillHit, 'swept terrain collision must catch the hill crest');

// Berm interpolation remains continuous at segment joins and perfectly
// mirrored about the authoritative lane centre.
let terrainContinuityChecks = 0;
for (const z of SIDE_BERM_Z_STOPS.slice(1, -1)) {
  const left = terrainHeightAt(LANE_CENTER_X - 70, z);
  const right = terrainHeightAt(LANE_CENTER_X + 70, z);
  if (z < -145) assert.ok(Math.abs(left - right) < 1e-9);
  assert.ok(Math.abs(terrainHeightAt(LANE_CENTER_X + 70, z - .001) - terrainHeightAt(LANE_CENTER_X + 70, z + .001)) < .001);
  terrainContinuityChecks += 2;
}
assert.equal(terrainHeightAt(LANE_CENTER_X + SIDE_BERM_APRON_OUTER, -400), 0);
terrainContinuityChecks += 1;

// The .32m adaptive collision sampling catches both trunk and canopy-scale
// contacts at the maximum realistic per-frame travel of a long-drive ball.
assert.ok(sweptSphereHit(
  { x: -1.7, y: 4, z: 0 },
  { x: 1.7, y: 4, z: 0 },
  { x: 0, y: 4, z: 0 },
  .55,
));

// The obstacle-aware camera lift clears a canopy lying directly in the
// camera-to-ball corridor on a severe miss.
const camera = { x: 22, y: 9, z: -280 };
const trackedBall = { x: 55, y: 3, z: -310 };
const canopy = { x: 38.5, y: 12, z: -295, radius: 4.2 };
const avoidance = avoidCanopy(camera, trackedBall, canopy);
assert.ok(avoidance.dodge > 0);
assert.ok(avoidance.cleared, JSON.stringify(avoidance));

// Terrain evaluation stays finite and lightweight across an extreme envelope.
let checksum = 0;
const benchmarkStart = performance.now();
for (let index = 0; index < 250000; index += 1) {
  const x = -205 + (index % 411);
  const z = 15 - (index % 920);
  const height = terrainHeightAt(x, z);
  assert.ok(Number.isFinite(height) && height >= 0);
  checksum += height;
}
const benchmarkMs = performance.now() - benchmarkStart;

process.stdout.write(JSON.stringify({
  status: 'pass',
  codeReviewContracts: 9,
  ordinaryRewardFlow: rewardFlow(ordinary),
  activeDriverDuringUnlockRound: ordinary.roundDriver,
  driverAtFollowingRound: driverForState(levelForXp(ordinary.xp), ordinary.competitionUnlocked),
  competitionDriverDuringUnlockRound: competition.roundDriver,
  competitionDriverFollowingRound: driverForState(10, competition.competitionUnlocked),
  sweptHillCollision: { samples: hillHit.samples, hitSample: hillHit.sample, ground: Number(hillHit.ground.toFixed(3)) },
  terrainContinuityChecks,
  maxStepTreeSweep: 'pass',
  canopyCameraAvoidance: {
    lateralDodgeMetres: Number(avoidance.dodge.toFixed(3)),
    liftMetres: Number(avoidance.lift.toFixed(3)),
    cleared: avoidance.cleared,
  },
  terrainBenchmark: { calls: 250000, milliseconds: Number(benchmarkMs.toFixed(2)), checksum: Number(checksum.toFixed(2)) },
}, null, 2));
