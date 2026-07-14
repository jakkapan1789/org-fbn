import type { OrgPerson, OrgSnapshot, PersonOverride, PersonSummary } from "./types";
import { ApiError, apiFetch } from "./apiClient";
import { isOrgSnapshot } from "./snapshot";

// Backend boundary — the real backend only, no mock fallback. One read endpoint backs
// the whole app (base URL from VITE_API_BASE_URL, default http://localhost:41704/api —
// see apiConfig.ts):
//   GET   /employee/?empNo=<EN>  → OrgPerson | OrgSnapshot — the person plus everyone
//         under them, optionally wrapped in a saved-chart snapshot ({ orgId, tree,
//         layoutOverrides, stackSides, displayOptions }). Serves BOTH the root-picker
//         lookup (findPersonByEn derives the summary from the tree root) and the chart
//         load (fetchOrgTree). 404 = no such employee.
//   PATCH /people/:en            → 204 (savePersonOverride — best-effort edit sync;
//         optional, callers swallow failures)

const employeePath = (empNo: string) => `/employee/?empNo=${encodeURIComponent(empNo)}`;

/** Recursively lowercases the first letter of every object key. The real backend answers
 *  in PascalCase (`OrgId`, `En`, `TeamName`, `ChildLayout`, ...), while every type in
 *  ./types and every localStorage/UI key in the app is camelCase — applied once, right
 *  after parsing, so nothing downstream needs to know the wire format differs. A no-op
 *  on keys that are already camelCase, so it's safe even if the backend changes later. */
function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key.charAt(0).toLowerCase() + key.slice(1)] = camelizeKeys(v);
    }
    return out;
  }
  return value;
}

async function fetchEmployee(empNo: string): Promise<OrgPerson | OrgSnapshot> {
  const raw = await apiFetch<unknown>(employeePath(empNo));
  return camelizeKeys(raw) as OrgPerson | OrgSnapshot;
}

/** Unwraps the employee endpoint's two response shapes to the tree root. */
function treeOf(data: OrgPerson | OrgSnapshot): OrgPerson {
  return isOrgSnapshot(data) ? data.tree : data;
}

/** Looks up the single person with this employee number, for the root-person picker.
 *  Resolves to `null` when nobody matches — the picker shows a "not found" message
 *  rather than an error, since a typo'd EN is an expected outcome, not a failure. */
export async function findPersonByEn(en: string): Promise<PersonSummary | null> {
  const query = en.trim();
  if (!query) return null;

  try {
    const data = await fetchEmployee(query);
    const root = treeOf(data);
    if (!root || typeof root.en !== "string") return null; // 200 but not a person we understand
    const { en: personEn, name, initials, title, dept, level, headcount } = root;
    return { en: personEn, name, initials, title, dept, level, headcount };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface OrgTreeResult {
  tree: OrgPerson;
  /** Set when the backend answered with a full OrgSnapshot instead of a bare tree —
   *  the saved chart's layoutOverrides/stackSides/displayOptions ride along so a single
   *  endpoint can restore the whole customized chart, not just the people. */
  snapshot: OrgSnapshot | null;
}

/** The chosen person plus everyone under them. The backend may return either a bare
 *  OrgPerson or an exported-snapshot wrapper (`{ orgId, tree, layoutOverrides,
 *  stackSides, displayOptions }`) — both shapes are accepted. */
export async function fetchOrgTree(rootEn: string): Promise<OrgTreeResult> {
  const data = await fetchEmployee(rootEn);
  return isOrgSnapshot(data) ? { tree: data.tree, snapshot: data } : { tree: data, snapshot: null };
}

/** Persists a person edit (name/title/teamName/dept) server-side. OrgChart keeps its
 *  own localStorage copy as the source of truth for rendering, so callers should treat
 *  this as best-effort sync — it lets edits survive across devices, but a failed/absent
 *  endpoint must never block editing locally. */
export async function savePersonOverride(en: string, updates: PersonOverride): Promise<void> {
  await apiFetch<void>(`/people/${encodeURIComponent(en)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
