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

// Within the Team Member tier (B), the senior bands get their own colour instead of the
// flat Team Member grey — B3+ yellow, B4+ green (B4 wins since it satisfies both). Only
// affects card colouring (avatar/badge/border); LEVEL_META and the Legend panel's five
// tier rows are untouched.
const BAND_OVERRIDE: { min: number; meta: Omit<LevelMeta, "name"> }[] = [
  { min: 4, meta: { color: "#16a34a", grad: ["#4ade80", "#16a34a"], shadow: "rgba(22,163,74,0.3)" } },
  { min: 3, meta: { color: "#d99a06", grad: ["#f5c344", "#d99a06"], shadow: "rgba(217,154,6,0.32)" } },
];

export function getLevelMeta(level: string): LevelMeta {
  const code = String(level);
  const base = LEVEL_META[levelIndex(code)];
  if (code.charAt(0).toUpperCase() === "B") {
    const band = Number(code.slice(1));
    const override = BAND_OVERRIDE.find((o) => band >= o.min);
    if (override) return { ...base, ...override.meta };
  }
  return base;
}
