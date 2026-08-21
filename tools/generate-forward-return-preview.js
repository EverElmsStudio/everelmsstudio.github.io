const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'sloppy-golf', 'media', 'audio', 'previews', 'charge-up-glass-clean-preview.wav');
const outputPath = path.resolve(__dirname, '..', 'sloppy-golf', 'media', 'audio', 'previews', 'charge-up-glass-clean-forward-return-preview.wav');
const source = fs.readFileSync(sourcePath);

if (source.toString('ascii', 0, 4) !== 'RIFF' || source.toString('ascii', 8, 12) !== 'WAVE') {
  throw new Error('Expected a RIFF/WAVE source file.');
}

const channels = source.readUInt16LE(22);
const sampleRate = source.readUInt32LE(24);
const bitsPerSample = source.readUInt16LE(34);
const bytesPerFrame = channels * bitsPerSample / 8;
const dataBytes = source.readUInt32LE(40);
const sourceFrames = dataBytes / bytesPerFrame;
const pauseFrames = Math.round(sampleRate * .2);
const outputFrames = sourceFrames * 2 + pauseFrames;
const outputBytes = outputFrames * bytesPerFrame;
const wave = Buffer.alloc(44 + outputBytes);

source.copy(wave, 0, 0, 44);
wave.writeUInt32LE(36 + outputBytes, 4);
wave.writeUInt32LE(outputBytes, 40);
source.copy(wave, 44, 44, 44 + dataBytes);

const returnOffset = 44 + (sourceFrames + pauseFrames) * bytesPerFrame;
for (let frame = 0; frame < sourceFrames; frame += 1) {
  const sourceOffset = 44 + (sourceFrames - frame - 1) * bytesPerFrame;
  source.copy(wave, returnOffset + frame * bytesPerFrame, sourceOffset, sourceOffset + bytesPerFrame);
}

fs.writeFileSync(outputPath, wave);
console.log(outputPath);
