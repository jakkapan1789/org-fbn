import type { OrgPerson } from "./types";

// Deterministic sample-company generator backing the mock API (api.ts).
// No randomness, so the same tree is produced on every load.

const FIRST_NAMES = [
  "Somchai", "Somying", "Wichai", "Arunee", "Prayuth", "Kanokwan", "Thanakorn", "Piyada", "Nattapon", "Supaporn",
  "Worawut", "Jiraporn", "Chaiwat", "Pimjai", "Anucha", "Siriporn", "Kittisak", "Rattana", "Teerapong", "Wilaiwan",
  "Surachai", "Napaporn", "Adisak", "Benjamas", "Weerayut", "Chantima", "Preecha", "Sunisa", "Thawatchai", "Aree",
];
const LAST_NAMES = [
  "Jaidee", "Rakrian", "Srisuk", "Mankong", "Charoenporn", "Suksan", "Wongthai", "Thongdee", "Kaewmanee", "Boonmee",
  "Siriwat", "Phongphan", "Rungruang", "Thanawut", "Saithong",
];

const IC_TITLES = [
  "System Analyst", "Senior System Analyst", "Business Analyst", "Software Engineer",
  "Senior Software Engineer", "QA Engineer", "Data Analyst",
];

// Level code pool per hierarchy tier (0=Executive … 4=Team Member). The code's letter
// prefix maps back to the tier (see levelMeta.ts); the digit is the band within it, so
// two Team Members on the same tier can still be "B1" vs "B3".
const LEVEL_CODES_BY_TIER: Record<number, string[]> = {
  0: ["C1"],
  1: ["V1", "V2"],
  2: ["D1", "D2"],
  3: ["M1", "M2", "M3"],
  4: ["B1", "B2", "B3", "B4"],
};
function levelCodeFor(tier: number, seed: number): string {
  const pool = LEVEL_CODES_BY_TIER[tier] ?? LEVEL_CODES_BY_TIER[4];
  return pool[seed % pool.length];
}

let counter = 0;

function nextPerson() {
  const f = FIRST_NAMES[counter % FIRST_NAMES.length];
  const l = LAST_NAMES[Math.floor(counter / FIRST_NAMES.length) % LAST_NAMES.length];
  const seed = counter;
  const en = "EN" + String(counter + 1).padStart(5, "0");
  counter++;
  return {
    seed,
    en,
    name: f + " " + l.charAt(0) + ".",
    initials: f[0] + l[0],
    email: "emp" + (counter + 1000) + "@company.co.th",
    phone: "0" + (81 + (counter % 9)) + "-" + String(100 + (counter * 7) % 900) + "-" + String(1000 + (counter * 13) % 9000).slice(0, 4),
  };
}

function makePerson(tier: number, title: string, dept: string): OrgPerson {
  const { seed, ...p } = nextPerson();
  return { ...p, level: levelCodeFor(tier, seed), title, dept, children: [], headcount: 0, childLayout: "horizontal" };
}

// Attach computed fields: headcount (total reports below) and childLayout,
// based on an explicit per-node `layout` or the >4-children auto threshold.
function annotateTree(node: OrgPerson): number {
  let headcount = 0;
  for (const c of node.children) {
    headcount += 1 + annotateTree(c);
  }
  node.headcount = headcount;
  node.childLayout = node.layout ?? (node.children.length > 4 ? "vertical" : "horizontal");
  return headcount;
}

// Full company: CEO → VPs → Directors → Managers → (Lead System Analyst →) analysts/engineers.
// Any node can be picked as the root of a rendered chart via the mock API.
export function buildCompanyTree(): OrgPerson {
  counter = 0;

  const ceo = makePerson(0, "CEO", "Executive Office");

  const vpDefs = [
    { dept: "Engineering", directors: 3 },
    { dept: "Sales & Marketing", directors: 2 },
    { dept: "Finance & Operations", directors: 2 },
  ];

  let mi = 0; // global manager index — drives deterministic team-size variation
  ceo.children = vpDefs.map((vpDef, vi) => {
    const vp = makePerson(1, "VP", vpDef.dept);
    vp.children = Array.from({ length: vpDef.directors }, (_, di) => {
      const dir = makePerson(2, "Director", vpDef.dept);
      const mgrCount = 2 + ((di + vi) % 2); // 2–3 managers per director
      dir.children = Array.from({ length: mgrCount }, () => {
        const mgr = makePerson(3, "Manager", vpDef.dept);
        if (mi === 0) mgr.teamName = "MES Team"; // custom team label, shown above the card
        const icCount = 3 + (mi % 3); // 3–5 direct ICs per manager
        mgr.children = Array.from({ length: icCount }, (_, ii) =>
          makePerson(4, IC_TITLES[(mi + ii) % IC_TITLES.length], vpDef.dept),
        );
        if (mi % 3 === 0) {
          // every 3rd manager also has a lead running a sub-team
          const lead = makePerson(3, "Lead System Analyst", vpDef.dept);
          lead.layout = "vertical";
          lead.teamName = "Team Lead"; // custom team label, shown above the card
          lead.children = Array.from({ length: 4 }, (_, ii) =>
            makePerson(4, ii === 0 ? "Senior System Analyst" : "System Analyst", vpDef.dept),
          );
          mgr.children.push(lead);
        }
        mi++;
        return mgr;
      });
      return dir;
    });
    return vp;
  });

  addPreechaSubTeam(ceo);
  addSingleReportMockup(ceo);
  annotateTree(ceo);
  return ceo;
}

// Test fixture: give "Preecha J." (a leaf IC deep inside a vertical stack) their own
// sub-team — including a sub-lead who leads yet another sub-team — to exercise the
// deepest nesting the layout supports (stack within stack within stack).
function addPreechaSubTeam(root: OrgPerson) {
  let preecha: OrgPerson | null = null;
  const find = (n: OrgPerson) => {
    if (!preecha && n.name === "Preecha J.") preecha = n;
    n.children.forEach(find);
  };
  find(root);
  if (!preecha) return;

  const target: OrgPerson = preecha;
  const dept = target.dept;
  const subLead = makePerson(3, "Lead System Analyst", dept);
  subLead.teamName = "Team Lead"; // custom team label, shown above the card
  subLead.children = [makePerson(4, "System Analyst", dept), makePerson(4, "QA Engineer", dept)];
  target.children = [makePerson(4, "Software Engineer", dept), subLead, makePerson(4, "Data Analyst", dept)];
}

// Test fixture: give "Chantima J." (another leaf IC) exactly one direct report on a
// vertical layout, to exercise the single-report case — it should drop straight down
// from the parent instead of sitting offset to one side like a multi-report stack.
function addSingleReportMockup(root: OrgPerson) {
  let chantima: OrgPerson | null = null;
  const find = (n: OrgPerson) => {
    if (!chantima && n.name === "Chantima J.") chantima = n;
    n.children.forEach(find);
  };
  find(root);
  if (!chantima) return;

  const target: OrgPerson = chantima;
  target.layout = "vertical";
  target.children = [makePerson(4, "Software Engineer", target.dept)];
}
