const fs = require('fs');
const path = require('path');

const sampleRate = 48000;
const duration = .72;
const frames = Math.ceil(sampleRate * duration);
const channels = 2;
const samples = [new Float64Array(frames), new Float64Array(frames)];

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = (value) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

const pulseTimes = [];
let nextPulse = .018;
while (nextPulse < .69) {
  pulseTimes.push(nextPulse);
  const progress = nextPulse / .69;
  const interval = .145 - Math.pow(progress, .68) * .108;
  nextPulse += interval;
}

for (let frame = 0; frame < frames; frame += 1) {
  const time = frame / sampleRate;
  let pulseSignal = 0;
  pulseTimes.forEach((pulseTime, index) => {
    const age = time - pulseTime;
    const progress = index / Math.max(1, pulseTimes.length - 1);
    const pulseDuration = .052 - progress * .016;
    if (age < 0 || age >= pulseDuration) return;
    const window = Math.pow(Math.sin(Math.PI * age / pulseDuration), 1.25 + progress * .55);
    const frequency = 355 + progress * 545;
    const localSweep = frequency * .12 / pulseDuration;
    const pulsePhase = Math.PI * 2 * (frequency * age + .5 * localSweep * age * age);
    const tone = Math.sin(pulsePhase)
      + Math.sin(pulsePhase * 2 + .15) * (.025 + progress * .105)
      + Math.sin(pulsePhase * 3 + .32) * (progress * .028);
    pulseSignal += tone * window * (.19 + progress * .045);
  });

  samples[0][frame] = pulseSignal;
  samples[1][frame] = pulseSignal;
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

const output = path.resolve(__dirname, '..', 'sloppy-golf', 'media', 'audio', 'previews', 'charge-up-accelerating-pulses-brightening-preview.wav');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, wave);
console.log(output);
