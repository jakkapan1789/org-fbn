import type { LevelMeta } from "./types";

export const LEVEL_META: LevelMeta[] = [
  { name: "Executive", color: "#2E6FDB", grad: ["#5b93f2", "#2E6FDB"], shadow: "rgba(46,111,219,0.35)" },
  { name: "VP", color: "#7c5cde", grad: ["#9d81ea", "#6d4ad4"], shadow: "rgba(124,92,222,0.32)" },
  { name: "Director", color: "#0d9488", grad: ["#1cb8aa", "#0c8377"], shadow: "rgba(13,148,136,0.3)" },
  { name: "Manager", color: "#dd8412", grad: ["#f0a53f", "#cf7a0f"], shadow: "rgba(221,132,18,0.3)" },
  { name: "Team Member", color: "#5f6b7e", grad: ["#7d8b9e", "#515c6f"], shadow: "rgba(95,107,126,0.28)" },
];

export function getLevelMeta(level: number): LevelMeta {
  return LEVEL_META[level] ?? LEVEL_META[4];
}
