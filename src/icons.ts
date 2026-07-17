import iconAlert from "@tabler/icons/outline/alert-triangle.svg?raw";
import iconArrowRight from "@tabler/icons/outline/arrow-narrow-right.svg?raw";
import iconCopy from "@tabler/icons/outline/copy.svg?raw";
import iconFlag from "@tabler/icons/filled/flag.svg?raw";
import iconRefresh from "@tabler/icons/outline/refresh.svg?raw";
import iconShare from "@tabler/icons/outline/share.svg?raw";
import iconSparkles from "@tabler/icons/outline/sparkles.svg?raw";
import iconTrophy from "@tabler/icons/outline/trophy.svg?raw";
import iconVolume from "@tabler/icons/outline/volume-2.svg?raw";
import iconVolumeOff from "@tabler/icons/outline/volume-off.svg?raw";
import { siLine, siThreads, siX } from "simple-icons";

type IconName =
  | "alert"
  | "arrowRight"
  | "copy"
  | "flag"
  | "line"
  | "refresh"
  | "share"
  | "sparkles"
  | "threads"
  | "trophy"
  | "volume"
  | "volumeOff"
  | "x";

const tablerIcons: Partial<Record<IconName, string>> = {
  alert: iconAlert,
  arrowRight: iconArrowRight,
  copy: iconCopy,
  flag: iconFlag,
  refresh: iconRefresh,
  share: iconShare,
  sparkles: iconSparkles,
  trophy: iconTrophy,
  volume: iconVolume,
  volumeOff: iconVolumeOff,
};

const brandIcons: Partial<Record<IconName, string>> = {
  line: siLine.svg,
  threads: siThreads.svg,
  x: siX.svg,
};

function prepareSvg(svg: string): string {
  return svg
    .replace(/<title>.*?<\/title>/, "")
    .replace("<svg", '<svg aria-hidden="true" focusable="false"');
}

export function iconMarkup(name: IconName, className = "ui-icon"): string {
  const svg = tablerIcons[name] ?? brandIcons[name];
  if (!svg) return "";
  return `<span class="${className}" aria-hidden="true">${prepareSvg(svg)}</span>`;
}
