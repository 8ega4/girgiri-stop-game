import type { GameMode, GameState, RoundResult } from "./types";

export const TOTAL_ROUNDS = 5;
export const TARGET_POSITION = 0.78;
export const EDGE_START = 0.62;
export const OUT_START = 0.84;

const ROUND_DURATIONS = [4_200, 3_200, 2_700, 2_400, 2_050] as const;

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

export function positionAt(elapsedMs: number, round: number, seed = 1): number {
  const safeRound = Math.min(TOTAL_ROUNDS, Math.max(1, Math.round(round)));
  const base = elapsedMs / (ROUND_DURATIONS[safeRound - 1] * seededVariation(seed, safeRound));
  let position: number;

  switch (safeRound) {
    case 1:
    case 2:
      position = base;
      break;
    case 3:
      position = Math.pow(Math.max(0, base), 1.62);
      break;
    case 4:
      position = base + Math.sin(base * Math.PI * 8) * 0.034;
      break;
    case 5:
      if (base < 0.42) position = base * 1.12;
      else if (base < 0.7) position = 0.4704 + (base - 0.42) * 0.28;
      else position = 0.5488 + (base - 0.7) * 1.504;
      break;
    default:
      position = base;
  }

  return Math.min(1, Math.max(0, position));
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
