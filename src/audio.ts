export type BgmScene = "play" | "result";
export type SoundEffect = "start" | "stop" | "high" | "fail" | "complete";

const SILENCE = 0.0001;
const PLAY_TEMPOS = [126, 134, 142, 150, 158] as const;

const PLAY_MELODY: ReadonlyArray<number | null> = [
  72, null, 76, null, 79, 76, 74, null,
  72, null, 76, 79, 81, null, 79, null,
];

const PLAY_BASS: ReadonlyArray<number | null> = [
  48, null, null, null, 55, null, null, null,
  53, null, null, null, 55, null, 50, null,
];

const RESULT_MELODY: ReadonlyArray<number | null> = [
  67, null, 71, null, 74, null, 71, null,
  69, null, 72, null, 76, null, 74, null,
];

const RESULT_BASS: ReadonlyArray<number | null> = [
  43, null, null, null, 50, null, null, null,
  45, null, null, null, 50, null, null, null,
];

const EFFECT_FREQUENCIES: Record<SoundEffect, number[]> = {
  start: [440, 660],
  stop: [280],
  high: [660, 880, 1_080],
  fail: [180, 120],
  complete: [440, 660, 880, 1_120],
};

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function bgmTempo(scene: BgmScene, round = 1): number {
  if (scene === "result") return 96;
  const roundIndex = Math.min(PLAY_TEMPOS.length - 1, Math.max(0, Math.round(round) - 1));
  return PLAY_TEMPOS[roundIndex];
}

export class GameAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private schedulerId: number | null = null;
  private scene: BgmScene | null = null;
  private round = 1;
  private step = 0;
  private nextStepAt = 0;
  private enabled: boolean;
  private pageVisible = true;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  get contextState(): AudioContextState | "unavailable" {
    return this.context?.state ?? "unavailable";
  }

  get isBgmActive(): boolean {
    return this.schedulerId !== null && this.scene !== null && this.enabled && this.pageVisible;
  }

  async unlock(): Promise<void> {
    if (!this.enabled || !this.pageVisible) return;
    this.ensureGraph();
    if (!this.context) return;
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return;
      }
    }
    this.applyMasterVolume();
    this.restartBgm();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyMasterVolume();
    if (!enabled) {
      this.stopBgm();
      return;
    }
    this.restartBgm();
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
    this.applyMasterVolume();
    if (!visible) {
      this.stopBgm();
      return;
    }
    void this.unlock();
  }

  setScene(scene: BgmScene | null, round = 1): void {
    const normalizedRound = Math.min(5, Math.max(1, Math.round(round)));
    if (this.scene === scene && this.round === normalizedRound) return;
    this.scene = scene;
    this.round = normalizedRound;
    this.restartBgm();
  }

  playEffect(effect: SoundEffect): void {
    if (!this.enabled || !this.pageVisible || !this.context || !this.sfxGain) return;
    const startAt = this.context.currentTime;
    EFFECT_FREQUENCIES[effect].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const noteAt = startAt + index * 0.09;
      oscillator.type = effect === "fail" ? "sawtooth" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(SILENCE, noteAt);
      gain.gain.exponentialRampToValueAtTime(0.13, noteAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(SILENCE, noteAt + 0.12);
      oscillator.connect(gain).connect(this.sfxGain!);
      oscillator.start(noteAt);
      oscillator.stop(noteAt + 0.14);
    });
  }

  private ensureGraph(): void {
    if (this.context) return;
    try {
      const AudioContextConstructor =
        globalThis.AudioContext
        ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      this.context = new AudioContextConstructor();
      this.masterGain = this.context.createGain();
      this.bgmGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      this.masterGain.gain.value = SILENCE;
      this.bgmGain.gain.value = SILENCE;
      this.sfxGain.gain.value = 0.82;
      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(compressor);
      compressor.connect(this.context.destination);
      this.applyMasterVolume();
    } catch {
      this.context = null;
      this.masterGain = null;
      this.bgmGain = null;
      this.sfxGain = null;
    }
  }

  private applyMasterVolume(): void {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const target = this.enabled && this.pageVisible ? 0.72 : SILENCE;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(SILENCE, this.masterGain.gain.value), now);
    this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.08);
  }

  private restartBgm(): void {
    this.clearScheduler();
    if (!this.context || !this.bgmGain || !this.scene || !this.enabled || !this.pageVisible) {
      this.fadeBgmTo(SILENCE, 0.08);
      return;
    }
    const now = this.context.currentTime;
    const targetVolume = this.scene === "play" ? 0.24 : 0.2;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.setValueAtTime(Math.max(SILENCE, this.bgmGain.gain.value), now);
    this.bgmGain.gain.exponentialRampToValueAtTime(targetVolume, now + 0.22);
    this.step = 0;
    this.nextStepAt = now + 0.04;
    this.scheduleWindow();
    this.schedulerId = window.setInterval(() => this.scheduleWindow(), 50);
  }

  private stopBgm(): void {
    this.clearScheduler();
    this.fadeBgmTo(SILENCE, 0.08);
  }

  private clearScheduler(): void {
    if (this.schedulerId === null) return;
    window.clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  private fadeBgmTo(target: number, duration: number): void {
    if (!this.context || !this.bgmGain) return;
    const now = this.context.currentTime;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.setValueAtTime(Math.max(SILENCE, this.bgmGain.gain.value), now);
    this.bgmGain.gain.exponentialRampToValueAtTime(Math.max(SILENCE, target), now + duration);
  }

  private scheduleWindow(): void {
    if (!this.context || !this.scene || !this.bgmGain) return;
    const stepDuration = 60 / bgmTempo(this.scene, this.round) / 2;
    const horizon = this.context.currentTime + 0.14;
    while (this.nextStepAt < horizon) {
      this.scheduleStep(this.nextStepAt, stepDuration);
      this.nextStepAt += stepDuration;
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(when: number, stepDuration: number): void {
    if (!this.scene || !this.bgmGain) return;
    const melody = this.scene === "play" ? PLAY_MELODY : RESULT_MELODY;
    const bass = this.scene === "play" ? PLAY_BASS : RESULT_BASS;
    const transpose = this.scene === "play" && this.round >= 4 ? 2 : 0;
    const melodyNote = melody[this.step];
    const bassNote = bass[this.step];

    if (melodyNote !== null) {
      this.scheduleTone(melodyNote + transpose, when, stepDuration * 0.78, 0.075, "triangle");
    }
    if (bassNote !== null) {
      this.scheduleTone(bassNote, when, stepDuration * 0.92, 0.045, "sine");
    }
    if (this.scene === "play" && this.step % 4 === 0) {
      this.schedulePulse(when, stepDuration * 0.45);
    }
  }

  private scheduleTone(
    midi: number,
    when: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    if (!this.context || !this.bgmGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(SILENCE, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(SILENCE, when + duration);
    oscillator.connect(gain).connect(this.bgmGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  private schedulePulse(when: number, duration: number): void {
    if (!this.context || !this.bgmGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(105, when);
    oscillator.frequency.exponentialRampToValueAtTime(54, when + duration);
    gain.gain.setValueAtTime(0.038, when);
    gain.gain.exponentialRampToValueAtTime(SILENCE, when + duration);
    oscillator.connect(gain).connect(this.bgmGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }
}
