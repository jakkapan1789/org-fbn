import type { LevelMeta } from "./types";

export const LEVEL_META: LevelMeta[] = [
  { name: "Executive", color: "#2E6FDB", grad: ["#5b93f2", "#2E6FDB"], shadow: "rgba(46,111,219,0.35)" },
  { name: "VP", color: "#7c5cde", grad: ["#9d81ea", "#6d4ad4"], shadow: "rgba(124,92,222,0.32)" },
  { name: "Director", color: "#0d9488", grad: ["#1cb8aa", "#0c8377"], shadow: "rgba(13,148,136,0.3)" },
  { name: "Manager", color: "#dd8412", grad: ["#f0a53f", "#cf7a0f"], shadow: "rgba(221,132,18,0.3)" },
  { name: "Team Member", color: "#5f6b7e", grad: ["#7d8b9e", "#515c6f"], shadow: "rgba(95,107,126,0.28)" },
];

// `level` is a grade code like "C1" / "V2" / "M3" / "B1" — the letter prefix picks the
// hierarchy tier (and therefore the card colour); the digit is just the band within it.
const TIER_BY_PREFIX: Record<string, number> = { C: 0, V: 1, D: 2, M: 3, B: 4 };

/** Index into LEVEL_META for a level code — unknown prefixes fall back to Team Member. */
export function levelIndex(level: string): number {
  return TIER_BY_PREFIX[String(level).charAt(0).toUpperCase()] ?? 4;
}

export function getLevelMeta(level: string): LevelMeta {
  return LEVEL_META[levelIndex(level)];
}
