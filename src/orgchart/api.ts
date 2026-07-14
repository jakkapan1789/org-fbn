import type { OrgPerson, OrgSnapshot, PersonOverride, PersonSummary } from "./types";
import { buildCompanyTree } from "./orgData";
import { ApiError, apiFetch } from "./apiClient";
import { USE_MOCK_DATA } from "./apiConfig";
import { isOrgSnapshot } from "./snapshot";

// Backend boundary. One read endpoint backs the whole app — point VITE_API_BASE_URL
// (see .env.example; e.g. http://localhost:41704/api) at a real backend and these take
// over automatically:
//   GET   /employee/?empNo=<EN>  → OrgPerson | OrgSnapshot — the person plus everyone
//         under them, optionally wrapped in a saved-chart snapshot ({ orgId, tree,
//         layoutOverrides, stackSides, displayOptions }). Serves BOTH the root-picker
//         lookup (findPersonByEn derives the summary from the tree root) and the chart
//         load (fetchOrgTree). 404 = no such employee.
//   PATCH /people/:en            → 204 (savePersonOverride — best-effort edit sync;
//         optional, callers swallow failures)
// With VITE_API_BASE_URL unset, everything below falls back to the deterministic mock
// generator (orgData.ts), so the app runs standalone with no backend at all.

const employeePath = (empNo: string) => `/employee/?empNo=${encodeURIComponent(empNo)}`;

/** Unwraps the employee endpoint's two response shapes to the tree root. */
function treeOf(data: OrgPerson | OrgSnapshot): OrgPerson {
  return isOrgSnapshot(data) ? data.tree : data;
}

const LATENCY_MS = 350;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let db: OrgPerson | null = null;
function getDb(): OrgPerson {
  db ??= buildCompanyTree();
  return db;
}

function walk(node: OrgPerson, fn: (n: OrgPerson) => void) {
  fn(node);
  node.children.forEach((c) => walk(c, fn));
}

/** Looks up the single person with this employee number, for the root-person picker.
 *  Resolves to `null` when nobody matches — the picker shows a "not found" message
 *  rather than an error, since a typo'd EN is an expected outcome, not a failure. */
export async function findPersonByEn(en: string): Promise<PersonSummary | null> {
  const query = en.trim();
  if (!query) return null;

  if (!USE_MOCK_DATA) {
    try {
      const data = await apiFetch<OrgPerson | OrgSnapshot>(employeePath(query));
      const root = treeOf(data);
      if (!root || typeof root.en !== "string") return null; // 200 but not a person we understand
      const { en, name, initials, title, dept, level, headcount } = root;
      return { en, name, initials, title, dept, level, headcount };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  await delay(LATENCY_MS);
  let found: PersonSummary | null = null;
  walk(getDb(), (n) => {
    if (found || n.en.toLowerCase() !== query.toLowerCase()) return;
    found = {
      en: n.en,
      name: n.name,
      initials: n.initials,
      title: n.title,
      dept: n.dept,
      level: n.level,
      headcount: n.headcount,
    };
  });
  return found;
}

export interface OrgTreeResult {
  tree: OrgPerson;
  /** Set when the backend answered with a full OrgSnapshot instead of a bare tree —
   *  the saved chart's layoutOverrides/stackSides/displayOptions ride along so a single
   *  endpoint can restore the whole customized chart, not just the people. */
  snapshot: OrgSnapshot | null;
}

/** The chosen person plus everyone under them, as a detached tree. The backend may
 *  return either a bare OrgPerson or an exported-snapshot wrapper (`{ orgId, tree,
 *  layoutOverrides, stackSides, displayOptions }`) — both shapes are accepted. */
export async function fetchOrgTree(rootEn: string): Promise<OrgTreeResult> {
  if (!USE_MOCK_DATA) {
    const data = await apiFetch<OrgPerson | OrgSnapshot>(employeePath(rootEn));
    return isOrgSnapshot(data) ? { tree: data.tree, snapshot: data } : { tree: data, snapshot: null };
  }

  await delay(LATENCY_MS);
  let found: OrgPerson | null = null;
  walk(getDb(), (n) => {
    if (n.en === rootEn) found = n;
  });
  if (!found) throw new Error("Person not found: " + rootEn);
  return { tree: structuredClone(found), snapshot: null };
}

/** Persists a person edit (name/title/teamName/dept) server-side. OrgChart keeps its
 *  own localStorage copy as the source of truth for rendering, so callers should treat
 *  this as best-effort sync — it lets edits survive across devices once a real backend
 *  is connected, but a failed/absent backend must never block editing locally. */
export async function savePersonOverride(en: string, updates: PersonOverride): Promise<void> {
  if (USE_MOCK_DATA) return;
  await apiFetch<void>(`/people/${encodeURIComponent(en)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
