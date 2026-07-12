import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Pencil, RefreshCcw, Search, SlidersHorizontal } from "lucide-react";
import type {
  AnnotatedNode,
  DisplayOptions,
  LayoutDirection,
  OrgPerson,
  OrgSnapshot,
  PersonOverride,
  StackSide,
} from "./types";
import { DEFAULT_DISPLAY_OPTIONS } from "./types";
import { fetchOrgTree, savePersonOverride } from "./api";
import { annotate } from "./annotate";
import { usePersistentState } from "./usePersistentState";
import {
  buildSnapshot,
  downloadSnapshotFile,
  fetchSnapshotFile,
  loadSnapshot,
  pruneDeleted,
  saveSnapshot,
  slugifyTitle,
} from "./snapshot";
import { OrgTree } from "./OrgTree";
import { RootPicker } from "./RootPicker";
import { ExportDialog } from "./ExportDialog";
import { LegendPanel } from "./LegendPanel";
import { ZoomControls } from "./ZoomControls";
import { PersonModal } from "./PersonModal";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;

const DISPLAY_OPTION_LABELS: { key: keyof DisplayOptions; label: string }[] = [
  { key: "showAvatar", label: "รูปโปรไฟล์" },
  { key: "showName", label: "ชื่อ" },
  { key: "showPosition", label: "ตำแหน่ง" },
  { key: "showHeadcount", label: "จำนวนทีม (ทุกระดับ)" },
  { key: "showGrade", label: "เกรด/Level (B1, B2, …)" },
];

// User edits (name/title/teamName/dept) merged over the fetched tree before annotation —
// a fresh tree each time, never mutating the fetched one, so unrelated re-fetches (e.g.
// switching root back and forth) can't leak stale object identities into React state.
function applyOverrides(node: OrgPerson, overrides: Record<string, PersonOverride>): OrgPerson {
  return {
    ...node,
    ...overrides[node.id],
    children: node.children.map((c) => applyOverrides(c, overrides)),
  };
}

// Headcount per level index (0=Executive … 4=Team Member) for the LegendPanel summary —
// counts the whole current tree regardless of search/collapse state, matching what
// `headcount` already means elsewhere in the app (every level below the root).
function countByLevel(node: OrgPerson): number[] {
  const counts = [0, 0, 0, 0, 0];
  const walk = (n: OrgPerson) => {
    counts[Math.min(n.level, counts.length - 1)]++;
    n.children.forEach(walk);
  };
  walk(node);
  return counts;
}

interface OrgChartProps {
  /** Preview mode (every route except ?mode=edit): same data, read-only — no layout/
   *  side toggles, no person-edit affordance. Search, zoom, pan, expand/collapse, and
   *  display-option toggles stay live since none of them write person data. */
  readOnly?: boolean;
}

export function OrgChart({ readOnly = false }: OrgChartProps) {
  const [tree, setTree] = useState<OrgPerson | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [rootId, setRootId] = usePersistentState<string | null>("orgchart:rootId", null);
  // Layout overrides are keyed by person id, so they survive switching roots too.
  const [layoutOverrides, setLayoutOverrides] = usePersistentState<Record<string, LayoutDirection>>(
    "orgchart:layoutOverrides",
    {},
  );
  // Which side each node's vertical stack hangs on, keyed by person id (default right).
  const [stackSides, setStackSides] = usePersistentState<Record<string, StackSide>>("orgchart:stackSides", {});
  // Live-edited fields (name/title/teamName), keyed by person id — survives root switches
  // the same way layoutOverrides/stackSides do.
  const [personOverrides, setPersonOverrides] = usePersistentState<Record<string, PersonOverride>>(
    "orgchart:personOverrides",
    {},
  );
  // Admin-deleted people (and, transitively, everyone under them) — a flat id set, global
  // across roots like the maps above, since deleting someone removes them from the org
  // wherever they'd otherwise appear.
  const [deletedIds, setDeletedIds] = usePersistentState<string[]>("orgchart:deletedIds", []);
  const deletedIdsSet = useMemo(() => new Set(deletedIds), [deletedIds]);
  // A frozen Export snapshot loaded for Preview — bypasses the shared persisted overrides
  // above entirely (both directions: preview must never read admin's in-progress live
  // edits, and must never write back into the same localStorage keys the admin tab uses).
  const [previewSnapshot, setPreviewSnapshot] = useState<OrgSnapshot | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = usePersistentState<DisplayOptions>(
    "orgchart:displayOptions",
    DEFAULT_DISPLAY_OPTIONS,
    (stored) => {
      const merged = { ...DEFAULT_DISPLAY_OPTIONS, ...(stored as Partial<DisplayOptions>) };
      return merged.showAvatar || merged.showName || merged.showPosition ? merged : DEFAULT_DISPLAY_OPTIONS;
    },
  );
  // The Admin page is always edit mode — viewing without editing is what the Export'd
  // preview links are for, so there is no view/edit toggle here.
  const editingDisabled = readOnly;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<AnnotatedNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // "path info": which org this URL points at, and where to read it from. Read once on
  // mount — query params rather than a real route so the app still works on static hosting
  // with zero server-side rewrite config (see App.tsx for both routes).
  const { urlOrgId, fileTitle } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      urlOrgId: params.get("org"),
      // ?source=jsonfile&title=… — read the published file, never localStorage or live data.
      fileTitle: params.get("source") === "jsonfile" ? params.get("title") : null,
    };
  }, []);

  function syncUrlOrgId(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("org", id);
    else url.searchParams.delete("org");
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    // File-backed preview: the .json under public/orgs/ is the whole source of truth, so
    // this branch never touches rootId, localStorage, or api.ts. A missing/invalid file
    // leaves `tree` null and the empty state explains which title failed.
    if (fileTitle !== null) {
      setTreeLoading(true);
      fetchSnapshotFile(fileTitle)
        .then((snapshot) => {
          if (!snapshot) return;
          setPreviewSnapshot(snapshot);
          setTree(snapshot.tree);
        })
        .finally(() => setTreeLoading(false));
      return;
    }

    const initialId = urlOrgId ?? rootId;
    if (!initialId) return;
    setTreeLoading(true);

    if (readOnly) {
      // Fast path: an exported snapshot renders instantly with no fetch at all. No
      // snapshot yet for this org → fall back to live data, same as before this feature.
      const snapshot = loadSnapshot(initialId);
      if (snapshot) {
        setPreviewSnapshot(snapshot);
        setTree(snapshot.tree);
        setTreeLoading(false);
        return;
      }
      fetchOrgTree(initialId)
        .then(setTree)
        .catch(() => {})
        .finally(() => setTreeLoading(false));
      return;
    }

    if (urlOrgId && urlOrgId !== rootId) setRootId(urlOrgId);
    fetchOrgTree(initialId)
      .then(setTree)
      .catch(() => setRootId(null))
      .finally(() => setTreeLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  async function selectRoot(id: string) {
    setRootId(id);
    setTreeLoading(true);
    setTree(null);
    setSelectedNode(null);
    setCollapsed({});
    setSearchQuery("");
    syncUrlOrgId(id);
    try {
      setTree(await fetchOrgTree(id));
    } catch {
      setRootId(null);
    } finally {
      setTreeLoading(false);
    }
  }

  // Loads a previously-exported .json directly, skipping api.ts entirely — the file's
  // `tree` already has that session's edits/deletions baked in, so personOverrides/
  // deletedIds reset rather than layering the *current* browser's unrelated customizations
  // on top of someone else's export. Also refreshes the localStorage snapshot copy, so
  // Preview works immediately even on a browser that never ran Export for this org.
  function importSnapshot(snapshot: OrgSnapshot) {
    setRootId(snapshot.orgId);
    setTree(snapshot.tree);
    setLayoutOverrides(snapshot.layoutOverrides ?? {});
    setStackSides(snapshot.stackSides ?? {});
    setDisplayOptions((prev) => {
      const merged = { ...DEFAULT_DISPLAY_OPTIONS, ...snapshot.displayOptions };
      return merged.showAvatar || merged.showName || merged.showPosition ? merged : prev;
    });
    setPersonOverrides({});
    setDeletedIds([]);
    setSelectedNode(null);
    setCollapsed({});
    setSearchQuery("");
    setTreeLoading(false);
    syncUrlOrgId(snapshot.orgId);
    saveSnapshot(snapshot);
  }

  function resetRoot() {
    setRootId(null);
    setTree(null);
    setSelectedNode(null);
    setSettingsOpen(false);
    syncUrlOrgId(null);
  }

  function openPreview() {
    if (!rootId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("mode"); // no mode = read-only preview, the default route
    url.searchParams.set("org", rootId);
    window.open(url.toString(), "_blank", "noopener");
  }

  function handleExport(title: string) {
    if (!rootId || !treeWithOverrides) return;
    const snapshot = buildSnapshot(rootId, title, treeWithOverrides, layoutOverrides, stackSides, displayOptions);
    saveSnapshot(snapshot);
    downloadSnapshotFile(snapshot);
    // Straight to the read-only link — the blob download above has already started, so
    // navigating the tab away doesn't cancel it. Dropping mode=edit is what makes the
    // destination read-only: no mode = preview, the default route.
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.set("org", rootId);
    window.location.assign(url.toString());
  }

  // Seeded from the previous Export of this org, else from the root person — the admin
  // renaming a chart on every re-export would silently orphan the published file.
  function defaultExportTitle(): string {
    if (!rootId || !treeWithOverrides) return "";
    return loadSnapshot(rootId)?.title || slugifyTitle(`${treeWithOverrides.dept} ${treeWithOverrides.name}`);
  }

  function deletePerson(id: string) {
    setDeletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setSelectedNode((prev) => (prev && prev.id === id ? null : prev));
  }

  const treeWithOverrides = useMemo(() => {
    if (!tree) return null;
    if (previewSnapshot) return tree; // already final as of export — never re-derived
    return applyOverrides(pruneDeleted(tree, deletedIdsSet), personOverrides);
  }, [tree, personOverrides, deletedIdsSet, previewSnapshot]);

  const effectiveLayoutOverrides = previewSnapshot ? previewSnapshot.layoutOverrides : layoutOverrides;
  const effectiveStackSides = previewSnapshot ? previewSnapshot.stackSides : stackSides;

  const annotatedTree = useMemo(
    () =>
      treeWithOverrides
        ? annotate(treeWithOverrides, searchQuery, collapsed, effectiveLayoutOverrides, effectiveStackSides)
        : null,
    [treeWithOverrides, searchQuery, collapsed, effectiveLayoutOverrides, effectiveStackSides],
  );

  const levelCounts = useMemo(() => (treeWithOverrides ? countByLevel(treeWithOverrides) : []), [treeWithOverrides]);

  function toggleNode(id: string) {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }

  function toggleLayout(id: string, next: LayoutDirection) {
    setLayoutOverrides((o) => ({ ...o, [id]: next }));
  }

  function toggleSide(id: string, next: StackSide) {
    setStackSides((s) => ({ ...s, [id]: next }));
  }

  function savePerson(id: string, updates: PersonOverride) {
    setPersonOverrides((o) => ({ ...o, [id]: { ...o[id], ...updates } }));
    // Reflect the edit in the open modal immediately, without waiting on the tree/annotate
    // recompute — same node reference otherwise, so the modal wouldn't show new values.
    setSelectedNode((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
    // Best-effort sync to a real backend when one is connected (see api.ts /
    // apiConfig.ts) — localStorage above already has the edit either way, so a failed
    // or absent backend must never block editing.
    savePersonOverride(id, updates).catch(() => {});
  }

  function toggleDisplayOption(key: keyof DisplayOptions) {
    setDisplayOptions((o) => {
      const next = { ...o, [key]: !o[key] };
      // keep at least one field visible so cards never render empty
      return next.showAvatar || next.showName || next.showPosition ? next : o;
    });
  }

  function setZoom(z: number) {
    setZoomLevel(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 10) / 10)));
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-card]") || target.closest("[data-chevron]")) return;
    const c = containerRef.current;
    if (!c) return;
    dragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: c.scrollLeft, scrollTop: c.scrollTop };
  }
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const c = containerRef.current;
    if (!drag || !c) return;
    c.scrollLeft = drag.scrollLeft - (e.clientX - drag.x);
    c.scrollTop = drag.scrollTop - (e.clientY - drag.y);
  }
  function handleMouseUp() {
    dragRef.current = null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#eef1f6] font-sans">
      <div className="z-20 flex h-[66px] shrink-0 items-center justify-between bg-white px-[26px] shadow-[0_1px_0_rgba(16,24,40,0.06),0_2px_12px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-[13px]">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[linear-gradient(140deg,#5b93f2,#2E6FDB)] shadow-[0_4px_10px_rgba(46,111,219,0.35)]">
            <div className="h-[13px] w-[13px] rounded border-[2.5px] border-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold leading-tight tracking-[.01em] text-[#0f1c2e]">Organization Chart</span>
              {readOnly && (
                <span className="flex items-center gap-1 rounded-full bg-black px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[.04em] text-white">
                  <Eye size={10} /> Preview
                </span>
              )}
              {!readOnly && tree && (
                <span className="flex items-center gap-1 rounded-full bg-[#2E6FDB] px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[.04em] text-white">
                  <Pencil size={10} /> Edit mode
                </span>
              )}
            </div>
            {!tree && !readOnly && (
              <div className="text-[11.5px] leading-tight text-[#8b97a8]">เลือกจุดตั้งต้นเพื่อสร้างผังองค์กร</div>
            )}
            {tree && readOnly && previewSnapshot?.title && (
              <div className="font-mono text-[11.5px] leading-tight text-[#8b97a8]">{previewSnapshot.title}</div>
            )}
            {tree && readOnly && !previewSnapshot && (
              <div className="text-[11.5px] leading-tight text-[#8b97a8]">ยังไม่มีการ Export ผังนี้ — แสดงข้อมูลสดล่าสุด</div>
            )}
          </div>
        </div>

        {tree && (
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Search size={16} className="pointer-events-none absolute left-[13px] text-[#9aa5b5]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อ ตำแหน่ง หรือแผนก"
                className="h-10 w-[260px] rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] pl-9 pr-3.5 text-[13.5px] text-[#0f1c2e] outline-none placeholder:text-[#a2adbd] focus:border-[#2E6FDB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,111,219,0.12)]"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                title="ตั้งค่าการแสดงผลการ์ด"
                className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
              >
                <SlidersHorizontal size={16} />
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-12 z-40 w-[230px] rounded-xl border border-[#e9ecf1] bg-white p-3 shadow-[0_10px_30px_rgba(16,24,40,0.14)]">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#8b97a8]">แสดงข้อมูลในการ์ด</div>
                    {DISPLAY_OPTION_LABELS.map(({ key, label }) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-[#f6f8fb]">
                        <input
                          type="checkbox"
                          checked={displayOptions[key]}
                          onChange={() => toggleDisplayOption(key)}
                          className="h-3.5 w-3.5 accent-[#2E6FDB]"
                        />
                        <span className="text-[12.5px] font-medium text-[#3a4658]">{label}</span>
                      </label>
                    ))}

                    <div className="my-2 border-t border-[#f1f3f6]" />

                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-[#f6f8fb]">
                      <input
                        type="checkbox"
                        checked={displayOptions.centerContent}
                        onChange={() => toggleDisplayOption("centerContent")}
                        className="h-3.5 w-3.5 accent-[#2E6FDB]"
                      />
                      <span className="text-[12.5px] font-medium text-[#3a4658]">จัดกึ่งกลางเนื้อหาทั้งหมด</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {!readOnly && (
              <button
                onClick={() => setExportOpen(true)}
                title="Export ผังปัจจุบันเป็น .json แล้วไปยังลิงก์ดูอย่างเดียวทันที — นำไฟล์ไปวางใน public/orgs/ เพื่อแชร์ลิงก์ให้คนอื่น"
                className="flex h-10 items-center gap-2 rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] px-3.5 text-[12.5px] font-semibold text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
              >
                <Download size={14} />
                Export
              </button>
            )}

            {!readOnly && (
              <button
                onClick={openPreview}
                title="เปิดหน้า Live/Preview mode ในแท็บใหม่ (ดูอย่างเดียว แก้ไขไม่ได้)"
                className="flex h-10 items-center gap-2 rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] px-3.5 text-[12.5px] font-semibold text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
              >
                <Eye size={14} />
                Live/Preview
              </button>
            )}

            {!readOnly && (
              <button
                onClick={resetRoot}
                className="flex h-10 items-center gap-2 rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] px-3.5 text-[12.5px] font-semibold text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
              >
                <RefreshCcw size={14} />
                เปลี่ยนจุดตั้งต้น
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!tree && !treeLoading ? (
          readOnly ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-[#8b97a8]">
              {fileTitle !== null ? (
                <span>
                  ไม่พบไฟล์ผังชื่อ <span className="font-mono text-[#42506a]">{fileTitle}</span> — ตรวจสอบว่าได้วางไฟล์{" "}
                  <span className="font-mono text-[#42506a]">{slugifyTitle(fileTitle) || "…"}.json</span> ไว้ใน{" "}
                  <span className="font-mono text-[#42506a]">public/orgs/</span> แล้วหรือยัง
                </span>
              ) : (
                "ไม่พบผังองค์กรสำหรับลิงก์นี้ — ตรวจสอบว่ามีการกด Export จากหน้า Admin แล้วหรือยัง"
              )}
            </div>
          ) : (
            <RootPicker onSelect={selectRoot} onImport={importSnapshot} />
          )
        ) : (
          <>
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="absolute inset-0 cursor-grab overflow-auto bg-[#eef1f6] [background-image:radial-gradient(circle_at_1px_1px,rgba(16,24,40,0.055)_1px,transparent_0)] [background-size:24px_24px]"
            >
              {!annotatedTree ? (
                <div className="flex h-full items-center justify-center text-sm font-medium text-[#8b97a8]">กำลังโหลดโครงสร้างองค์กร...</div>
              ) : (
                <div style={{ zoom: zoomLevel }} className="flex min-w-max justify-center px-[220px] pb-[200px] pt-20">
                  <OrgTree
                    node={annotatedTree}
                    onToggle={toggleNode}
                    onSelect={setSelectedNode}
                    onToggleLayout={toggleLayout}
                    onToggleSide={toggleSide}
                    displayOptions={displayOptions}
                    readOnly={editingDisabled}
                  />
                </div>
              )}
            </div>

            <LegendPanel counts={levelCounts} />
            <ZoomControls
              zoomLevel={zoomLevel}
              onZoomIn={() => setZoom(zoomLevel + 0.1)}
              onZoomOut={() => setZoom(zoomLevel - 0.1)}
              onZoomReset={() => setZoom(1)}
            />

            {exportOpen && !readOnly && (
              <ExportDialog defaultTitle={defaultExportTitle()} onClose={() => setExportOpen(false)} onConfirm={handleExport} />
            )}

            {selectedNode && (
              <PersonModal
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onSave={savePerson}
                onDelete={deletePerson}
                canDelete={!editingDisabled && selectedNode.id !== rootId}
                readOnly={editingDisabled}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
