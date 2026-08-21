'use strict';

const { simulateShot, WIND_DIRECTIONS, mulberry32 } = require('./long-drive-physics-harness');

const PROFILES = [
  { name: 'Developing', powerSigma: .09, accuracySigma: .09 },
  { name: 'Skilled', powerSigma: .06, accuracySigma: .06 },
  { name: 'Expert', powerSigma: .035, accuracySigma: .035 },
];
const LONG_MULTIPLIER = 1.012;
const COMPETITION_MULTIPLIER = 1.035;
const CAREERS = 5000;
const MAX_ROUNDS = 30;
const POOL_SIZE = 3000;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function normal(random) {
  const u = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
function shot(random, profile, multiplier) {
  const power = clamp(1 - Math.abs(normal(random) * profile.powerSigma) / .42, .08, 1);
  const accuracy = clamp(Math.sin(normal(random) * profile.accuracySigma * 8) * .96, -1, 1);
  const wind = WIND_DIRECTIONS[Math.floor(random() * WIND_DIRECTIONS.length)];
  const windMph = Math.max(1, Math.round((random() * .65 + .35) * 8));
  return simulateShot({ power, accuracy, wind, windMph, level: 10, clubSpeedMultiplier: multiplier });
}
function round(random, profile, multiplier) {
  const pool = shotPools.get(`${profile.name}|${multiplier}`);
  const shots = Array.from({ length: 6 }, () => pool[Math.floor(random() * pool.length)]);
  const valid = shots.filter((result) => result.valid);
  return {
    average: valid.reduce((sum, result) => sum + result.totalYards, 0) / 6,
    best: valid.length ? Math.max(...valid.map((result) => result.totalYards)) : 0,
  };
}

const poolRandom = mulberry32(0xC04ECAFE);
const shotPools = new Map();
for (const profile of PROFILES) {
  for (const multiplier of [LONG_MULTIPLIER, COMPETITION_MULTIPLIER]) {
    shotPools.set(`${profile.name}|${multiplier}`, Array.from({ length: POOL_SIZE }, () => shot(poolRandom, profile, multiplier)));
  }
}
function career(profile, competitionEnabled, seed) {
  const random = mulberry32(seed);
  let unlocked = false;
  let unlockedAt = null;
  const history = [];
  for (let roundNumber = 1; roundNumber <= MAX_ROUNDS; roundNumber += 1) {
    const result = round(random, profile, unlocked ? COMPETITION_MULTIPLIER : LONG_MULTIPLIER);
    if (competitionEnabled && !unlocked && result.average >= 325) {
      unlocked = true;
      unlockedAt = roundNumber;
    }
    history.push(result.best);
    if (history.length > 8) history.shift();
    if (history.filter((best) => best >= 439).length >= 3) return { legendAt: roundNumber, unlockedAt };
  }
  return { legendAt: null, unlockedAt };
}
function quantile(values, q) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return values[Math.round((values.length - 1) * q)];
}

const results = PROFILES.map((profile, profileIndex) => {
  const baseline = [];
  const competition = [];
  for (let index = 0; index < CAREERS; index += 1) {
    const seed = 0xC04E0000 + profileIndex * CAREERS + index;
    baseline.push(career(profile, false, seed));
    competition.push(career(profile, true, seed));
  }
  const summarize = (careers) => {
    const legends = careers.filter((entry) => entry.legendAt !== null);
    return {
      legendWithin30Pct: legends.length / careers.length * 100,
      medianLegendRound: quantile(legends.map((entry) => entry.legendAt), .5),
    };
  };
  const unlocks = competition.filter((entry) => entry.unlockedAt !== null);
  return {
    profile: profile.name,
    longDriverOnly: summarize(baseline),
    competitionDriver: summarize(competition),
    competitionUnlockPct: unlocks.length / competition.length * 100,
    medianUnlockRound: quantile(unlocks.map((entry) => entry.unlockedAt), .5),
  };
});

process.stdout.write(JSON.stringify({
  seed: '0xC04E0000',
  careersPerProfile: CAREERS,
  exactShotsPerProfileAndDriver: POOL_SIZE,
  maxRounds: MAX_ROUNDS,
  unlock: 'Level 10 round average >= 325 yd; OOB = 0; equipped next round',
  longMultiplier: LONG_MULTIPLIER,
  competitionMultiplier: COMPETITION_MULTIPLIER,
  results,
}, null, 2));
