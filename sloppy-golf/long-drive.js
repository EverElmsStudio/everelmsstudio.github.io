const $ = (selector) => document.querySelector(selector);
const canvas = $('#game-canvas');
const sceneWrap = $('#scene-wrap');
const clubPreviewMode = new URLSearchParams(window.location.search).has('clubView');
const clubPreviewStyle = new URLSearchParams(window.location.search).get('clubStyle');
const legacyGolferPreview = new URLSearchParams(window.location.search).get('golferView') === 'legacy';
const sourceGolferPreview = new URLSearchParams(window.location.search).get('golferView') === 'source';
const driverUnlockPreview = new URLSearchParams(window.location.search).get('unlockView');
const rewardPreview = new URLSearchParams(window.location.search).get('rewardView');
const roundPreview = new URLSearchParams(window.location.search).get('roundView');
const diagnosticsMode = new URLSearchParams(window.location.search).has('diagnostics');
const startPanel = $('#start-panel');
const swingPanel = $('#swing-panel');
const resultPanel = $('#result-panel');
const accuracyWrap = $('#accuracy-wrap');
const distanceLive = $('#distance-live');
const powerMarker = $('#power-marker');
const powerFill = $('#power-fill');
const powerMeter = $('#power-meter');
const accuracyMarker = $('#accuracy-marker');
const swingPrompt = $('#swing-prompt');
const impactFeedback = $('#impact-feedback');
const boundaryFeedback = $('#boundary-feedback');
const impactFlash = $('#impact-flash');
const startButton = $('#start-button');
let meterStartedAt = 0;
let powerMarkerAnimation = null;
let powerFillAnimation = null;
let accuracyMarkerAnimation = null;

const performanceDiagnostics = diagnosticsMode ? {
  startedAt: performance.now(),
  frames: 0,
  over20ms: 0,
  over33ms: 0,
  over50ms: 0,
  maxFrameMs: 0,
  frameMsTotal: 0,
  longTasks: 0,
  longTaskMs: 0,
  driveSnapshots: [],
  states: {},
  sections: {
    environment: { total: 0, max: 0 },
    gameplay: { total: 0, max: 0 },
    golfer: { total: 0, max: 0 },
    render: { total: 0, max: 0 },
  },
} : null;
const performanceDiagnosticsOutput = diagnosticsMode ? document.createElement('output') : null;
if (performanceDiagnosticsOutput) {
  performanceDiagnosticsOutput.id = 'performance-diagnostics';
  performanceDiagnosticsOutput.hidden = true;
  document.body.append(performanceDiagnosticsOutput);
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          performanceDiagnostics.longTasks += 1;
          performanceDiagnostics.longTaskMs += entry.duration;
        });
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* Long-task entries are optional browser diagnostics. */ }
  }
}

function recordPerformanceDiagnostics(frameMs, state, sectionTimes) {
  if (!performanceDiagnostics || frameMs > 1000) return;
  performanceDiagnostics.frames += 1;
  performanceDiagnostics.frameMsTotal += frameMs;
  performanceDiagnostics.maxFrameMs = Math.max(performanceDiagnostics.maxFrameMs, frameMs);
  if (frameMs > 20) performanceDiagnostics.over20ms += 1;
  if (frameMs > 33.34) performanceDiagnostics.over33ms += 1;
  if (frameMs > 50) performanceDiagnostics.over50ms += 1;
  const stateStats = performanceDiagnostics.states[state] ||= { frames: 0, total: 0, over33ms: 0, max: 0 };
  stateStats.frames += 1;
  stateStats.total += frameMs;
  stateStats.max = Math.max(stateStats.max, frameMs);
  if (frameMs > 33.34) stateStats.over33ms += 1;
  Object.entries(sectionTimes).forEach(([name, duration]) => {
    performanceDiagnostics.sections[name].total += duration;
    performanceDiagnostics.sections[name].max = Math.max(performanceDiagnostics.sections[name].max, duration);
  });
  if (performanceDiagnostics.frames % 30 !== 0) return;
  const round = (value) => Math.round(value * 100) / 100;
  performanceDiagnosticsOutput.textContent = JSON.stringify({
    elapsedSeconds: round((performance.now() - performanceDiagnostics.startedAt) / 1000),
    frames: performanceDiagnostics.frames,
    averageFrameMs: round(performanceDiagnostics.frameMsTotal / performanceDiagnostics.frames),
    maxFrameMs: round(performanceDiagnostics.maxFrameMs),
    over20ms: performanceDiagnostics.over20ms,
    over33ms: performanceDiagnostics.over33ms,
    over50ms: performanceDiagnostics.over50ms,
    longTasks: performanceDiagnostics.longTasks,
    longTaskMs: round(performanceDiagnostics.longTaskMs),
    driveSnapshots: performanceDiagnostics.driveSnapshots,
    states: Object.fromEntries(Object.entries(performanceDiagnostics.states).map(([name, stats]) => [name, {
      frames: stats.frames,
      averageFrameMs: round(stats.total / stats.frames),
      maxFrameMs: round(stats.max),
      over33ms: stats.over33ms,
    }])),
    sections: Object.fromEntries(Object.entries(performanceDiagnostics.sections).map(([name, stats]) => [name, {
      averageMs: round(stats.total / performanceDiagnostics.frames),
      maxMs: round(stats.max),
    }])),
    renderer: {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    },
    heapMb: performance.memory ? round(performance.memory.usedJSHeapSize / 1048576) : null,
  });
}

const ranks = [
  { name: 'Rookie', min: 0, wind: 2.5 },
  { name: 'Amateur', min: 370, wind: 4 },
  { name: 'Crusher', min: 400, wind: 6 },
  { name: 'Pro', min: 420, wind: 8 },
  { name: 'Legend', min: 439, wind: 10 },
];

const XP_LEVELS = [0, 100, 220, 360, 540, 760, 1020, 1320, 1680, 2100];
const CLUB_SPEED_BY_LEVEL = [130, 133, 136, 139, 142, 145, 148, 151, 154, 157];
const RANK_REQUIREMENTS = [
  null,
  { target: 370, minLevel: 2, requiredRounds: 2, window: 5 },
  { target: 400, minLevel: 4, requiredRounds: 2, window: 5 },
  { target: 420, minLevel: 7, requiredRounds: 2, window: 7 },
  { target: 439, minLevel: 10, requiredRounds: 3, window: 8 },
];

function readStoredJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function readStoredNumber(key, fallback = 0) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? value : fallback;
  } catch { return fallback; }
}

function readStoredRoundHistory() {
  const history = readStoredJson('everelms-sloppy-golf-rounds', []);
  if (!Array.isArray(history)) return [];
  return history.filter((round) => round && Number.isFinite(Number(round.best))).slice(-12);
}

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

const game = {
  state: 'ready',
  power: 0,
  accuracy: 0,
  accuracyCenterIndex: 0,
  meterTime: 0,
  shotTime: 0,
  best: Math.max(0, readStoredNumber('everelms-sloppy-golf-best')),
  xp: Math.max(0, readStoredNumber('everelms-sloppy-golf-xp')),
  rankIndex: Math.trunc(readStoredNumber('everelms-sloppy-golf-rank', -1)),
  roundHistory: readStoredRoundHistory(),
  totalRounds: Math.max(0, Math.trunc(readStoredNumber('everelms-sloppy-golf-total-rounds'))),
  competitionDriverUnlocked: localStorage.getItem('everelms-sloppy-golf-competition-driver') === 'unlocked',
  roundActive: false,
  roundShot: 0,
  roundResults: [],
  roundXpStart: 0,
  roundLevelStart: 1,
  roundDriver: null,
  roundHadPersonalBest: false,
  lastXpBreakdown: null,
  pendingPromotion: null,
  pendingLevelUp: null,
  pendingDriverUnlock: null,
  sound: localStorage.getItem('everelms-long-drive-sound') !== 'off',
  windMph: 2,
  windX: 1,
  windZ: 0,
  windArrow: '→',
  windName: 'right crosswind',
  carryMetres: 0,
  landed: false,
  rolling: false,
  firstBounceEffectPlayed: false,
  maxHeight: 0,
  strikeTime: 0,
  swingStartPose: null,
  pendingVelocity: { x: 0, y: 0, z: 0 },
  pendingCurveVelocity: 0,
  curveVelocity: 0,
  maxCurveSpeed: 0,
  spinFlightActive: false,
  swingClipStart: 0,
  followThroughTime: 0,
  impactGrade: 'Good',
  impactShape: 'Straight',
  strikeHorizontal: 0,
  strikeVertical: 0,
  shotCurve: 0,
  curveAccel: 0,
  strikeEfficiency: 1,
  clubSpeedMph: 0,
  speedRisk: 0,
  boundaryZone: 'clear',
  boundaryNearAnnounced: false,
};

const SWING_TIMING = {
  topClipTime: .9,
  backswingSpeed: 1,
  topPause: 0,
  downswingSpeed: 1.18,
  impactClipTime: 1.20,
  finishClipTime: 1.75,
  flightCameraHold: .42,
  flightCameraBlend: 1.08,
};

function strikePlaybackTimeForClipTime(clipTime) {
  const { topClipTime, backswingSpeed, topPause, downswingSpeed } = SWING_TIMING;
  if (clipTime <= topClipTime) return clipTime / backswingSpeed;
  return topClipTime / backswingSpeed + topPause + (clipTime - topClipTime) / downswingSpeed;
}

function swingClipTimeForPlaybackTime(playbackTime) {
  const { topClipTime, backswingSpeed, topPause, downswingSpeed } = SWING_TIMING;
  const topPlaybackTime = topClipTime / backswingSpeed;
  if (playbackTime <= topPlaybackTime) return playbackTime * backswingSpeed;
  if (playbackTime <= topPlaybackTime + topPause) return topClipTime;
  return topClipTime + (playbackTime - topPlaybackTime - topPause) * downswingSpeed;
}

const METER_DIFFICULTY = [
  { powerSeconds: .78, accuracySpeed: 4.6 },
  { powerSeconds: .68, accuracySpeed: 5.4 },
  { powerSeconds: .58, accuracySpeed: 6.3 },
  { powerSeconds: .49, accuracySpeed: 7.1 },
  { powerSeconds: .42, accuracySpeed: 8.0 },
];
const METER_REFERENCE_LEVELS = [1, 3, 5, 7, 10];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefb97f);
scene.fog = new THREE.Fog(0xc79079, 365, 900);

const camera = new THREE.PerspectiveCamera(61, 1, .1, 1000);
const BALL_START_X = 2.43;
const LANE_CENTER_X = BALL_START_X;
const GRID_HALF_WIDTH_METRES = 27.2;
// Wide rear three-quarter tee view: the golfer remains readable while the
// complete competition grid converges toward the horizon behind him.
const teeCameraPosition = new THREE.Vector3(1.15, 5.1, 11.8);
const teeCameraTarget = new THREE.Vector3(-.35, 1.2, -55);
camera.position.copy(teeCameraPosition);

scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x31543b, .62));
const sun = new THREE.DirectionalLight(0xffdfa3, .92);
sun.position.set(-38, 52, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
scene.add(sun);

const mat = (color) => new THREE.MeshToonMaterial({ color });
const terrainMaterials = [];
const palms = [];
const windBanners = [];
let environmentTime = 0;

// Mobile-friendly EverElms terrain grade. Vertex palettes still define the
// illustrated facets, while this single-pass shader adds cool shadow bands,
// warm sunset light, restrained saturation and subtle mowing variation.
function terrainMaterial(stripeStrength = 0) {
  const material = new THREE.ShaderMaterial({
    vertexColors: true,
    fog: true,
    uniforms: {
      ...THREE.UniformsLib.fog,
      sunDirection: { value: new THREE.Vector3(-.57, .78, .27).normalize() },
      stripeStrength: { value: stripeStrength },
      windTime: { value: 0 },
      windDirection: { value: new THREE.Vector2(1, 0) },
      windStrength: { value: .2 },
    },
    vertexShader: `
      varying vec3 vTerrainColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vViewDepth;
      #include <fog_pars_vertex>
      void main() {
        vTerrainColor = color;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = viewMatrix * worldPosition;
        vViewDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform float stripeStrength;
      uniform float windTime;
      uniform vec2 windDirection;
      uniform float windStrength;
      varying vec3 vTerrainColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vViewDepth;
      #include <fog_pars_fragment>
      void main() {
        float diffuse = max(dot(normalize(vWorldNormal), sunDirection), 0.0);
        float toonLight = floor((diffuse * .999) * 4.0) / 3.0;
        vec3 coolShade = vTerrainColor * vec3(.64, .82, 1.04);
        vec3 warmLight = vTerrainColor * vec3(1.22, 1.08, .78);
        vec3 graded = mix(coolShade, warmLight, .22 + toonLight * .66);
        float mowing = sin((vWorldPosition.z + vWorldPosition.x * .08) * .105);
        graded *= 1.0 + mowing * stripeStrength;
        vec2 windAxis = normalize(windDirection + vec2(.0001));
        float movingBand = sin(dot(vWorldPosition.xz, windAxis) * .095 - windTime * (1.15 + windStrength * 1.8));
        float crossBand = sin(dot(vWorldPosition.xz, vec2(-windAxis.y, windAxis.x)) * .038 + windTime * .34);
        float gust = smoothstep(.28, 1.0, movingBand * .76 + crossBand * .24);
        graded *= 1.0 + gust * windStrength * (.014 + stripeStrength * .16);
        float cloudLarge = sin(dot(vWorldPosition.xz, vec2(.0105, .0065)) - windTime * (.055 + windStrength * .055));
        float cloudDetail = sin(dot(vWorldPosition.xz, vec2(-.0045, .014)) - windTime * (.035 + windStrength * .04) + 1.7);
        float cloudShade = smoothstep(.32, .92, cloudLarge * .68 + cloudDetail * .32);
        graded *= 1.0 - cloudShade * (.028 + windStrength * .018);
        float rangeDepth = smoothstep(35.0, 610.0, -vWorldPosition.z);
        graded = mix(graded, graded * vec3(.82, .94, .91), rangeDepth * .14);
        float luminance = dot(graded, vec3(.2126, .7152, .0722));
        graded = mix(vec3(luminance), graded, 1.2);
        float aerial = smoothstep(155.0, 690.0, vViewDepth);
        graded = mix(graded, graded * vec3(.84, .94, .93) + vec3(.032, .042, .039), aerial * .3);
        gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
        #include <fog_fragment>
      }
    `,
  });
  terrainMaterials.push(material);
  return material;
}
// One authoritative identification color per reward driver. The same value is
// used on the club and its announcement ring so future tiers cannot drift.
const DRIVER_IDENTIFICATION_COLORS = {
  Training: 0x737e83,
  Steady: 0xf5e400,
  Long: 0xf45d01,
  Competition: 0x111820,
};
const blue = mat(0x2d7dd2);
const blueDeep = mat(0x185596);
const yellow = mat(DRIVER_IDENTIFICATION_COLORS.Steady);
const orange = mat(DRIVER_IDENTIFICATION_COLORS.Long);
const skin = mat(0xb96f45);
const dark = mat(0x242426);
const graphite = mat(0x343a40);
const driverGripMaterial = mat(0x242426);
const driverCrown = mat(0x172127);
const driverFace = mat(0x59676d);
const driverSole = mat(0x7f8b90);
const white = mat(0xfbfbf2);
const fairwayMat = mat(0x64a83c);
const roughMat = mat(0x397a33);
const hillDark = mat(0x315f35);
const hillMid = mat(0x4f783b);
const hillLight = mat(0x6f8e43);
const platformMat = mat(0x9e9b63);
const platformTopMat = mat(0x4c633a);
// Palms need to hold their colour against the warm sunset grade and aerial
// haze. A small emissive lift preserves the greens at distance without making
// the crowns look self-lit, while the warmer trunk separates from the rough.
const trunkMat = new THREE.MeshToonMaterial({ color: 0xa8612c, emissive: 0x351507, emissiveIntensity: .08 });
const palmLeafDark = new THREE.MeshToonMaterial({ color: 0x08723a, emissive: 0x052b16, emissiveIntensity: .16 });
const palmLeafLight = new THREE.MeshToonMaterial({ color: 0x35c957, emissive: 0x0a3d1b, emissiveIntensity: .18 });

function mesh(geometry, material, position, parent = scene) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

// A lightweight illustrated sunset dome follows the camera without requiring
// a large raster background or introducing perspective mismatch.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(720, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x486f9e) },
      middleColor: { value: new THREE.Color(0xc98491) },
      horizonColor: { value: new THREE.Color(0xffd172) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 topColor; uniform vec3 middleColor; uniform vec3 horizonColor; varying vec2 vUv; void main(){ float h=smoothstep(.45,.79,vUv.y); vec3 low=mix(horizonColor,middleColor,smoothstep(.43,.68,vUv.y)); vec3 skyColor=mix(low,topColor,h); float horizonGlow=exp(-pow((vUv.y-.505)*11.0,2.0)); skyColor+=vec3(.12,.045,.006)*horizonGlow; float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5; skyColor+=grain*.004; gl_FragColor=vec4(skyColor,1.0); }',
  }),
);
sky.position.set(0, -80, -260);
scene.add(sky);

// A low-cost vertical veil hides the hard meeting point between the long
// ground plane and mountain bases. Depth testing lets nearer palms and range
// furniture stay crisp while distant silhouettes settle into the atmosphere.
const horizonVeil = new THREE.Mesh(
  new THREE.PlaneGeometry(1500, 150),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      hazeColor: { value: new THREE.Color(0xc9967c) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 hazeColor; varying vec2 vUv; void main(){ float base=1.0-smoothstep(.05,.84,vUv.y); float alpha=base*base*.3; gl_FragColor=vec4(hazeColor,alpha); }',
  }),
);
horizonVeil.position.set(0, 38, -552);
horizonVeil.frustumCulled = false;
scene.add(horizonVeil);

function addMountainRange(z, baseY, heights, palette, span = 560) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const startX = -span / 2;
  const segmentWidth = span / (heights.length - 1);
  for (let index = 0; index < heights.length - 1; index += 1) {
    const x0 = startX + index * segmentWidth;
    const x1 = x0 + segmentWidth;
    const ridge0 = baseY + heights[index];
    const ridge1 = baseY + heights[index + 1];
    const vertices = [
      [x0, baseY, 0], [x0, ridge0, 0], [x1, baseY, 0],
      [x0, ridge0, 0], [x1, ridge1, 0], [x1, baseY, 0],
    ];
    const color = new THREE.Color(palette[index % palette.length]);
    const shade = new THREE.Color(palette[(index + 1) % palette.length]);
    vertices.forEach((vertex, vertexIndex) => {
      positions.push(...vertex);
      const selected = vertexIndex < 3 ? color : shade;
      colors.push(selected.r, selected.g, selected.b);
    });
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mountains = new THREE.Mesh(geometry, new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mountains.position.set(0, 0, z);
  mountains.frustumCulled = false;
  scene.add(mountains);
}

// Two low-poly silhouettes give the range a destination without adding a
// heavy skybox. The farther layer is cooler and taller; the nearer foothills
// carry more green so both settle naturally into the horizon fog.
addMountainRange(-650, -10, [16, 45, 20, 61, 24, 72, 22, 58, 19, 49, 15, 52, 18, 63, 21, 47, 16], [0x59627b, 0x68708a, 0x4d5b73], 1500);
addMountainRange(-585, -8, [9, 27, 13, 38, 15, 43, 12, 35, 11, 30, 8, 24, 9, 33, 12, 39, 10, 29, 8], [0x365b4e, 0x416956, 0x2d5148], 1450);

function facetedGround(width, depth, segmentsX, segmentsZ, palette, position, stripeStrength = 0) {
  const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ).toNonIndexed();
  const colors = [];
  const triangles = geometry.attributes.position.count / 3;
  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const color = new THREE.Color(palette[(triangle * 7 + Math.floor(triangle / 5)) % palette.length]);
    for (let vertex = 0; vertex < 3; vertex += 1) colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = terrainMaterial(stripeStrength);
  const ground = mesh(geometry, material, position);
  ground.rotation.x = -Math.PI / 2;
  return ground;
}

// Long-drive grid remains flat and authoritative; faceted colors give the
// surrounding world the illustrated low-poly character from the reference.
facetedGround(900, 1280, 14, 48, [0x173d2f, 0x1a4432, 0x1e4b35, 0x225139], [0, -.05, -535], .018);
const fairway = facetedGround(55, 760, 6, 38, [0x286f44, 0x2c7748, 0x317f4d, 0x276c42], [LANE_CENTER_X, 0, -370], .055);

const boundaryLineMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: .94, polygonOffset: true, polygonOffsetFactor: -4 });
const boundaryPulseMaterials = [-1, 1].map(() => new THREE.MeshBasicMaterial({
  color: 0xffe143,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  polygonOffset: true,
  polygonOffsetFactor: -5,
}));
const centreLineMaterial = new THREE.MeshBasicMaterial({ color: 0xdde9d2, transparent: true, opacity: .48, polygonOffset: true, polygonOffsetFactor: -4 });
const distanceLineMaterial = new THREE.MeshBasicMaterial({ color: 0xe7efd9, transparent: true, opacity: .58, polygonOffset: true, polygonOffsetFactor: -4 });

function addRangeRibbon(points, width, material) {
  const positions = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, z0] = points[index];
    const [x1, z1] = points[index + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz) || 1;
    const offsetX = -dz / length * width * .5;
    const offsetZ = dx / length * width * .5;
    // The competition grid is intentionally flat. A consistent raised ribbon
    // avoids the old long-box edge clipping and z-fighting at shallow angles.
    const y0 = .075;
    const y1 = .075;
    positions.push(
      x0 - offsetX, y0, z0 - offsetZ, x0 + offsetX, y0, z0 + offsetZ, x1 - offsetX, y1, z1 - offsetZ,
      x0 + offsetX, y0, z0 + offsetZ, x1 + offsetX, y1, z1 + offsetZ, x1 - offsetX, y1, z1 - offsetZ,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.castShadow = false;
  ribbon.receiveShadow = false;
  scene.add(ribbon);
}

const longitudinalStops = Array.from({ length: 53 }, (_, index) => 10 - index * 10);
[-1, 1].forEach((side, index) => {
  const points = longitudinalStops.map((z) => [LANE_CENTER_X + side * GRID_HALF_WIDTH_METRES, z]);
  addRangeRibbon(points, 1.35, boundaryPulseMaterials[index]);
  addRangeRibbon(points, .42, boundaryLineMaterial);
});
addRangeRibbon(longitudinalStops.map((z) => [LANE_CENTER_X, z]), .16, centreLineMaterial);
for (let yards = 50; yards <= 550; yards += 25) {
  const z = -(yards / 1.09361);
  addRangeRibbon([[LANE_CENTER_X - 27.2, z], [LANE_CENTER_X + 27.2, z]], yards % 50 === 0 ? .2 : .1, distanceLineMaterial);
}

// Wide beveled competition platform inspired by the reference image.
const platformShape = new THREE.Shape();
platformShape.moveTo(-8.5, -3.8);
platformShape.lineTo(8.5, -3.8);
platformShape.lineTo(8.5, 3.8);
platformShape.lineTo(-8.5, 3.8);
platformShape.closePath();
const platformGeometry = new THREE.ExtrudeGeometry(platformShape, { depth: .34, bevelEnabled: true, bevelSegments: 1, bevelSize: .32, bevelThickness: .16 });
platformGeometry.center();
const tee = mesh(platformGeometry, platformMat, [0, .08, 3]);
tee.rotation.x = Math.PI / 2;
mesh(new THREE.BoxGeometry(17.7, .22, 8.1), blueDeep, [0, .015, 3]);
// The hitting mat stays inset from the platform. Its slight world-space
// offset produces balanced visible margins through the off-centre tee camera.
mesh(new THREE.BoxGeometry(9.4, .08, 5.05), platformTopMat, [.7, .38, 2.1]);
facetedGround(9.4, 5.05, 4, 3, [0x4b6039, 0x536b3f, 0x5b7444, 0x465b36], [.7, .425, 2.1]);
mesh(new THREE.BoxGeometry(.13, .035, .58), yellow, [BALL_START_X, .46, .12]);
mesh(new THREE.CylinderGeometry(.05, .08, .28, 8), white, [BALL_START_X, .38, 0]);

// Polygonal hills stay outside the legal grid and frame its perspective.
const HILL_SETTINGS = [
  // Keep the two near framing hills. Far scenery uses the continuous berm so
  // the flight camera never reveals huge isolated polygon silhouettes.
  [-74, 1, -55, 43, 10, 45], [74, 0, -70, 48, 12, 52],
];
HILL_SETTINGS.forEach(([x, materialIndex, z, sx, sy, sz]) => {
  const hill = mesh(new THREE.DodecahedronGeometry(1, 0), [hillDark, hillMid, hillLight][materialIndex], [x, sy * .18 - 2.5, z]);
  hill.scale.set(sx, sy, sz);
  hill.rotation.set(0, (x + z) * .006, x * .004);
});

// A continuous faceted berm on each side connects the near scenery to the
// horizon. Rendering, ball collision, markers, and the flight camera all use
// these same terrain values.
const SIDE_BERM_Z_STOPS = [12, -35, -85, -145, -220, -310, -410, -520, -630, -760, -900];
const SIDE_BERM_HEIGHT_STOPS = [1.8, 4.4, 5.8, 4.5, 7.2, 5.2, 6.4, 4.8, 6.1, 4.2, 2.2];
const SIDE_BERM_RIDGE_STOPS = [47, 51, 46, 54, 49, 56, 48, 53, 47, 51, 46];
const SIDE_BERM_OUTER = 92;
const SIDE_BERM_APRON_OUTER = 180;

function sideTerrainProfile(z) {
  if (z > SIDE_BERM_Z_STOPS[0] || z < SIDE_BERM_Z_STOPS[SIDE_BERM_Z_STOPS.length - 1]) return null;
  for (let index = 0; index < SIDE_BERM_Z_STOPS.length - 1; index += 1) {
    const zNear = SIDE_BERM_Z_STOPS[index];
    const zFar = SIDE_BERM_Z_STOPS[index + 1];
    if (z <= zNear && z >= zFar) {
      const progress = (zNear - z) / (zNear - zFar);
      return {
        index,
        height: THREE.MathUtils.lerp(SIDE_BERM_HEIGHT_STOPS[index], SIDE_BERM_HEIGHT_STOPS[index + 1], progress),
      };
    }
  }
  return null;
}

function terrainHeightAt(x, z) {
  const profile = sideTerrainProfile(z);
  const lateral = Math.abs(x - LANE_CENTER_X);
  let height = 0;
  if (profile && lateral > 29) {
    const zNear = SIDE_BERM_Z_STOPS[profile.index];
    const zFar = SIDE_BERM_Z_STOPS[profile.index + 1];
    const progress = (zNear - z) / (zNear - zFar);
    const mid = THREE.MathUtils.lerp(SIDE_BERM_RIDGE_STOPS[profile.index], SIDE_BERM_RIDGE_STOPS[profile.index + 1], progress);
    if (lateral <= mid) height = THREE.MathUtils.lerp(.03, profile.height, (lateral - 29) / (mid - 29));
    else if (lateral <= SIDE_BERM_OUTER) height = THREE.MathUtils.lerp(profile.height, profile.height * .72, (lateral - mid) / (SIDE_BERM_OUTER - mid));
    else if (lateral <= SIDE_BERM_APRON_OUTER) {
      height = THREE.MathUtils.lerp(profile.height * .72, 0, (lateral - SIDE_BERM_OUTER) / (SIDE_BERM_APRON_OUTER - SIDE_BERM_OUTER));
    }
  }

  // The two near polygon hills are separate visible meshes rather than part
  // of the side-berm surface. Give them a conservative ellipsoid collision
  // envelope so an OOB ball cannot disappear through their front faces.
  HILL_SETTINGS.forEach(([hillX, , hillZ, sx, sy, sz]) => {
    const dx = (x - hillX) / sx;
    const dz = (z - hillZ) / sz;
    const radial = dx * dx + dz * dz;
    if (radial >= 1) return;
    const centreY = sy * .18 - 2.5;
    const hillHeight = centreY + sy * .94 * Math.sqrt(1 - radial);
    height = Math.max(height, hillHeight);
  });
  return Math.max(0, height);
}

function addSideBerm(side) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const palette = [new THREE.Color(0x174330), new THREE.Color(0x1c4b35), new THREE.Color(0x22543a)];
  const addVertex = (x, y, z, colorIndex) => {
    positions.push(x, y, z);
    const color = palette[colorIndex % palette.length];
    colors.push(color.r, color.g, color.b);
  };
  for (let index = 0; index < SIDE_BERM_Z_STOPS.length - 1; index += 1) {
    const zNear = SIDE_BERM_Z_STOPS[index];
    const zFar = SIDE_BERM_Z_STOPS[index + 1];
    const inner = LANE_CENTER_X + side * 29;
    const outer = LANE_CENTER_X + side * SIDE_BERM_OUTER;
    const apronOuter = LANE_CENTER_X + side * SIDE_BERM_APRON_OUTER;
    const midNear = LANE_CENTER_X + side * SIDE_BERM_RIDGE_STOPS[index];
    const midFar = LANE_CENTER_X + side * SIDE_BERM_RIDGE_STOPS[index + 1];
    const hNear = SIDE_BERM_HEIGHT_STOPS[index];
    const hFar = SIDE_BERM_HEIGHT_STOPS[index + 1];
    const verts = [
      [inner, .03, zNear], [midNear, hNear, zNear], [inner, .03, zFar],
      [midNear, hNear, zNear], [midFar, hFar, zFar], [inner, .03, zFar],
      [midNear, hNear, zNear], [outer, hNear * .72, zNear], [midFar, hFar, zFar],
      [outer, hNear * .72, zNear], [outer, hFar * .72, zFar], [midFar, hFar, zFar],
      [outer, hNear * .72, zNear], [apronOuter, 0, zNear], [outer, hFar * .72, zFar],
      [apronOuter, 0, zNear], [apronOuter, 0, zFar], [outer, hFar * .72, zFar],
    ];
    verts.forEach(([x, y, z], vertex) => addVertex(x, y, z, index + Math.floor(vertex / 3)));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const bermMaterial = terrainMaterial(.012);
  bermMaterial.side = THREE.DoubleSide;
  const berm = new THREE.Mesh(geometry, bermMaterial);
  berm.receiveShadow = true;
  scene.add(berm);
}

addSideBerm(-1);
addSideBerm(1);

// One shared, segmented frond adds a broader silhouette and visible droop
// without multiplying geometry allocations as the palm population grows.
const palmFrondGeometry = new THREE.BufferGeometry();
palmFrondGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0, 1.05, -.08, -.42, 1.05, -.08, .42,
  1.05, -.08, -.42, 2.1, -.34, -.34, 1.05, -.08, .42,
  2.1, -.34, -.34, 2.1, -.34, .34, 1.05, -.08, .42,
  2.1, -.34, -.34, 3.05, -.72, -.2, 2.1, -.34, .34,
  3.05, -.72, -.2, 3.05, -.72, .2, 2.1, -.34, .34,
  3.05, -.72, -.2, 3.75, -1.08, 0, 3.05, -.72, .2,
], 3));
palmFrondGeometry.computeVertexNormals();

function addPalm(x, z, scale = 1, lean = 0) {
  const palm = new THREE.Group();
  palm.position.set(x, terrainHeightAt(x, z), z);
  palm.scale.setScalar(scale * 1.1);
  palm.rotation.z = lean;
  scene.add(palm);
  const trunk = mesh(new THREE.CylinderGeometry(.2, .39, 8.4, 6), trunkMat, [0, 4.2, 0], palm);
  trunk.rotation.z = -.04;
  const crown = new THREE.Group();
  crown.position.set(-.34, 8.35, 0);
  palm.add(crown);
  mesh(new THREE.DodecahedronGeometry(.72, 0), palmLeafDark, [0, 0, 0], crown);
  const fronds = [];
  for (let leaf = 0; leaf < 9; leaf += 1) {
    const frond = mesh(palmFrondGeometry, leaf % 2 ? palmLeafDark : palmLeafLight, [0, 0, 0], crown);
    frond.material.side = THREE.DoubleSide;
    frond.castShadow = false;
    frond.rotation.y = leaf / 9 * Math.PI * 2;
    frond.rotation.z = leaf % 2 ? .08 : -.055;
    frond.scale.setScalar(.92 + (leaf % 3) * .055);
    frond.userData.baseRotationZ = frond.rotation.z;
    frond.userData.windPhase = leaf * .74 + (Math.abs(x) + Math.abs(z)) * .019;
    frond.userData.windAxisX = Math.cos(frond.rotation.y);
    frond.userData.windAxisZ = Math.sin(frond.rotation.y);
    fronds.push(frond);
  }
  palm.userData.baseLean = lean;
  palm.userData.swayPhase = (Math.abs(x) * .173 + Math.abs(z) * .037) % (Math.PI * 2);
  palm.userData.crown = crown;
  palm.userData.trunk = trunk;
  palm.userData.fronds = fronds;
  palms.push(palm);
}

[
  [-33, -30, 1.28, -.035], [35, -42, 1.16, .03],
  [-48, -58, 1.62, -.035], [51, -70, 1.4, .025],
  [-37, -94, 1.38, -.025], [39, -112, 1.5, .025],
  [-58, -132, 1.24, -.035], [61, -148, 1.34, .03],
  [-45, -180, 1.12, -.02], [48, -198, 1.18, .02],
  [-72, -225, 1.36, -.025], [75, -248, 1.28, .025],
  [-91, -292, 1.4, -.02], [95, -322, 1.32, .02],
  [-65, -365, 1.05, -.02], [69, -392, 1.1, .025],
  [-84, -438, .94, -.018], [88, -468, .98, .02],
  [-28, -46, 1.12, -.028], [33, -60, 1.08, .026],
  [-30, -104, 1.02, -.022], [35, -124, 1.06, .022],
  [-31, -168, .94, -.018], [34, -192, .98, .02],
  [-32, -252, .86, -.016], [36, -278, .9, .018],
  [-34, -326, .94, -.016], [38, -344, .9, .018],
  [-31, -402, .86, -.014], [35, -424, .9, .016],
  [-35, -478, .92, -.014], [39, -500, .88, .016],
  [-32, -548, .82, -.012], [36, -572, .86, .014],
  [-49, -610, 1.02, -.014], [54, -634, 1.06, .014],
  [-34, -674, .78, -.012], [38, -704, .82, .012],
  [-71, -742, 1.08, -.012], [76, -772, 1.04, .012],
  [-106, -92, 1.28, -.025], [114, -126, 1.16, .024],
  [-126, -188, 1.42, -.022], [132, -222, 1.3, .02],
  [-104, -286, 1.22, -.018], [116, -332, 1.34, .018],
  [-136, -404, 1.48, -.016], [142, -452, 1.4, .016],
  [-112, -526, 1.24, -.014], [124, -574, 1.3, .014],
  [-146, -654, 1.38, -.012], [152, -716, 1.44, .012],
  [-92, -806, 1.18, -.01], [104, -842, 1.22, .01],
].forEach((settings) => addPalm(...settings));

// Small tournament markers retain EverElms color without stadium bulk.
for (const side of [-1, 1]) {
  for (let marker = 0; marker < 7; marker += 1) {
    const z = -35 - marker * 67;
    const poleX = LANE_CENTER_X + side * 31.5;
    const bannerX = LANE_CENTER_X + side * 32.6;
    const poleGround = terrainHeightAt(poleX, z);
    const bannerGround = terrainHeightAt(bannerX, z);
    mesh(new THREE.CylinderGeometry(.035, .045, 2.1, 6), dark, [poleX, poleGround + 1.05, z]);
    const banner = mesh(new THREE.BoxGeometry(2.5, 1.05, .08), marker % 2 ? yellow : blue, [bannerX, bannerGround + 1.65, z]);
    banner.rotation.y = side < 0 ? .08 : -.08;
    banner.userData.baseRotationY = banner.rotation.y;
    banner.userData.windPhase = marker * .73 + side;
    windBanners.push(banner);
  }
}

// Sparse wind motes stay near the active camera and move in the authoritative
// gameplay wind direction. They make crosswind legible without a heavy
// full-screen particle or post-processing pass.
const WIND_PARTICLE_COUNT = 72;
const windParticlePositions = new Float32Array(WIND_PARTICLE_COUNT * 3);
const windParticlePhases = new Float32Array(WIND_PARTICLE_COUNT);
const windParticleGeometry = new THREE.BufferGeometry();
windParticleGeometry.setAttribute('position', new THREE.BufferAttribute(windParticlePositions, 3));
const windParticles = new THREE.Points(
  windParticleGeometry,
  new THREE.PointsMaterial({
    color: 0xffefc2,
    size: .1,
    transparent: true,
    opacity: .34,
    depthWrite: false,
    sizeAttenuation: true,
  }),
);
windParticles.frustumCulled = false;
windParticles.renderOrder = 2;
scene.add(windParticles);

function resetWindParticle(index, initial = false) {
  const offset = index * 3;
  const strength = THREE.MathUtils.clamp(game.windMph / 10, .1, 1);
  const upstream = initial ? (Math.random() - .5) * 80 : 42 + Math.random() * 20;
  windParticlePositions[offset] = camera.position.x - game.windX * upstream + (Math.random() - .5) * 62;
  windParticlePositions[offset + 2] = camera.position.z - game.windZ * upstream + (Math.random() - .5) * 105;
  windParticlePositions[offset + 1] = Math.max(
    terrainHeightAt(windParticlePositions[offset], windParticlePositions[offset + 2]) + .8,
    camera.position.y + (Math.random() - .5) * (12 + strength * 5),
  );
  windParticlePhases[index] = Math.random() * Math.PI * 2;
}
for (let index = 0; index < WIND_PARTICLE_COUNT; index += 1) resetWindParticle(index, true);

const TURF_PARTICLE_COUNT = 88;
const turfParticlePositions = new Float32Array(TURF_PARTICLE_COUNT * 3);
const turfParticleColors = new Float32Array(TURF_PARTICLE_COUNT * 3);
const turfParticleVelocity = Array.from({ length: TURF_PARTICLE_COUNT }, () => new THREE.Vector3());
const turfParticleLife = new Float32Array(TURF_PARTICLE_COUNT);
const turfParticleGeometry = new THREE.BufferGeometry();
turfParticleGeometry.setAttribute('position', new THREE.BufferAttribute(turfParticlePositions, 3));
turfParticleGeometry.setAttribute('color', new THREE.BufferAttribute(turfParticleColors, 3));
const turfParticles = new THREE.Points(
  turfParticleGeometry,
  new THREE.PointsMaterial({
    size: .115,
    vertexColors: true,
    transparent: true,
    opacity: .9,
    depthWrite: false,
    sizeAttenuation: true,
  }),
);
turfParticles.frustumCulled = false;
turfParticles.renderOrder = 3;
scene.add(turfParticles);
for (let index = 0; index < TURF_PARTICLE_COUNT; index += 1) turfParticlePositions[index * 3 + 1] = -999;
let turfParticleCursor = 0;

const firstBounceMark = new THREE.Mesh(
  new THREE.CircleGeometry(.42, 16),
  new THREE.MeshBasicMaterial({ color: 0x173d2f, transparent: true, opacity: .32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }),
);
firstBounceMark.rotation.x = -Math.PI / 2;
firstBounceMark.visible = false;
firstBounceMark.renderOrder = 1;
scene.add(firstBounceMark);

function spawnTurfBurst(origin, count, landing = false) {
  const palette = landing
    ? [new THREE.Color(0x245b38), new THREE.Color(0x6f7139), new THREE.Color(0x9a6b36)]
    : [new THREE.Color(0x397a33), new THREE.Color(0x75a53e), new THREE.Color(0x9a7a37)];
  for (let particle = 0; particle < count; particle += 1) {
    const index = turfParticleCursor;
    turfParticleCursor = (turfParticleCursor + 1) % TURF_PARTICLE_COUNT;
    const offset = index * 3;
    turfParticlePositions[offset] = origin.x + (Math.random() - .5) * .28;
    turfParticlePositions[offset + 1] = origin.y + .04 + Math.random() * .12;
    turfParticlePositions[offset + 2] = origin.z + (Math.random() - .5) * .25;
    const backwardX = landing ? -ballVelocity.x * .028 : 0;
    const backwardZ = landing ? -ballVelocity.z * .028 : -1.1;
    turfParticleVelocity[index].set(
      backwardX + (Math.random() - .5) * (landing ? 1.8 : 1.35),
      .65 + Math.random() * (landing ? 2.5 : 1.75),
      backwardZ + (Math.random() - .5) * (landing ? 1.45 : .85),
    );
    turfParticleLife[index] = .32 + Math.random() * (landing ? .38 : .28);
    const color = palette[Math.floor(Math.random() * palette.length)];
    turfParticleColors[offset] = color.r;
    turfParticleColors[offset + 1] = color.g;
    turfParticleColors[offset + 2] = color.b;
  }
  turfParticleGeometry.attributes.position.needsUpdate = true;
  turfParticleGeometry.attributes.color.needsUpdate = true;
}

function updateEnvironment(delta) {
  environmentTime += delta;
  const windStrength = THREE.MathUtils.clamp(game.windMph / 10, .08, 1);
  const windX = game.windX;
  const windZ = game.windZ;
  terrainMaterials.forEach((material) => {
    material.uniforms.windTime.value = environmentTime;
    material.uniforms.windDirection.value.set(windX, windZ);
    material.uniforms.windStrength.value = windStrength;
  });

  palms.forEach((palm) => {
    const phase = palm.userData.swayPhase;
    const gust = Math.sin(environmentTime * (1.15 + windStrength * .38) + phase)
      + Math.sin(environmentTime * .47 + phase * 1.7) * .32;
    const ambient = gust * (.006 + windStrength * .012);
    const pressure = .01 + windStrength * .03;
    palm.rotation.z = palm.userData.baseLean + windX * pressure + ambient * (Math.abs(windX) + .22);
    palm.rotation.x = windZ * pressure * .72 + ambient * (Math.abs(windZ) + .18);
    const crown = palm.userData.crown;
    crown.rotation.z = windX * pressure * 2.65 + gust * (.022 + windStrength * .038);
    crown.rotation.x = windZ * pressure * 2.1 + gust * (.017 + windStrength * .031);
    palm.userData.fronds.forEach((frond) => {
      const windFacing = windX * frond.userData.windAxisX + windZ * frond.userData.windAxisZ;
      const flutter = Math.sin(environmentTime * (2.05 + windStrength * 1.45) + frond.userData.windPhase);
      frond.rotation.z = frond.userData.baseRotationZ
        + windFacing * (.025 + windStrength * .075)
        + flutter * (.01 + windStrength * .028);
      frond.rotation.x = flutter * (.006 + windStrength * .018);
    });
  });
  windBanners.forEach((banner) => {
    const flutter = Math.sin(environmentTime * (3.4 + windStrength * 2.2) + banner.userData.windPhase);
    banner.rotation.y = banner.userData.baseRotationY + windX * (.08 + windStrength * .18) + flutter * (.012 + windStrength * .025);
    banner.rotation.z = -windZ * (.018 + windStrength * .045) + flutter * .008;
  });

  const particleSpeed = 1.25 + game.windMph * .34;
  for (let index = 0; index < WIND_PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    windParticlePositions[offset] += windX * particleSpeed * delta;
    windParticlePositions[offset + 2] += windZ * particleSpeed * delta;
    windParticlePositions[offset + 1] += Math.sin(environmentTime * 1.8 + windParticlePhases[index]) * .08 * delta;
    if (
      Math.abs(windParticlePositions[offset] - camera.position.x) > 58
      || Math.abs(windParticlePositions[offset + 2] - camera.position.z) > 92
      || Math.abs(windParticlePositions[offset + 1] - camera.position.y) > 19
    ) resetWindParticle(index);
  }
  windParticleGeometry.attributes.position.needsUpdate = true;

  for (let index = 0; index < TURF_PARTICLE_COUNT; index += 1) {
    if (turfParticleLife[index] <= 0) continue;
    const offset = index * 3;
    turfParticleLife[index] -= delta;
    turfParticleVelocity[index].y -= 5.8 * delta;
    turfParticlePositions[offset] += turfParticleVelocity[index].x * delta;
    turfParticlePositions[offset + 1] += turfParticleVelocity[index].y * delta;
    turfParticlePositions[offset + 2] += turfParticleVelocity[index].z * delta;
    const ground = terrainHeightAt(turfParticlePositions[offset], turfParticlePositions[offset + 2]);
    if (turfParticleLife[index] <= 0 || turfParticlePositions[offset + 1] <= ground) {
      turfParticleLife[index] = 0;
      turfParticlePositions[offset + 1] = -999;
    }
  }
  turfParticleGeometry.attributes.position.needsUpdate = true;
}

// Anatomical stick rig: explicit joints make posture, weight shift, elbow bend,
// wrist path, and the club plane readable before a final character is modelled.
const golfer = new THREE.Group();
golfer.position.set(-1.05, .48, .35);
golfer.scale.setScalar(.98);
scene.add(golfer);

function makeBone(radius, material) {
  return mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), material, [0, 0, 0], golfer);
}

function makeJoint(radius, material, z) {
  return mesh(new THREE.SphereGeometry(radius, 10, 7), material, [0, 0, z], golfer);
}

const bones = {
  trailShin: makeBone(.12, yellow), trailThigh: makeBone(.15, yellow),
  leadShin: makeBone(.12, yellow), leadThigh: makeBone(.15, yellow),
  spine: makeBone(.25, blue), neck: makeBone(.12, blue), shoulderBar: makeBone(.18, blue),
  trailUpperArm: makeBone(.105, skin), trailForearm: makeBone(.095, skin),
  leadUpperArm: makeBone(.105, skin), leadForearm: makeBone(.095, skin),
  club: makeBone(.032, dark),
};

const joints = {
  trailFoot: makeJoint(.18, white, -.13), trailKnee: makeJoint(.16, yellow, -.13),
  leadFoot: makeJoint(.18, white, .13), leadKnee: makeJoint(.16, yellow, .13),
  hip: makeJoint(.25, blueDeep, 0), shoulder: makeJoint(.27, blue, 0),
  trailElbow: makeJoint(.13, skin, -.18), leadElbow: makeJoint(.13, skin, .18),
  hands: makeJoint(.17, skin, .04), head: makeJoint(.37, skin, 0),
};

const clubHead = mesh(new THREE.BoxGeometry(.46, .15, .22), dark, [0, 0, 0], golfer);

const ADDRESS_POSE = {
  trailFoot: [-.58, .02], trailKnee: [-.38, .78],
  leadFoot: [.66, .02], leadKnee: [.48, .76],
  hip: [.02, 1.48], shoulder: [.42, 2.76], head: [.57, 3.48],
  trailElbow: [.7, 2.2], leadElbow: [.9, 2.15], hands: [1.28, 1.5],
  clubHead: [2.48, .1],
};

const TOP_POSE = {
  trailFoot: [-.58, .02], trailKnee: [-.42, .8],
  leadFoot: [.66, .02], leadKnee: [.38, .7],
  hip: [-.06, 1.5], shoulder: [-.32, 2.92], head: [.34, 3.5],
  trailElbow: [-.6, 2.92], leadElbow: [-.02, 3.16], hands: [-.4, 3.48],
  clubHead: [-1.25, 4.18],
};

const IMPACT_POSE = {
  trailFoot: [-.5, .05], trailKnee: [-.12, .82],
  leadFoot: [.66, .02], leadKnee: [.55, .9],
  hip: [.28, 1.55], shoulder: [.5, 2.8], head: [.62, 3.48],
  trailElbow: [.7, 2.18], leadElbow: [.86, 2.14], hands: [1.16, 1.42],
  clubHead: [2.48, .1],
};

const RELEASE_POSE = {
  trailFoot: [-.42, .12], trailKnee: [.02, .88],
  leadFoot: [.66, .02], leadKnee: [.58, .96],
  hip: [.38, 1.62], shoulder: [.68, 2.9], head: [.7, 3.55],
  trailElbow: [1.03, 2.75], leadElbow: [1.15, 2.7], hands: [1.54, 2.9],
  clubHead: [2.02, 4.02],
};

const FINISH_POSE = {
  trailFoot: [-.25, .18], trailKnee: [.18, .92],
  leadFoot: [.66, .02], leadKnee: [.61, 1.02],
  hip: [.45, 1.68], shoulder: [.3, 3.04], head: [.52, 3.67],
  trailElbow: [-.12, 3.0], leadElbow: [.2, 3.28], hands: [-.25, 3.36],
  clubHead: [-1.22, 3.86],
};

function mixPose(from, to, amount) {
  const result = {};
  Object.keys(from).forEach((key) => {
    result[key] = [
      THREE.MathUtils.lerp(from[key][0], to[key][0], amount),
      THREE.MathUtils.lerp(from[key][1], to[key][1], amount),
    ];
  });
  return result;
}

function setBone(bone, start, end, z) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  bone.position.set((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, z);
  bone.scale.set(1, length, 1);
  bone.rotation.set(0, 0, Math.atan2(-dx, dy));
}

let currentPose = ADDRESS_POSE;
function applyPose(pose) {
  currentPose = pose;
  setBone(bones.trailShin, pose.trailFoot, pose.trailKnee, -.13);
  setBone(bones.trailThigh, pose.trailKnee, pose.hip, -.13);
  setBone(bones.leadShin, pose.leadFoot, pose.leadKnee, .13);
  setBone(bones.leadThigh, pose.leadKnee, pose.hip, .13);
  setBone(bones.spine, pose.hip, pose.shoulder, 0);
  setBone(bones.neck, pose.shoulder, [pose.head[0], pose.head[1] - .34], 0);
  setBone(bones.shoulderBar, [pose.shoulder[0] - .2, pose.shoulder[1] - .03], [pose.shoulder[0] + .2, pose.shoulder[1] + .03], 0);
  setBone(bones.trailUpperArm, pose.shoulder, pose.trailElbow, -.18);
  setBone(bones.trailForearm, pose.trailElbow, pose.hands, -.18);
  setBone(bones.leadUpperArm, pose.shoulder, pose.leadElbow, .18);
  setBone(bones.leadForearm, pose.leadElbow, pose.hands, .18);
  setBone(bones.club, pose.hands, pose.clubHead, 0);

  Object.entries(joints).forEach(([key, joint]) => {
    const point = key === 'head' ? pose.head : pose[key];
    joint.position.x = point[0];
    joint.position.y = point[1];
  });
  clubHead.position.set(pose.clubHead[0], pose.clubHead[1], 0);
  clubHead.rotation.z = Math.atan2(pose.clubHead[1] - pose.hands[1], pose.clubHead[0] - pose.hands[0]);
}

applyPose(ADDRESS_POSE);
golfer.visible = false;

let animatedGolfer = null;
let swingMixer = null;
let swingClip = null;
let swingAction = null;
let golferHeadBone = null;
let golferHeadwear = null;
let golferHipsBone = null;
let golferLeftUpperLegBone = null;
let golferLeftLegBone = null;
let golferLeftFootBone = null;
let golferRightUpperLegBone = null;
let golferRightLegBone = null;
let golferRightFootBone = null;
const legTargetPosition = new THREE.Vector3();
const legCurrentPosition = new THREE.Vector3();
const legJointPosition = new THREE.Vector3();
const legCurrentDirection = new THREE.Vector3();
const legTargetDirection = new THREE.Vector3();
const legWorldDelta = new THREE.Quaternion();
const legWorldQuaternion = new THREE.Quaternion();
const legParentWorldQuaternion = new THREE.Quaternion();
const legTargetFootQuaternion = new THREE.Quaternion();
const golferHipsParentWorldScale = new THREE.Vector3();
let modelReady = false;
let driverGroup = null;
let driverGrip = null;
let driverShaft = null;
let driverHead = null;
let driverShell = null;
let driverAccent = null;
let driverWing = null;
let activeDriverVisual = '';
let driverRevealRenderer = null;
let importedDriverTemplate = null;
let importedDriverGroup = null;
let importedDriverModel = null;
let importedDriverShaft = null;
const importedDriverHeadParts = [];
const flexibleShaftSegments = [];
const flexWorldOffset = new THREE.Vector3();
const flexBendOffset = new THREE.Vector3();
const flexContactOffset = new THREE.Vector3();
const flexLocalOffset = new THREE.Vector3();
const flexPointA = new THREE.Vector3();
const flexPointB = new THREE.Vector3();
const flexShaftEnd = new THREE.Vector3();
const flexMidpoint = new THREE.Vector3();
const flexSegmentDirection = new THREE.Vector3();
const flexSegmentQuaternion = new THREE.Quaternion();
const flexParentWorldQuaternion = new THREE.Quaternion();
const flexParentWorldScale = new THREE.Vector3();
const flexClubSide = new THREE.Vector3(1, 0, 0);
const importedDriverQuaternion = new THREE.Quaternion();
const DRIVER_MODEL_AXIS_CORRECTION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, 0),
);
let rightHandBone = null;
let leftHandBone = null;
let rightGripBone = null;
let leftGripBone = null;
let clubLength = 0;
const clubHandWorld = new THREE.Vector3();
const clubLeftHandWorld = new THREE.Vector3();
const clubGripWorld = new THREE.Vector3();
const clubHeadWorld = new THREE.Vector3();
const clubDirection = new THREE.Vector3();
const clubMidpoint = new THREE.Vector3();
const clubShaftStart = new THREE.Vector3();
const clubAxisAtAddress = new THREE.Vector3();
const clubHandQuaternion = new THREE.Quaternion();
const clubRigidQuaternion = new THREE.Quaternion();
const clubRotationOffset = new THREE.Quaternion();
const clubAddressQuaternion = new THREE.Quaternion();
const clubUp = new THREE.Vector3(0, 1, 0);
const clubHeadX = new THREE.Vector3();
const clubHeadZ = new THREE.Vector3();
const clubHeadMatrix = new THREE.Matrix4();
const golferHeadWorld = new THREE.Vector3();
const golferHeadQuaternion = new THREE.Quaternion();
const GOLFER_ACCESSORY_ORIENTATION = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  -Math.PI / 2,
);

const GOLFER_PALETTE = {
  skin: new THREE.Color(0xc98c68),
  shirt: new THREE.Color(0xd82bb8),
  shorts: new THREE.Color(0xcbd1d0),
  belt: new THREE.Color(0xf0eee2),
  shoe: new THREE.Color(0xf7f6ed),
  glove: new THREE.Color(0xf7f6ed),
};

function golferColorForBone(name) {
  const bone = name.toLowerCase();
  if (bone.includes('leftfoot') || bone.includes('lefttoe') || bone.includes('rightfoot') || bone.includes('righttoe')) return GOLFER_PALETTE.shoe;
  if (bone.includes('lefthand') || bone.includes('leftfinger') || bone.includes('leftthumb')) return GOLFER_PALETTE.glove;
  if (bone.includes('upleg') || bone.includes('hips')) return GOLFER_PALETTE.shorts;
  if (bone.includes('spine') || bone.includes('shoulder')) return GOLFER_PALETTE.shirt;
  return GOLFER_PALETTE.skin;
}

function styleGolferMesh(part) {
  if (!part.isSkinnedMesh || !part.geometry?.attributes?.skinIndex || !part.skeleton) return;
  const { geometry, skeleton } = part;
  const skinIndex = geometry.attributes.skinIndex;
  const skinWeight = geometry.attributes.skinWeight;
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let vertex = 0; vertex < geometry.attributes.position.count; vertex += 1) {
    const indices = [skinIndex.getX(vertex), skinIndex.getY(vertex), skinIndex.getZ(vertex), skinIndex.getW(vertex)];
    const weights = skinWeight
      ? [skinWeight.getX(vertex), skinWeight.getY(vertex), skinWeight.getZ(vertex), skinWeight.getW(vertex)]
      : [1, 0, 0, 0];
    let strongest = 0;
    for (let influence = 1; influence < 4; influence += 1) {
      if (weights[influence] > weights[strongest]) strongest = influence;
    }
    const boneName = skeleton.bones[indices[strongest]]?.name || '';
    golferColorForBone(boneName).toArray(colors, vertex * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  part.material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, skinning: true });
}

function setGolferPartMaterial(part, color) {
  const materials = Array.isArray(part.material) ? part.material : [part.material];
  part.material = materials.map((source) => {
    const material = source.clone();
    material.color.setHex(color);
    material.map = null;
    material.vertexColors = false;
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
    return material;
  });
  if (part.material.length === 1) [part.material] = part.material;
}

function tintAlternateSkin(part) {
  const materials = Array.isArray(part.material) ? part.material : [part.material];
  const tintedMaterials = materials.map((source) => {
    const material = source.clone();
    material.color.setHex(0xffd1b2);
    if (material.emissive) {
      material.emissive.setHex(0x7b4b32);
      material.emissiveIntensity = .32;
    }
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
    return material;
  });
  part.material = tintedMaterials.length === 1 ? tintedMaterials[0] : tintedMaterials;
}

let golferShirtTexture = null;
let optimizedGolferActive = false;

function makeGolferShirtTexture() {
  if (golferShirtTexture) return golferShirtTexture;
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 256;
  patternCanvas.height = 256;
  const context = patternCanvas.getContext('2d');
  context.fillStyle = '#d82bb8';
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = 'rgba(255,150,232,.32)';
  context.lineWidth = 7;
  context.lineCap = 'round';
  for (let row = -1; row < 4; row += 1) {
    for (let column = -1; column < 4; column += 1) {
      const x = column * 86 + (row % 2) * 28;
      const y = row * 78;
      context.beginPath();
      context.moveTo(x + 10, y + 70);
      context.quadraticCurveTo(x + 42, y + 40, x + 54, y + 6);
      context.stroke();
      for (let leaf = 0; leaf < 4; leaf += 1) {
        const stemY = y + 56 - leaf * 12;
        context.beginPath();
        context.moveTo(x + 28 + leaf * 6, stemY);
        context.lineTo(x + 6 + leaf * 2, stemY - 13);
        context.moveTo(x + 31 + leaf * 6, stemY - 2);
        context.lineTo(x + 60 + leaf * 3, stemY - 15);
        context.stroke();
      }
    }
  }
  golferShirtTexture = new THREE.CanvasTexture(patternCanvas);
  golferShirtTexture.wrapS = THREE.RepeatWrapping;
  golferShirtTexture.wrapT = THREE.RepeatWrapping;
  golferShirtTexture.repeat.set(2.2, 3.2);
  golferShirtTexture.encoding = THREE.sRGBEncoding;
  return golferShirtTexture;
}

function styleAlternateShirt(part) {
  part.material = new THREE.MeshToonMaterial({
    map: makeGolferShirtTexture(),
    side: THREE.DoubleSide,
    skinning: true,
  });
}

function styleAlternateShorts(part) {
  const geometry = part.geometry;
  geometry.computeBoundingBox();
  const minimum = geometry.boundingBox.min.y;
  const height = Math.max(.001, geometry.boundingBox.max.y - minimum);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const shortsColor = new THREE.Color(0xb6bec0);
  const beltColor = new THREE.Color(0xeeeadd);
  for (let vertex = 0; vertex < geometry.attributes.position.count; vertex += 1) {
    const heightRatio = (geometry.attributes.position.getY(vertex) - minimum) / height;
    const color = heightRatio > .91 ? GOLFER_PALETTE.shirt : heightRatio > .84 ? beltColor : shortsColor;
    color.toArray(colors, vertex * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  part.material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, skinning: true });
}

function cleanAlternateHeadMaterial(part) {
  const isEyelashes = part.name === 'Ch42__Eyelashes';
  const isHair = part.name === 'Ch42_Hair' || part.name === 'Ch42_Hair1';
  if (!isHair && !isEyelashes) return false;
  // FBX2glTF cannot preserve Character Creator's separate TransparentColor
  // channel. Its converted hair cards otherwise become an opaque black shell;
  // the authored scalp/body texture is a much closer match to the cleaned FBX
  // presentation than displaying that conversion artifact.
  if (optimizedGolferActive && isHair) {
    part.visible = false;
    return true;
  }

  // Character Creator builds hair from overlapping alpha-textured cards.
  // Rendering both faces of every card makes the layers stack into a fuzzy
  // halo at mobile size. Keep only their authored front faces and use a firm
  // alpha cutoff so the silhouette stays crisp instead of semi-transparent.
  const sources = Array.isArray(part.material) ? part.material : [part.material];
  const cleaned = sources.map((source) => {
    const material = source.clone();
    material.side = THREE.FrontSide;
    material.transparent = false;
    material.opacity = 1;
    material.alphaTest = isHair ? (optimizedGolferActive ? .74 : .48) : .62;
    material.depthTest = true;
    material.depthWrite = true;
    material.premultipliedAlpha = false;
    if (material.map?.image) {
      material.map.minFilter = THREE.LinearMipmapLinearFilter;
      material.map.magFilter = THREE.LinearFilter;
      material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      material.map.needsUpdate = true;
    }
    material.needsUpdate = true;
    return material;
  });
  part.material = Array.isArray(part.material) ? cleaned : cleaned[0];
  return true;
}

function styleAlternateGolferPart(part) {
  if (!part.isMesh) return;
  if (cleanAlternateHeadMaterial(part)) return;
  if (part.name === 'Ch42_Shirt') styleAlternateShirt(part);
  else if (part.name === 'Ch42_Shorts') styleAlternateShorts(part);
  if (part.name === 'Ch42_Body1') tintAlternateSkin(part);
  else if (part.name === 'Ch42_Sneakers') setGolferPartMaterial(part, 0xf7f6ed);
}

function makeGolferHeadwear() {
  if (!golferHeadBone || golferHeadwear) return;
  golferHeadwear = new THREE.Group();
  golferHeadwear.name = 'EverElms golfer cap and beard';

  const capBlue = mat(0x185596);
  const capSide = mat(0x2d7dd2);
  const hair = mat(0x5b3828);
  const beardMaterial = mat(0x352018);
  // A complete flattened sphere intersects the skull like a fitted cap. Using
  // a partial sphere produced open wedges when the animated head pitched down.
  const crown = new THREE.Mesh(new THREE.SphereGeometry(.37, 8, 6), capBlue);
  crown.position.set(0, 0, .2);
  crown.scale.set(1, .62, 1.05);
  golferHeadwear.add(crown);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(.44, .065, .5), capSide);
  brim.position.set(0, -.12, .65);
  brim.rotation.x = -.32;
  golferHeadwear.add(brim);
  const logo = new THREE.Mesh(new THREE.TorusGeometry(.055, .014, 5, 8), yellow);
  logo.position.set(0, -.02, .53);
  logo.rotation.x = Math.PI / 2 - .32;
  golferHeadwear.add(logo);
  // A faceted jaw shell sits forward of the face instead of disappearing
  // inside the original head mesh as the earlier narrow cone did.
  const beard = new THREE.Mesh(new THREE.DodecahedronGeometry(.24, 0), beardMaterial);
  beard.position.set(0, -.46, .02);
  beard.scale.set(.86, .78, .5);
  golferHeadwear.add(beard);
  const moustache = new THREE.Mesh(new THREE.BoxGeometry(.24, .055, .055), beardMaterial);
  moustache.position.set(0, -.28, .08);
  moustache.rotation.z = -.03;
  golferHeadwear.add(moustache);

  golferHeadwear.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  scene.add(golferHeadwear);
}

function updateGolferHeadwear() {
  if (!golferHeadBone || !golferHeadwear) return;
  golferHeadwear.visible = animatedGolfer?.visible !== false;
  if (!golferHeadwear.visible) return;
  golferHeadBone.getWorldPosition(golferHeadWorld);
  golferHeadwear.position.copy(golferHeadWorld);
  golferHeadwear.position.y += .18;
  golferHeadwear.position.x += .42;

  // Track the animated head position, but keep a stable body-facing product
  // orientation. The FBX head track contains roll that turns a rigid cap
  // edge-on during the follow-through.
  animatedGolfer.getWorldQuaternion(golferHeadQuaternion);
  golferHeadQuaternion.multiply(GOLFER_ACCESSORY_ORIENTATION);
  golferHeadwear.quaternion.copy(golferHeadQuaternion);
}

function makeLowPolyDriverHead() {
  const head = new THREE.Group();
  head.name = 'Low-poly driver head';

  // The head sits at a deliberate angle to the hosel so its long axis rests
  // horizontally at address instead of simply inheriting the shaft angle.
  driverShell = new THREE.Group();
  driverShell.rotation.z = .64;
  head.add(driverShell);

  // Reshape a low-segment sphere into an asymmetric pear: compact at the heel
  // beside the hosel and fuller at the toe, matching the supplied reference.
  const crownGeometry = new THREE.SphereGeometry(.38, 10, 6);
  const crownPositions = crownGeometry.attributes.position;
  for (let vertex = 0; vertex < crownPositions.count; vertex += 1) {
    const x = crownPositions.getX(vertex);
    const y = crownPositions.getY(vertex);
    const z = crownPositions.getZ(vertex);
    crownPositions.setXYZ(vertex, x * (x > 0 ? 1.18 : .78) + .08, y * .57, z * .8);
  }
  crownGeometry.computeVertexNormals();
  driverShell.add(new THREE.Mesh(crownGeometry, driverCrown));

  // The contrasting face is broad and shallow. Fine grooves are omitted here
  // because they become visual noise at the club's gameplay-scale size.
  const face = new THREE.Mesh(new THREE.CircleGeometry(.285, 10), driverFace);
  face.scale.set(1.12, .64, 1);
  face.position.set(.08, -.015, .305);
  driverShell.add(face);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(.5, .055, .31), driverSole);
  sole.position.set(.08, -.205, -.015);
  sole.rotation.z = -.06;
  driverShell.add(sole);

  driverAccent = new THREE.Mesh(new THREE.BoxGeometry(.3, .032, .16), yellow);
  driverAccent.position.set(.08, .19, -.03);
  driverAccent.rotation.z = -.08;
  driverShell.add(driverAccent);

  driverWing = new THREE.Mesh(new THREE.BoxGeometry(.24, .07, .24), orange);
  driverWing.position.set(.39, .02, -.17);
  driverWing.rotation.z = -.22;
  driverShell.add(driverWing);

  // A short angled hosel makes the transition from shaft to heel explicit.
  const hosel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .065, .3, 8), graphite);
  hosel.position.set(-.245, .12, 0);
  hosel.rotation.z = -.28;
  head.add(hosel);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.057, .057, .055, 8), driverSole);
  collar.position.set(-.205, .255, 0);
  collar.rotation.z = -.28;
  head.add(collar);

  head.traverse((part) => {
    if (!part.isMesh) return;
    part.castShadow = true;
    part.receiveShadow = true;
  });
  return head;
}

function updateDriver() {
  if (!rightHandBone || !leftHandBone || !clubLength || !driverGrip || !driverShaft || !driverHead) return;
  animatedGolfer.updateMatrixWorld(true);
  if (clubPreviewMode) {
    clubGripWorld.set(-1.5, 4.75, 1);
    clubRigidQuaternion.copy(clubAddressQuaternion);
  } else {
    // Mixamo hand bones originate at the wrists. The first middle-finger bones
    // sit inside the fists and provide the visible grip point the club needs.
    rightGripBone.getWorldPosition(clubHandWorld);
    leftGripBone.getWorldPosition(clubLeftHandWorld);
    clubGripWorld.addVectors(clubHandWorld, clubLeftHandWorld).multiplyScalar(.5);

    // The right-hand bone supplies full rigid wrist rotation, including twist
    // around the shaft; the finger anchors keep the handle inside both fists.
    rightHandBone.getWorldQuaternion(clubHandQuaternion);
    clubRigidQuaternion.copy(clubHandQuaternion).multiply(clubRotationOffset);
  }
  clubDirection.copy(clubUp).applyQuaternion(clubRigidQuaternion).normalize();
  clubHeadWorld.copy(clubGripWorld).addScaledVector(clubDirection, clubLength);

  // The hands wrap around the middle of the grip. The shaft begins below the
  // hands and runs continuously into the hosel at the head.
  driverGrip.position.copy(clubGripWorld).addScaledVector(clubDirection, -.08);
  driverGrip.quaternion.copy(clubRigidQuaternion);
  clubShaftStart.copy(clubGripWorld).addScaledVector(clubDirection, .24);
  clubMidpoint.addVectors(clubShaftStart, clubHeadWorld).multiplyScalar(.5);
  const shaftLength = clubShaftStart.distanceTo(clubHeadWorld);
  driverShaft.position.copy(clubMidpoint);
  driverShaft.scale.set(1, shaftLength, 1);
  driverShaft.quaternion.copy(clubRigidQuaternion);
  driverHead.position.copy(clubHeadWorld);
  driverHead.quaternion.copy(clubRigidQuaternion);
  if (importedDriverGroup) {
    importedDriverGroup.position.copy(clubGripWorld).addScaledVector(clubDirection, -.08);
    importedDriverQuaternion.copy(clubRigidQuaternion).multiply(DRIVER_MODEL_AXIS_CORRECTION);
    importedDriverGroup.quaternion.copy(importedDriverQuaternion);
    updateImportedDriverFlex();
  }
  if (window.__swingDebug && ball) {
    window.__swingDebug.clubHead = clubHeadWorld.toArray();
    window.__swingDebug.ball = ball.position.toArray();
    window.__swingDebug.contactDistance = clubHeadWorld.distanceTo(ball.position);
  }
}

function swingWindow(time, riseStart, peak, fallEnd) {
  if (time <= riseStart || time >= fallEnd) return 0;
  if (time < peak) return THREE.MathUtils.smoothstep(time, riseStart, peak);
  return 1 - THREE.MathUtils.smoothstep(time, peak, fallEnd);
}

function currentDriverFlex() {
  if (clubPreviewMode || !swingAction) return 0;
  const clipTime = swingAction.time;
  const topLag = swingWindow(clipTime, .72, .91, 1.08);
  const finishRebound = swingWindow(clipTime, 1.46, 1.61, 1.74);
  // Deliberately arcade-scale: real shaft flex would be nearly invisible on
  // a portrait phone. These values approach the visual breaking point while
  // the impact window remains perfectly straight.
  return .42 * topLag - .07 * finishRebound;
}

function updateImportedDriverFlex() {
  if (!importedDriverShaft) return;
  const flex = currentDriverFlex();
  flexWorldOffset.copy(flexClubSide).applyQuaternion(clubRigidQuaternion).multiplyScalar(flex);
  flexBendOffset.copy(flexWorldOffset);
  const contactRelease = swingWindow(swingAction?.time || 0, 1.12, SWING_TIMING.impactClipTime, 1.29);
  if (contactRelease > 0) {
    flexContactOffset.set(BALL_START_X, .53, 0).sub(clubHeadWorld).multiplyScalar(contactRelease);
    flexWorldOffset.add(flexContactOffset);
  }
  importedDriverGroup.updateMatrixWorld(true);
  importedDriverHeadParts.forEach(({ part, position, quaternion }) => {
    part.parent.getWorldQuaternion(flexParentWorldQuaternion).invert();
    part.parent.getWorldScale(flexParentWorldScale);
    flexLocalOffset.copy(flexWorldOffset).applyQuaternion(flexParentWorldQuaternion);
    flexLocalOffset.set(
      flexLocalOffset.x / Math.max(.001, flexParentWorldScale.x),
      flexLocalOffset.y / Math.max(.001, flexParentWorldScale.y),
      flexLocalOffset.z / Math.max(.001, flexParentWorldScale.z),
    );
    part.position.copy(position);
    part.position.add(flexLocalOffset);
    part.quaternion.copy(quaternion);
  });

  flexShaftEnd.copy(clubHeadWorld).add(flexWorldOffset);
  for (let index = 0; index < flexibleShaftSegments.length; index += 1) {
    const startT = index / flexibleShaftSegments.length;
    const endT = (index + 1) / flexibleShaftSegments.length;
    const curvePoint = (target, t) => {
      target.lerpVectors(clubShaftStart, flexShaftEnd, t);
      target.addScaledVector(flexBendOffset, -.55 * 4 * t * (1 - t));
    };
    curvePoint(flexPointA, startT);
    curvePoint(flexPointB, endT);
    const segment = flexibleShaftSegments[index];
    flexMidpoint.addVectors(flexPointA, flexPointB).multiplyScalar(.5);
    flexSegmentDirection.subVectors(flexPointB, flexPointA);
    segment.position.copy(flexMidpoint);
    segment.scale.set(1, flexSegmentDirection.length(), 1);
    flexSegmentQuaternion.setFromUnitVectors(clubUp, flexSegmentDirection.normalize());
    segment.quaternion.copy(flexSegmentQuaternion);
    segment.visible = true;
  }
}

function installImportedDriver() {
  if (!importedDriverTemplate || !clubLength || importedDriverGroup) return;
  importedDriverGroup = new THREE.Group();
  importedDriverGroup.name = 'Imported rigid driver';
  importedDriverModel = importedDriverTemplate.clone(true);
  importedDriverModel.traverse((part) => {
    if (!part.isMesh) return;
    part.material = part.material.clone();
    part.castShadow = true;
    part.receiveShadow = true;
    const region = part.material.name;
    if (region === 'Shaft') {
      importedDriverShaft = part;
      part.visible = false;
    }
    else if (region === 'Hosel' || region === 'Crown' || region === 'Face' || region === 'Sole') {
      importedDriverHeadParts.push({
        part,
        position: part.position.clone(),
        quaternion: part.quaternion.clone(),
      });
    }
  });
  // The source runs from the head near Z=0 to the grip butt at Z=2.02. Anchor
  // the hands near that butt end (not the grip midpoint) and renormalize from
  // the new anchor so the clubhead still reaches the original address point.
  const importedDriverScale = clubLength / 2.11;
  importedDriverModel.scale.multiplyScalar(importedDriverScale);
  importedDriverModel.position.set(0, 0, -1.96 * importedDriverScale);
  importedDriverGroup.add(importedDriverModel);
  scene.add(importedDriverGroup);
  for (let index = 0; index < 9; index += 1) {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, 1, 8), graphite);
    segment.castShadow = true;
    flexibleShaftSegments.push(segment);
    scene.add(segment);
  }
  driverGrip.visible = false;
  driverShaft.visible = false;
  driverHead.visible = false;
  activeDriverVisual = '';
  updateDriverAppearance();
  updateDriver();
}

function setSwingTime(time) {
  if (!swingMixer || !swingAction || !swingClip) return;
  swingAction.time = THREE.MathUtils.clamp(time, 0, swingClip.duration);
  swingMixer.update(0);
  applyLongDriveLowerBody(swingAction.time);
}

function solveLegJointTowardTarget(joint, foot, target) {
  joint.getWorldPosition(legJointPosition);
  foot.getWorldPosition(legCurrentPosition);
  legCurrentDirection.subVectors(legCurrentPosition, legJointPosition).normalize();
  legTargetDirection.subVectors(target, legJointPosition).normalize();
  if (legCurrentDirection.lengthSq() < .5 || legTargetDirection.lengthSq() < .5) return;

  legWorldDelta.setFromUnitVectors(legCurrentDirection, legTargetDirection);
  joint.getWorldQuaternion(legWorldQuaternion);
  legWorldQuaternion.premultiply(legWorldDelta);
  joint.parent.getWorldQuaternion(legParentWorldQuaternion).invert();
  joint.quaternion.copy(legParentWorldQuaternion.multiply(legWorldQuaternion));
  joint.updateMatrixWorld(true);
}

function keepLegPlanted(upperLeg, lowerLeg, foot) {
  if (!upperLeg || !lowerLeg || !foot) return;
  foot.getWorldPosition(legTargetPosition);
  foot.getWorldQuaternion(legTargetFootQuaternion);

  // Two short CCD passes distribute the pelvis correction through the knee
  // and hip while returning the ankle to the FBX-authored location.
  for (let pass = 0; pass < 2; pass += 1) {
    solveLegJointTowardTarget(lowerLeg, foot, legTargetPosition);
    solveLegJointTowardTarget(upperLeg, foot, legTargetPosition);
  }

  foot.parent.getWorldQuaternion(legParentWorldQuaternion).invert();
  foot.quaternion.copy(legParentWorldQuaternion.multiply(legTargetFootQuaternion));
  foot.updateMatrixWorld(true);
}

function applyLongDriveLowerBody(clipTime) {
  if (!golferHipsBone) return;
  const compress = THREE.MathUtils.smoothstep(clipTime, .86, 1.0)
    * (1 - THREE.MathUtils.smoothstep(clipTime, 1.0, 1.14));
  if (compress < .001) return;

  // Preserve the original subtle world-space squat across both source FBX
  // centimetre units and the optimized GLB's metre-scale skeleton. Applying
  // the old local-space 2.8 directly to the GLB dropped the golfer almost
  // completely below the tee camera during the downswing.
  golferHipsBone.parent.getWorldScale(golferHipsParentWorldScale);
  golferHipsBone.position.y -= (.14 / Math.max(.001, golferHipsParentWorldScale.y)) * compress;
  animatedGolfer.updateMatrixWorld(true);
  keepLegPlanted(golferLeftUpperLegBone, golferLeftLegBone, golferLeftFootBone);
  keepLegPlanted(golferRightUpperLegBone, golferRightLegBone, golferRightFootBone);
  animatedGolfer.updateMatrixWorld(true);
}

const fbxLoader = new THREE.FBXLoader();
const gltfLoader = new THREE.GLTFLoader();
let golferAssetReady = false;
let driverAssetSettled = false;

function enableStartWhenAssetsReady() {
  if (!golferAssetReady || !driverAssetSettled) return;
  modelReady = true;
  startButton.disabled = false;
  startButton.classList.remove('is-loading');
  startButton.textContent = 'Start six-drive round';
}

gltfLoader.load('media/golf-club-driver.glb?v=4', (gltf) => {
  importedDriverTemplate = gltf.scene;
  installImportedDriver();
  driverAssetSettled = true;
  enableStartWhenAssetsReady();
}, undefined, (error) => {
  console.warn('Unable to load the imported driver; using the procedural fallback.', error);
  driverAssetSettled = true;
  enableStartWhenAssetsReady();
});

function installGolferAsset(object, animations, sourceLabel) {
  animatedGolfer = object;
  optimizedGolferActive = sourceLabel === 'GLB';
  animatedGolfer.animations = animations || animatedGolfer.animations || [];
  animatedGolfer.name = 'Mixamo golfer';
  animatedGolfer.scale.setScalar(1);
  animatedGolfer.position.set(0, 0, 0);
  // The Mixamo export's forward axis is rotated relative to our driving lane.
  animatedGolfer.rotation.y = Math.PI;
  animatedGolfer.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (legacyGolferPreview) styleGolferMesh(child);
    else {
      styleAlternateGolferPart(child);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => {
        if (!['Ch42_Hair', 'Ch42_Hair1', 'Ch42__Eyelashes'].includes(child.name)) {
          material.side = THREE.DoubleSide;
          material.needsUpdate = true;
        }
      });
    }
  });
  scene.add(animatedGolfer);

  if (diagnosticsMode || legacyGolferPreview || sourceGolferPreview) {
    console.log(`${sourceLabel}_CLIPS ${animatedGolfer.animations.map((clip, index) => `${index}:${clip.name}:${clip.duration.toFixed(3)}:${clip.tracks.length}`).join('|')}`);
  }
  swingClip = animatedGolfer.animations.find((clip) => clip.tracks.length > 0 && clip.duration > 0) || null;
  const previewTime = Number(new URLSearchParams(window.location.search).get('swingTime'));
  if (swingClip) {
    swingMixer = new THREE.AnimationMixer(animatedGolfer);
    swingAction = swingMixer.clipAction(swingClip);
    swingAction.play();
    swingAction.paused = true;
    // Always calibrate attachment from the true address frame. The optional
    // frame viewer is applied only after the address axes and hand order exist.
    swingAction.time = 0;
    swingMixer.update(0);
    animatedGolfer.updateMatrixWorld(true);
  }

  animatedGolfer.updateMatrixWorld(true);
  const rawBounds = new THREE.Box3().setFromObject(animatedGolfer);
  const targetHeight = 5.35;
  const fittedScale = targetHeight / Math.max(.001, rawBounds.max.y - rawBounds.min.y);
  animatedGolfer.scale.setScalar(fittedScale);
  animatedGolfer.updateMatrixWorld(true);
  const fittedBounds = new THREE.Box3().setFromObject(animatedGolfer);
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
  // Preserve the authored FBX swing and fit the stance to the imported
  // driver's real reach.  The longer rigid club needs the golfer farther left
  // so its unchanged downswing arc meets the teed ball.
  animatedGolfer.position.x += -1.25 - fittedCenter.x;
  animatedGolfer.position.y += .42 - fittedBounds.min.y;
  // Bring the player toward the camera so the stance sits just above the
  // mobile timing panel while the teed ball remains fixed in the scene.
  animatedGolfer.position.z += .9 - fittedCenter.z;
  animatedGolfer.updateMatrixWorld(true);
  window.__swingDebug = {
    animations: animatedGolfer.animations.length,
    children: animatedGolfer.children.length,
    scale: fittedScale,
  };

  if (swingClip) {
    golferHeadBone = animatedGolfer.getObjectByName('mixamorigHead');
    golferHipsBone = animatedGolfer.getObjectByName('mixamorigHips');
    golferLeftUpperLegBone = animatedGolfer.getObjectByName('mixamorigLeftUpLeg');
    golferLeftLegBone = animatedGolfer.getObjectByName('mixamorigLeftLeg');
    golferLeftFootBone = animatedGolfer.getObjectByName('mixamorigLeftFoot');
    golferRightUpperLegBone = animatedGolfer.getObjectByName('mixamorigRightUpLeg');
    golferRightLegBone = animatedGolfer.getObjectByName('mixamorigRightLeg');
    golferRightFootBone = animatedGolfer.getObjectByName('mixamorigRightFoot');
    if (legacyGolferPreview) makeGolferHeadwear();
    rightHandBone = animatedGolfer.getObjectByName('mixamorigRightHand');
    leftHandBone = animatedGolfer.getObjectByName('mixamorigLeftHand');
    if (rightHandBone && leftHandBone) {
      rightGripBone = animatedGolfer.getObjectByName('mixamorigRightHandMiddle1') || rightHandBone;
      leftGripBone = animatedGolfer.getObjectByName('mixamorigLeftHandMiddle1') || leftHandBone;
      driverGroup = new THREE.Group();
      driverGrip = new THREE.Mesh(new THREE.CylinderGeometry(.055, .067, .72, 10), driverGripMaterial);
      driverGrip.castShadow = true;
      driverGroup.add(driverGrip);
      driverShaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .029, 1, 10), graphite);
      driverShaft.castShadow = true;
      driverGroup.add(driverShaft);
      driverHead = makeLowPolyDriverHead();
      driverHead.scale.setScalar(.58);
      driverGroup.add(driverHead);
      scene.add(driverGroup);

      rightGripBone.getWorldPosition(clubHandWorld);
      leftGripBone.getWorldPosition(clubLeftHandWorld);
      clubGripWorld.addVectors(clubHandWorld, clubLeftHandWorld).multiplyScalar(.5);
      clubHeadWorld.set(BALL_START_X - .12, .68, .02);
      clubAxisAtAddress.subVectors(clubHeadWorld, clubGripWorld).normalize();
      clubHeadZ.set(0, 0, -1).addScaledVector(clubAxisAtAddress, clubAxisAtAddress.z).normalize();
      clubHeadX.crossVectors(clubAxisAtAddress, clubHeadZ).normalize();
      clubHeadZ.crossVectors(clubHeadX, clubAxisAtAddress).normalize();
      clubHeadMatrix.makeBasis(clubHeadX, clubAxisAtAddress, clubHeadZ);
      clubRigidQuaternion.setFromRotationMatrix(clubHeadMatrix);
      clubAddressQuaternion.copy(clubRigidQuaternion);
      rightHandBone.getWorldQuaternion(clubHandQuaternion);
      clubRotationOffset.copy(clubHandQuaternion).invert().multiply(clubRigidQuaternion);
      clubLength = clubGripWorld.distanceTo(clubHeadWorld);
      installImportedDriver();
      updateDriverAppearance();
      updateDriver();

      if (clubPreviewMode) {
        animatedGolfer.visible = false;
        ball.visible = false;
        startPanel.classList.add('is-hidden');
        swingPanel.classList.add('is-hidden');
        document.querySelector('.top-hud')?.classList.add('is-hidden');
        camera.position.set(1.8, 2.85, 5.35);
        camera.lookAt(-.05, 2.65, 1);
      }
      if (Number.isFinite(previewTime) && previewTime >= 0) {
        setSwingTime(Math.min(previewTime, swingClip.duration));
        updateDriver();
      }
    }
    golfer.visible = false;
    golferAssetReady = true;
    enableStartWhenAssetsReady();
    window.__swingDebug = {
      animations: animatedGolfer.animations.length,
      duration: swingClip.duration,
      name: swingClip.name,
      tracks: swingClip.tracks.length,
      scale: fittedScale,
    };
    if (diagnosticsMode || legacyGolferPreview || sourceGolferPreview) {
      const modelNames = [];
      animatedGolfer.traverse((child) => {
        if (child.isBone || child.isMesh) modelNames.push(`${child.type}:${child.name}`);
      });
      console.log(`${sourceLabel}_INSPECT ${JSON.stringify(window.__swingDebug)} ${modelNames.join('|')}`);
    }

    // A query-string frame viewer keeps animation calibration reproducible
    // without changing normal gameplay.
    if (new URLSearchParams(window.location.search).has('swingTime')) {
      startPanel.classList.add('is-hidden');
      swingPanel.classList.add('is-hidden');
    }
  } else {
    startButton.disabled = false;
    startButton.classList.remove('is-loading');
    startButton.dataset.loadError = 'true';
    startButton.textContent = 'Retry loading golfer';
  }
}

function handleGolferLoadError(error) {
  console.error('Unable to load the animated golfer.', error);
  startButton.disabled = false;
  startButton.classList.remove('is-loading');
  startButton.dataset.loadError = 'true';
  startButton.textContent = 'Retry loading golfer';
}

if (legacyGolferPreview || sourceGolferPreview) {
  const fbxPath = legacyGolferPreview ? 'media/golf-drive.fbx' : 'media/golf-drive-alternate.fbx';
  fbxLoader.load(fbxPath, (object) => installGolferAsset(object, object.animations, 'FBX'), undefined, handleGolferLoadError);
} else {
  gltfLoader.load(
    'media/golf-drive-runtime-optimized.glb?v=1',
    (gltf) => installGolferAsset(gltf.scene, gltf.animations, 'GLB'),
    undefined,
    handleGolferLoadError,
  );
}

const ballMaterial = white.clone();
ballMaterial.color.setHex(0xf4f1dd);
const ball = mesh(new THREE.SphereGeometry(.09, 14, 10), ballMaterial, [BALL_START_X, .53, 0]);
ball.castShadow = true;
const ballVisibilityMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthTest: false,
  depthWrite: false,
});
const ballVisibilityShell = new THREE.Mesh(new THREE.SphereGeometry(.103, 12, 9), ballVisibilityMaterial);
ballVisibilityShell.renderOrder = 40;
ball.add(ballVisibilityShell);
const ballVelocity = new THREE.Vector3();
const ballPreviousPosition = new THREE.Vector3();
const ballCollisionEnd = new THREE.Vector3();
const ballCollisionSample = new THREE.Vector3();
const treeTrunkCenter = new THREE.Vector3();
const treeTrunkBase = new THREE.Vector3();
const treeTrunkTop = new THREE.Vector3();
const treeTrunkAxis = new THREE.Vector3();
const treeTrunkQuaternion = new THREE.Quaternion();
const treeClosestPoint = new THREE.Vector3();
const treeCrownCenter = new THREE.Vector3();
const treeCollisionNormal = new THREE.Vector3();
const treeTrunkLine = new THREE.Line3();
const cameraObstacleCentre = new THREE.Vector3();
let treeCollisionCooldown = 0;
const tracerGroup = new THREE.Group();
const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0x2d7dd2 });
tracerMaterial.depthTest = false;
tracerMaterial.depthWrite = false;
let shotTracer = null;
let tracerPoints = [];
let tracerComplete = false;
scene.add(tracerGroup);

function clearShotTracer() {
  if (shotTracer) {
    tracerGroup.remove(shotTracer);
    shotTracer.geometry.dispose();
  }
  shotTracer = null;
  tracerPoints = [];
  tracerComplete = false;
}

function rebuildShotTracer() {
  if (tracerPoints.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(tracerPoints, false, 'centripetal');
  const tubularSegments = Math.min(160, Math.max(8, tracerPoints.length * 2));
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, .06, 5, false);
  if (shotTracer) {
    shotTracer.geometry.dispose();
    shotTracer.geometry = geometry;
    return;
  }
  shotTracer = new THREE.Mesh(geometry, tracerMaterial);
  shotTracer.frustumCulled = false;
  shotTracer.renderOrder = 2;
  tracerGroup.add(shotTracer);
}

function extendShotTracer(force = false) {
  if (tracerComplete && !force) return;
  const point = ball.position.clone();
  const previous = tracerPoints[tracerPoints.length - 1];
  // Rebuilding an expanding TubeGeometry is one of the flight's most
  // expensive allocations. A 3.2-metre sample interval remains visually
  // smooth through Catmull-Rom interpolation while roughly halving rebuilds.
  if (!force && previous && previous.distanceToSquared(point) < 10.24) return;
  if (previous && previous.distanceToSquared(point) < .0001) return;
  tracerPoints.push(point);
  rebuildShotTracer();
}

function snapshotPerformanceDrive() {
  if (!performanceDiagnostics) return;
  const round = (value) => Math.round(value * 100) / 100;
  performanceDiagnostics.driveSnapshots.push({
    drive: game.roundShot,
    elapsedSeconds: round((performance.now() - performanceDiagnostics.startedAt) / 1000),
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    renderCalls: renderer.info.render.calls,
    tracerPoints: tracerPoints.length,
    heapMb: performance.memory ? round(performance.memory.usedJSHeapSize / 1048576) : null,
  });
}
const cameraTarget = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const desiredCameraTarget = new THREE.Vector3();
const launchCameraPosition = new THREE.Vector3();
const launchCameraTarget = new THREE.Vector3();
const clock = new THREE.Clock();
let feedbackTimer = 0;
let boundaryFeedbackTimer = 0;
let driveIntroTimer = 0;
let xpGainTimer = 0;
let lastFlightHudTime = -1;

function currentRankIndex() {
  return game.rankIndex;
}

function currentLevel() {
  let level = 1;
  XP_LEVELS.forEach((threshold, index) => { if (game.xp >= threshold) level = index + 1; });
  return level;
}

function driverForLevel(level) {
  if (level >= 10 && game.competitionDriverUnlocked) return { name: 'Competition', dispersionMultiplier: .96, clubSpeedMultiplier: 1.035 };
  if (level >= 7) return { name: 'Long', dispersionMultiplier: .96, clubSpeedMultiplier: 1.012 };
  if (level >= 3) return { name: 'Steady', dispersionMultiplier: .96, clubSpeedMultiplier: 1 };
  return { name: 'Training', dispersionMultiplier: 1, clubSpeedMultiplier: 1 };
}

function currentMeterDifficulty() {
  const rankIndex = currentRankIndex();
  const base = METER_DIFFICULTY[rankIndex];
  const levelDelta = currentLevel() - METER_REFERENCE_LEVELS[rankIndex];
  const powerPressure = 1 + levelDelta * .03;
  const accuracyPressure = 1 + levelDelta * .02;
  return {
    powerSeconds: base.powerSeconds / powerPressure,
    accuracySpeed: base.accuracySpeed * accuracyPressure,
  };
}

function meterElapsedSeconds(now = performance.now()) {
  return Math.max(0, (now - meterStartedAt) / 1000);
}

function powerAtTime(elapsed, sweepSeconds) {
  const cycle = (elapsed / sweepSeconds) % 2;
  return 1 - Math.abs(cycle - 1);
}

function accuracyAtTime(elapsed, speed) {
  return -Math.cos(elapsed * speed);
}

function markerTransform(marker, percent) {
  const meterWidth = marker.parentElement.clientWidth;
  return `translateX(-50%) translateX(${meterWidth * percent / 100}px)`;
}

function cancelMeterAnimations() {
  powerMarkerAnimation?.cancel();
  powerFillAnimation?.cancel();
  accuracyMarkerAnimation?.cancel();
  powerMarkerAnimation = null;
  powerFillAnimation = null;
  accuracyMarkerAnimation = null;
}

function setPowerMeterPosition(power) {
  const percent = THREE.MathUtils.clamp(power, 0, 1) * 100;
  powerMarker.style.transform = markerTransform(powerMarker, percent);
  powerFill.style.transform = `scaleX(${percent / 100})`;
}

function setAccuracyMeterPosition(accuracy) {
  const percent = (THREE.MathUtils.clamp(accuracy, -1, 1) + 1) * 50;
  accuracyMarker.style.transform = markerTransform(accuracyMarker, percent);
}

function startPowerMeterAnimation(sweepSeconds, elapsed = 0) {
  powerMarkerAnimation?.cancel();
  powerFillAnimation?.cancel();
  powerMarker.style.transform = markerTransform(powerMarker, 0);
  powerFill.style.transform = 'scaleX(0)';
  const animationOptions = { duration: sweepSeconds * 2000, iterations: Infinity, easing: 'linear' };
  powerMarkerAnimation = powerMarker.animate([
    { transform: markerTransform(powerMarker, 0) },
    { transform: markerTransform(powerMarker, 100) },
    { transform: markerTransform(powerMarker, 0) },
  ], animationOptions);
  powerFillAnimation = powerFill.animate([
    { transform: 'scaleX(0)' },
    { transform: 'scaleX(1)' },
    { transform: 'scaleX(0)' },
  ], animationOptions);
  const cycleMilliseconds = sweepSeconds * 2000;
  const phaseMilliseconds = (elapsed * 1000) % cycleMilliseconds;
  powerMarkerAnimation.currentTime = phaseMilliseconds;
  powerFillAnimation.currentTime = phaseMilliseconds;
}

function accuracyAnimationFrames(marker, sampleCount = 64) {
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const offset = index / sampleCount;
    const accuracy = -Math.cos(offset * Math.PI * 2);
    return { offset, transform: markerTransform(marker, (accuracy + 1) * 50) };
  });
}

function startAccuracyMeterAnimation(speed, elapsed = 0) {
  accuracyMarkerAnimation?.cancel();
  accuracyMarker.style.transform = markerTransform(accuracyMarker, 0);
  const cycleSeconds = Math.PI * 2 / speed;
  accuracyMarkerAnimation = accuracyMarker.animate(accuracyAnimationFrames(accuracyMarker), {
    duration: cycleSeconds * 1000,
    iterations: Infinity,
    easing: 'linear',
  });
  accuracyMarkerAnimation.currentTime = (elapsed % cycleSeconds) * 1000;
}

function syncMeterValue(now = performance.now()) {
  game.meterTime = meterElapsedSeconds(now);
  const difficulty = currentMeterDifficulty();
  if (game.state === 'power') game.power = powerAtTime(game.meterTime, difficulty.powerSeconds);
  else if (game.state === 'accuracy') game.accuracy = accuracyAtTime(game.meterTime, difficulty.accuracySpeed);
}

function refreshMeterAnimation() {
  if (game.state !== 'power' && game.state !== 'accuracy') return;
  syncMeterValue();
  const difficulty = currentMeterDifficulty();
  if (game.state === 'power') startPowerMeterAnimation(difficulty.powerSeconds, game.meterTime);
  else startAccuracyMeterAnimation(difficulty.accuracySpeed, game.meterTime);
}

function currentDriver() {
  return game.roundActive && game.roundDriver ? game.roundDriver : driverForLevel(currentLevel());
}

const DRIVER_VISUALS = {
  Training: {
    crown: DRIVER_IDENTIFICATION_COLORS.Training, face: 0x185596, sole: DRIVER_IDENTIFICATION_COLORS.Training, shaft: 0x35434a, grip: 0x183c66,
    headScale: .54, shellScale: [.92, .9, .9], accent: false, wing: false,
  },
  Steady: {
    crown: DRIVER_IDENTIFICATION_COLORS.Steady, face: 0x185596, sole: DRIVER_IDENTIFICATION_COLORS.Steady, shaft: 0x35434a, grip: 0x183c66,
    headScale: .59, shellScale: [1, 1, 1], accent: true, wing: false,
  },
  Long: {
    crown: DRIVER_IDENTIFICATION_COLORS.Long, face: 0x185596, sole: DRIVER_IDENTIFICATION_COLORS.Long, shaft: 0x35434a, grip: 0x183c66,
    headScale: .65, shellScale: [1.13, .95, 1.08], accent: true, wing: true,
  },
  Competition: {
    crown: 0x080b0e, face: 0x303b43, sole: 0x050708, shaft: 0x111820, grip: 0x050708,
    headScale: .68, shellScale: [1.17, .96, 1.1], accent: true, wing: true,
  },
};

const IMPORTED_DRIVER_COLORS = {
  Training: {
    Grip: 0x183c66,
    Shaft: 0x35434a,
    Hosel: DRIVER_IDENTIFICATION_COLORS.Training,
    Crown: DRIVER_IDENTIFICATION_COLORS.Training,
    Face: 0x101820,
    Sole: DRIVER_IDENTIFICATION_COLORS.Training,
  },
  Steady: {
    Grip: 0x183c66,
    Shaft: 0x35434a,
    Hosel: DRIVER_IDENTIFICATION_COLORS.Steady,
    Crown: DRIVER_IDENTIFICATION_COLORS.Steady,
    Face: 0x101820,
    Sole: DRIVER_IDENTIFICATION_COLORS.Steady,
  },
  Long: {
    Grip: 0x183c66,
    Shaft: 0x35434a,
    Hosel: DRIVER_IDENTIFICATION_COLORS.Long,
    Crown: DRIVER_IDENTIFICATION_COLORS.Long,
    Face: 0x101820,
    Sole: DRIVER_IDENTIFICATION_COLORS.Long,
  },
  Competition: {
    Grip: 0x050708,
    Shaft: 0x111820,
    Hosel: 0x242d34,
    Crown: 0x080b0e,
    Face: 0x303b43,
    Sole: 0x050708,
  },
};

function colorImportedDriver(root, style) {
  if (!root) return;
  const colors = IMPORTED_DRIVER_COLORS[style];
  root.traverse((part) => {
    if (!part.isMesh || !part.material) return;
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    materials.forEach((material) => {
      if (colors[material.name]) material.color.setHex(colors[material.name]);
      if (style === 'Competition') {
        const isCrown = material.name === 'Crown';
        const isGrip = material.name === 'Grip';
        if ('metalness' in material) material.metalness = isGrip ? .05 : isCrown ? .9 : .72;
        if ('roughness' in material) material.roughness = isGrip ? .55 : isCrown ? .08 : .18;
      }
    });
  });
}

function updateDriverAppearance() {
  if (!driverHead || !driverShell || !driverAccent || !driverWing) return;
  const requestedStyle = clubPreviewStyle && DRIVER_VISUALS[clubPreviewStyle] ? clubPreviewStyle : currentDriver().name;
  if (requestedStyle === activeDriverVisual) return;
  const visual = DRIVER_VISUALS[requestedStyle];
  driverCrown.color.setHex(visual.crown);
  driverFace.color.setHex(visual.face);
  driverSole.color.setHex(visual.sole);
  graphite.color.setHex(visual.shaft);
  driverGripMaterial.color.setHex(visual.grip);
  driverHead.scale.setScalar(visual.headScale);
  driverShell.scale.set(...visual.shellScale);
  driverAccent.visible = visual.accent;
  driverWing.visible = visual.wing;
  colorImportedDriver(importedDriverModel, requestedStyle);
  activeDriverVisual = requestedStyle;
}

function renderDriverRevealPreview(driverName, attempt = 0) {
  if (!driverGroup) {
    if (attempt < 40 && game.state === 'driver-reveal') {
      setTimeout(() => renderDriverRevealPreview(driverName, attempt + 1), 100);
    }
    return;
  }
  const canvas = $('#driver-reveal-canvas');
  const art = canvas.parentElement;
  const visual = DRIVER_VISUALS[driverName];
  const identificationColor = DRIVER_IDENTIFICATION_COLORS[driverName] ?? DRIVER_IDENTIFICATION_COLORS.Steady;
  art.style.setProperty('--driver-accent', `#${identificationColor.toString(16).padStart(6, '0')}`);
  canvas.setAttribute('aria-label', `${driverName} Driver 3D preview`);

  if (driverRevealRenderer) driverRevealRenderer.dispose();
  driverRevealRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  driverRevealRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const width = Math.max(280, art.clientWidth);
  const height = Math.max(128, art.clientHeight);
  driverRevealRenderer.setSize(width, height, false);
  driverRevealRenderer.setClearColor(0xffffff, 0);

  const previewScene = new THREE.Scene();
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0x8ba47d, 1.25));
  const previewLight = new THREE.DirectionalLight(0xffffff, 1.1);
  previewLight.position.set(3, 5, 6);
  previewScene.add(previewLight);
  if (driverName === 'Competition') {
    const crownSheen = new THREE.DirectionalLight(0xe5f8ff, 2.15);
    crownSheen.position.set(-4, 3, 7);
    previewScene.add(crownSheen);
    const edgeLight = new THREE.DirectionalLight(0x61b8ee, 1.35);
    edgeLight.position.set(5, -2, -4);
    previewScene.add(edgeLight);
  }

  const previewClub = (importedDriverModel || driverGroup).clone(true);
  previewClub.position.set(0, 0, 0);
  previewClub.quaternion.identity();
  previewClub.traverse((part) => {
    if (!part.isMesh) return;
    const sourceMaterial = part.material;
    if (importedDriverModel && sourceMaterial.name === 'Shaft') part.visible = true;
    part.material = sourceMaterial.clone();
    if (!importedDriverModel) {
      if (sourceMaterial === driverCrown) part.material.color.setHex(visual.crown);
      else if (sourceMaterial === driverFace) part.material.color.setHex(visual.face);
      else if (sourceMaterial === driverSole) part.material.color.setHex(visual.sole);
      else if (sourceMaterial === graphite) part.material.color.setHex(visual.shaft);
      else if (sourceMaterial === driverGripMaterial) part.material.color.setHex(visual.grip);
      else if (sourceMaterial === yellow) part.material.color.setHex(driverName === 'Competition' ? visual.crown : driverName === 'Long' ? visual.sole : 0xeeb902);
      else if (sourceMaterial === orange) part.material.color.setHex(driverName === 'Competition' ? visual.sole : 0xf45d01);
    }
  });
  if (importedDriverModel) {
    colorImportedDriver(previewClub, driverName);
    // Product view: source +Z runs from head to grip and +Y is the club face.
    const productBasis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    );
    previewClub.quaternion.setFromRotationMatrix(productBasis);
  } else {
    const previewHead = previewClub.getObjectByName('Low-poly driver head');
    previewHead.scale.setScalar(visual.headScale);
    const previewShell = previewHead.children[0];
    previewShell.scale.set(...visual.shellScale);
    if (previewShell.children[3]) previewShell.children[3].visible = visual.accent;
    if (previewShell.children[4]) previewShell.children[4].visible = visual.wing;

    // Rotate the complete assembled club so the crown is readable while every
    // component keeps its gameplay-relative position and rigid connection.
    const desiredHeadRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 2.65, -Math.PI / 2));
    const currentHeadRotation = previewHead.quaternion.clone();
    previewClub.quaternion.copy(desiredHeadRotation.multiply(currentHeadRotation.invert()));
  }
  previewScene.add(previewClub);
  previewClub.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(previewClub);
  const center = bounds.getCenter(new THREE.Vector3());
  previewClub.position.sub(center);
  previewClub.updateMatrixWorld(true);
  const fittedBounds = new THREE.Box3().setFromObject(previewClub);
  const size = fittedBounds.getSize(new THREE.Vector3());
  const aspect = width / height;
  const halfHeight = Math.max(size.y * .72, size.x / aspect * .62, 1.15);
  const previewCamera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, .1, 30);
  previewCamera.position.set(0, .7, 10);
  previewCamera.lookAt(0, 0, 0);
  driverRevealRenderer.render(previewScene, previewCamera);
}

function updateXpHud(gain = 0) {
  const level = currentLevel();
  const maxLevel = XP_LEVELS.length;
  const levelStart = XP_LEVELS[level - 1];
  const levelEnd = level < maxLevel ? XP_LEVELS[level] : levelStart;
  const progress = level < maxLevel ? (game.xp - levelStart) / (levelEnd - levelStart) : 1;
  $('#xp-level').textContent = level < maxLevel ? `Level ${level}` : 'Level 10 · Max';
  $('#xp-count').textContent = level < maxLevel ? `${game.xp - levelStart} / ${levelEnd - levelStart} XP` : `${game.xp} total XP`;
  $('#xp-next').textContent = level < maxLevel ? `Next: Level ${level + 1}` : 'Maximum level reached';
  $('#xp-reward').textContent = level < 3
    ? 'Steady Driver at L3'
    : level < 7
      ? 'Long Driver at L7'
      : level < 10
        ? 'Competition Driver challenge at L10'
        : game.competitionDriverUnlocked
          ? 'Competition Driver unlocked'
          : 'Average 325 yd to unlock Competition';
  $('#xp-fill').style.width = `${THREE.MathUtils.clamp(progress, 0, 1) * 100}%`;
  if (gain > 0) {
    const badge = $('#xp-gain');
    badge.textContent = `+${gain} XP`;
    badge.classList.remove('is-active');
    requestAnimationFrame(() => badge.classList.add('is-active'));
    clearTimeout(xpGainTimer);
    xpGainTimer = setTimeout(() => badge.classList.remove('is-active'), 1900);
  }
}

function qualificationProgress() {
  const nextIndex = currentRankIndex() + 1;
  const requirement = RANK_REQUIREMENTS[nextIndex];
  if (!requirement) return { text: 'Legend status achieved', qualifying: 0, requirement: null };
  const recent = game.roundHistory.slice(-requirement.window);
  const qualifying = recent.filter((round) => round.best >= requirement.target).length;
  const roundsNeeded = Math.max(0, requirement.requiredRounds - qualifying);
  const levelNeeded = Math.max(0, requirement.minLevel - currentLevel());
  const parts = [];
  if (roundsNeeded) parts.push(`${roundsNeeded} more ${requirement.target}+ yd round${roundsNeeded === 1 ? '' : 's'} in the last ${requirement.window}`);
  if (levelNeeded) parts.push(`reach level ${requirement.minLevel}`);
  return {
    qualifying,
    requirement,
    text: parts.length ? `${parts.join(' and ')} to ${ranks[nextIndex].name}` : `${ranks[nextIndex].name} promotion ready`,
  };
}

function renderQualificationTracker() {
  const card = $('#qualification-card');
  const nextIndex = currentRankIndex() + 1;
  const requirement = RANK_REQUIREMENTS[nextIndex];
  if (!requirement) {
    card.classList.add('is-complete');
    $('#qualification-rank').textContent = 'Legend';
    $('#qualification-distance-label').textContent = '✓ Distance complete';
    $('#qualification-rounds').textContent = 'All rank requirements achieved';
    $('#qualification-level-label').textContent = 'Level 10 of 10';
    $('#qualification-level').textContent = '✓ Maximum level reached';
    $('#qualification-distance-row').classList.add('is-met');
    $('#qualification-level-row').classList.add('is-met');
    $('#round-progress').textContent = 'Legend status achieved';
    return;
  }

  card.classList.remove('is-complete');
  const recent = game.roundHistory.slice(-requirement.window);
  const qualifying = recent.filter((round) => round.best >= requirement.target).length;
  const roundsNeeded = Math.max(0, requirement.requiredRounds - qualifying);
  const levelNeeded = Math.max(0, requirement.minLevel - currentLevel());
  $('#qualification-rank').textContent = ranks[nextIndex].name;
  const distanceMet = qualifying >= requirement.requiredRounds;
  const levelMet = currentLevel() >= requirement.minLevel;
  $('#qualification-distance-label').textContent = distanceMet ? '✓ Distance complete' : 'Distance requirement';
  $('#qualification-rounds').textContent = distanceMet
    ? `${Math.min(qualifying, requirement.requiredRounds)} of your last ${requirement.window} rounds reached ${requirement.target}+ yd`
    : `${Math.min(qualifying, requirement.requiredRounds)} of ${requirement.requiredRounds} required rounds reached ${requirement.target}+ yd · last ${requirement.window}`;
  $('#qualification-level-label').textContent = `Level ${Math.min(currentLevel(), requirement.minLevel)} of ${requirement.minLevel}`;
  $('#qualification-level').textContent = levelMet ? '✓ Level requirement complete' : 'Keep earning XP to qualify';
  $('#qualification-distance-row').classList.toggle('is-met', distanceMet);
  $('#qualification-level-row').classList.toggle('is-met', levelMet);
  const parts = [];
  if (roundsNeeded) parts.push(`${roundsNeeded} more ${requirement.target}+ yd round${roundsNeeded === 1 ? '' : 's'}`);
  if (levelNeeded) parts.push(`reach level ${requirement.minLevel}`);
  $('#round-progress').textContent = parts.length ? `${parts.join(' and ')} to reach ${ranks[nextIndex].name}` : `${ranks[nextIndex].name} promotion ready`;
}

function saveProgression() {
  localStorage.setItem('everelms-sloppy-golf-xp', String(game.xp));
  localStorage.setItem('everelms-sloppy-golf-rank', String(game.rankIndex));
  localStorage.setItem('everelms-sloppy-golf-rounds', JSON.stringify(game.roundHistory.slice(-12)));
  localStorage.setItem('everelms-sloppy-golf-total-rounds', String(game.totalRounds));
  localStorage.setItem('everelms-sloppy-golf-competition-driver', game.competitionDriverUnlocked ? 'unlocked' : 'locked');
}

function setWind() {
  const rank = ranks[currentRankIndex()];
  game.windMph = Math.max(1, Math.round((Math.random() * .65 + .35) * rank.wind));
  const direction = WIND_DIRECTIONS[Math.floor(Math.random() * WIND_DIRECTIONS.length)];
  game.windX = direction.x;
  game.windZ = direction.z;
  game.windArrow = direction.arrow;
  game.windName = direction.name;
  const windValue = $('#wind-value');
  windValue.textContent = `${game.windMph} mph ${game.windArrow}`;
  windValue.setAttribute('aria-label', `${game.windMph} mile per hour ${game.windName}`);
  windValue.title = game.windName;
}

function updatePersistentHud() {
  $('#best-value').textContent = Math.round(game.best);
  $('#rank-value').textContent = ranks[currentRankIndex()].name;
  const driveNumber = game.roundActive ? Math.min(6, game.roundShot + 1) : 1;
  $('#rank-label').textContent = `Rank · L${currentLevel()} · ${driveNumber}/6`;
  $('#sound-button').textContent = game.sound ? 'Sound on' : 'Sound off';
  $('#sound-button').setAttribute('aria-label', game.sound ? 'Mute sound and music' : 'Turn sound and music on');
  $('#sound-button').setAttribute('aria-pressed', String(!game.sound));
  updateXpHud();
}

const AUDIO_ASSETS = {
  music: 'media/audio/late-afternoon-transit.mp3?v=1',
  charge: 'media/audio/charge-up-pulses.wav?v=1',
  accuracyPing: 'media/audio/accuracy-center-ping.wav?v=1',
  powerLock: 'media/audio/power-lok.mp3',
  perfectHundred: 'media/audio/onehundred.mp3',
  impact: 'media/audio/driver-impact.mp3',
  validDrive: 'media/audio/valid-drive.mp3?v=2',
  outOfBounds: 'media/audio/out-of-bounds.mp3?v=2',
  personalBest: 'media/audio/personal_best.mp3',
  levelUp: 'media/audio/level-up.mp3',
  rankUp: 'media/audio/rank-up.mp3?v=1',
  newClub: 'media/audio/new-club.mp3?v=1',
};

let audioContext;
let audioLoadPromise;
let audioMasterGain = null;
let audioSfxGain = null;
let backgroundMusicGain = null;
let backgroundMusicSource = null;
let chargeCycleBuffer = null;
let chargeCycleSourceBuffer = null;
const audioBuffers = new Map();
const audioBufferPromises = new Map();
let meterChargeSource = null;
let meterChargeGain = null;
let meterChargeRequest = '';

const MUSIC_VOLUME = .008;
const MUSIC_LOOP_END_SECONDS = 28.5;

function audioOutput(context) {
  if (audioMasterGain) return audioMasterGain;
  audioMasterGain = context.createGain();
  audioMasterGain.gain.value = .98;
  audioMasterGain.connect(context.destination);
  return audioMasterGain;
}

function sfxOutput(context) {
  if (audioSfxGain) return audioSfxGain;
  audioSfxGain = context.createGain();
  audioSfxGain.gain.value = 1;
  audioSfxGain.connect(audioOutput(context));
  return audioSfxGain;
}

function musicOutput(context) {
  if (backgroundMusicGain) return backgroundMusicGain;
  backgroundMusicGain = context.createGain();
  backgroundMusicGain.gain.value = .0001;
  backgroundMusicGain.connect(audioOutput(context));
  return backgroundMusicGain;
}

function setMasterSoundEnabled(enabled, fadeSeconds = .08) {
  if (!audioContext || !audioMasterGain) return;
  const now = audioContext.currentTime;
  audioMasterGain.gain.cancelScheduledValues(now);
  audioMasterGain.gain.setValueAtTime(Math.max(.0001, audioMasterGain.gain.value), now);
  audioMasterGain.gain.linearRampToValueAtTime(enabled ? .98 : .0001, now + fadeSeconds);
}

async function startBackgroundMusic() {
  if (!game.sound || backgroundMusicSource) return;
  const context = await ensureAudioContext();
  const buffer = audioBuffers.get('music') || await loadAudioBuffer('music');
  if (!context || !buffer || !game.sound || backgroundMusicSource) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = 0;
  source.loopEnd = Math.min(MUSIC_LOOP_END_SECONDS, buffer.duration);
  source.connect(musicOutput(context));
  backgroundMusicSource = source;
  backgroundMusicGain.gain.cancelScheduledValues(context.currentTime);
  backgroundMusicGain.gain.setValueAtTime(MUSIC_VOLUME, context.currentTime);
  source.start(context.currentTime + .01);
  source.onended = () => {
    source.disconnect();
    if (backgroundMusicSource === source) backgroundMusicSource = null;
  };
}

function stopBackgroundMusic() {
  if (!backgroundMusicSource) return;
  const source = backgroundMusicSource;
  backgroundMusicSource = null;
  source.onended = null;
  try { source.stop(); } catch {}
  source.disconnect();
  if (backgroundMusicGain) backgroundMusicGain.gain.value = .0001;
}

async function ensureAudioContext() {
  if (!game.sound) return null;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  audioOutput(audioContext);
  if (audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}

function loadAudioBuffer(name) {
  if (audioBuffers.has(name)) return Promise.resolve(audioBuffers.get(name));
  if (audioBufferPromises.has(name)) return audioBufferPromises.get(name);
  const path = AUDIO_ASSETS[name];
  if (!path) return Promise.resolve(null);
  const promise = (async () => {
    const context = await ensureAudioContext();
    if (!context) return null;
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    audioBuffers.set(name, buffer);
    return buffer;
  })().catch((error) => {
    console.warn(`Long Drive audio could not load ${name}.`, error);
    audioBufferPromises.delete(name);
    return null;
  });
  audioBufferPromises.set(name, promise);
  return promise;
}

async function prepareAudio() {
  const context = await ensureAudioContext();
  if (!context) return null;
  audioLoadPromise ||= Promise.all(Object.keys(AUDIO_ASSETS).map(loadAudioBuffer)).then(() => context);
  await audioLoadPromise;
  await startBackgroundMusic();
  return context;
}

async function playSfx(name, { volume = .7, delay = 0, maxDuration = 0, fadeOut = .08 } = {}) {
  const context = await ensureAudioContext();
  const buffer = audioBuffers.get(name) || await loadAudioBuffer(name);
  if (!context || !buffer || !game.sound) return;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  const startAt = context.currentTime + delay;
  const playDuration = maxDuration > 0 ? Math.min(maxDuration, buffer.duration) : buffer.duration;
  gain.gain.setValueAtTime(volume, startAt);
  if (maxDuration > 0 && playDuration > fadeOut) {
    gain.gain.setValueAtTime(volume, startAt + playDuration - fadeOut);
    gain.gain.linearRampToValueAtTime(0, startAt + playDuration);
  }
  source.connect(gain).connect(sfxOutput(context));
  source.start(startAt, 0, playDuration);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}

function stopMeterCharge() {
  meterChargeRequest = '';
  if (!meterChargeSource) return;
  const source = meterChargeSource;
  const gain = meterChargeGain;
  meterChargeSource = null;
  meterChargeGain = null;
  const stopAt = audioContext?.currentTime || 0;
  if (gain && audioContext) {
    gain.gain.cancelScheduledValues(stopAt);
    gain.gain.setValueAtTime(Math.max(.0001, gain.gain.value), stopAt);
    gain.gain.linearRampToValueAtTime(.0001, stopAt + .018);
  }
  try { source.stop(stopAt + .02); } catch {}
}

function getChargeCycleBuffer(context, buffer) {
  if (chargeCycleBuffer && chargeCycleSourceBuffer === buffer) return chargeCycleBuffer;
  const cycle = context.createBuffer(buffer.numberOfChannels, buffer.length * 2, buffer.sampleRate);
  const fadeSamples = Math.min(buffer.length, Math.round(buffer.sampleRate * .025));
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    cycle.copyToChannel(buffer.getChannelData(channel), channel);
    const cycleData = cycle.getChannelData(channel);
    for (let index = 0; index < fadeSamples; index += 1) {
      cycleData[buffer.length - fadeSamples + index] *= 1 - index / fadeSamples;
    }
  }
  chargeCycleSourceBuffer = buffer;
  chargeCycleBuffer = cycle;
  return cycle;
}

async function startMeterCharge(sweepSeconds) {
  if (!game.sound) {
    stopMeterCharge();
    return;
  }
  stopMeterCharge();
  const request = `power:${performance.now()}`;
  meterChargeRequest = request;
  if (game.state !== 'power') return;
  const context = await ensureAudioContext();
  const buffer = audioBuffers.get('charge') || await loadAudioBuffer('charge');
  if (!context || meterChargeRequest !== request || game.state !== 'power') return;
  if (!buffer) return;
  // Build one deterministic forward-audio + silent-return cycle and start it
  // only once. Web Audio then owns every repeat instead of render frames
  // repeatedly restarting the WAV at slightly different offsets.
  const cycleBuffer = getChargeCycleBuffer(context, buffer);
  const playbackRate = THREE.MathUtils.clamp(buffer.duration / Math.max(.2, sweepSeconds), .65, 2.1);
  const fullCycleSeconds = sweepSeconds * 2;
  syncMeterValue();
  const cyclePhase = (game.meterTime % fullCycleSeconds) / fullCycleSeconds;
  const bufferOffset = cyclePhase * cycleBuffer.duration;
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = cycleBuffer;
  source.loop = true;
  source.loopStart = 0;
  source.loopEnd = cycleBuffer.duration;
  source.playbackRate.value = playbackRate;
  const startAt = context.currentTime + .006;
  gain.gain.setValueAtTime(.18, startAt);
  source.connect(gain).connect(sfxOutput(context));
  source.start(startAt, bufferOffset);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    if (meterChargeSource === source) {
      meterChargeSource = null;
      meterChargeGain = null;
    }
  };
  meterChargeSource = source;
  meterChargeGain = gain;
}

function tone(frequency, duration = .08, type = 'sine', volume = .05) {
  if (!game.sound) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const output = sfxOutput(audioContext);
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

const CLOSE_CALL_YARDS = 5;
const CLOSE_CALL_METRES = CLOSE_CALL_YARDS / 1.09361;

function boundaryMetrics() {
  const lateral = ball.position.x - LANE_CENTER_X;
  const side = lateral < 0 ? -1 : 1;
  const marginMetres = GRID_HALF_WIDTH_METRES - Math.abs(lateral);
  return {
    lateral,
    side,
    marginMetres,
    boundaryX: LANE_CENTER_X + side * GRID_HALF_WIDTH_METRES,
  };
}

function showBoundaryFeedback(message, state, duration = 950) {
  clearTimeout(boundaryFeedbackTimer);
  boundaryFeedback.textContent = message;
  boundaryFeedback.className = `boundary-feedback is-${state}`;
  requestAnimationFrame(() => boundaryFeedback.classList.add('is-active'));
  boundaryFeedbackTimer = setTimeout(() => {
    boundaryFeedback.classList.remove('is-active');
    boundaryFeedbackTimer = setTimeout(() => boundaryFeedback.classList.add('is-hidden'), 220);
  }, duration);
}

function updateBoundaryDrama() {
  const { side, marginMetres } = boundaryMetrics();
  const distanceToLine = Math.abs(marginMetres);
  const nearStrength = 1 - THREE.MathUtils.smoothstep(distanceToLine, 0, 8);
  const pulse = .72 + Math.sin(environmentTime * 8.5) * .28;
  boundaryPulseMaterials.forEach((material, index) => {
    const isNearest = index === (side < 0 ? 0 : 1);
    material.opacity = isNearest ? nearStrength * (.12 + pulse * .43) : 0;
    material.color.setHex(marginMetres < 0 ? 0xff5b35 : 0xffe143);
  });

  const nextZone = marginMetres < 0 ? 'outside' : marginMetres <= CLOSE_CALL_METRES ? 'near' : 'clear';
  if (nextZone !== game.boundaryZone && game.shotTime > .7) {
    if (nextZone === 'outside') {
      showBoundaryFeedback('Drifting outside', 'outside');
      tone(235, .08, 'triangle', .035);
    } else if (game.boundaryZone === 'outside') {
      showBoundaryFeedback('Back in play', 'safe');
      tone(520, .07, 'sine', .03);
    } else if (nextZone === 'near' && !game.boundaryNearAnnounced) {
      game.boundaryNearAnnounced = true;
      showBoundaryFeedback('Line watch', 'near', 800);
    }
    game.boundaryZone = nextZone;
  }
}

function playCloseCallCue(inBounds) {
  if (!game.sound) return;
  const first = inBounds ? 540 : 230;
  const second = inBounds ? 720 : 155;
  setTimeout(() => tone(first, .1, 'triangle', .036), 170);
  setTimeout(() => tone(second, .14, 'sine', .04), 285);
  navigator.vibrate?.(inBounds ? [18, 35, 28] : [55, 30, 85]);
}

function resetBallAndCamera() {
  cancelMeterAnimations();
  setPowerMeterPosition(0);
  setAccuracyMeterPosition(-1);
  clearShotTracer();
  ball.position.set(BALL_START_X, .53, 0);
  ball.scale.setScalar(1);
  ballVisibilityMaterial.opacity = 0;
  ballVelocity.set(0, 0, 0);
  treeCollisionCooldown = 0;
  game.curveVelocity = 0;
  game.spinFlightActive = false;
  camera.position.copy(teeCameraPosition);
  cameraTarget.copy(teeCameraTarget);
  camera.lookAt(teeCameraTarget);
  golfer.rotation.set(0, 0, 0);
  applyPose(ADDRESS_POSE);
  setSwingTime(0);
  game.carryMetres = 0;
  game.landed = false;
  game.rolling = false;
  game.firstBounceEffectPlayed = false;
  game.maxHeight = 0;
  game.followThroughTime = 0;
  clearTimeout(feedbackTimer);
  clearTimeout(boundaryFeedbackTimer);
  clearTimeout(driveIntroTimer);
  $('#drive-intro').className = 'drive-intro is-hidden';
  impactFeedback.className = 'impact-feedback is-hidden';
  boundaryFeedback.className = 'boundary-feedback is-hidden';
  resultPanel.classList.remove('is-close', 'is-out');
  impactFlash.classList.remove('is-active');
  firstBounceMark.visible = false;
  firstBounceMark.material.color.setHex(0x173d2f);
  firstBounceMark.material.opacity = .32;
  boundaryPulseMaterials.forEach((material) => { material.opacity = 0; });
  game.boundaryZone = 'clear';
  game.boundaryNearAnnounced = false;
  for (let index = 0; index < TURF_PARTICLE_COUNT; index += 1) {
    turfParticleLife[index] = 0;
    turfParticlePositions[index * 3 + 1] = -999;
  }
  turfParticleGeometry.attributes.position.needsUpdate = true;
  powerMeter.classList.remove('is-locked');
  swingPanel.classList.remove('is-shot-summary', 'is-dismissing');
  $('#flight-distance').textContent = '0';
}

function startRound() {
  game.roundShot = 0;
  game.roundResults = [];
  game.roundXpStart = game.xp;
  game.roundLevelStart = currentLevel();
  game.roundDriver = driverForLevel(game.roundLevelStart);
  game.roundActive = true;
  game.roundHadPersonalBest = false;
  game.lastXpBreakdown = null;
  game.pendingPromotion = null;
  game.pendingLevelUp = null;
  game.pendingDriverUnlock = null;
  $('#level-reveal').classList.add('is-hidden');
  $('#driver-reveal').classList.add('is-hidden');
  $('#rank-reveal').classList.add('is-hidden');
  $('#round-panel').classList.add('is-hidden');
  beginSwing();
}

function showMainMenu() {
  game.state = 'ready';
  game.roundActive = false;
  resultPanel.classList.add('is-hidden');
  $('#level-reveal').classList.add('is-hidden');
  $('#driver-reveal').classList.add('is-hidden');
  $('#rank-reveal').classList.add('is-hidden');
  $('#round-panel').classList.add('is-hidden');
  swingPanel.classList.add('is-hidden');
  distanceLive.classList.add('is-hidden');
  startPanel.classList.remove('is-hidden');
  resetBallAndCamera();
  updatePersistentHud();
}

function beginSwing() {
  stopMeterCharge();
  resetBallAndCamera();
  setWind();
  game.state = 'intro';
  game.meterTime = 0;
  game.power = 0;
  startPanel.classList.add('is-hidden');
  resultPanel.classList.add('is-hidden');
  $('#round-panel').classList.add('is-hidden');
  distanceLive.classList.add('is-hidden');
  swingPanel.classList.add('is-hidden');
  accuracyWrap.classList.add('is-hidden');
  swingPrompt.textContent = 'Tap 1: lock power';
  setPowerMeterPosition(0);
  updatePersistentHud();
  const driveIntro = $('#drive-intro');
  $('#drive-intro-number').textContent = `${game.roundShot + 1} / 6`;
  driveIntro.className = 'drive-intro';
  requestAnimationFrame(() => driveIntro.classList.add('is-active'));
  setTimeout(() => driveIntro.classList.remove('is-active'), 850);
  driveIntroTimer = setTimeout(() => {
    driveIntro.classList.add('is-hidden');
    if (game.state !== 'intro') return;
    game.state = 'power';
    game.meterTime = 0;
    meterStartedAt = performance.now();
    swingPanel.classList.remove('is-hidden');
    const meterDifficulty = currentMeterDifficulty();
    startPowerMeterAnimation(meterDifficulty.powerSeconds);
    startMeterCharge(meterDifficulty.powerSeconds);
  }, 1250);
}

function lockPower() {
  syncMeterValue();
  game.power = THREE.MathUtils.clamp(game.power, .08, 1);
  powerMarkerAnimation?.cancel();
  powerFillAnimation?.cancel();
  powerMarkerAnimation = null;
  powerFillAnimation = null;
  setPowerMeterPosition(game.power);
  game.state = 'accuracy';
  game.meterTime = 0;
  game.accuracy = -1;
  game.accuracyCenterIndex = 0;
  meterStartedAt = performance.now();
  accuracyWrap.classList.remove('is-hidden');
  setAccuracyMeterPosition(-1);
  startAccuracyMeterAnimation(currentMeterDifficulty().accuracySpeed);
  powerMeter.classList.add('is-locked');
  swingPrompt.textContent = `Power locked: ${Math.round(game.power * 100)}% · Tap 2 for accuracy`;
  stopMeterCharge();
  playSfx('powerLock', { volume: .32 });
  navigator.vibrate?.(20);
}

function strikeBall() {
  syncMeterValue();
  game.power = THREE.MathUtils.clamp(game.power, .08, 1);
  game.accuracy = THREE.MathUtils.clamp(game.accuracy, -1, 1);
  accuracyMarkerAnimation?.cancel();
  accuracyMarkerAnimation = null;
  setAccuracyMeterPosition(game.accuracy);
  const accuracy = game.accuracy * currentDriver().dispersionMultiplier;
  const quality = 1 - Math.min(1, Math.abs(accuracy));
  const timingSide = accuracy < 0 ? 'Early' : 'Late';
  game.impactGrade = Math.abs(accuracy) <= .1 ? 'Perfect' : Math.abs(accuracy) <= .45 ? `Good · ${timingSide}` : timingSide;
  // Contact is related to timing, but not identical to it. The deterministic
  // variation allows believable center-face curves and occasional opposing
  // gear effect without making repeated inputs feel random.
  const horizontalVariation = Math.sin(game.power * 18.1 + accuracy * 9.7) * (.07 + Math.abs(accuracy) * .14);
  game.strikeHorizontal = THREE.MathUtils.clamp(accuracy * .45 + horizontalVariation, -.9, .9);
  const verticalVariation = Math.sin(game.power * 12.7 + accuracy * 7.3) * .08 * Math.abs(accuracy);
  game.strikeVertical = THREE.MathUtils.clamp((game.power - .65) * .45 - Math.abs(accuracy) * .25 + verticalVariation, -.8, .65);

  // Timing controls most curvature. Toe/heel gear effect modifies it, while
  // high-face contact slightly reduces the resulting spin tendency.
  game.shotCurve = THREE.MathUtils.clamp(accuracy * .78 + game.strikeHorizontal * .38, -1, 1);
  const severeTiming = THREE.MathUtils.clamp((Math.abs(accuracy) - .58) / .42, 0, 1);
  if (Math.abs(accuracy) > .58) {
    // The orange timing zones are authoritative. Gear effect may strengthen
    // an extreme miss, but it must never visually promise Hook/Slice and then
    // downgrade the result to a controlled Draw/Fade.
    const severeFloor = .62 + ((Math.abs(accuracy) - .58) / .42) * .38;
    game.shotCurve = Math.sign(accuracy) * Math.max(Math.abs(game.shotCurve), severeFloor);
  }
  // Keep controlled draws/fades playable, but make the final portion of the
  // timing scale escalate sharply enough that full hooks/slices miss the grid.
  const maxClubSpeedMph = CLUB_SPEED_BY_LEVEL[currentLevel() - 1] * currentDriver().clubSpeedMultiplier;
  game.clubSpeedMph = maxClubSpeedMph * (.57 + game.power * .43);
  game.speedRisk = THREE.MathUtils.clamp((game.clubSpeedMph - 130) / 27, 0, 1);
  const curveStrength = .9 + Math.pow(Math.abs(game.shotCurve), 1.4) * 10.5;
  game.curveAccel = game.shotCurve * curveStrength * (1 - game.strikeVertical * .16)
    * (1 + severeTiming * .5) * (1 + game.speedRisk * .58);
  game.maxCurveSpeed = (1.8 + Math.abs(game.shotCurve) * 9.2 + severeTiming * 3.4)
    * (1 + game.speedRisk * .38);
  game.impactShape = shotShape(game.shotCurve);

  const horizontalPenalty = Math.pow(Math.abs(game.strikeHorizontal), 1.35) * .13;
  const verticalPenalty = Math.pow(Math.abs(game.strikeVertical), 1.3) * .17;
  const timingPenalty = Math.abs(accuracy) * .055;
  game.strikeEfficiency = THREE.MathUtils.clamp(1 - horizontalPenalty - verticalPenalty - timingPenalty, .62, 1);
  game.ballSpeedMph = game.clubSpeedMph * 1.47 * game.strikeEfficiency;
  const speedMps = game.ballSpeedMph / 2.23694;
  const launchDegrees = THREE.MathUtils.clamp(
    10.5 + game.power * 4.2 + game.strikeVertical * 3.1 - Math.abs(accuracy) * 1.15,
    7,
    16.5,
  );
  const launch = THREE.MathUtils.degToRad(launchDegrees);
  // Start line and spin axis are related but not identical. Draws/hooks begin
  // slightly right before bending left; fades/slices begin left before bending
  // right. This opposing start is what makes the tracer reveal a golf-shaped
  // curve instead of a single diagonal line.
  const curveAmount = Math.abs(game.shotCurve);
  game.pendingCurveVelocity = -game.shotCurve * (.45 + curveAmount * .95 + severeTiming * .5);
  game.pendingVelocity = { x: 0, y: Math.sin(launch) * speedMps, z: -Math.cos(launch) * speedMps };
  game.launchDegrees = launchDegrees;
  game.quality = quality;
  game.state = 'striking';
  game.strikeTime = 0;
  game.swingStartPose = ADDRESS_POSE;
  game.swingClipStart = 0;
  setSwingTime(0);
  applyPose(ADDRESS_POSE);
  swingPrompt.textContent = `Power ${Math.round(game.power * 100)}% · ${game.impactGrade} accuracy`;
  swingPanel.classList.add('is-shot-summary');
  stopMeterCharge();
  playSfx('powerLock', { volume: .32 });
}

function launchBall() {
  clearShotTracer();
  tracerPoints.push(ball.position.clone());
  ballVelocity.set(game.pendingVelocity.x, game.pendingVelocity.y, game.pendingVelocity.z);
  game.curveVelocity = game.pendingCurveVelocity;
  game.spinFlightActive = true;
  game.state = 'flight';
  game.shotTime = 0;
  lastFlightHudTime = -1;
  const impactOrigin = ball.position.clone();
  impactOrigin.y = terrainHeightAt(impactOrigin.x, impactOrigin.z) + .08;
  spawnTurfBurst(impactOrigin, 24, false);
  launchCameraPosition.copy(camera.position);
  launchCameraTarget.copy(cameraTarget);
  distanceLive.classList.remove('is-hidden');
  const feedbackClass = game.impactGrade === 'Perfect' ? 'is-perfect' : game.impactGrade.startsWith('Good') ? 'is-good' : 'is-miss';
  impactFeedback.textContent = `${game.impactGrade} · ${game.impactShape}`;
  impactFeedback.className = `impact-feedback ${feedbackClass}`;
  requestAnimationFrame(() => impactFeedback.classList.add('is-active'));
  feedbackTimer = setTimeout(() => {
    impactFeedback.classList.remove('is-active');
    swingPanel.classList.add('is-dismissing');
    setTimeout(() => {
      impactFeedback.classList.add('is-hidden');
      if (game.state === 'flight') swingPanel.classList.add('is-hidden');
    }, 260);
  }, 1800);
  const perfectHundred = Math.round(game.power * 100) === 100 && game.impactGrade === 'Perfect';
  playSfx('impact', { volume: 1.2 });
  if (perfectHundred) playSfx('perfectHundred', { volume: 1.18, delay: .045 });
  navigator.vibrate?.([25, 20, 45]);
}

function handleAction(event) {
  if (event?.target?.closest('button, a')) return;
  if (game.state === 'power') lockPower();
  else if (game.state === 'accuracy') strikeBall();
}

function shotShape(accuracy) {
  const amount = Math.abs(accuracy);
  if (amount < .11) return 'Straight';
  if (accuracy < 0) return amount > .58 ? 'Hook' : 'Draw';
  return amount > .58 ? 'Slice' : 'Fade';
}

function updateStrikeDiagram() {
  // Negative contact is toe-side and positive contact is heel-side in this
  // front-facing, right-handed diagram.
  const horizontal = Math.abs(game.strikeHorizontal) < .15 ? '' : game.strikeHorizontal < 0 ? 'toe' : 'heel';
  const vertical = Math.abs(game.strikeVertical) < .16 ? '' : game.strikeVertical > 0 ? 'high' : 'low';
  const label = vertical || horizontal ? [vertical, horizontal].filter(Boolean).join(' ') : 'center';
  const missAmount = Math.hypot(game.strikeHorizontal, game.strikeVertical);
  const dot = $('#strike-dot');
  const clubface = $('#clubface');
  const tierColor = DRIVER_IDENTIFICATION_COLORS[currentDriver().name] ?? DRIVER_IDENTIFICATION_COLORS.Training;
  clubface.style.setProperty('--club-tier-color', `#${tierColor.toString(16).padStart(6, '0')}`);
  // The transparent reference is fitted with object-fit: contain inside the
  // 190x125 diagram. These bounds describe its broad striking surface while
  // excluding the raised hosel.
  const faceFrame = { left: 3, right: 85, top: 28, bottom: 92 };
  const faceCenterX = (faceFrame.left + faceFrame.right) * .5;
  const faceCenterY = (faceFrame.top + faceFrame.bottom) * .5;
  const faceX = THREE.MathUtils.clamp(
    faceCenterX + game.strikeHorizontal * (faceFrame.right - faceFrame.left) * .42,
    faceFrame.left,
    faceFrame.right,
  );
  const faceY = THREE.MathUtils.clamp(
    faceCenterY - game.strikeVertical * (faceFrame.bottom - faceFrame.top) * .42,
    faceFrame.top,
    faceFrame.bottom,
  );
  clubface.style.setProperty('--face-center-x', `${faceCenterX}%`);
  clubface.style.setProperty('--face-center-y', `${faceCenterY}%`);
  clubface.style.setProperty('--strike-x', `${faceX}%`);
  clubface.style.setProperty('--strike-y', `${faceY}%`);
  dot.className = `strike-dot ${missAmount <= .22 ? '' : missAmount <= .55 ? 'is-good' : 'is-miss'}`.trim();
  $('#strike-label').textContent = label;
  clubface.setAttribute('aria-label', `Ball contact: ${label}`);
}

function renderedMeshBounds(part, target, worldSpace = false, range = null) {
  target.makeEmpty();
  const position = part.geometry.attributes.position;
  const index = part.geometry.index;
  const point = new THREE.Vector3();
  const start = range?.start || 0;
  const count = range?.count ?? (index ? index.count : position.count);
  for (let offset = start; offset < start + count; offset += 1) {
    const vertex = index ? index.getX(offset) : offset;
    point.fromBufferAttribute(position, vertex);
    if (worldSpace) point.applyMatrix4(part.matrixWorld);
    target.expandByPoint(point);
  }
  return target;
}

function expandVisibleMaterialBounds(part, target) {
  const materials = Array.isArray(part.material) ? part.material : [part.material];
  if (part.geometry.groups.length) {
    part.geometry.groups.forEach((group) => {
      if (materials[group.materialIndex]?.visible !== false) {
        target.union(renderedMeshBounds(part, new THREE.Box3(), true, group));
      }
    });
  } else if (materials[0]?.visible !== false) {
    target.union(renderedMeshBounds(part, new THREE.Box3(), true));
  }
}

function renderContactClubface(driverName) {
  const canvas = $('#contact-club-canvas');
  if (!canvas || !importedDriverTemplate) return;
  if (contactClubRenderer) contactClubRenderer.dispose();
  contactClubRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  contactClubRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  contactClubRenderer.setSize(Math.max(190, canvas.clientWidth), Math.max(125, canvas.clientHeight), false);
  contactClubRenderer.setClearColor(0xffffff, 0);

  const contactScene = new THREE.Scene();
  contactScene.add(new THREE.HemisphereLight(0xffffff, 0x46545b, 1.45));
  const contactLight = new THREE.DirectionalLight(0xffffff, 1.5);
  contactLight.position.set(-2, 3, 5);
  contactScene.add(contactLight);

  const contactHead = importedDriverTemplate.clone(true);
  let contactFace = null;
  contactHead.traverse((part) => {
    if (!part.isMesh || !part.material) return;
    const materials = Array.isArray(part.material) ? part.material.map((material) => material.clone()) : [part.material.clone()];
    part.material = Array.isArray(part.material) ? materials : materials[0];
    materials.forEach((material) => {
      if (material.name === 'Grip' || material.name === 'Shaft') material.visible = false;
    });
    part.geometry.groups.forEach((group) => {
      if (materials[group.materialIndex]?.name === 'Face') contactFace = { part, start: group.start, count: group.count };
    });
  });
  colorImportedDriver(contactHead, driverName);
  // Source-space truth: the striking face is viewed along -Y, with source X
  // horizontal and source Z vertical. Use that deterministic product view;
  // geometry-derived normals can be biased by the faceted face/bevels.
  contactHead.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
  );
  contactHead.scale.x *= -1;
  // The horizontal mirror reverses local roll direction. Positive local Z
  // therefore produces the requested 45-degree clockwise screen rotation.
  contactHead.rotateZ(Math.PI / 4);
  contactScene.add(contactHead);
  contactHead.updateMatrixWorld(true);
  const visibleHeadBounds = new THREE.Box3().makeEmpty();
  contactHead.traverse((part) => {
    if (!part.isMesh || !part.visible) return;
    expandVisibleMaterialBounds(part, visibleHeadBounds);
  });
  const initialFaceBounds = contactFace
    ? renderedMeshBounds(contactFace.part, new THREE.Box3(), true, contactFace)
    : visibleHeadBounds;
  const headCenter = initialFaceBounds.getCenter(new THREE.Vector3());
  contactHead.position.sub(headCenter);
  contactHead.updateMatrixWorld(true);
  const fittedHeadBounds = new THREE.Box3().makeEmpty();
  contactHead.traverse((part) => {
    if (!part.isMesh || !part.visible) return;
    expandVisibleMaterialBounds(part, fittedHeadBounds);
  });
  const fittedFaceBounds = contactFace
    ? renderedMeshBounds(contactFace.part, new THREE.Box3(), true, contactFace)
    : fittedHeadBounds;
  const faceSize = fittedFaceBounds.getSize(new THREE.Vector3());
  const halfWidth = Math.max(faceSize.x * .62, faceSize.y * .88, .08);
  const contactCamera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfWidth * .66, -halfWidth * .66, .01, 20);
  contactCamera.position.set(0, 0, 5);
  contactCamera.lookAt(0, 0, 0);
  contactClubRenderer.render(contactScene, contactCamera);
  return {
    left: THREE.MathUtils.clamp((fittedFaceBounds.min.x + halfWidth) / (halfWidth * 2) * 100, 0, 100),
    right: THREE.MathUtils.clamp((fittedFaceBounds.max.x + halfWidth) / (halfWidth * 2) * 100, 0, 100),
    top: THREE.MathUtils.clamp((halfWidth * .66 - fittedFaceBounds.max.y) / (halfWidth * 1.32) * 100, 0, 100),
    bottom: THREE.MathUtils.clamp((halfWidth * .66 - fittedFaceBounds.min.y) / (halfWidth * 1.32) * 100, 0, 100),
  };
}

function completeRoundProgression() {
  const validResults = game.roundResults.filter((result) => result.valid);
  const roundBest = validResults.length ? Math.max(...validResults.map((result) => result.distance)) : 0;
  const roundAverage = validResults.reduce((total, result) => total + result.distance, 0) / 6;
  const completionXp = 20;
  const averageXp = Math.floor(roundAverage / 6);
  const cleanRoundXp = validResults.length === 6 ? 10 : 0;
  const personalBestXp = game.roundHadPersonalBest ? 15 : 0;
  const nextRequirement = RANK_REQUIREMENTS[currentRankIndex() + 1];
  const rankTargetXp = nextRequirement && roundBest >= nextRequirement.target ? 15 : 0;
  const totalXp = completionXp + averageXp + cleanRoundXp + personalBestXp + rankTargetXp;
  game.xp += totalXp;
  const levelAfterRound = currentLevel();
  game.pendingLevelUp = levelAfterRound > game.roundLevelStart ? levelAfterRound : null;
  const unlockedSteady = game.roundLevelStart < 3 && levelAfterRound >= 3;
  const unlockedLong = game.roundLevelStart < 7 && levelAfterRound >= 7;
  const unlockedCompetition = !game.competitionDriverUnlocked && game.roundLevelStart >= 10 && roundAverage >= 325;
  if (unlockedCompetition) game.competitionDriverUnlocked = true;
  game.pendingDriverUnlock = unlockedCompetition ? 'Competition' : unlockedLong ? 'Long' : unlockedSteady ? 'Steady' : null;
  game.lastXpBreakdown = { roundAverage, completionXp, averageXp, cleanRoundXp, personalBestXp, rankTargetXp, totalXp };

  game.totalRounds += 1;
  game.roundHistory.push({ best: roundBest, average: roundAverage, validCount: validResults.length, date: Date.now() });
  game.roundHistory = game.roundHistory.slice(-12);

  const nextRankIndex = currentRankIndex() + 1;
  const requirement = RANK_REQUIREMENTS[nextRankIndex];
  if (requirement) {
    const recent = game.roundHistory.slice(-requirement.window);
    const qualifying = recent.filter((round) => round.best >= requirement.target).length;
    if (currentLevel() >= requirement.minLevel && qualifying >= requirement.requiredRounds) {
      game.rankIndex = nextRankIndex;
      game.pendingPromotion = ranks[nextRankIndex].name;
    }
  }
  saveProgression();
}

function hidePostRoundPanels() {
  startPanel.classList.add('is-hidden');
  resultPanel.classList.add('is-hidden');
  $('#level-reveal').classList.add('is-hidden');
  $('#driver-reveal').classList.add('is-hidden');
  $('#rank-reveal').classList.add('is-hidden');
  $('#round-panel').classList.add('is-hidden');
}

function nextLevelReward(level) {
  if (level < 3) return 'Steady Driver at Level 3';
  if (level < 7) return 'Long Driver at Level 7';
  if (level < 10) return 'Competition Driver challenge at Level 10';
  return game.competitionDriverUnlocked ? 'Competition Driver unlocked' : 'Average 325 yd to unlock the Competition Driver';
}

function showLevelReveal() {
  const level = game.pendingLevelUp;
  game.state = 'level-reveal';
  hidePostRoundPanels();
  $('#level-reveal-number').textContent = level;
  $('#level-reveal-title').textContent = `Level ${level} reached`;
  const speedGain = CLUB_SPEED_BY_LEVEL[level - 1] - CLUB_SPEED_BY_LEVEL[Math.max(0, game.roundLevelStart - 1)];
  $('#level-reveal-message').textContent = level - game.roundLevelStart > 1
    ? `You climbed ${level - game.roundLevelStart} levels, added ${speedGain} mph of club speed, and quickened the meters.`
    : `Maximum club speed is now ${CLUB_SPEED_BY_LEVEL[level - 1]} mph. The meters quicken with every level.`;
  $('#level-reveal-next strong').textContent = nextLevelReward(level);
  $('#level-reveal').classList.remove('is-hidden');
  playSfx('levelUp', { volume: .7 });
}

function showRankReveal() {
  const rankName = game.pendingPromotion;
  game.state = 'rank-reveal';
  hidePostRoundPanels();
  $('#rank-reveal-mark').textContent = rankName.charAt(0);
  $('#rank-reveal-title').textContent = rankName;
  $('#rank-reveal-name').textContent = `${rankName} achieved`;
  $('#rank-reveal').classList.remove('is-hidden');
  playSfx('rankUp', { volume: .7 });
}

function showPostRoundFlow() {
  if (game.pendingLevelUp) return showLevelReveal();
  if (game.pendingDriverUnlock) return showDriverReveal();
  if (game.pendingPromotion) return showRankReveal();
  showRoundSummary();
}

function showDriverReveal() {
  const driverName = game.pendingDriverUnlock;
  if (!driverName) {
    showRoundSummary();
    return;
  }
  game.state = 'driver-reveal';
  hidePostRoundPanels();
  const reveal = $('#driver-reveal');
  const isCompetition = driverName === 'Competition';
  const isLong = driverName === 'Long';
  reveal.classList.toggle('is-competition', isCompetition);
  $('#driver-reveal-level').textContent = isCompetition ? 'Level 10 challenge complete' : `Level ${isLong ? 7 : 3} reward`;
  $('#driver-reveal-title').textContent = `${driverName} Driver`;
  $('#driver-reveal-description').textContent = isCompetition
    ? 'A glossy black power driver built to turn the final Legend push into a show.'
    : isLong
    ? 'A faster driver built to add a little more speed without giving up control.'
    : 'A more forgiving driver built to make accurate timing easier.';
  const stats = $('#driver-reveal-stats');
  stats.innerHTML = isCompetition
    ? '<div><dt>Club speed</dt><dd>3.5% faster</dd></div><div><dt>Great strikes</dt><dd>Legend power</dd></div>'
    : isLong
    ? '<div><dt>Shot dispersion</dt><dd>4% calmer</dd></div><div><dt>Club speed</dt><dd>1.2% faster</dd></div>'
    : '<div><dt>Shot dispersion</dt><dd>4% calmer</dd></div>';
  reveal.classList.remove('is-hidden');
  playSfx('newClub', { volume: .75 });
  requestAnimationFrame(() => renderDriverRevealPreview(driverName));
}

function showRoundSummary() {
  game.state = 'round-summary';
  hidePostRoundPanels();
  const roundPanel = $('#round-panel');
  const validResults = game.roundResults.filter((result) => result.valid);
  const allOutOfBounds = game.roundResults.length > 0 && validResults.length === 0;
  const roundBest = validResults.length ? Math.max(...validResults.map((result) => result.distance)) : 0;
  const xp = game.lastXpBreakdown;
  const roundBestCard = $('#round-best').closest('.round-best');
  roundBestCard.classList.toggle('is-empty', allOutOfBounds);
  $('#round-best-label').textContent = allOutOfBounds ? 'Round result' : 'Best drive';
  $('#round-best').textContent = allOutOfBounds ? 'No drive' : Math.round(roundBest);
  $('#round-best-unit').textContent = allOutOfBounds ? 'in the grid' : 'yd';
  $('#round-recovery').classList.toggle('is-hidden', !allOutOfBounds);
  $('#round-title').textContent = allOutOfBounds ? 'Round complete. No drive in the grid.' : 'Round summary';
  $('#new-round-button').textContent = allOutOfBounds ? 'Try another round' : 'Play another round';
  $('#round-average').textContent = `${Math.round(xp?.roundAverage || 0)} yd`;
  $('#round-xp').textContent = `+${game.xp - game.roundXpStart} XP`;
  $('#qualification-card').open = false;
  renderQualificationTracker();
  $('#round-shots').innerHTML = game.roundResults.map((result, index) =>
    `<li class="${result.valid ? '' : 'is-out'} ${result.valid && result.distance === roundBest ? 'is-best' : ''}"><span>Drive ${index + 1}</span><strong>${result.valid ? `${Math.round(result.distance)} yd` : 'OOB'}</strong>${result.valid && result.distance === roundBest ? '<em>Best</em>' : ''}</li>`
  ).join('');
  roundPanel.classList.remove('is-hidden');
  updatePersistentHud();
}

function finishShot() {
  if (game.state === 'result') return;
  game.state = 'result';
  swingPanel.classList.add('is-hidden');
  swingPanel.classList.remove('is-shot-summary', 'is-dismissing');
  const lateralMetres = ball.position.x - BALL_START_X;
  const distanceYards = Math.max(0, Math.hypot(ball.position.z, lateralMetres) * 1.09361);
  const carryYards = game.carryMetres * 1.09361;
  const centreYards = Math.abs(lateralMetres) * 1.09361;
  // A drive remains valid beyond the drawn end of the grid; only the lateral
  // boundary determines whether a sufficiently long shot counts.
  const inBounds = ball.position.z < -35 && Math.abs(lateralMetres) <= GRID_HALF_WIDTH_METRES;
  const gridMarginYards = (GRID_HALF_WIDTH_METRES - Math.abs(lateralMetres)) * 1.09361;
  const closeToLine = Math.abs(gridMarginYards) <= 5;
  const lineDistance = Math.max(1, Math.ceil(Math.abs(gridMarginYards)));
  const lineUnit = lineDistance === 1 ? 'yard' : 'yards';
  const previousBest = game.best;
  const isRecord = inBounds && distanceYards > previousBest;
  if (isRecord) {
    game.best = distanceYards;
    game.roundHadPersonalBest = true;
    localStorage.setItem('everelms-sloppy-golf-best', game.best.toFixed(2));
  }

  const xpBeforeDrive = game.xp;
  game.roundResults.push({ valid: inBounds, distance: distanceYards, shape: game.impactShape });
  game.roundShot += 1;
  snapshotPerformanceDrive();
  if (game.roundShot >= 6) completeRoundProgression();
  else saveProgression();

  $('#result-kicker').textContent = inBounds ? (closeToLine ? 'Held the grid' : 'In the grid') : (closeToLine ? 'Just outside' : 'Out of bounds');
  $('#result-title').textContent = inBounds
    ? (closeToLine ? `Inside by ${lineDistance} ${lineUnit}` : 'A valid drive')
    : (closeToLine ? `Missed by ${lineDistance} ${lineUnit}` : 'That one will not count');
  $('#result-distance').textContent = Math.round(distanceYards);
  $('#result-distance-label').innerHTML = inBounds
    ? '<b>yards total</b>'
    : '<b>landing distance</b><em>OOB · scores 0</em>';
  $('#carry-stat').textContent = `${Math.round(carryYards)} yd`;
  $('#club-speed-stat').textContent = `${Math.round(game.clubSpeedMph)} mph`;
  $('#speed-stat').textContent = `${Math.round(game.ballSpeedMph)} mph`;
  $('#launch-stat').textContent = `${game.launchDegrees.toFixed(1)}°`;
  $('#shape-stat').textContent = game.impactShape;
  $('#center-stat-label').textContent = closeToLine ? 'Grid margin' : 'From center';
  $('#center-stat').textContent = closeToLine
    ? `${lineDistance} ${lineUnit} ${inBounds ? 'inside' : 'outside'}`
    : (centreYards < .5 ? 'Center' : `${Math.round(centreYards)} yd ${lateralMetres < 0 ? 'L' : 'R'}`);
  updateStrikeDiagram();
  $('#new-record').classList.toggle('is-hidden', !isRecord);
  resultPanel.classList.toggle('is-out', !inBounds);
  resultPanel.classList.toggle('is-close', closeToLine);

  const progressionText = game.roundShot >= 6 ? 'Round complete' : qualificationProgress().text;
  $('#rank-progress').textContent = inBounds ? progressionText : `OOB scores 0 · ${progressionText}`;
  $('#again-button').textContent = game.roundShot >= 6 ? 'View round summary' : `Next drive · ${game.roundShot + 1}/6`;

  updatePersistentHud();
  updateXpHud(game.xp - xpBeforeDrive);
  distanceLive.classList.add('is-hidden');
  resultPanel.classList.remove('is-hidden');
  playSfx(inBounds ? 'validDrive' : 'outOfBounds', {
    volume: .68,
    maxDuration: inBounds ? .95 : 0,
  });
  if (closeToLine) playCloseCallCue(inBounds);
  if (isRecord) playSfx('personalBest', { volume: .76, delay: 1.08 });
}

function updateMeters() {
  syncMeterValue();
  const meterDifficulty = currentMeterDifficulty();
  if (game.state === 'accuracy') {
    const accuracyRate = meterDifficulty.accuracySpeed;
    const accuracyPhase = game.meterTime * accuracyRate;
    const centerIndex = Math.floor((accuracyPhase + Math.PI / 2) / Math.PI);
    if (centerIndex !== game.accuracyCenterIndex) {
      game.accuracyCenterIndex = centerIndex;
      playSfx('accuracyPing', { volume: .16 });
    }
  }
}

function updateStrike(delta) {
  game.strikeTime += Math.min(delta, .04);

  if (modelReady) {
    const clipTime = swingClipTimeForPlaybackTime(game.strikeTime);
    setSwingTime(clipTime);
    if (game.strikeTime >= strikePlaybackTimeForClipTime(SWING_TIMING.impactClipTime)) launchBall();
    return;
  }

  const duration = .9;
  const impactAt = .46;
  const releaseAt = .7;
  const t = Math.min(1, game.strikeTime / duration);

  if (t < impactAt) {
    const down = t / impactAt;
    const eased = down * down * down;
    applyPose(mixPose(game.swingStartPose, IMPACT_POSE, eased));
  } else if (t < releaseAt) {
    const through = (t - impactAt) / (releaseAt - impactAt);
    const eased = 1 - Math.pow(1 - through, 3);
    applyPose(mixPose(IMPACT_POSE, RELEASE_POSE, eased));
  } else {
    const through = (t - releaseAt) / (1 - releaseAt);
    const eased = 1 - Math.pow(1 - through, 3);
    applyPose(mixPose(RELEASE_POSE, FINISH_POSE, eased));
  }

  if (t >= 1) launchBall();
}

function resolveTreeCollision(normal, restitution, damping) {
  if (normal.lengthSq() < .0001) {
    normal.set(-ballVelocity.x, 0, -ballVelocity.z);
    if (normal.lengthSq() < .0001) normal.set(1, 0, 0);
  }
  normal.normalize();
  if (game.spinFlightActive) {
    ballVelocity.x += game.curveVelocity;
    game.curveVelocity = 0;
    game.spinFlightActive = false;
  }
  const incoming = ballVelocity.dot(normal);
  if (incoming < 0) ballVelocity.addScaledVector(normal, -(1 + restitution) * incoming);
  ballVelocity.multiplyScalar(damping);
  treeCollisionCooldown = .13;
  tone(145, .11, 'triangle', .065);
  navigator.vibrate?.(18);
}

function collideBallWithPalms(previousPosition, step) {
  treeCollisionCooldown = Math.max(0, treeCollisionCooldown - step);
  if (treeCollisionCooldown > 0) return false;
  ballCollisionEnd.copy(ball.position);
  const travelDistance = previousPosition.distanceTo(ballCollisionEnd);
  const samples = THREE.MathUtils.clamp(Math.ceil(travelDistance / .32), 1, 12);
  const middleX = (previousPosition.x + ballCollisionEnd.x) * .5;
  const middleZ = (previousPosition.z + ballCollisionEnd.z) * .5;

  for (const palm of palms) {
    const collisionReach = 4.2 * palm.scale.x + travelDistance * .5;
    if (Math.abs(palm.position.x - middleX) > collisionReach || Math.abs(palm.position.z - middleZ) > collisionReach) continue;
    const trunk = palm.userData.trunk;
    const crown = palm.userData.crown;
    if (!trunk || !crown) continue;
    palm.updateMatrixWorld(true);
    trunk.getWorldPosition(treeTrunkCenter);
    trunk.getWorldQuaternion(treeTrunkQuaternion);
    treeTrunkAxis.set(0, 1, 0).applyQuaternion(treeTrunkQuaternion).normalize();
    const trunkHalfHeight = 4.2 * palm.scale.y;
    treeTrunkBase.copy(treeTrunkCenter).addScaledVector(treeTrunkAxis, -trunkHalfHeight);
    treeTrunkTop.copy(treeTrunkCenter).addScaledVector(treeTrunkAxis, trunkHalfHeight);
    treeTrunkLine.set(treeTrunkBase, treeTrunkTop);
    crown.getWorldPosition(treeCrownCenter);
    const trunkRadius = .42 * palm.scale.x + .12;
    const canopyRadius = 3.15 * palm.scale.x + .12;

    for (let sample = 1; sample <= samples; sample += 1) {
      ballCollisionSample.lerpVectors(previousPosition, ballCollisionEnd, sample / samples);
      treeTrunkLine.closestPointToPoint(ballCollisionSample, true, treeClosestPoint);
      const trunkDistance = ballCollisionSample.distanceTo(treeClosestPoint);
      if (trunkDistance < trunkRadius) {
        treeCollisionNormal.subVectors(ballCollisionSample, treeClosestPoint);
        if (treeCollisionNormal.lengthSq() < .0001) treeCollisionNormal.set(-ballVelocity.x, 0, -ballVelocity.z);
        treeCollisionNormal.normalize();
        ball.position.copy(treeClosestPoint).addScaledVector(treeCollisionNormal, trunkRadius + .025);
        resolveTreeCollision(treeCollisionNormal, .58, .72);
        return true;
      }

      const canopyDistance = ballCollisionSample.distanceTo(treeCrownCenter);
      if (canopyDistance < canopyRadius) {
        treeCollisionNormal.subVectors(ballCollisionSample, treeCrownCenter);
        if (treeCollisionNormal.lengthSq() < .0001) treeCollisionNormal.set(-ballVelocity.x, 0, -ballVelocity.z);
        treeCollisionNormal.normalize();
        ball.position.copy(treeCrownCenter).addScaledVector(treeCollisionNormal, canopyRadius + .025);
        resolveTreeCollision(treeCollisionNormal, .34, .62);
        return true;
      }
    }
  }
  return false;
}

function sweepBallAgainstTerrain(previousPosition) {
  const endGround = terrainHeightAt(ball.position.x, ball.position.z);
  const previousLateral = Math.abs(previousPosition.x - LANE_CENTER_X);
  const endLateral = Math.abs(ball.position.x - LANE_CENTER_X);
  if (Math.max(previousLateral, endLateral) <= 29) {
    return ball.position.y <= endGround + .12 ? endGround : null;
  }

  // Raised OOB scenery can be narrower than one high-speed physics step.
  // Sweep the travelled segment so the ball cannot enter and leave a hill or
  // steep berm between endpoint-only terrain checks.
  ballCollisionEnd.copy(ball.position);
  const travelDistance = previousPosition.distanceTo(ballCollisionEnd);
  const samples = THREE.MathUtils.clamp(Math.ceil(travelDistance / .32), 1, 12);
  for (let sample = 1; sample <= samples; sample += 1) {
    ballCollisionSample.lerpVectors(previousPosition, ballCollisionEnd, sample / samples);
    const groundHeight = terrainHeightAt(ballCollisionSample.x, ballCollisionSample.z);
    if (ballCollisionSample.y > groundHeight + .12) continue;
    ball.position.set(ballCollisionSample.x, groundHeight + .12, ballCollisionSample.z);
    return groundHeight;
  }
  return null;
}

function liftFlightCameraAboveObstacles(cameraPosition, trackedBall, outOfBoundsFollow) {
  if (outOfBoundsFollow < .04) return 0;
  let sightX = trackedBall.x - cameraPosition.x;
  let sightZ = trackedBall.z - cameraPosition.z;
  let sightLengthSquared = sightX * sightX + sightZ * sightZ;
  if (sightLengthSquared < .01) return 0;
  const missSide = trackedBall.x < LANE_CENTER_X ? -1 : 1;
  let corridorPenetration = 0;

  // First change the viewing angle laterally. Looking around a canopy is less
  // disruptive than lifting the camera high enough to look over its centre.
  for (const palm of palms) {
    const progress = THREE.MathUtils.clamp(
      ((palm.position.x - cameraPosition.x) * sightX + (palm.position.z - cameraPosition.z) * sightZ) / sightLengthSquared,
      0,
      1,
    );
    if (progress <= .03 || progress >= .94) continue;
    const sightPointX = cameraPosition.x + sightX * progress;
    const sightPointZ = cameraPosition.z + sightZ * progress;
    const canopyRadius = 3.15 * palm.scale.x + .65;
    const horizontalDistance = Math.hypot(palm.position.x - sightPointX, palm.position.z - sightPointZ);
    corridorPenetration = Math.max(corridorPenetration, canopyRadius - horizontalDistance);
  }
  const lateralDodge = THREE.MathUtils.clamp(corridorPenetration * 4.5, 0, 18) * outOfBoundsFollow;
  cameraPosition.x -= missSide * lateralDodge;
  sightX = trackedBall.x - cameraPosition.x;
  sightZ = trackedBall.z - cameraPosition.z;
  sightLengthSquared = sightX * sightX + sightZ * sightZ;
  let requiredLift = 0;

  const requiredCameraLift = (obstacleTop, progress) => {
    if (progress <= .03 || progress >= .94) return;
    const sightY = THREE.MathUtils.lerp(cameraPosition.y, trackedBall.y, progress);
    if (obstacleTop <= sightY) return;
    requiredLift = Math.max(requiredLift, (obstacleTop - sightY) / (1 - progress));
  };

  // Check only palms close to the horizontal camera-to-ball corridor. This
  // avoids per-frame work across the complete tree population on normal shots.
  for (const palm of palms) {
    const progress = THREE.MathUtils.clamp(
      ((palm.position.x - cameraPosition.x) * sightX + (palm.position.z - cameraPosition.z) * sightZ) / sightLengthSquared,
      0,
      1,
    );
    if (progress <= .03 || progress >= .94) continue;
    const sightPointX = cameraPosition.x + sightX * progress;
    const sightPointZ = cameraPosition.z + sightZ * progress;
    const canopyRadius = 3.15 * palm.scale.x + .65;
    const horizontalDistance = Math.hypot(palm.position.x - sightPointX, palm.position.z - sightPointZ);
    if (horizontalDistance >= canopyRadius) continue;
    const crown = palm.userData.crown;
    if (!crown) continue;
    crown.getWorldPosition(cameraObstacleCentre);
    const canopyTop = cameraObstacleCentre.y
      + Math.sqrt(Math.max(0, canopyRadius * canopyRadius - horizontalDistance * horizontalDistance))
      + .55;
    requiredCameraLift(canopyTop, progress);
  }

  // The rendered berm and collision terrain share terrainHeightAt(). Sampling
  // the sightline keeps an intervening ridge from filling the severe-miss view.
  for (let sample = 1; sample < 8; sample += 1) {
    const progress = sample / 8;
    const sampleX = cameraPosition.x + sightX * progress;
    const sampleZ = cameraPosition.z + sightZ * progress;
    requiredCameraLift(terrainHeightAt(sampleX, sampleZ) + 1.15, progress);
  }

  const appliedLift = THREE.MathUtils.clamp(requiredLift, 0, 9) * outOfBoundsFollow;
  cameraPosition.y += appliedLift;
  return { lift: appliedLift, dodge: lateralDodge };
}

function updateFlight(delta) {
  const step = Math.min(delta, .034);
  game.shotTime += step;
  if (modelReady && game.followThroughTime < .9) {
    game.followThroughTime += step;
    const follow = Math.min(1, game.followThroughTime / .75);
    setSwingTime(THREE.MathUtils.lerp(SWING_TIMING.impactClipTime, SWING_TIMING.finishClipTime, 1 - Math.pow(1 - follow, 3)));
  }
  const isAirborne = !game.landed;

  if (isAirborne) {
    // Crosswind should be readable in flight without cancelling a severe hook
    // or slice caused by timing and gear effect. Longitudinal wind remains
    // deliberately milder so distance does not become wind-lottery driven.
    const windRisk = 1 + game.speedRisk * .25;
    const windAccel = game.windX * game.windMph * .06 * windRisk;
    const windLongitudinalAccel = game.windZ * game.windMph * .065 * windRisk;
    const airspeedFactor = Math.pow(THREE.MathUtils.clamp(Math.abs(ballVelocity.z) / 65, .2, 1), 1.25);
    const curveBuild = THREE.MathUtils.smoothstep(game.shotTime, .18, 1.25);
    const curveFade = 1 - THREE.MathUtils.smoothstep(game.shotTime, 3.2, 5.4 + game.speedRisk * 1.2);
    const curveProfile = (.12 + curveBuild * .88) * curveFade;
    ballVelocity.x += windAccel * step;
    if (game.spinFlightActive) {
      game.curveVelocity = THREE.MathUtils.clamp(
        game.curveVelocity + game.curveAccel * airspeedFactor * curveProfile * step,
        -game.maxCurveSpeed,
        game.maxCurveSpeed,
      );
    }
    ballVelocity.z += windLongitudinalAccel * step;
    ballVelocity.y -= 9.25 * step;
    // A compact arcade approximation of aerodynamic drag. This keeps strong
    // drives in a recognizable long-drive range without a full physics engine.
    const speedDrag = THREE.MathUtils.clamp((Math.hypot(ballVelocity.x, ballVelocity.z) - 72) / 32, 0, 1);
    const drag = Math.pow(.99765 - game.speedRisk * .0007 - speedDrag * .00025, step * 60);
    ballVelocity.x *= drag;
    ballVelocity.z *= drag;
    ballPreviousPosition.copy(ball.position);
    ball.position.x += (ballVelocity.x + game.curveVelocity) * step;
    ball.position.y += ballVelocity.y * step;
    ball.position.z += ballVelocity.z * step;
    collideBallWithPalms(ballPreviousPosition, step);
    const sweptGroundHeight = sweepBallAgainstTerrain(ballPreviousPosition);
    extendShotTracer();
    game.maxHeight = Math.max(game.maxHeight, ball.position.y);

    const groundHeight = sweptGroundHeight ?? terrainHeightAt(ball.position.x, ball.position.z);
    if (sweptGroundHeight !== null || ball.position.y <= groundHeight + .12) {
      ball.position.y = groundHeight + .12;
      if (!game.firstBounceEffectPlayed) {
        game.firstBounceEffectPlayed = true;
        spawnTurfBurst(ball.position, 34, true);
        firstBounceMark.position.set(ball.position.x, groundHeight + .035, ball.position.z);
        const markScale = THREE.MathUtils.clamp(Math.abs(ballVelocity.y) / 9, .72, 1.28);
        firstBounceMark.scale.set(markScale, markScale * .62, markScale);
        firstBounceMark.visible = true;
      }
      if (game.spinFlightActive) {
        ballVelocity.x += game.curveVelocity;
        game.curveVelocity = 0;
        game.spinFlightActive = false;
      }
      game.carryMetres = Math.hypot(ball.position.z, ball.position.x - BALL_START_X);
      if (ballVelocity.y < -2.8 && game.shotTime < 12) {
        extendShotTracer(true);
        ballVelocity.y *= -.26;
        ballVelocity.x *= .76;
        ballVelocity.z *= .76;
        tone(90, .11, 'sine', .075);
      } else {
        extendShotTracer(true);
        tracerComplete = true;
        game.landed = true;
        game.rolling = true;
        ballVelocity.y = 0;
        tone(72, .16, 'sine', .07);
      }
    }
  } else if (game.rolling) {
    const horizontalSpeed = Math.hypot(ballVelocity.x, ballVelocity.z);
    if (horizontalSpeed > .08) {
      const friction = Math.min(horizontalSpeed, 6.3 * step);
      ballVelocity.x -= (ballVelocity.x / horizontalSpeed) * friction;
      ballVelocity.z -= (ballVelocity.z / horizontalSpeed) * friction;
      ballPreviousPosition.copy(ball.position);
      ball.position.addScaledVector(ballVelocity, step);
      collideBallWithPalms(ballPreviousPosition, step);
      ball.position.y = terrainHeightAt(ball.position.x, ball.position.z) + .12;
      ball.rotation.x += -ballVelocity.z * step * 4;
    } else {
      game.rolling = false;
      setTimeout(finishShot, 450);
    }
  }

  if (lastFlightHudTime < 0 || game.shotTime - lastFlightHudTime >= .08 || game.landed) {
    const yards = Math.max(0, Math.hypot(ball.position.z, ball.position.x - BALL_START_X) * 1.09361);
    $('#flight-distance').textContent = Math.round(yards);
    lastFlightHudTime = game.shotTime;
  }
  updateBoundaryDrama();

  // Keep one consistent follow distance for the entire shot. Descent changes
  // only the camera height and look-ahead, avoiding a late pullback.
  const descending = ballVelocity.y < 0
    ? THREE.MathUtils.clamp((9 - ball.position.y) / 9, 0, 1) * THREE.MathUtils.clamp(-ballVelocity.y / 7, 0, 1)
    : 0;
  const groundBlend = game.landed ? 1 : descending;
  const cameraGroundHeight = terrainHeightAt(ball.position.x, ball.position.z);
  const { side, marginMetres, boundaryX } = boundaryMetrics();
  const lateralTravel = Math.abs(ball.position.x - LANE_CENTER_X);
  const outOfBoundsFollow = THREE.MathUtils.smoothstep(lateralTravel, 22, 45);
  const lineWatch = (1 - THREE.MathUtils.smoothstep(Math.abs(marginMetres), 0, 10)) * groundBlend;
  const cameraHeight = THREE.MathUtils.lerp(4.8, 6, groundBlend) + lineWatch * 1.35 + outOfBoundsFollow * 3.15;
  const lookAhead = THREE.MathUtils.lerp(13, 9, groundBlend);
  // Follow most, but not all, of the lateral travel so crosswind drift remains
  // visible against the grid instead of being completely recentered.
  // Normal drives retain the offset that makes wind and shot shape readable.
  // Beyond the legal corridor, progressively recenter so a severe hook or
  // slice cannot leave the narrower mobile camera frustum before landing.
  const cameraLateralFollow = THREE.MathUtils.lerp(.55, .78, outOfBoundsFollow);
  const targetLateralFollow = THREE.MathUtils.lerp(.8, 1, outOfBoundsFollow);
  const lineAndBallMidpoint = (ball.position.x + boundaryX) * .5;
  // Stay on the range side of the boundary instead of driving the camera
  // through the dense OOB palm row. The diagonal view still shows how far the
  // miss travelled while retaining a clean sightline to the ball.
  const boundaryCameraX = boundaryX - side * 7.5;
  const partiallyFollowedBallX = LANE_CENTER_X + (ball.position.x - LANE_CENTER_X) * cameraLateralFollow;
  const desiredCameraX = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(partiallyFollowedBallX, lineAndBallMidpoint, lineWatch * .32),
    boundaryCameraX,
    outOfBoundsFollow * .82,
  );
  const desiredCameraZ = ball.position.z + 20 + outOfBoundsFollow * 10;
  const followCameraGround = terrainHeightAt(desiredCameraX, desiredCameraZ);
  desiredCameraPosition.set(
    desiredCameraX,
    Math.max(ball.position.y + cameraHeight, followCameraGround + 3.2),
    desiredCameraZ,
  );
  const baseTargetX = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(ball.position.x * targetLateralFollow, lineAndBallMidpoint, lineWatch * .48),
      lineAndBallMidpoint,
      outOfBoundsFollow * .78,
    );
  desiredCameraTarget.set(
    THREE.MathUtils.lerp(baseTargetX, ball.position.x, outOfBoundsFollow * .28),
    THREE.MathUtils.lerp(Math.max(cameraGroundHeight + .45, ball.position.y - .2), cameraGroundHeight + .25, groundBlend),
    ball.position.z - THREE.MathUtils.lerp(lookAhead, 4.5, outOfBoundsFollow),
  );
  liftFlightCameraAboveObstacles(desiredCameraPosition, ball.position, outOfBoundsFollow);

  const transition = THREE.MathUtils.clamp(
    (game.shotTime - SWING_TIMING.flightCameraHold) / SWING_TIMING.flightCameraBlend,
    0,
    1,
  );
  const transitionEase = transition * transition * (3 - 2 * transition);
  if (transition < 1) {
    // Preserve the impact and early follow-through before joining the ball.
    camera.position.copy(launchCameraPosition).lerp(desiredCameraPosition, transitionEase);
    cameraTarget.copy(launchCameraTarget).lerp(desiredCameraTarget, transitionEase);
  } else {
    const cameraEase = 1 - Math.pow(.008, step);
    camera.position.lerp(desiredCameraPosition, cameraEase);
    cameraTarget.lerp(desiredCameraTarget, cameraEase);
  }
  camera.lookAt(cameraTarget);
  // Preserve a readable on-screen ball without changing its physical radius.
  // The severe-miss camera sits farther back to retain boundary context, so a
  // restrained distance-based presentation scale prevents the ball becoming a
  // one-pixel speck on portrait screens.
  const ballCameraDistance = camera.position.distanceTo(ball.position);
  const ballReadability = THREE.MathUtils.smoothstep(ballCameraDistance, 16, 46);
  ball.scale.setScalar(THREE.MathUtils.lerp(1, 1.75, ballReadability) + outOfBoundsFollow * .45);
  ballVisibilityMaterial.opacity = outOfBoundsFollow * (game.landed ? .34 : .58);

  if (game.shotTime > 18 || ball.position.z < -525) finishShot();
}

function resize() {
  const width = sceneWrap.clientWidth;
  const height = sceneWrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  refreshMeterAnimation();
}

function animate() {
  const diagnosticsFrameStart = diagnosticsMode ? performance.now() : 0;
  const rawDelta = clock.getDelta();
  const delta = Math.min(rawDelta, .05);
  const scenePaused = ['result', 'level-reveal', 'driver-reveal', 'rank-reveal', 'round-summary'].includes(game.state);
  let diagnosticsMark = diagnosticsFrameStart;
  if (!scenePaused) updateEnvironment(delta);
  const environmentDone = diagnosticsMode ? performance.now() : 0;
  // Meter timing is an input contract, so it must remain tied to real elapsed
  // time even when rendering falls below 20 fps. Physics and presentation keep
  // the capped delta above to prevent a long frame from destabilizing motion.
  if (game.state === 'power' || game.state === 'accuracy') updateMeters();
  if (game.state === 'striking') updateStrike(delta);
  if (game.state === 'flight') updateFlight(delta);
  const gameplayDone = diagnosticsMode ? performance.now() : 0;
  const golferIsVisible = game.state !== 'flight' || game.shotTime <= 1.6;
  if (!scenePaused && golferIsVisible) {
    updateDriverAppearance();
    updateDriver();
    updateGolferHeadwear();
  }
  const golferDone = diagnosticsMode ? performance.now() : 0;
  if (!scenePaused) renderer.render(scene, camera);
  if (diagnosticsMode) {
    const renderDone = performance.now();
    recordPerformanceDiagnostics(rawDelta * 1000, game.state, {
      environment: environmentDone - diagnosticsMark,
      gameplay: gameplayDone - environmentDone,
      golfer: golferDone - gameplayDone,
      render: renderDone - golferDone,
    });
  }
  requestAnimationFrame(animate);
}

startButton.addEventListener('click', () => {
  if (startButton.dataset.loadError) window.location.reload();
  else if (modelReady) {
    prepareAudio();
    startRound();
  }
});
$('#again-button').addEventListener('click', () => {
  if (game.roundShot >= 6) showPostRoundFlow();
  else beginSwing();
});
$('#level-reveal-button').addEventListener('click', () => { game.pendingLevelUp = null; showPostRoundFlow(); });
$('#driver-reveal-button').addEventListener('click', () => { game.pendingDriverUnlock = null; showPostRoundFlow(); });
$('#rank-reveal-button').addEventListener('click', () => { game.pendingPromotion = null; showPostRoundFlow(); });
$('#new-round-button').addEventListener('click', startRound);
$('#round-menu-button').addEventListener('click', showMainMenu);
const resetDialog = $('#reset-dialog');
$('#reset-progress-button').addEventListener('click', () => resetDialog.showModal());
$('#confirm-reset-button').addEventListener('click', () => {
  [
    'everelms-sloppy-golf-best',
    'everelms-sloppy-golf-xp',
    'everelms-sloppy-golf-rank',
    'everelms-sloppy-golf-rounds',
    'everelms-sloppy-golf-total-rounds',
    'everelms-sloppy-golf-competition-driver',
  ].forEach((key) => localStorage.removeItem(key));
  window.location.reload();
});
$('#sound-button').addEventListener('click', () => {
  game.sound = !game.sound;
  localStorage.setItem('everelms-long-drive-sound', game.sound ? 'on' : 'off');
  updatePersistentHud();
  if (game.sound) {
    setMasterSoundEnabled(true);
    prepareAudio();
    tone(440);
    if (game.state === 'power') startMeterCharge(currentMeterDifficulty().powerSeconds);
  } else {
    stopMeterCharge();
    setMasterSoundEnabled(false);
    stopBackgroundMusic();
  }
});
sceneWrap.addEventListener('pointerdown', (event) => {
  prepareAudio();
  handleAction(event);
});
window.addEventListener('keydown', (event) => {
  if (!['Space', 'Enter'].includes(event.code)) return;
  event.preventDefault();
  prepareAudio();
  if (game.state === 'ready' && modelReady) startRound();
  else if (game.state === 'power') lockPower();
  else if (game.state === 'accuracy') strikeBall();
  else if (game.state === 'result') game.roundShot >= 6 ? showPostRoundFlow() : beginSwing();
  else if (game.state === 'level-reveal') { game.pendingLevelUp = null; showPostRoundFlow(); }
  else if (game.state === 'driver-reveal') { game.pendingDriverUnlock = null; showPostRoundFlow(); }
  else if (game.state === 'rank-reveal') { game.pendingPromotion = null; showPostRoundFlow(); }
  else if (game.state === 'round-summary') startRound();
});
window.addEventListener('resize', resize);

if (['Steady', 'Long', 'Competition'].includes(driverUnlockPreview)) {
  game.pendingDriverUnlock = driverUnlockPreview;
  requestAnimationFrame(showPostRoundFlow);
} else if (rewardPreview === 'level') {
  game.roundLevelStart = 2;
  game.pendingLevelUp = 3;
  requestAnimationFrame(showPostRoundFlow);
} else if (rewardPreview === 'rank') {
  game.pendingPromotion = 'Amateur';
  requestAnimationFrame(showPostRoundFlow);
} else if (rewardPreview === 'sequence') {
  game.roundLevelStart = 2;
  game.pendingLevelUp = 3;
  game.pendingDriverUnlock = 'Steady';
  game.pendingPromotion = 'Amateur';
  requestAnimationFrame(showPostRoundFlow);
} else if (roundPreview === 'sample' || roundPreview === 'oob') {
  const allOutOfBoundsPreview = roundPreview === 'oob';
  game.roundResults = allOutOfBoundsPreview
    ? Array.from({ length: 6 }, (_, index) => ({ distance: 374 + index * 7, valid: false }))
    : [
      { distance: 412, valid: true },
      { distance: 405, valid: true },
      { distance: 381, valid: true },
      { distance: 426, valid: false },
      { distance: 417, valid: true },
      { distance: 399, valid: true },
    ];
  game.lastXpBreakdown = { roundAverage: allOutOfBoundsPreview ? 0 : 336 };
  game.roundXpStart = game.xp - (allOutOfBoundsPreview ? 20 : 76);
  requestAnimationFrame(showRoundSummary);
}

if (game.rankIndex < 0 || game.rankIndex >= ranks.length) {
  game.rankIndex = 0;
  ranks.forEach((rank, index) => { if (game.best >= rank.min) game.rankIndex = index; });
  saveProgression();
}
updatePersistentHud();
setWind();
resetBallAndCamera();
resize();
animate();
