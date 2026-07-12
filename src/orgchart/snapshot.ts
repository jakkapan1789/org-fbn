import type { DisplayOptions, LayoutDirection, OrgPerson, OrgSnapshot, StackSide } from "./types";

const SNAPSHOT_KEY_PREFIX = "orgchart:snapshot:";

/** Folder under `public/` (so, under the deployed base path) where an admin drops the
 *  exported .json files that `?source=jsonfile&title=…` previews read. */
const SNAPSHOT_DIR = "orgs";

export function isOrgSnapshot(value: unknown): value is OrgSnapshot {
  const v = value as Partial<OrgSnapshot> | null;
  return !!v && typeof v.orgId === "string" && !!v.tree && typeof v.tree.id === "string";
}

/** Turns an admin-typed chart name into something safe to use as both a file name and a
 *  URL query value. Thai letters are kept as-is (they survive `encodeURIComponent` fine);
 *  anything that would need escaping in a path — spaces, slashes, dots — becomes a dash. */
export function slugifyTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Path a titled snapshot is expected to live at once the admin has moved the downloaded
 *  file into `public/orgs/` — also the URL the preview page fetches. */
export function snapshotFileUrl(title: string): string {
  return `${import.meta.env.BASE_URL}${SNAPSHOT_DIR}/${encodeURIComponent(slugifyTitle(title))}.json`;
}

/** Removes deleted people (and, transitively, everyone under them) from a tree. Admin-only
 *  customization — `deletedIds` is a flat id set, so deleting a manager silently drops
 *  their whole reporting line without needing to touch anyone else's record. */
export function pruneDeleted(node: OrgPerson, deletedIds: Set<string>): OrgPerson {
  return {
    ...node,
    children: node.children.filter((c) => !deletedIds.has(c.id)).map((c) => pruneDeleted(c, deletedIds)),
  };
}

function collectIds(node: OrgPerson, out: Set<string>) {
  out.add(node.id);
  node.children.forEach((c) => collectIds(c, out));
}

/** Freezes the admin's current customization (edited/deleted tree + layout/stackSide
 *  choices) into a self-contained snapshot the Preview page can render without hitting
 *  api.ts at all. Layout/stackSide maps are trimmed to ids still present in the tree so
 *  the file doesn't carry stale entries for people who were since deleted. */
export function buildSnapshot(
  orgId: string,
  title: string,
  tree: OrgPerson,
  layoutOverrides: Record<string, LayoutDirection>,
  stackSides: Record<string, StackSide>,
  displayOptions: DisplayOptions,
): OrgSnapshot {
  const ids = new Set<string>();
  collectIds(tree, ids);

  const trimmedLayout: Record<string, LayoutDirection> = {};
  for (const [id, v] of Object.entries(layoutOverrides)) if (ids.has(id)) trimmedLayout[id] = v;

  const trimmedSides: Record<string, StackSide> = {};
  for (const [id, v] of Object.entries(stackSides)) if (ids.has(id)) trimmedSides[id] = v;

  return {
    orgId,
    title: slugifyTitle(title),
    exportedAt: new Date().toISOString(),
    tree,
    layoutOverrides: trimmedLayout,
    stackSides: trimmedSides,
    displayOptions,
  };
}

export function saveSnapshot(snapshot: OrgSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY_PREFIX + snapshot.orgId, JSON.stringify(snapshot));
  } catch {
    // storage blocked or full — the downloaded .json is still a valid backup
  }
}

export function loadSnapshot(orgId: string): OrgSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_PREFIX + orgId);
    return raw ? (JSON.parse(raw) as OrgSnapshot) : null;
  } catch {
    return null;
  }
}

/** Triggers a browser download of the snapshot .json, named after its title so the file can
 *  be dropped straight into `public/orgs/` and served to `?source=jsonfile&title=<title>`. */
export function downloadSnapshotFile(snapshot: OrgSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${snapshot.title || `orgchart-${snapshot.orgId}`}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads a published snapshot from `public/orgs/<title>.json` — what the file-backed
 *  preview (`?source=jsonfile&title=…`) renders. Resolves to `null` for every failure the
 *  page treats identically ("no chart published under that name"): a 404, a static host
 *  that answers missing paths with index.html, or a file that isn't one of our exports. */
export async function fetchSnapshotFile(title: string): Promise<OrgSnapshot | null> {
  if (!slugifyTitle(title)) return null;
  try {
    const res = await fetch(snapshotFileUrl(title));
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return isOrgSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
