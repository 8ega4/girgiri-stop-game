import type { GameMode, GameState, RoundResult } from "./types";

export const TOTAL_ROUNDS = 5;
export const MOVEMENT_PATTERN_COUNT = 100;
export const TARGET_POSITION = 0.78;
export const EDGE_START = 0.62;
export const OUT_START = 0.84;

const ROUND_DURATIONS = [4_200, 2_800, 2_400, 2_100, 1_800] as const;
const ROUND_CUES = [
  "まずは一定スピード",
  "ここから一気に1.5倍！",
  "後半ほど速くなる",
  "速度の波を見切れ",
  "緩急MAX、最後の一発！",
] as const;
const ROUND_PATTERN_INTENSITY = [0.25, 0.35, 0.65, 0.85, 1] as const;
const PATTERN_STEPS = [7, 9, 11, 13, 17, 19, 21, 23, 27, 29] as const;

export const MOVEMENT_PATTERNS = Object.freeze(
  Array.from({ length: MOVEMENT_PATTERN_COUNT }, (_, id) => ({
    id,
    family: id % 5,
    variant: Math.floor(id / 5),
    durationScale: 0.96 + ((id * 7) % 9) * 0.01,
  })),
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

function multiSpeedProgress(progress: number, variant: number): number {
  const firstBreak = 0.3;
  const secondBreak = 0.68;
  const firstSpeed = 0.68 + (variant % 4) * 0.12;
  const middleSpeed = 0.65 + (Math.floor(variant / 4) % 5) * 0.12;
  const finalSpeed = 0.76 + ((variant * 7) % 6) * 0.09;
  const firstDistance = firstBreak * firstSpeed;
  const middleDistance = (secondBreak - firstBreak) * middleSpeed;
  const totalDistance = firstDistance + middleDistance + (1 - secondBreak) * finalSpeed;

  if (progress < firstBreak) return (progress * firstSpeed) / totalDistance;
  if (progress < secondBreak) {
    return (firstDistance + (progress - firstBreak) * middleSpeed) / totalDistance;
  }
  return (firstDistance + middleDistance + (progress - secondBreak) * finalSpeed) / totalDistance;
}

export function movementPatternProgress(progress: number, patternIndex: number, round: number): number {
  const value = Math.min(1, Math.max(0, progress));
  const safePatternIndex = ((Math.round(patternIndex) % MOVEMENT_PATTERN_COUNT) + MOVEMENT_PATTERN_COUNT) % MOVEMENT_PATTERN_COUNT;
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  const { family, variant } = MOVEMENT_PATTERNS[safePatternIndex];
  const intensity = ROUND_PATTERN_INTENSITY[safeRound - 1];
  let position: number;

  switch (family) {
    case 0: {
      const frequency = 1 + (variant % 4);
      const phase = ((variant * 0.61803398875) % 1) * Math.PI * 2;
      const amplitude = (0.12 + (variant % 5) * 0.025) * intensity;
      position = value + (amplitude * (Math.cos(phase) - Math.cos(Math.PI * 2 * frequency * value + phase))) / (Math.PI * 2 * frequency);
      break;
    }
    case 1: {
      const exponent = 1 + (0.1 + variant * 0.009) * intensity;
      position = value ** exponent;
      break;
    }
    case 2: {
      const exponent = 1 + (0.1 + variant * 0.009) * intensity;
      position = 1 - (1 - value) ** exponent;
      break;
    }
    case 3: {
      const direction = variant % 2 === 0 ? 1 : -1;
      const amplitude = (0.07 + variant * 0.004) * intensity;
      position = value + direction * amplitude * Math.sin(Math.PI * value);
      break;
    }
    case 4: {
      const stepped = multiSpeedProgress(value, variant);
      position = value + (stepped - value) * intensity;
      break;
    }
    default:
      position = value;
  }

  return Math.min(1, Math.max(0, position));
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
