let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function blip(freq: number, duration: number, type: OscillatorType = 'square', gain = 0.03) {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume();
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(audio.destination);
  const now = audio.currentTime;
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

export function playSound(kind: 'click' | 'error' | 'win') {
  if (kind === 'click') blip(880, 0.03, 'square', 0.02);
  if (kind === 'error') blip(180, 0.15, 'sawtooth', 0.04);
  if (kind === 'win') {
    blip(523, 0.08);
    setTimeout(() => blip(659, 0.1), 90);
    setTimeout(() => blip(784, 0.14), 190);
  }
}
