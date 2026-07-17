import { overallTitle } from "./game";
import type { GameMode, RoundResult } from "./types";

export interface ShareResult {
  totalScore: number;
  best: RoundResult;
  results: RoundResult[];
  mode: GameMode;
}

export function shareText(result: ShareResult): string {
  const title = result.mode === "quick" ? result.best.title : overallTitle(result.totalScore);
  return `「ギリギリで止めろ！」で${result.totalScore}点！\n\nベスト誤差は${result.best.errorCm.toFixed(1)}cm。\n称号は「${title}」でした。\n\nこれ超えられる？\n#ギリギリで止めろ`;
}

export function trackedUrl(source: string, score: number): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("from", source);
  url.searchParams.set("score", String(score));
  return url.toString();
}

function openShare(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer,width=680,height=720");
}

export function shareX(result: ShareResult): void {
  const url = trackedUrl("x", result.totalScore);
  openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(result))}&url=${encodeURIComponent(url)}`);
}

export async function shareThreads(result: ShareResult): Promise<boolean> {
  const text = `${shareText(result)}\n${trackedUrl("threads", result.totalScore)}`;
  try {
    openShare(`https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`);
    return true;
  } catch {
    return copyText(text);
  }
}

export function shareLine(result: ShareResult): void {
  const url = trackedUrl("line", result.totalScore);
  openShare(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText(result))}`);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

export async function shareNative(result: ShareResult): Promise<boolean> {
  const url = trackedUrl("share", result.totalScore);
  if (navigator.share) {
    try {
      await navigator.share({ title: "ギリギリで止めろ！", text: shareText(result), url });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
    }
  }
  return copyText(`${shareText(result)}\n${url}`);
}

export function copyShareLink(result: ShareResult): Promise<boolean> {
  return copyText(trackedUrl("copy", result.totalScore));
}
