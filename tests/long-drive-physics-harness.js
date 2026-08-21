'use strict';

// Deterministic headless validation of the equations in long-drive.js.
// This intentionally mirrors the live game's constants and integration order.

const YARDS_PER_METRE = 1.09361;
const GRID_HALF_WIDTH_METRES = 27.2;
const BALL_START_X = 2.43;
const CLUB_SPEED_BY_LEVEL = [130, 133, 136, 139, 142, 145, 148, 151, 154, 157];
const RANK_WIND_MAX = [2.5, 4, 6, 8, 10];
const WIND_DIRECTIONS = [
  { name: 'left crosswind', x: -1, z: 0, arrow: '←' },
  { name: 'right crosswind', x: 1, z: 0, arrow: '→' },
  { name: 'tailwind', x: 0, z: -1, arrow: '↑' },
  { name: 'headwind', x: 0, z: 1, arrow: '↓' },
  { name: 'left tailwind', x: -.707, z: -.707, arrow: '↖' },
  { name: 'right tailwind', x: .707, z: -.707, arrow: '↗' },
  { name: 'left headwind', x: -.707, z: .707, arrow: '↙' },
  { name: 'right headwind', x: .707, z: .707, arrow: '↘' },
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0xE7E1A5);
const between = (min, max) => lerp(min, max, random());
const choose = (items) => items[Math.floor(random() * items.length)];

function shotShape(curve) {
  const amount = Math.abs(curve);
  if (amount < .11) return 'Straight';
  if (curve < 0) return amount > .58 ? 'Hook' : 'Draw';
  return amount > .58 ? 'Slice' : 'Fade';
}

function calculateLaunch(powerInput, accuracyInput, level = 1, clubSpeedMultiplier = 1) {
  const power = clamp(powerInput, .08, 1);
  const accuracy = clamp(accuracyInput, -1, 1);
  const horizontalVariation = Math.sin(power * 18.1 + accuracy * 9.7) * (.07 + Math.abs(accuracy) * .14);
  const strikeHorizontal = clamp(accuracy * .45 + horizontalVariation, -.9, .9);
  const verticalVariation = Math.sin(power * 12.7 + accuracy * 7.3) * .08 * Math.abs(accuracy);
  const strikeVertical = clamp((power - .65) * .45 - Math.abs(accuracy) * .25 + verticalVariation, -.8, .65);

  let shotCurve = clamp(accuracy * .78 + strikeHorizontal * .38, -1, 1);
  const severeTiming = clamp((Math.abs(accuracy) - .58) / .42, 0, 1);
  if (Math.abs(accuracy) > .58) {
    const severeFloor = .62 + ((Math.abs(accuracy) - .58) / .42) * .38;
    shotCurve = Math.sign(accuracy) * Math.max(Math.abs(shotCurve), severeFloor);
  }

  const maxClubSpeedMph = CLUB_SPEED_BY_LEVEL[clamp(level, 1, CLUB_SPEED_BY_LEVEL.length) - 1] * clubSpeedMultiplier;
  const clubSpeedMph = maxClubSpeedMph * (.57 + power * .43);
  const speedRisk = clamp((clubSpeedMph - 130) / 27, 0, 1);
  const curveStrength = .9 + Math.pow(Math.abs(shotCurve), 1.4) * 10.5;
  const curveAccel = shotCurve * curveStrength * (1 - strikeVertical * .16) * (1 + severeTiming * .5) * (1 + speedRisk * .58);
  const horizontalPenalty = Math.pow(Math.abs(strikeHorizontal), 1.35) * .13;
  const verticalPenalty = Math.pow(Math.abs(strikeVertical), 1.3) * .17;
  const timingPenalty = Math.abs(accuracy) * .055;
  const efficiency = clamp(1 - horizontalPenalty - verticalPenalty - timingPenalty, .62, 1);
  const ballSpeedMph = clubSpeedMph * 1.47 * efficiency;
  const speedMps = ballSpeedMph / 2.23694;
  const launchDegrees = clamp(10.5 + power * 4.2 + strikeVertical * 3.1 - Math.abs(accuracy) * 1.15, 7, 16.5);
  const launch = launchDegrees * Math.PI / 180;
  // Face/path establishes a subtle start line opposite the eventual spin
  // curve: draws/hooks begin right, fades/slices begin left.
  const curveAmount = Math.abs(shotCurve);
  const sideways = -shotCurve * (.45 + curveAmount * .95 + severeTiming * .5);

  return {
    power, accuracy, strikeHorizontal, strikeVertical, shotCurve, curveAccel,
    maxCurveSpeed: (1.8 + Math.abs(shotCurve) * 9.2 + severeTiming * 3.4) * (1 + speedRisk * .38),
    efficiency, clubSpeedMph, maxClubSpeedMph, speedRisk, speedMps, ballSpeedMph, launchDegrees,
    velocity: { x: sideways, y: Math.sin(launch) * speedMps, z: -Math.cos(launch) * speedMps },
    shape: shotShape(shotCurve),
  };
}

function simulateShot(input) {
  const launch = calculateLaunch(input.power, input.accuracy, input.level || 1, input.clubSpeedMultiplier || input.speedMultiplier || 1);
  const position = { x: BALL_START_X, y: .55, z: 0 };
  const velocity = { ...launch.velocity };
  let curveVelocity = velocity.x;
  velocity.x = 0;
  let spinFlightActive = true;
  const step = 1 / 60;
  let shotTime = 0;
  let landed = false;
  let rolling = false;
  let carryMetres = 0;
  let firstCarryMetres = null;
  let maxHeight = position.y;
  let bounces = 0;
  let lateralAt50Yards = null;
  let lateralAt100Yards = null;

  while (shotTime <= 18 && position.z >= -525) {
    shotTime += step;
    if (!landed) {
      const windRisk = 1 + launch.speedRisk * .25;
      const windAccel = input.wind.x * input.windMph * .06 * windRisk;
      const windLongitudinalAccel = input.wind.z * input.windMph * .065 * windRisk;
      const airspeedFactor = Math.pow(clamp(Math.abs(velocity.z) / 65, .2, 1), 1.25);
      const curveBuild = clamp((shotTime - .18) / (1.25 - .18), 0, 1);
      const curveBuildEase = curveBuild * curveBuild * (3 - 2 * curveBuild);
      const curveEnd = 5.4 + launch.speedRisk * 1.2;
      const curveFade = 1 - clamp((shotTime - 3.2) / (curveEnd - 3.2), 0, 1);
      const curveProfile = (.12 + curveBuildEase * .88) * curveFade;
      velocity.x += windAccel * step;
      if (spinFlightActive) {
        curveVelocity = clamp(
          curveVelocity + launch.curveAccel * airspeedFactor * curveProfile * step,
          -launch.maxCurveSpeed,
          launch.maxCurveSpeed,
        );
      }
      velocity.z += windLongitudinalAccel * step;
      velocity.y -= 9.25 * step;
      const speedDrag = clamp((Math.hypot(velocity.x, velocity.z) - 72) / 32, 0, 1);
      const drag = Math.pow(.99765 - launch.speedRisk * .0007 - speedDrag * .00025, step * 60);
      velocity.x *= drag;
      velocity.z *= drag;
      position.x += (velocity.x + curveVelocity) * step;
      position.y += velocity.y * step;
      position.z += velocity.z * step;
      const forwardYards = -position.z * YARDS_PER_METRE;
      if (lateralAt50Yards === null && forwardYards >= 50) lateralAt50Yards = (position.x - BALL_START_X) * YARDS_PER_METRE;
      if (lateralAt100Yards === null && forwardYards >= 100) lateralAt100Yards = (position.x - BALL_START_X) * YARDS_PER_METRE;
      maxHeight = Math.max(maxHeight, position.y);

      if (position.y <= .12 && velocity.y < 0) {
        position.y = .12;
        if (spinFlightActive) {
          velocity.x += curveVelocity;
          curveVelocity = 0;
          spinFlightActive = false;
        }
        carryMetres = Math.hypot(position.z, position.x - BALL_START_X);
        if (firstCarryMetres === null) firstCarryMetres = carryMetres;
        if (Math.abs(velocity.y) > 2.8 && shotTime < 12) {
          bounces += 1;
          velocity.y *= -.26;
          velocity.x *= .76;
          velocity.z *= .76;
        } else {
          landed = true;
          rolling = true;
          velocity.y = 0;
        }
      }
    } else if (rolling) {
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      if (horizontalSpeed > .08) {
        const friction = Math.min(horizontalSpeed, 6.3 * step);
        velocity.x -= (velocity.x / horizontalSpeed) * friction;
        velocity.z -= (velocity.z / horizontalSpeed) * friction;
        position.x += velocity.x * step;
        position.z += velocity.z * step;
      } else {
        rolling = false;
        break;
      }
    }
  }

  const lateralMetres = position.x - BALL_START_X;
  const totalYards = Math.hypot(position.z, lateralMetres) * YARDS_PER_METRE;
  const carryYards = carryMetres * YARDS_PER_METRE;
  const firstCarryYards = (firstCarryMetres ?? carryMetres) * YARDS_PER_METRE;
  const lateralYards = lateralMetres * YARDS_PER_METRE;
  const longEnough = position.z < -35;
  const laterallyInBounds = Math.abs(lateralMetres) <= GRID_HALF_WIDTH_METRES;
  const edgeDistanceYards = Math.abs(Math.abs(lateralYards) - GRID_HALF_WIDTH_METRES * YARDS_PER_METRE);
  return {
    ...input, ...launch, totalYards, carryYards, firstCarryYards, lateralYards, lateralAt50Yards, lateralAt100Yards, maxHeight,
    bounces, shotTime, valid: longEnough && laterallyInBounds,
    outLeft: lateralMetres < -GRID_HALF_WIDTH_METRES,
    outRight: lateralMetres > GRID_HALF_WIDTH_METRES,
    edgeDistanceYards,
    nearInside: laterallyInBounds && edgeDistanceYards <= 5,
    nearOutside: !laterallyInBounds && edgeDistanceYards <= 5,
  };
}

function windForRank(rankIndex, extreme = false) {
  const wind = choose(WIND_DIRECTIONS);
  const windMph = extreme ? between(8, 10) : Math.max(1, Math.round(between(.35, 1) * RANK_WIND_MAX[rankIndex]));
  return { wind, windMph };
}

const suites = [
  {
    name: 'Broad distribution', count: 10000,
    make: () => ({ power: between(.08, 1), accuracy: between(-1, 1), ...windForRank(Math.floor(random() * 5)) }),
  },
  {
    name: 'Near-perfect', count: 4000,
    make: () => ({ power: between(.85, 1), accuracy: between(-.1, .1), ...windForRank(Math.floor(random() * 5)) }),
  },
  {
    name: 'Severe hooks', count: 2000,
    make: () => ({ power: between(.5, 1), accuracy: between(-1, -.58), ...windForRank(Math.floor(random() * 5)) }),
  },
  {
    name: 'Severe slices', count: 2000,
    make: () => ({ power: between(.5, 1), accuracy: between(.58, 1), ...windForRank(Math.floor(random() * 5)) }),
  },
  {
    name: 'Boundary + extreme wind', count: 2000,
    make: () => ({
      power: between(.65, 1),
      accuracy: (random() < .5 ? -1 : 1) * between(.42, .78),
      ...windForRank(4, true),
    }),
  },
];

function percentile(sorted, fraction) {
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return lerp(sorted[low], sorted[high], index - low);
}

function summarize(name, shots) {
  const sum = (field) => shots.reduce((total, shot) => total + shot[field], 0);
  const totalDistances = shots.map((shot) => shot.totalYards).sort((a, b) => a - b);
  const lateral = shots.map((shot) => Math.abs(shot.lateralYards)).sort((a, b) => a - b);
  const shapes = Object.fromEntries(['Straight', 'Draw', 'Hook', 'Fade', 'Slice'].map((shape) => [shape, shots.filter((shot) => shot.shape === shape).length]));
  return {
    name,
    shots: shots.length,
    validPct: sum('valid') / shots.length * 100,
    outLeftPct: sum('outLeft') / shots.length * 100,
    outRightPct: sum('outRight') / shots.length * 100,
    avgTotalYards: sum('totalYards') / shots.length,
    p05TotalYards: percentile(totalDistances, .05),
    p95TotalYards: percentile(totalDistances, .95),
    avgCarryYards: sum('carryYards') / shots.length,
    avgBallSpeedMph: sum('ballSpeedMph') / shots.length,
    avgClubSpeedMph: sum('clubSpeedMph') / shots.length,
    avgLaunchDegrees: sum('launchDegrees') / shots.length,
    avgAbsLateralYards: shots.reduce((total, shot) => total + Math.abs(shot.lateralYards), 0) / shots.length,
    avgLateralAt50Yards: shots.reduce((total, shot) => total + (shot.lateralAt50Yards || 0), 0) / shots.length,
    avgLateralAt100Yards: shots.reduce((total, shot) => total + (shot.lateralAt100Yards || 0), 0) / shots.length,
    p95AbsLateralYards: percentile(lateral, .95),
    nearInsidePct: sum('nearInside') / shots.length * 100,
    nearOutsidePct: sum('nearOutside') / shots.length * 100,
    closeCallPct: (sum('nearInside') + sum('nearOutside')) / shots.length * 100,
    shapes,
  };
}

function runValidation() {
const allShots = [];
const suiteResults = [];
const rawSuites = {};
for (const suite of suites) {
  const shots = Array.from({ length: suite.count }, () => simulateShot(suite.make()));
  rawSuites[suite.name] = shots;
  allShots.push(...shots);
  suiteResults.push(summarize(suite.name, shots));
}

const windResults = WIND_DIRECTIONS.map((wind) => summarize(
  `${wind.arrow} ${wind.name}`,
  allShots.filter((shot) => shot.wind.name === wind.name),
));

const hooks = rawSuites['Severe hooks'];
const slices = rawSuites['Severe slices'];
const perfect = rawSuites['Near-perfect'];
const diagnosticResults = [
  summarize('Extreme hooks (|timing| ≥ 0.90)', hooks.filter((shot) => Math.abs(shot.accuracy) >= .9)),
  summarize('Extreme slices (|timing| ≥ 0.90)', slices.filter((shot) => Math.abs(shot.accuracy) >= .9)),
];
const contradictions = {
  severeHooksFinishingRight: hooks.filter((shot) => shot.lateralYards > 0).length,
  severeSlicesFinishingLeft: slices.filter((shot) => shot.lateralYards < 0).length,
  severeHooksStillValid: hooks.filter((shot) => shot.valid).length,
  severeSlicesStillValid: slices.filter((shot) => shot.valid).length,
  nearPerfectOutOfBounds: perfect.filter((shot) => !shot.valid).length,
  nearPerfectNotStraight: perfect.filter((shot) => shot.shape !== 'Straight').length,
};

process.stdout.write(JSON.stringify({
  seed: '0xE7E1A5',
  totalShots: allShots.length,
  gridHalfWidthYards: GRID_HALF_WIDTH_METRES * YARDS_PER_METRE,
  suiteResults,
  diagnosticResults,
  windResults,
  contradictions,
}, null, 2));
}

if (require.main === module) runValidation();

module.exports = {
  simulateShot,
  calculateLaunch,
  WIND_DIRECTIONS,
  RANK_WIND_MAX,
  CLUB_SPEED_BY_LEVEL,
  mulberry32,
};
