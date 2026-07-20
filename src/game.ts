import type { GameMode, GameState, RoundResult } from "./types";

export const TOTAL_ROUNDS = 5;
export const MOVEMENT_PATTERN_COUNT = 100;
export const ROUND_INTRO_DURATION_MS = 2_200;
export const TARGET_POSITION = 0.78;
export const EDGE_START = 0.62;
export const OUT_START = 0.84;

const ROUND_DURATIONS = [4_200, 2_800, 2_400, 2_100, 1_800] as const;
const ROUND_CUES = [
  "まずは動きのクセを見切れ",
  "ここから一気に1.5倍！",
  "後半ほど速くなる",
  "速度の波を見切れ",
  "緩急MAX、最後の一発！",
] as const;
const ROUND_PATTERN_INTENSITY = [0.85, 0.9, 0.95, 1, 1] as const;
const PATTERN_STEPS = [7, 9, 11, 13, 17, 19, 21, 23, 27, 29] as const;
const MAX_NORMALIZED_SPEED = 1.55;
const PATTERN_FAMILIES = [
  { name: "さざ波", speeds: [0.66, 1.34, 0.78, 1.22, 0.72, 1.28, 0.84, 1.16, 0.7, 1.3] },
  { name: "じわ加速", speeds: [0.26, 0.38, 0.52, 0.7, 0.9, 1.1, 1.32, 1.56, 1.82, 2.08] },
  { name: "急ブレーキ", speeds: [2.08, 1.82, 1.56, 1.32, 1.1, 0.9, 0.7, 0.52, 0.38, 0.26] },
  { name: "ストップ＆ゴー", speeds: [1.55, 0.12, 1.45, 0.15, 1.65, 0.1, 1.5, 0.14, 1.7, 0.18] },
  { name: "ダッシュ連打", speeds: [0.25, 2.2, 0.45, 1.9, 0.2, 2.35, 0.55, 1.75, 0.3, 2.1] },
  { name: "階段加速", speeds: [0.4, 0.4, 0.7, 0.7, 1, 1, 1.3, 1.3, 1.65, 1.65] },
  { name: "ためてダッシュ", speeds: [1.1, 0.8, 0.5, 0.12, 0.12, 2.2, 1.9, 1.4, 1, 0.8] },
  { name: "フェイント", speeds: [1.25, 1.05, 1.35, 0.15, 2, 1, 0.12, 1.8, 0.6, 1.4] },
  { name: "パルス", speeds: [1, 0.2, 1.7, 0.25, 1.4, 0.16, 1.9, 0.3, 1.55, 0.2] },
  { name: "カオス", speeds: [0.15, 2.2, 0.35, 1.6, 0.12, 1.9, 0.55, 1.25, 0.2, 1.75] },
] as const;
const SEGMENT_DURATION_SHAPE = [0.72, 1.28, 0.86, 1.16, 0.76, 1.32, 0.9, 1.12, 0.8, 1.08] as const;
const PHASED_FAMILIES = new Set([0, 3, 4, 6, 7, 8, 9]);

function patternSpeeds(family: number, variant: number): readonly number[] {
  const source = PATTERN_FAMILIES[family].speeds;
  const phase = (variant * 3 + family * 2) % source.length;
  const shaped = PHASED_FAMILIES.has(family)
    ? source.map((_, index) => source[(index + phase) % source.length])
    : source;
  const strength = PHASED_FAMILIES.has(family) ? 0.86 + variant * 0.045 : 0.68 + variant * 0.12;

  return Object.freeze(shaped.map((speed, index) => {
    const offset = (((variant + 1) * 31 + (index + 1) * 17 + family * 13) % 9) - 4;
    const emphasized = 1 + (speed - 1) * strength;
    return Math.max(0.08, emphasized * (1 + offset * 0.012));
  }));
}

function patternDurations(variant: number): readonly number[] {
  const phase = (variant * 3) % SEGMENT_DURATION_SHAPE.length;
  const amplitude = 0.72 + (variant % 5) * 0.16;
  const source = variant >= 5 ? [...SEGMENT_DURATION_SHAPE].reverse() : SEGMENT_DURATION_SHAPE;
  return Object.freeze(
    source.map((_, index) => {
      const duration = source[(index + phase) % source.length];
      return 1 + (duration - 1) * amplitude;
    }),
  );
}

export const MOVEMENT_PATTERNS = Object.freeze(
  Array.from({ length: MOVEMENT_PATTERN_COUNT }, (_, id) => ({
    id,
    family: id % PATTERN_FAMILIES.length,
    variant: Math.floor(id / PATTERN_FAMILIES.length),
    name: PATTERN_FAMILIES[id % PATTERN_FAMILIES.length].name,
    durationScale: 0.96 + ((id * 7) % 9) * 0.01,
    speeds: patternSpeeds(id % PATTERN_FAMILIES.length, Math.floor(id / PATTERN_FAMILIES.length)),
    durations: patternDurations(Math.floor(id / PATTERN_FAMILIES.length)),
  })),
);

function normalizedSpeeds(patternIndex: number, round: number): readonly number[] {
  const { speeds, durations } = MOVEMENT_PATTERNS[patternIndex];
  const intensity = ROUND_PATTERN_INTENSITY[round - 1];
  let effectiveSpeeds = speeds.map((speed) => 1 + (speed - 1) * intensity);
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const average = effectiveSpeeds.reduce(
      (total, speed, index) => total + speed * durations[index],
      0,
    ) / totalDuration;
    const limit = average * MAX_NORMALIZED_SPEED;
    effectiveSpeeds = effectiveSpeeds.map((speed) => Math.min(speed, limit));
  }

  const finalAverage = effectiveSpeeds.reduce(
    (total, speed, index) => total + speed * durations[index],
    0,
  ) / totalDuration;
  return Object.freeze(effectiveSpeeds.map((speed) => speed / finalAverage));
}

const NORMALIZED_PATTERN_SPEEDS = Object.freeze(
  MOVEMENT_PATTERNS.map((_, patternIndex) =>
    Object.freeze(
      ROUND_PATTERN_INTENSITY.map((_, roundIndex) => normalizedSpeeds(patternIndex, roundIndex + 1)),
    )),
);

export function createInitialState(): GameState {
  return {
    screen: "start",
    currentRound: 1,
    totalScore: 0,
    results: [],
    mode: "challenge",
    position: 0,
    inputLocked: true,
    seed: Date.now(),
  };
}

export function dailySeed(date = new Date()): number {
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seedForMode(mode: GameMode): number {
  return mode === "daily" ? dailySeed() : Math.floor(Math.random() * 2 ** 31);
}

export function totalRoundsForMode(mode: GameMode): number {
  return mode === "quick" ? 1 : TOTAL_ROUNDS;
}

function seededVariation(seed: number, round: number): number {
  const value = Math.sin(seed * 0.000001 + round * 12.9898) * 43758.5453;
  return 0.94 + (value - Math.floor(value)) * 0.12;
}

function mixSeed(seed: number): number {
  let value = Math.trunc(seed) | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

export function movementPatternIndex(seed: number, round: number): number {
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  const mixed = mixSeed(seed);
  const start = mixed % MOVEMENT_PATTERN_COUNT;
  const step = PATTERN_STEPS[(mixed >>> 8) % PATTERN_STEPS.length];
  return (start + (safeRound - 1) * step) % MOVEMENT_PATTERN_COUNT;
}

export function movementPatternProgress(progress: number, patternIndex: number, round: number): number {
  const value = Math.min(1, Math.max(0, progress));
  if (value === 0 || value === 1) return value;
  const safePatternIndex = ((Math.round(patternIndex) % MOVEMENT_PATTERN_COUNT) + MOVEMENT_PATTERN_COUNT) % MOVEMENT_PATTERN_COUNT;
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  const { durations } = MOVEMENT_PATTERNS[safePatternIndex];
  const speeds = NORMALIZED_PATTERN_SPEEDS[safePatternIndex][safeRound - 1];
  const totalDuration = durations.reduce((total, duration) => total + duration, 0);
  const elapsedDuration = value * totalDuration;
  let coveredDuration = 0;
  let coveredDistance = 0;

  for (let index = 0; index < speeds.length; index += 1) {
    const segmentEnd = coveredDuration + durations[index];
    const activeDuration = Math.min(
      durations[index],
      Math.max(0, elapsedDuration - coveredDuration),
    );
    coveredDistance += speeds[index] * activeDuration;
    coveredDuration = segmentEnd;
    if (elapsedDuration <= segmentEnd) break;
  }

  return Math.min(1, Math.max(0, coveredDistance / totalDuration));
}

export function positionAt(elapsedMs: number, round: number, seed = 1): number {
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  const patternIndex = movementPatternIndex(seed, safeRound);
  const pattern = MOVEMENT_PATTERNS[patternIndex];
  const base = elapsedMs / (ROUND_DURATIONS[safeRound - 1] * seededVariation(seed, safeRound) * pattern.durationScale);
  return movementPatternProgress(base, patternIndex, safeRound);
}

export function roundDifficulty(round: number): { speedMultiplier: number; cue: string } {
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  return {
    speedMultiplier: Math.round((ROUND_DURATIONS[0] / ROUND_DURATIONS[safeRound - 1]) * 10) / 10,
    cue: ROUND_CUES[safeRound - 1],
  };
}

export function zoneForPosition(position: number): RoundResult["zone"] {
  if (position >= OUT_START) return "out";
  if (position >= EDGE_START) return "edge";
  if (position >= 0.38) return "normal";
  return "safe";
}

export function scoreForPosition(position: number): number {
  const value = Math.min(1, Math.max(0, position));
  const errorPercent = Math.abs(value - TARGET_POSITION) * 100;

  if (value >= OUT_START) {
    return Math.max(0, Math.round(9 * (1 - (value - OUT_START) / (1 - OUT_START))));
  }
  if (errorPercent <= 0.5) return Math.round(100 - errorPercent * 1.2);
  if (errorPercent <= 1.5) return Math.round(99.4 - (errorPercent - 0.5) * 3.4);
  if (errorPercent <= 3.5) return Math.round(96 - (errorPercent - 1.5) * 4.5);
  if (errorPercent <= 6.5) return Math.round(87 - (errorPercent - 3.5) * 6);
  if (errorPercent <= 12) return Math.round(69 - (errorPercent - 6.5) * 3.45);
  if (value < EDGE_START) return Math.round(10 + (value / EDGE_START) * 39);
  return Math.max(10, Math.round(50 - (errorPercent - 12) * 2.2));
}

export function titleForScore(score: number): string {
  if (score === 100) return "人間をやめています";
  if (score >= 97) return "ほぼ神！";
  if (score >= 90) return "ギリギリ職人";
  if (score >= 80) return "かなり攻めた";
  if (score >= 60) return "慎重派";
  if (score >= 30) return "安全第一すぎる";
  if (score >= 1) return "ギリギリの意味、知ってる？";
  return "コップは旅立ちました";
}

export function makeRoundResult(round: number, position: number): RoundResult {
  const stoppedPosition = Math.min(1, Math.max(0, position));
  const normalizedError = Math.abs(stoppedPosition - TARGET_POSITION);
  const score = scoreForPosition(stoppedPosition);
  return {
    round,
    targetPosition: TARGET_POSITION,
    stoppedPosition,
    normalizedError,
    errorCm: Math.round(normalizedError * 800) / 10,
    score,
    title: titleForScore(score),
    zone: zoneForPosition(stoppedPosition),
  };
}

export function overallTitle(score: number): string {
  if (score >= 485) return "人間卒業レベル";
  if (score >= 450) return "ギリギリの神";
  if (score >= 400) return "ギリギリ職人";
  if (score >= 320) return "攻めの達人";
  if (score >= 220) return "安全運転のプロ";
  if (score >= 100) return "伸びしろしかない";
  return "コップ回収係";
}

export function roundLabel(round: number, totalRounds = TOTAL_ROUNDS): string {
  return round === totalRounds ? "FINAL ROUND" : `ROUND ${round}`;
}
