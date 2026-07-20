import "./style.css";
import { track } from "./analytics";
import { GameAudio, type BgmScene, type SoundEffect } from "./audio";
import { iconMarkup } from "./icons";
import {
  createInitialState,
  makeRoundResult,
  MOVEMENT_PATTERNS,
  movementPatternIndex,
  overallTitle,
  positionAt,
  roundDifficulty,
  roundLabel,
  seedForMode,
  totalRoundsForMode,
} from "./game";
import {
  copyShareLink,
  shareLine,
  shareNative,
  shareThreads,
  shareX,
  type ShareResult,
} from "./share";
import type { GameMode, GameScreen, StoredStats } from "./types";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App root was not found");
const app: HTMLDivElement = appRoot;
document.documentElement.style.setProperty("--hero-image", `url("${import.meta.env.BASE_URL}assets/hero-cat-cup.webp")`);

const STORAGE_KEY = "girigiri-stop-game:v1";
const DEFAULT_STATS: StoredStats = {
  highScore: 0,
  playCount: 0,
  bestRoundScore: 0,
  soundEnabled: true,
  lastDailyDate: "",
  dailyScore: 0,
};

const state = createInitialState();
let stats = loadStats();
const gameAudio = new GameAudio(stats.soundEnabled);
let frameId = 0;
let roundStartTime = 0;
let pausedAt = 0;
let introTimer = 0;
let resultTimer = 0;

function loadStats(): StoredStats {
  try {
    return { ...DEFAULT_STATS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } as StoredStats;
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // The game remains fully playable when storage is unavailable.
  }
}

function currentDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function setScreen(screen: GameScreen): void {
  state.screen = screen;
  document.body.dataset.screen = screen;
  document.body.dataset.mode = state.mode;
  syncBgmToScreen();
}

function syncBgmToScreen(): void {
  let scene: BgmScene | null = null;
  if (state.screen === "roundIntro" || state.screen === "playing") scene = "play";
  else if (state.screen === "finalResult") scene = "result";
  gameAudio.setScene(scene, state.currentRound);
  document.body.dataset.bgm = stats.soundEnabled ? scene ?? "ready" : "off";
  updateAudioDataset();
}

function updateAudioDataset(): void {
  document.body.dataset.audio = gameAudio.contextState;
  document.body.dataset.bgmActive = String(gameAudio.isBgmActive);
}

function shell(content: string, extraClass = ""): string {
  return `
    <main class="game-shell ${extraClass}">
      <button class="sound-toggle" type="button" data-action="sound" title="BGM・効果音 ${stats.soundEnabled ? "ON" : "OFF"}" aria-label="BGMと効果音を${stats.soundEnabled ? "オフ" : "オン"}にする" aria-pressed="${stats.soundEnabled}">
        ${iconMarkup(stats.soundEnabled ? "volume" : "volumeOff", "sound-toggle__icon")}
      </button>
      ${content}
      <div class="toast" role="status" aria-live="polite"></div>
    </main>
  `;
}

function pawIcon(className = "paw-icon"): string {
  return `<img class="${className}" src="${import.meta.env.BASE_URL}favicon.svg" alt="" width="64" height="64" aria-hidden="true" />`;
}

function titleMarkup(compact = false): string {
  return `
    <div class="game-title ${compact ? "game-title--compact" : ""}" aria-label="ギリギリで止めろ！">
      <span class="game-title__yellow" data-text="ギリギリ"><b>ギリギリ</b></span><span class="game-title__white" data-text="で"><b>で</b></span><span class="game-title__red" data-text="止めろ！"><b>止めろ！</b></span>
    </div>
  `;
}

function gameSceneLayers(animated = false, active = false): string {
  const motionClass = animated ? " is-animated" : "";
  return `
    <img class="scene-layer scene-layer--background" src="${import.meta.env.BASE_URL}assets/game-background.webp" alt="" width="1545" height="1018" aria-hidden="true" />
    <img class="scene-layer scene-layer--cat${motionClass}" src="${import.meta.env.BASE_URL}assets/game-cat.png" alt="" width="900" height="583" aria-hidden="true" />
    <img class="scene-layer scene-layer--cup${motionClass}" src="${import.meta.env.BASE_URL}assets/game-cup.png" alt="" width="500" height="460" aria-hidden="true" />
    <span class="scene-speech" aria-hidden="true">おっとっと…</span>
    <span class="edge-warning" aria-hidden="true"></span>
    <span class="drop-warning" aria-hidden="true">${iconMarkup("alert", "drop-warning__icon")}<span>ここから<br />落ちる！</span></span>
    ${active ? `<span class="cup-pulse" aria-hidden="true"></span><span class="motion-dots" aria-hidden="true"><span class="motion-dots__line"></span>${iconMarkup("arrowRight", "motion-dots__icon")}</span>` : ""}
  `;
}

function shareIcon(kind: "x" | "threads" | "line" | "native" | "copy"): string {
  return iconMarkup(kind === "native" ? "share" : kind, `share-icon share-icon--${kind}`);
}

function startMarkup(): string {
  return shell(`
    <section class="screen screen--start" aria-labelledby="start-heading">
      <h1 id="start-heading" class="sr-only">ギリギリで止めろ！</h1>
      ${titleMarkup()}
      <p class="catch-copy"><span>説明なしで、</span><strong>すぐ遊べる。</strong></p>
      <p class="sub-copy"><strong>ギリギリ</strong>のタイミングで止める</p>

      <div class="hero-visual">
        <img src="${import.meta.env.BASE_URL}assets/hero-cat-cup.webp" alt="猫が机の端へコップを押している" width="941" height="640" />
      </div>

      <div class="start-actions">
        <button class="big-button big-button--red" type="button" data-action="start" data-mode="challenge">
          <span>いますぐ遊ぶ</span>${pawIcon("paw-mini")}
        </button>
      </div>
      <div class="personal-stats" aria-label="あなたの記録">
        <span>${iconMarkup("trophy", "personal-stats__icon")}<small>BEST</small><strong>${stats.highScore}</strong></span>
        <span class="personal-stats__divider" aria-hidden="true"></span>
        <span><small>PLAY</small><strong>${stats.playCount}</strong></span>
      </div>
      <p class="easy-note">${iconMarkup("sparkles", "easy-note__icon")}<strong>5問・500点満点</strong><span aria-hidden="true">／</span>タップだけ</p>
    </section>
  `, "game-shell--start");
}

function playHeader(): string {
  const totalRounds = totalRoundsForMode(state.mode);
  return `
    ${titleMarkup(true)}
    <div class="play-status" aria-label="ゲーム進行状況">
      <div class="status-card status-card--round">
        ${iconMarkup("flag", "status-card__flag")}
        <div class="status-card__round-detail">
          <span><strong>${state.currentRound}</strong><span class="status-card__muted"> / ${totalRounds}</span></span>
          <span class="round-progress" aria-hidden="true">
            ${Array.from({ length: totalRounds }, (_, index) => `<i class="${index + 1 < state.currentRound ? "is-done" : index + 1 === state.currentRound ? "is-current" : ""}"></i>`).join("")}
          </span>
        </div>
      </div>
      <div class="status-divider" aria-hidden="true"></div>
      <div class="status-card status-card--score"><small>SCORE</small><strong>${state.totalScore}</strong></div>
    </div>
  `;
}

function roundIntroMarkup(): string {
  const totalRounds = totalRoundsForMode(state.mode);
  const difficulty = roundDifficulty(state.currentRound);
  const patternIndex = movementPatternIndex(state.seed, state.currentRound);
  const patternNumber = patternIndex + 1;
  const patternName = MOVEMENT_PATTERNS[patternIndex].name;
  return shell(`
    <section class="screen screen--playing screen--intro" aria-live="assertive">
      ${playHeader()}
      <div class="play-visual play-visual--dimmed" role="img" aria-label="猫がコップを机の端へ押している">
        ${gameSceneLayers(false)}
      </div>
      <div class="round-intro-card">
        ${iconMarkup("sparkles", "round-intro-card__icon")}
        <span class="round-intro-card__pace">SPEED <strong>×${difficulty.speedMultiplier.toFixed(1)}</strong></span>
        <strong class="round-intro-card__round">${roundLabel(state.currentRound, totalRounds)}</strong>
        <small>${difficulty.cue}</small>
        <span class="round-intro-card__pattern">
          PATTERN ${String(patternNumber).padStart(3, "0")} / 100
          <strong>${patternName}</strong>
        </span>
      </div>
    </section>
  `, "game-shell--playing");
}

function pawMarker(): string {
  return `
    <span class="gauge-marker" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <circle cx="32" cy="32" r="29" fill="#08285d" stroke="#fff" stroke-width="4"/>
        <g fill="#ff9fb8">
          <ellipse cx="32" cy="40" rx="12" ry="10"/>
          <ellipse cx="18" cy="29" rx="5" ry="7"/>
          <ellipse cx="28" cy="23" rx="5" ry="7"/>
          <ellipse cx="39" cy="23" rx="5" ry="7"/>
          <ellipse cx="47" cy="30" rx="5" ry="7"/>
        </g>
      </svg>
    </span>
  `;
}

function gaugeMarkup(): string {
  return `
    <div class="gauge-card" aria-label="タイミングゲージ。青は安全、黄色は通常、赤はギリギリ、灰色はアウト">
      <div class="gauge-labels" aria-hidden="true">
        <span>安全</span><span>通常</span><span>ギリギリ</span><span>アウト</span>
      </div>
      <div class="gauge-track">
        <span class="gauge-zone gauge-zone--safe"></span>
        <span class="gauge-zone gauge-zone--normal"></span>
        <span class="gauge-zone gauge-zone--edge"></span>
        <span class="gauge-zone gauge-zone--out"></span>
        <span class="gauge-target" aria-hidden="true"></span>
        ${pawMarker()}
      </div>
    </div>
  `;
}

function playingMarkup(): string {
  return shell(`
    <section class="screen screen--playing" aria-label="第${state.currentRound}ラウンド">
      ${playHeader()}
      <button class="play-tap-area" type="button" data-action="stop" aria-label="ゲームを止める">
        <div class="play-visual" role="img" aria-label="猫がコップを机の端へ押している">
          ${gameSceneLayers(true, true)}
        </div>
      </button>
      ${gaugeMarkup()}
      <p class="tap-hint">${iconMarkup("sparkles", "tap-hint__icon")}どこをタップしても止まる${iconMarkup("sparkles", "tap-hint__icon")}</p>
      <button class="stop-button" type="button" data-action="stop"><span>STOP!</span></button>
    </section>
  `, "game-shell--playing");
}

function confettiMarkup(count = 18): string {
  return `<div class="confetti" aria-hidden="true">${Array.from({ length: count }, (_, index) => `<i style="--i:${index}"></i>`).join("")}</div>`;
}

function roundResultMarkup(): string {
  const result = state.results.at(-1);
  if (!result) return playingMarkup();
  const success = result.score >= 80;
  const totalRounds = totalRoundsForMode(state.mode);
  const nextLabel = state.currentRound < totalRounds ? `次は ROUND ${state.currentRound + 1}` : "結果発表へ";
  return shell(`
    <section class="screen screen--playing screen--round-result ${result.zone === "out" ? "is-out" : ""}" aria-live="assertive">
      ${playHeader()}
      <div class="play-visual ${success ? "is-success" : "is-miss"}" role="img" aria-label="停止した猫とコップ">
        ${gameSceneLayers(false)}
      </div>
      <div class="mini-result">
        <small>誤差</small>
        <strong>${result.errorCm.toFixed(1)}<em>cm</em></strong>
        <div class="mini-result__score">${result.score}<span>点</span></div>
        <p>${result.title}</p>
        <span class="mini-result__next">${nextLabel}</span>
      </div>
      ${success ? confettiMarkup() : ""}
    </section>
  `, "game-shell--playing");
}

function shareResult(): ShareResult | null {
  const best = state.results.reduce((current, item) => item.score > current.score ? item : current, state.results[0]);
  return best ? { totalScore: state.totalScore, best, results: state.results, mode: state.mode } : null;
}

function finalResultMarkup(): string {
  const result = shareResult();
  if (!result) return startMarkup();
  const bestIndex = state.results.findIndex((item) => item === result.best);
  const modeLabel = state.mode === "quick" ? "すぐ遊ぶ" : state.mode === "daily" ? "今日のプレイ" : "5問プレイ";
  const resultTitle = state.mode === "quick" ? result.best.title : overallTitle(state.totalScore);
  return shell(`
    <section class="screen screen--result" aria-labelledby="result-heading">
      ${titleMarkup(true)}
      <h1 id="result-heading" class="result-heading" data-text="結果発表" aria-label="結果発表" tabindex="-1"><span>結果発表</span></h1>
      <p class="mode-ribbon">${pawIcon("mode-ribbon__paw")}<span>${modeLabel}</span>${pawIcon("mode-ribbon__paw")}</p>

      <article class="result-card">
        <div class="result-card__top">
          <img src="${import.meta.env.BASE_URL}assets/result-cat-cup.webp" alt="猫と机の端のコップ" width="482" height="535" />
          <div class="result-metrics">
            <div><span>ベスト誤差 <small>R${bestIndex + 1}</small></span><strong>${result.best.errorCm.toFixed(1)}<em>cm</em></strong></div>
            <div class="result-metrics__edge"><span>ギリギリ度</span><strong>${result.best.score}<em>点</em></strong></div>
            <p><small>${iconMarkup("trophy", "result-title__icon")}称号 GET!</small><strong>${resultTitle}</strong></p>
          </div>
        </div>
        <div class="total-score">${iconMarkup("sparkles", "total-score__spark")}<span>TOTAL</span><strong>${state.totalScore}</strong><em>点</em>${iconMarkup("sparkles", "total-score__spark")}</div>
        <div class="round-breakdown" style="--round-count:${state.results.length}" aria-label="${state.results.length}問のスコア内訳">
          ${state.results.map((item, index) => `<span class="${index === bestIndex ? "is-best" : ""}"><small>R${index + 1}</small><strong>${item.score}</strong></span>`).join("")}
        </div>
      </article>

      <p class="share-lead">${iconMarkup("sparkles", "share-lead__icon")}この結果をみんなに<strong>シェア</strong>しよう！${iconMarkup("sparkles", "share-lead__icon")}</p>
      <div class="share-grid">
        <button class="share-button share-button--x" type="button" data-action="share-x">${shareIcon("x")}<span>Xで共有</span></button>
        <button class="share-button share-button--threads" type="button" data-action="share-threads">${shareIcon("threads")}<span>Threadsで共有</span></button>
        <button class="share-button share-button--line" type="button" data-action="share-line">${shareIcon("line")}<span>LINEで送る</span></button>
        <button class="share-button share-button--native share-button--utility" type="button" data-action="share-native">${shareIcon("native")}<span>シェア先を選ぶ</span></button>
        <button class="share-button share-button--copy share-button--utility" type="button" data-action="copy-link">${shareIcon("copy")}<span>リンクをコピー</span></button>
      </div>
      <button class="retry-button" type="button" data-action="retry">${iconMarkup("refresh", "retry-button__icon")}<span>もう一回あそぶ</span></button>
      ${(state.mode === "quick" ? state.totalScore >= 95 : state.totalScore >= 450) ? confettiMarkup(28) : ""}
    </section>
  `, "game-shell--result");
}

function render(): void {
  window.clearTimeout(introTimer);
  window.clearTimeout(resultTimer);
  switch (state.screen) {
    case "start":
      app.innerHTML = startMarkup();
      break;
    case "roundIntro":
      app.innerHTML = roundIntroMarkup();
      break;
    case "playing":
      app.innerHTML = playingMarkup();
      updateGauge();
      break;
    case "roundResult":
      app.innerHTML = roundResultMarkup();
      break;
    case "finalResult":
      app.innerHTML = finalResultMarkup();
      break;
  }
}

function beginGame(mode: GameMode): void {
  cancelAnimationFrame(frameId);
  state.mode = mode;
  state.currentRound = 1;
  state.totalScore = 0;
  state.results = [];
  state.position = 0;
  state.inputLocked = true;
  state.seed = seedForMode(mode);
  stats.playCount += 1;
  saveStats();
  unlockAudio();
  track("game_start", { mode });
  beginRound();
}

function beginRound(): void {
  state.position = 0;
  state.inputLocked = true;
  setScreen("roundIntro");
  render();
  playSound("start");
  track("round_start", {
    round: state.currentRound,
    mode: state.mode,
    pattern: movementPatternIndex(state.seed, state.currentRound) + 1,
  });
  introTimer = window.setTimeout(() => {
    setScreen("playing");
    state.inputLocked = false;
    render();
    roundStartTime = performance.now();
    frameId = requestAnimationFrame(animate);
  }, 900);
}

function animate(now: number): void {
  if (state.screen !== "playing" || state.inputLocked) return;
  state.position = positionAt(now - roundStartTime, state.currentRound, state.seed);
  updateGauge();
  if (state.position >= 1) {
    stopRound(true);
    return;
  }
  frameId = requestAnimationFrame(animate);
}

function updateGauge(): void {
  const marker = document.querySelector<HTMLElement>(".gauge-marker");
  if (marker) marker.style.setProperty("--position", String(state.position));
}

function stopRound(auto = false): void {
  if (state.screen !== "playing" || state.inputLocked) return;
  state.inputLocked = true;
  cancelAnimationFrame(frameId);
  if (auto) state.position = 1;
  const result = makeRoundResult(state.currentRound, state.position);
  state.results.push(result);
  state.totalScore += result.score;
  setScreen("roundResult");
  render();
  playSound(result.score >= 95 ? "high" : result.score <= 9 ? "fail" : "stop");
  vibrate(result.score);
  track("round_stop", { round: result.round, position: result.stoppedPosition, auto });
  track("round_result", { round: result.round, score: result.score, error_cm: result.errorCm, zone: result.zone });

  resultTimer = window.setTimeout(() => {
    if (state.currentRound < totalRoundsForMode(state.mode)) {
      state.currentRound += 1;
      beginRound();
    } else {
      completeGame();
    }
  }, result.score >= 95 ? 1_650 : 1_450);
}

function completeGame(): void {
  const bestRound = Math.max(...state.results.map((item) => item.score));
  stats.highScore = Math.max(stats.highScore, state.totalScore);
  stats.bestRoundScore = Math.max(stats.bestRoundScore, bestRound);
  if (state.mode === "daily") {
    const previousDailyScore = stats.lastDailyDate === currentDateKey() ? stats.dailyScore : 0;
    stats.lastDailyDate = currentDateKey();
    stats.dailyScore = Math.max(previousDailyScore, state.totalScore);
  }
  saveStats();
  setScreen("finalResult");
  render();
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("#result-heading")?.focus({ preventScroll: true });
  });
  playSound("complete");
  track("game_complete", { mode: state.mode, score: state.totalScore, best_round: bestRound });
}

function vibrate(score: number): void {
  if (!("vibrate" in navigator)) return;
  if (score >= 95) navigator.vibrate([35, 45, 35]);
  else if (score <= 9) navigator.vibrate(120);
  else navigator.vibrate(35);
}

function unlockAudio(): void {
  void gameAudio.unlock().then(updateAudioDataset);
}

function playSound(type: SoundEffect): void {
  gameAudio.playEffect(type);
}

function showToast(message: string): void {
  const toast = document.querySelector<HTMLElement>(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 2_200);
}

function toggleSound(): void {
  stats.soundEnabled = !stats.soundEnabled;
  saveStats();
  gameAudio.setEnabled(stats.soundEnabled);
  syncBgmToScreen();
  if (stats.soundEnabled) {
    unlockAudio();
    playSound("start");
  }
  render();
  showToast(`BGM・効果音 ${stats.soundEnabled ? "ON" : "OFF"}`);
  track("sound_toggle", { enabled: stats.soundEnabled });
}

async function handleShare(action: string): Promise<void> {
  const result = shareResult();
  if (!result) return;
  switch (action) {
    case "share-x":
      shareX(result);
      track("share_x", { score: result.totalScore });
      break;
    case "share-threads":
      await shareThreads(result);
      track("share_threads", { score: result.totalScore });
      break;
    case "share-line":
      shareLine(result);
      track("share_line", { score: result.totalScore });
      break;
    case "share-native": {
      const shared = await shareNative(result);
      if (shared && !navigator.share) showToast("共有内容をコピーしました！");
      track("share_native", { score: result.totalScore, shared });
      break;
    }
    case "copy-link": {
      const copied = await copyShareLink(result);
      showToast(copied ? "リンクをコピーしました！" : "リンクをコピーできませんでした");
      track("copy_share_link", { score: result.totalScore, copied });
      break;
    }
  }
}

app.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;
  event.preventDefault();
  if (action === "start") {
    const mode = target.dataset.mode;
    beginGame(mode === "daily" || mode === "quick" ? mode : "challenge");
  }
  else if (action === "stop") stopRound();
  else if (action === "sound") toggleSound();
  else if (action === "retry") {
    track("retry", { previous_score: state.totalScore });
    beginGame(state.mode);
  } else {
    void handleShare(action);
  }
});

window.addEventListener("keydown", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && state.screen === "playing") {
    event.preventDefault();
    stopRound();
  }
});

document.addEventListener("visibilitychange", () => {
  gameAudio.setPageVisible(!document.hidden);
  updateAudioDataset();
  if (state.screen !== "playing" || state.inputLocked) return;
  if (document.hidden) {
    pausedAt = performance.now();
    cancelAnimationFrame(frameId);
  } else if (pausedAt > 0) {
    roundStartTime += performance.now() - pausedAt;
    pausedAt = 0;
    frameId = requestAnimationFrame(animate);
  }
});

setScreen("start");
render();
track("game_view");
