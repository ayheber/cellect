let _ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(freq: number, type: OscillatorType, dur: number, vol = 0.22, delay = 0) {
  try {
    const a = ac();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.connect(gain);
    gain.connect(a.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = a.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}

export const sound = {
  perfect()  {
    tone(880,  'sine', 0.10, 0.22);
    tone(1320, 'sine', 0.08, 0.14, 0.07);
  },
  close()    { tone(600, 'sine', 0.07, 0.12); },
  wrong()    { tone(260, 'square', 0.12, 0.14); },
  lifeLoss() {
    tone(330, 'square', 0.06, 0.28);
    tone(220, 'square', 0.12, 0.28, 0.07);
    tone(165, 'square', 0.22, 0.28, 0.15);
  },
  combo(n: number) {
    const f = 440 * Math.pow(1.059, Math.min(n - 4, 14));
    tone(f,       'sine', 0.08, 0.22);
    tone(f * 1.5, 'sine', 0.06, 0.14, 0.06);
  },
  spinup() {
    tone(440, 'sine', 0.04, 0.16);
    tone(880, 'sine', 0.09, 0.20, 0.04);
  },
  newBest() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', 0.14, 0.26, i * 0.11));
  },
};
