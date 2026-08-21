'use strict';

const {
  simulateShot,
  WIND_DIRECTIONS,
  RANK_WIND_MAX,
  mulberry32,
} = require('./long-drive-physics-harness');

const RANKS = ['Rookie', 'Amateur', 'Crusher', 'Pro', 'Legend'];
const XP_LEVELS = [0, 100, 220, 360, 540, 760, 1020, 1320, 1680, 2100];
const REQUIREMENTS = [
  null,
  { target: 370, minLevel: 2, requiredRounds: 2, window: 5 },
  { target: 400, minLevel: 4, requiredRounds: 2, window: 5 },
  { target: 420, minLevel: 7, requiredRounds: 2, window: 7 },
  { target: 439, minLevel: 10, requiredRounds: 3, window: 8 },
];
const METERS = [
  { powerSeconds: .78, accuracySpeed: 4.6 },
  { powerSeconds: .68, accuracySpeed: 5.4 },
  { powerSeconds: .58, accuracySpeed: 6.3 },
  { powerSeconds: .49, accuracySpeed: 7.1 },
  { powerSeconds: .42, accuracySpeed: 8.0 },
];
const PROFILES = [
  { name: 'Recreational', powerSigma: .13, accuracySigma: .13 },
  { name: 'Developing', powerSigma: .09, accuracySigma: .09 },
  { name: 'Skilled', powerSigma: .06, accuracySigma: .06 },
  { name: 'Expert', powerSigma: .035, accuracySigma: .035 },
];
const POOL_SIZE = 1000;
const CAREERS = 5000;
const MAX_ROUNDS = 50;
const MINUTES_PER_ROUND = 1.5;
const random = mulberry32(0x1E6E0D);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function normal() {
  const u = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}
function currentLevel(xp) {
  let level = 1;
  XP_LEVELS.forEach((threshold, index) => { if (xp >= threshold) level = index + 1; });
  return level;
}
function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const p = (sorted.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
}
function driverForLevel(level, useSpeedDriver) {
  if (useSpeedDriver && level >= 7) return { name: 'Long', dispersionMultiplier: .96, clubSpeedMultiplier: 1.012 };
  if (level >= 3) return { name: 'Steady', dispersionMultiplier: .96, clubSpeedMultiplier: 1 };
  return { name: 'Training', dispersionMultiplier: 1, clubSpeedMultiplier: 1 };
}
function meterForRankAndLevel(rankIndex, level) {
  const referenceLevels = [1, 3, 5, 7, 10];
  const base = METERS[rankIndex];
  const levelDelta = level - referenceLevels[rankIndex];
  const powerPressure = 1 + levelDelta * .03;
  const accuracyPressure = 1 + levelDelta * .02;
  return {
    powerSeconds: base.powerSeconds / powerPressure,
    accuracySpeed: base.accuracySpeed * accuracyPressure,
  };
}
function makeShot(profile, rankIndex, level, driver) {
  const meter = meterForRankAndLevel(rankIndex, level);
  const powerError = normal() * profile.powerSigma;
  const accuracyError = normal() * profile.accuracySigma;
  const power = clamp(1 - Math.abs(powerError) / meter.powerSeconds, .08, 1);
  const accuracy = clamp(Math.sin(accuracyError * meter.accuracySpeed) * driver.dispersionMultiplier, -1, 1);
  const wind = WIND_DIRECTIONS[Math.floor(random() * WIND_DIRECTIONS.length)];
  const windMph = Math.max(1, Math.round((random() * .65 + .35) * RANK_WIND_MAX[rankIndex]));
  const shot = simulateShot({ power, accuracy, wind, windMph, level, clubSpeedMultiplier: driver.clubSpeedMultiplier });
  return {
    valid: shot.valid,
    distance: shot.totalYards,
    clubSpeedMph: shot.clubSpeedMph,
    ballSpeedMph: shot.ballSpeedMph,
    nearInside: shot.nearInside,
    nearOutside: shot.nearOutside,
  };
}

const pools = new Map();
for (const profile of PROFILES) {
  for (let rank = 0; rank < RANKS.length; rank += 1) {
    for (let level = 1; level <= XP_LEVELS.length; level += 1) {
      for (const useSpeedDriver of [false, true]) {
        const driver = driverForLevel(level, useSpeedDriver);
        const key = `${profile.name}|${rank}|${level}|${useSpeedDriver}`;
        pools.set(key, Array.from({ length: POOL_SIZE }, () => makeShot(profile, rank, level, driver)));
      }
    }
  }
}

function sampleShot(profile, rankIndex, level, useSpeedDriver) {
  const pool = pools.get(`${profile.name}|${rankIndex}|${level}|${useSpeedDriver}`);
  return pool[Math.floor(random() * pool.length)];
}

function runCareer(profile, requirements = REQUIREMENTS, useSpeedDriver = false) {
  let xp = 0;
  let rank = 0;
  let personalBest = 0;
  const history = [];
  const promotedAt = [0, null, null, null, null];

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    let roundBest = 0;
    let validCount = 0;
    let validDistanceTotal = 0;
    let setPersonalBest = false;
    for (let drive = 0; drive < 6; drive += 1) {
      const level = currentLevel(xp);
      const shot = sampleShot(profile, rank, level, useSpeedDriver);
      const isRecord = shot.valid && shot.distance > personalBest;
      if (shot.valid) {
        validCount += 1;
        validDistanceTotal += shot.distance;
        roundBest = Math.max(roundBest, shot.distance);
        if (isRecord) {
          personalBest = shot.distance;
          setPersonalBest = true;
        }
      }
    }
    const roundAverage = validDistanceTotal / 6;
    xp += 20 + Math.floor(roundAverage / 6);
    if (validCount === 6) xp += 10;
    if (setPersonalBest) xp += 15;
    const next = requirements[rank + 1];
    if (next && roundBest >= next.target) xp += 15;
    history.push({ best: roundBest });
    if (history.length > 12) history.shift();

    const requirement = requirements[rank + 1];
    if (requirement) {
      const recent = history.slice(-requirement.window);
      const qualifying = recent.filter((item) => item.best >= requirement.target).length;
      if (currentLevel(xp) >= requirement.minLevel && qualifying >= requirement.requiredRounds) {
        rank += 1;
        promotedAt[rank] = round;
      }
    }
    if (rank === 4) return { reached: true, rounds: round, promotedAt };
  }
  return { reached: false, rounds: MAX_ROUNDS, rank, promotedAt };
}

function evaluate(requirements, careerCount = CAREERS, useSpeedDriver = false) {
return PROFILES.map((profile) => {
  const careers = Array.from({ length: careerCount }, () => runCareer(profile, requirements, useSpeedDriver));
  const successes = careers.filter((career) => career.reached);
  const rounds = successes.map((career) => career.rounds);
  const rankDistribution = Object.fromEntries(RANKS.map((name, index) => [name, careers.filter((career) => (career.reached ? 4 : career.rank) === index).length / careers.length * 100]));
  const promotions = Object.fromEntries(RANKS.slice(1).map((name, offset) => {
    const rankIndex = offset + 1;
    const samples = careers.map((career) => career.promotedAt[rankIndex]).filter(Number.isFinite);
    return [name, { reachedPct: samples.length / careers.length * 100, medianRound: quantile(samples, .5) }];
  }));
  return {
    profile: profile.name,
    legendPct: successes.length / careers.length * 100,
    medianRounds: quantile(rounds, .5),
    p25Rounds: quantile(rounds, .25),
    p75Rounds: quantile(rounds, .75),
    p90Rounds: quantile(rounds, .9),
    medianDrives: quantile(rounds, .5) === null ? null : quantile(rounds, .5) * 6,
    medianHours: quantile(rounds, .5) === null ? null : quantile(rounds, .5) * MINUTES_PER_ROUND / 60,
    promotions,
    rankDistribution,
  };
});
}

const results = evaluate(REQUIREMENTS, CAREERS, true);

const scenarios = [
  { name: 'Two-round 438', amateur: 370, crusher: 400, pro: 420, legend: 438 },
  { name: 'Two-round 440', amateur: 370, crusher: 400, pro: 420, legend: 440 },
  { name: 'Three-round 438', amateur: 370, crusher: 400, pro: 420, legend: 438, legendRounds: 3 },
  { name: 'Three-round 439', amateur: 370, crusher: 400, pro: 420, legend: 439, legendRounds: 3 },
];

const scenarioResults = scenarios.map((scenario) => {
  const requirements = [
    null,
    { target: scenario.amateur, minLevel: 2, requiredRounds: 2, window: 5 },
    { target: scenario.crusher, minLevel: 4, requiredRounds: 2, window: 5 },
    { target: scenario.pro, minLevel: 7, requiredRounds: 2, window: 7 },
    { target: scenario.legend, minLevel: 10, requiredRounds: scenario.legendRounds || 2, window: 8 },
  ];
  const evaluated = evaluate(requirements, 2500, true);
  return {
    ...scenario,
    proPct: Object.fromEntries(evaluated.map((result) => [result.profile, result.promotions.Pro.reachedPct])),
    legendPct: Object.fromEntries(evaluated.map((result) => [result.profile, result.legendPct])),
    medianRounds: Object.fromEntries(evaluated.map((result) => [result.profile, result.medianRounds])),
  };
});

const gateChances = PROFILES.map((profile) => ({
  profile: profile.name,
  gates: REQUIREMENTS.slice(1).map((requirement, offset) => {
    const rankIndex = offset;
    const pool = pools.get(`${profile.name}|${rankIndex}|${requirement.minLevel}|true`);
    const qualifyingShots = pool.filter((shot) => shot.valid && shot.distance >= requirement.target);
    const shotPct = qualifyingShots.length / pool.length * 100;
    return {
      promotion: RANKS[rankIndex + 1],
      target: requirement.target,
      perDrivePct: shotPct,
      perRoundPct: (1 - Math.pow(1 - shotPct / 100, 6)) * 100,
      maxObservedYards: Math.max(...pool.filter((shot) => shot.valid).map((shot) => shot.distance)),
    };
  }),
}));

const representativeLevels = [1, 3, 5, 7, 10];
const rankShotMetrics = PROFILES.map((profile) => ({
  profile: profile.name,
  ranks: RANKS.map((rank, rankIndex) => {
    const level = representativeLevels[rankIndex];
    const pool = pools.get(`${profile.name}|${rankIndex}|${level}|true`);
    const average = (field, shots = pool) => shots.reduce((total, shot) => total + shot[field], 0) / shots.length;
    const validShots = pool.filter((shot) => shot.valid);
    return {
      rank,
      level,
      validPct: validShots.length / pool.length * 100,
      closeCallPct: pool.filter((shot) => shot.nearInside || shot.nearOutside).length / pool.length * 100,
      nearOutsidePct: pool.filter((shot) => shot.nearOutside).length / pool.length * 100,
      averageYards: average('distance'),
      averageValidYards: validShots.length ? average('distance', validShots) : 0,
      averageClubSpeedMph: average('clubSpeedMph'),
      averageBallSpeedMph: average('ballSpeedMph'),
    };
  }),
}));

const levelTenProMetrics = PROFILES.map((profile) => {
  const pool = pools.get(`${profile.name}|3|10|true`);
  const validShots = pool.filter((shot) => shot.valid);
  const qualifyingShots = validShots.filter((shot) => shot.distance >= REQUIREMENTS[4].target);
  return {
    profile: profile.name,
    validPct: validShots.length / pool.length * 100,
    qualifyingDrivePct: qualifyingShots.length / pool.length * 100,
    anyValidRoundPct: (1 - Math.pow(1 - validShots.length / pool.length, 6)) * 100,
    allOobRoundPct: Math.pow(1 - validShots.length / pool.length, 6) * 100,
  };
});

process.stdout.write(JSON.stringify({
  seed: '0x1E6E0D',
  method: `${POOL_SIZE} exact physics shots per profile/rank/level/driver cell; ${CAREERS} sampled careers per profile`,
  maxRounds: MAX_ROUNDS,
  assumedMinutesPerRound: MINUTES_PER_ROUND,
  profiles: PROFILES,
  gateChances,
  rankShotMetrics,
  levelTenProMetrics,
  scenarioResults,
  results,
}, null, 2));
