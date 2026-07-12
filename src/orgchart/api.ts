import type { OrgPerson, PersonOverride, PersonSummary } from "./types";
import { buildCompanyTree } from "./orgData";
import { ApiError, apiFetch } from "./apiClient";
import { USE_MOCK_DATA } from "./apiConfig";

// Backend boundary. Three endpoints back the whole app — point VITE_API_BASE_URL (see
// .env.example) at a real backend that calls the database and returns JSON shaped per
// ./types, and these take over automatically:
//   GET   /people/by-en/:en            → PersonSummary | 404 (findPersonByEn — root picker)
//   GET   /people/:id/org-tree         → OrgPerson           (fetchOrgTree — chosen subtree)
//   PATCH /people/:id                  → 204                 (savePersonOverride — an edit)
// With VITE_API_BASE_URL unset, everything below falls back to the deterministic mock
// generator (orgData.ts), so the app runs standalone with no backend at all.

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
      return await apiFetch<PersonSummary>(`/people/by-en/${encodeURIComponent(query)}`);
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
      id: n.id,
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

/** The chosen person plus everyone under them, as a detached tree. */
export async function fetchOrgTree(rootId: string): Promise<OrgPerson> {
  if (!USE_MOCK_DATA) return apiFetch<OrgPerson>(`/people/${encodeURIComponent(rootId)}/org-tree`);

  await delay(LATENCY_MS);
  let found: OrgPerson | null = null;
  walk(getDb(), (n) => {
    if (n.id === rootId) found = n;
  });
  if (!found) throw new Error("Person not found: " + rootId);
  return structuredClone(found);
}

/** Persists a person edit (name/title/teamName/dept) server-side. OrgChart keeps its
 *  own localStorage copy as the source of truth for rendering, so callers should treat
 *  this as best-effort sync — it lets edits survive across devices once a real backend
 *  is connected, but a failed/absent backend must never block editing locally. */
export async function savePersonOverride(id: string, updates: PersonOverride): Promise<void> {
  if (USE_MOCK_DATA) return;
  await apiFetch<void>(`/people/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}
