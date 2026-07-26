export type GameConfig = {
  id: string;
  title: {
    full: string;
    lead: string;
    connector: string;
    action: string;
  };
  copy: {
    catchLead: string;
    catchStrong: string;
    subtitleLead: string;
    subtitleStrong: string;
    startButton: string;
    tapHint: string;
    stopButton: string;
    resultHeading: string;
    retryButton: string;
  };
  assets: {
    hero: string;
    background: string;
    movingCharacter: string;
    movingObject: string;
    result: string;
    favicon: string;
  };
  scene: {
    heroAlt: string;
    playAlt: string;
    resultAlt: string;
    speech: string;
    dangerLabel: string;
  };
  storageKey: string;
  gameplay: {
    totalRounds: number;
    roundIntroDurationMs: number;
    targetPosition: number;
    edgeStart: number;
    outStart: number;
    roundDurationsMs: readonly number[];
    roundCues: readonly string[];
  };
  labels: {
    scoreTitles: {
      perfect: string;
      nearPerfect: string;
      expert: string;
      aggressive: string;
      cautious: string;
      tooSafe: string;
      low: string;
      zero: string;
    };
    overallTitles: readonly { minScore: number; label: string }[];
  };
};

export const gameConfig: GameConfig = {
  id: "girigiri-stop-game",
  title: {
    full: "ギリギリで止めろ！",
    lead: "ギリギリ",
    connector: "で",
    action: "止めろ！",
  },
  copy: {
    catchLead: "説明なしで、",
    catchStrong: "すぐ遊べる。",
    subtitleLead: "のタイミングで止める",
    subtitleStrong: "ギリギリ",
    startButton: "いますぐ遊ぶ",
    tapHint: "どこをタップしても止まる",
    stopButton: "STOP!",
    resultHeading: "結果発表",
    retryButton: "もう一回あそぶ",
  },
  assets: {
    hero: "assets/hero-cat-cup.webp",
    background: "assets/game-background.webp",
    movingCharacter: "assets/game-cat.png",
    movingObject: "assets/game-cup.png",
    result: "assets/result-cat-cup.webp",
    favicon: "favicon.svg",
  },
  scene: {
    heroAlt: "猫が机の端へコップを押している",
    playAlt: "猫がコップを机の端へ押している",
    resultAlt: "猫と机の端のコップ",
    speech: "おっとっと…",
    dangerLabel: "ここから落ちる！",
  },
  storageKey: "girigiri-stop-game:v1",
  gameplay: {
    totalRounds: 5,
    roundIntroDurationMs: 2_200,
    targetPosition: 0.78,
    edgeStart: 0.62,
    outStart: 0.84,
    roundDurationsMs: [4_200, 2_800, 2_400, 2_100, 1_800],
    roundCues: [
      "まずは動きのクセを見切れ",
      "ここから一気に1.5倍！",
      "後半ほど速くなる",
      "速度の波を見切れ",
      "緩急MAX、最後の一発！",
    ],
  },
  labels: {
    scoreTitles: {
      perfect: "人間をやめています",
      nearPerfect: "ほぼ神！",
      expert: "ギリギリ職人",
      aggressive: "かなり攻めた",
      cautious: "慎重派",
      tooSafe: "安全第一すぎる",
      low: "ギリギリの意味、知ってる？",
      zero: "コップは旅立ちました",
    },
    overallTitles: [
      { minScore: 485, label: "人間卒業レベル" },
      { minScore: 450, label: "ギリギリの神" },
      { minScore: 400, label: "ギリギリ職人" },
      { minScore: 320, label: "攻めの達人" },
      { minScore: 220, label: "安全運転のプロ" },
      { minScore: 100, label: "伸びしろしかない" },
      { minScore: 0, label: "コップ回収係" },
    ],
  },
};

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
