import { describe, expect, it } from "vitest";
import { bgmTempo, midiToFrequency } from "../src/audio";

describe("BGM", () => {
  it("raises the tempo as rounds get harder", () => {
    expect(bgmTempo("play", 1)).toBe(126);
    expect(bgmTempo("play", 3)).toBe(142);
    expect(bgmTempo("play", 5)).toBe(158);
  });

  it("uses a calmer fixed tempo for the result scene", () => {
    expect(bgmTempo("result", 1)).toBe(96);
    expect(bgmTempo("result", 5)).toBe(96);
  });

  it("converts standard MIDI tuning correctly", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
    expect(midiToFrequency(81)).toBeCloseTo(880, 5);
  });
});
