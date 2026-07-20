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
  function progressAtPosition(patternId: number, round: number, target: number): number {
    let lower = 0;
    let upper = 1;
    for (let step = 0; step < 24; step += 1) {
      const midpoint = (lower + upper) / 2;
      if (movementPatternProgress(midpoint, patternId, round) >= target) upper = midpoint;
      else lower = midpoint;
    }
    return upper;
  }

  function completionTime(round: number, seed: number): number {
    let lower = 0;
    let upper = 6_000;
    for (let step = 0; step < 24; step += 1) {
      const midpoint = (lower + upper) / 2;
      if (positionAt(midpoint, round, seed) >= 1) upper = midpoint;
      else lower = midpoint;
    }
    return upper;
  }

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

  it("selects five non-repeating pattern families for each game", () => {
    for (const seed of [1, 42, 123_456, 987_654_321]) {
      const selected = Array.from({ length: 5 }, (_, index) => movementPatternIndex(seed, index + 1));
      expect(new Set(selected).size).toBe(5);
      expect(new Set(selected.map((pattern) => MOVEMENT_PATTERNS[pattern].family)).size).toBe(5);
      expect(selected.every((pattern) => pattern >= 0 && pattern < MOVEMENT_PATTERN_COUNT)).toBe(true);
    }
  });

  it("keeps irregular families visibly different from steady movement", () => {
    for (const pattern of MOVEMENT_PATTERNS.filter(({ family }) => family >= 1)) {
      const increments = Array.from({ length: 40 }, (_, index) =>
        movementPatternProgress((index + 1) / 40, pattern.id, 1)
        - movementPatternProgress(index / 40, pattern.id, 1),
      );
      expect(Math.max(...increments) / Math.min(...increments)).toBeGreaterThan(1.8);
    }
  });

  it("gives each named family ten structurally distinct timing variants", () => {
    for (let family = 0; family < 10; family += 1) {
      const variants = MOVEMENT_PATTERNS.filter((pattern) => pattern.family === family);
      for (let first = 0; first < variants.length; first += 1) {
        for (let second = first + 1; second < variants.length; second += 1) {
          const largestDifference = Math.max(
            ...Array.from({ length: 39 }, (_, index) => {
              const progress = (index + 1) / 40;
              return Math.abs(
                movementPatternProgress(progress, variants[first].id, 5)
                - movementPatternProgress(progress, variants[second].id, 5),
              );
            }),
          );
          expect(largestDifference * 300).toBeGreaterThan(1.25);
        }
      }
    }
  });

  it("keeps the target approach difficult but humanly stoppable", () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const approachWindow = progressAtPosition(pattern.id, 5, 0.84)
        - progressAtPosition(pattern.id, 5, 0.72);
      expect(approachWindow).toBeGreaterThanOrEqual(0.077);
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
    expect(roundDifficulty(1)).toEqual({ speedMultiplier: 1, cue: "まずは動きのクセを見切れ" });
    expect(roundDifficulty(2)).toEqual({ speedMultiplier: 1.5, cue: "ここから一気に1.5倍！" });

    for (const seed of [1, 42, 123_456, 987_654_321]) {
      expect(completionTime(2, seed)).toBeLessThan(completionTime(1, seed) * 0.8);
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
