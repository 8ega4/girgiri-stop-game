export type GameScreen = "start" | "roundIntro" | "playing" | "roundResult" | "finalResult";
export type GameMode = "quick" | "challenge" | "daily";

export interface RoundResult {
  round: number;
  targetPosition: number;
  stoppedPosition: number;
  normalizedError: number;
  errorCm: number;
  score: number;
  title: string;
  zone: "safe" | "normal" | "edge" | "out";
}

export interface GameState {
  screen: GameScreen;
  currentRound: number;
  totalScore: number;
  results: RoundResult[];
  mode: GameMode;
  position: number;
  inputLocked: boolean;
  seed: number;
}

export interface StoredStats {
  highScore: number;
  playCount: number;
  bestRoundScore: number;
  soundEnabled: boolean;
  lastDailyDate: string;
  dailyScore: number;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
