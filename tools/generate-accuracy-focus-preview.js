const fs = require('fs');
const path = require('path');

const sampleRate = 48000;
const duration = .062;
const frames = Math.ceil(sampleRate * duration);
const channels = 2;
const samples = [new Float64Array(frames), new Float64Array(frames)];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

for (let frame = 0; frame < frames; frame += 1) {
  const time = frame / sampleRate;
  const progress = time / duration;
  const window = Math.pow(Math.sin(Math.PI * progress), 1.35);
  const frequency = 690 + progress * 170;
  const phase = Math.PI * 2 * (690 * time + .5 * 170 / duration * time * time);
  const signal = (
    Math.sin(phase)
    + Math.sin(phase * 2 + .16) * .065
  ) * window * .24;
  samples[0][frame] = signal;
  samples[1][frame] = signal;
}

let peak = 0;
for (const channel of samples) {
  for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
}
const gain = .88 / Math.max(peak, .001);
const byteLength = 44 + frames * channels * 2;
const wave = Buffer.alloc(byteLength);
wave.write('RIFF', 0);
wave.writeUInt32LE(byteLength - 8, 4);
wave.write('WAVE', 8);
wave.write('fmt ', 12);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(channels, 22);
wave.writeUInt32LE(sampleRate, 24);
wave.writeUInt32LE(sampleRate * channels * 2, 28);
wave.writeUInt16LE(channels * 2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(frames * channels * 2, 40);

let offset = 44;
for (let frame = 0; frame < frames; frame += 1) {
  for (let channel = 0; channel < channels; channel += 1) {
    const sample = clamp(samples[channel][frame] * gain, -1, 1);
    wave.writeInt16LE(Math.round(sample * (sample < 0 ? 32768 : 32767)), offset);
    offset += 2;
  }
}

const output = path.resolve(__dirname, '..', 'sloppy-golf', 'media', 'audio', 'previews', 'accuracy-center-ping-preview.wav');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, wave);
console.log(output);
