import type { FoodKitchenAlertLevel } from '@/lib/types';

let audioContext: AudioContext | null = null;

const PATTERNS: Partial<Record<FoodKitchenAlertLevel, Array<[number, number, number]>>> = {
  new: [[740, 0, 0.12], [940, 0.18, 0.12]],
  change: [[980, 0, 0.1], [760, 0.14, 0.1], [980, 0.28, 0.1]],
  unaccepted_warning: [[620, 0, 0.16], [620, 0.24, 0.16], [820, 0.48, 0.2]],
  cashier_escalation: [[420, 0, 0.22], [760, 0.28, 0.22], [420, 0.56, 0.22], [920, 0.84, 0.3]],
  near_limit: [[560, 0, 0.18]],
  late: [[480, 0, 0.2], [480, 0.3, 0.2]],
  critical: [[360, 0, 0.22], [360, 0.3, 0.22], [360, 0.6, 0.22]],
  ready_waiting: [[880, 0, 0.12], [1100, 0.16, 0.12], [880, 0.32, 0.12]],
};

function getContext() {
  if (audioContext) return audioContext;
  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  audioContext = new Context();
  return audioContext;
}

export async function playKitchenAlert(level: FoodKitchenAlertLevel, volume = 0.7) {
  const context = getContext();
  const pattern = PATTERNS[level];
  if (!context || !pattern) return false;
  try {
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return false;
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.22, context.currentTime);
    gain.connect(context.destination);
    pattern.forEach(([frequency, delay, duration]) => {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration);
    });
    return true;
  } catch {
    return false;
  }
}

export async function enableKitchenAudio(volume = 0.7) {
  return playKitchenAlert('new', volume);
}
