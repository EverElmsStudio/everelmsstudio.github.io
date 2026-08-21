import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, '_site');

// This is deliberately an allowlist. Development models, source textures,
// diagnostics, tests, and audio experiments stay in the repository but never
// enter the public GitHub Pages artifact.
const publicFiles = [
  'CNAME',
  'index.html',
  'prototype.css',
  'prototype.js',
  'chord-arranger.html',
  'chordStyle.css',
  'chordApp.js',
  'long-drive.html',
  'sloppy-golf/index.html',
  'sloppy-golf/long-drive.css',
  'sloppy-golf/long-drive.js',
  'sloppy-golf/media/driver-face-reference.png',
  'sloppy-golf/media/golf-club-driver.glb',
  'sloppy-golf/media/golf-drive-runtime-optimized.glb',
  'sloppy-golf/media/audio/accuracy-center-ping.wav',
  'sloppy-golf/media/audio/charge-up-pulses.wav',
  'sloppy-golf/media/audio/driver-impact.mp3',
  'sloppy-golf/media/audio/late-afternoon-transit.mp3',
  'sloppy-golf/media/audio/level-up.mp3',
  'sloppy-golf/media/audio/new-club.mp3',
  'sloppy-golf/media/audio/onehundred.mp3',
  'sloppy-golf/media/audio/out-of-bounds.mp3',
  'sloppy-golf/media/audio/personal_best.mp3',
  'sloppy-golf/media/audio/power-lok.mp3',
  'sloppy-golf/media/audio/rank-up.mp3',
  'sloppy-golf/media/audio/valid-drive.mp3',
  'sloppy-golf/media/branding/everelms-favicon.svg',
  'sloppy-golf/media/branding/everelms-symbol-small.svg',
  'sloppy-golf/media/branding/menu-golf-ball.svg',
  'sloppy-golf/media/branding/sloppy-golf-logo.svg',
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

let totalBytes = 0;
for (const relativePath of publicFiles) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(outputRoot, relativePath);
  const details = await stat(source);
  if (!details.isFile()) {
    throw new Error(`Public release entry is not a file: ${relativePath}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
  totalBytes += details.size;
}

// GitHub Pages should serve these static files exactly as built.
await writeFile(path.join(outputRoot, '.nojekyll'), '');

console.log(`Built ${publicFiles.length} public files (${(totalBytes / 1024 / 1024).toFixed(2)} MB) in _site/.`);
