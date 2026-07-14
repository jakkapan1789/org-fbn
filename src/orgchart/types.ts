export interface OrgPerson {
  /** Employee number — THE identifier for a person everywhere in the app (React keys,
   *  collapse/layout/side maps, snapshot orgId, API paths), so it must be unique across
   *  the whole company. Also what an Admin types on the create/customize page to pick
   *  who sits at the top of a chart. */
  en: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  /** Grade/band code, e.g. "C1", "V2", "D1", "M3", "B2". The letter prefix is the
   *  hierarchy tier that drives the card colour (C=Executive, V=VP, D=Director,
   *  M=Manager/Lead, B=Team Member — see levelMeta.ts); the digit is the band within
   *  that tier, so two Team Members can be "B1" vs "B3". */
  level: string;
  title: string;
  dept: string;
  children: OrgPerson[];
  headcount: number;
  childLayout: "horizontal" | "vertical";
  layout?: "horizontal" | "vertical";
  teamName?: string;
}

export interface AnnotatedNode extends OrgPerson {
  children: AnnotatedNode[];
  expanded: boolean;
  hasChildren: boolean;
  layoutHorizontal: boolean;
  layoutVertical: boolean;
  /** Which side this node's vertical stack of children hangs on (default "right"). */
  stackSide: StackSide;
  highlighted: boolean;
  dimmed: boolean;
}

export interface LevelMeta {
  name: string;
  color: string;
  grad: [string, string];
  shadow: string;
}

/** Lightweight person record returned by the (mock) backend for the root picker. */
export interface PersonSummary {
  en: string;
  name: string;
  initials: string;
  title: string;
  dept: string;
  level: string;
  headcount: number;
}

export type LayoutDirection = "horizontal" | "vertical";

/** Side a vertical stack of subordinates hangs on, relative to the trunk. */
export type StackSide = "left" | "right";

/** Which fields each org card renders. showHeadcount is purely additive (a card is
 *  never empty with it off), so it sits outside the "at least one visible" guard that
 *  applies to showAvatar/showName/showPosition. centerContent is a layout toggle, not a
 *  visibility one — it always forces the card's content to centre. */
export interface DisplayOptions {
  showAvatar: boolean;
  showName: boolean;
  showPosition: boolean;
  showHeadcount: boolean;
  centerContent: boolean;
}

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showAvatar: true,
  showName: true,
  showPosition: true,
  showHeadcount: false,
  centerContent: false,
};

/** User edits to a person, keyed by EN in OrgChart's persisted `personOverrides`.
 *  Merged over the fetched OrgPerson before annotation — a key present with value
 *  `undefined` (e.g. clearing teamName) still overrides, since the merge is a spread. */
export interface PersonOverride {
  name?: string;
  title?: string;
  teamName?: string;
  dept?: string;
}

/** A customized org tree exported by an Admin (positions edited, people removed),
 *  frozen at export time so the Preview page can load it instantly instead of
 *  re-fetching + re-annotating live data. Stored in localStorage keyed by `orgId`
 *  (the root person's EN) and also offered as a downloadable .json for safekeeping. */
export interface OrgSnapshot {
  orgId: string;
  /** Human-chosen name for this chart, slugified at export time — it is both the .json
   *  file's name under `public/orgs/` and the `?title=` of the file-backed preview link.
   *  Optional: snapshots exported before titles existed still load. */
  title?: string;
  exportedAt: string;
  tree: OrgPerson;
  layoutOverrides: Record<string, LayoutDirection>;
  stackSides: Record<string, StackSide>;
  displayOptions: DisplayOptions;
}
