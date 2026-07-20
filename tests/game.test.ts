import { describe, expect, it } from "vitest";
import {
  MOVEMENT_PATTERN_COUNT,
  MOVEMENT_PATTERNS,
  OUT_START,
  TARGET_POSITION,
  dailySeed,
  makeRoundResult,
  movementPatternIndex,
  movementPatternProgress,
  positionAt,
  roundDifficulty,
  scoreForPosition,
  titleForScore,
  totalRoundsForMode,
} from "../src/game";

describe("scoring", () => {
  it("awards 100 at the target and reduces continuously around it", () => {
    expect(scoreForPosition(TARGET_POSITION)).toBe(100);
    expect(scoreForPosition(TARGET_POSITION - 0.02)).toBeGreaterThan(scoreForPosition(TARGET_POSITION - 0.05));
    expect(scoreForPosition(TARGET_POSITION - 0.05)).toBeGreaterThan(scoreForPosition(TARGET_POSITION - 0.1));
  });

  it("requires a stop within roughly 1.7 percent for a 95+ score", () => {
    expect(scoreForPosition(TARGET_POSITION + 0.015)).toBeGreaterThanOrEqual(95);
    expect(scoreForPosition(TARGET_POSITION + 0.02)).toBeLessThan(95);
  });

  it("keeps out-zone scores under 10", () => {
    expect(scoreForPosition(OUT_START)).toBeLessThanOrEqual(9);
    expect(scoreForPosition(1)).toBe(0);
  });

  it("returns complete round results", () => {
    const result = makeRoundResult(3, TARGET_POSITION);
    expect(result).toMatchObject({ round: 3, score: 100, zone: "edge" });
    expect(result.errorCm).toBe(0);
  });
});

describe("movement", () => {
  it("defines 100 distinct movement patterns", () => {
    expect(MOVEMENT_PATTERN_COUNT).toBe(100);
    expect(MOVEMENT_PATTERNS).toHaveLength(100);

    const fingerprints = MOVEMENT_PATTERNS.map((pattern) =>
      [0.17, 0.39, 0.61, 0.79]
        .map((progress) => movementPatternProgress(progress, pattern.id, 5).toFixed(6))
        .join(":"),
    );
    expect(new Set(fingerprints).size).toBe(100);
  });

  it("selects five non-repeating random patterns for each game", () => {
    for (const seed of [1, 42, 123_456, 987_654_321]) {
      const selected = Array.from({ length: 5 }, (_, index) => movementPatternIndex(seed, index + 1));
      expect(new Set(selected).size).toBe(5);
      expect(selected.every((pattern) => pattern >= 0 && pattern < MOVEMENT_PATTERN_COUNT)).toBe(true);
    }
  });

  it("keeps all 100 patterns monotonic", () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      for (let round = 1; round <= 5; round += 1) {
        let previous = 0;
        for (let step = 0; step <= 100; step += 1) {
          const position = movementPatternProgress(step / 100, pattern.id, round);
          expect(position).toBeGreaterThanOrEqual(previous - Number.EPSILON);
          previous = position;
        }
      }
    }
  });

  it("starts at zero and reaches the end without exceeding normalized bounds", () => {
    for (let round = 1; round <= 5; round += 1) {
      expect(positionAt(0, round, 42)).toBe(0);
      expect(positionAt(10_000, round, 42)).toBe(1);
    }
  });

  it("uses distinct patterns across the five rounds", () => {
    const positions = Array.from({ length: 5 }, (_, index) => positionAt(2_000, index + 1, 42));
    expect(new Set(positions.map((value) => value.toFixed(3))).size).toBe(5);
  });

  it("makes round two clearly faster than the opening round", () => {
    expect(roundDifficulty(1)).toEqual({ speedMultiplier: 1, cue: "まずは一定スピード" });
    expect(roundDifficulty(2)).toEqual({ speedMultiplier: 1.5, cue: "ここから一気に1.5倍！" });

    for (const seed of [1, 42, 123_456, 987_654_321]) {
      expect(positionAt(2_000, 2, seed) - positionAt(2_000, 1, seed)).toBeGreaterThan(0.15);
    }
  });

  it("keeps the harder pace short even in the opening round", () => {
    expect(positionAt(4_500, 1, 42)).toBe(1);
    expect(positionAt(2_000, 5, 42)).toBeGreaterThanOrEqual(TARGET_POSITION);
  });

  it("keeps round four movement monotonic", () => {
    let previous = 0;
    for (let time = 0; time <= 5_000; time += 20) {
      const position = positionAt(time, 4, 42);
      expect(position).toBeGreaterThanOrEqual(previous);
      previous = position;
    }
  });
});

describe("daily mode and titles", () => {
  it("assigns one round to quick play and five rounds to both challenges", () => {
    expect(totalRoundsForMode("quick")).toBe(1);
    expect(totalRoundsForMode("challenge")).toBe(5);
    expect(totalRoundsForMode("daily")).toBe(5);
  });

  it("creates a stable date seed", () => {
    expect(dailySeed(new Date(2026, 6, 17))).toBe(dailySeed(new Date(2026, 6, 17)));
    expect(dailySeed(new Date(2026, 6, 17))).not.toBe(dailySeed(new Date(2026, 6, 18)));
  });

  it("maps exact score titles", () => {
    expect(titleForScore(100)).toBe("人間をやめています");
    expect(titleForScore(98)).toBe("ほぼ神！");
    expect(titleForScore(0)).toBe("コップは旅立ちました");
  });
});
