# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (pass `-- --port NNNN` to pick a port)
- `npm run build` — type-check (`tsc -b`) + production build
- `npx tsc --noEmit` — type-check only
- `npm run lint` — oxlint

There is no test suite. Verification is done by driving the app in a headless browser: temporarily `npm install -D playwright --no-save` (Chromium is already in the ms-playwright cache), script against the dev server, screenshot, then uninstall. Screenshots alone are not enough for connector-alignment work — measure `getBoundingClientRect()` centers and assert the diff is 0.

## Architecture

React 19 + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no tailwind.config; theme lives in `@theme` in `src/index.css`) + lucide-react icons. Fonts (IBM Plex Sans Thai / IBM Plex Mono) load from Google Fonts in `index.html`. UI copy is mixed Thai/English by design.

The app is a single feature in `src/orgchart/`, originally ported from a Claude Design project ("Organization chart web with vertical layout"). Data flow:

1. `orgData.ts` — deterministic full-company generator (`buildCompanyTree()`: CEO → VPs → Directors → Managers → Lead System Analyst/analysts); no randomness so renders are reproducible. Computes `headcount` and `childLayout` per node (explicit `layout` field wins; otherwise >4 children ⇒ `vertical`).
2. `api.ts` — **mock backend boundary**. `findPersonByEn(en)` (one person by employee number, for the root picker; `null` when nobody matches), `fetchOrgTree(rootId)` (chosen person + everyone under them, as a detached `structuredClone`), and `savePersonOverride(id, updates)`, all async with simulated latency. To add a real backend, replace only these function bodies — the rest of the app depends solely on their signatures.
3. `annotate.ts` — pure function folding UI state (search query, collapsed map, per-node `layoutOverrides`, per-node `stackSides`) into an `AnnotatedNode` tree per render: `expanded`, `highlighted`, `dimmed`, `layoutHorizontal/Vertical`, `stackSide` (search auto-expands matching branches; layout override wins over the node's `childLayout`). **`stackSide` is which column a node sits in within its parent's vertical stack** (`left`/`right`, default `right`) and **inherits**: a node uses its explicit `stackSides[id]` if set, else its nearest ancestor's effective side (root `right`) — so a subtree stays on one side unless a descendant is explicitly flipped. A parent buckets its children by their `stackSide`: mixed → two-column split (see geometry); uniform → single column.
4. `OrgChart.tsx` — owns all state (fetched tree, collapsed, layoutOverrides, stackSides, displayOptions, search, zoom, selected node). `rootId`, `layoutOverrides`, `stackSides`, and `displayOptions` persist to localStorage via `usePersistentState.ts` (keys `orgchart:*`) — on mount the saved root is re-fetched automatically, the per-id maps survive root switches, and displayOptions are sanitized against the current shape on load. When no tree is loaded it renders `RootPicker.tsx` (EN lookup → result card → "สร้างผังองค์กร" → `fetchOrgTree`, or Import of an exported .json); otherwise the pannable/zoomable canvas (drag-to-scroll via `scrollLeft/scrollTop`; zoom via CSS `zoom`) plus `LegendPanel`, `ZoomControls`, `PersonModal`, a display-options popover (Profile/Name/Position checkboxes — at least one must stay enabled), and a "change root" button back to the picker.
5. `OrgTree.tsx` — recursive layout renderer; threads `displayOptions`/`onToggleLayout`/`onToggleSide` down to every card.
6. `OrgCard.tsx` — every card renders the same fixed-width horizontal layout (`CARD_WIDTH` = 180px: avatar left, name/position stacked right; avatar centers itself when it's the only visible field). The `compact` prop does not change the card's look — it marks "row of a vertical stack": hides the layout toggle, shows the side toggle on the card's outer edge, and makes `OrgTree` force nested children vertical. It is set for direct children inside a vertical stack only — not inherited deeper. The position badge shows `node.title` (VP, Director, Lead System Analyst, …) colored by level. Cards get up to three floating buttons: layout H/V toggle (top-right, `data-layout-toggle`, non-compact only), stack-side L/R toggle (`data-side-toggle` — on a compact card it sits on the card's *outer* edge and moves that card to the other column; on a non-compact vertical parent it sits top-left and sets the default column its children fall into; shown on every card whose children render vertically), and the expand/collapse chevron (`data-chevron`).

Level colors/gradients live in `levelMeta.ts` (index = `node.level`, 0=Executive … 4=Team Member); `LEVEL_META` order must match the `level` numbers assigned in `orgData.ts`.

## Routes and the Export → read-only flow

`App.tsx` routes on query params only (no router — a path route would need SPA-fallback rewrites on static hosting). **Read-only is the default**: only `?mode=edit` is editable, so stripping params off a shared link can never land on the editor:

- `?mode=edit` → Admin page, always in edit mode (there is no view/edit toggle). Search an EN → "สร้างผังองค์กร" loads the tree ready to customize. **Export**: `ExportDialog.tsx` asks for a chart name, `snapshot.ts` slugifies it (`slugifyTitle` — Thai letters kept, everything else dashed) and builds an `OrgSnapshot` with the edits already baked into `tree`. The snapshot is saved to `localStorage` (`orgchart:snapshot:<orgId>`), downloaded as `<title>.json`, and the tab then redirects to the read-only `?org=<id>` link.
- no `mode=edit` (including a bare URL) → read-only. `?org=<id>` reads that localStorage snapshot (falls back to live data when the browser has none). Same-browser only.
- `?source=jsonfile&title=<title>` → read-only (even if `mode=edit` is also present), `fetchSnapshotFile()` fetches `public/orgs/<title>.json`. **The shareable link**: no localStorage, no api.ts, so any visitor sees the same chart. Publishing is a manual step — move the downloaded .json into `public/orgs/`. A missing/invalid file renders an empty state naming the title, and never falls back to live data.

`readOnly` (every route except `?mode=edit`) hides Export/root-switching and all layout/side toggles; search, zoom, pan, collapse, and display options stay live since none of them write person data.

## Connector geometry — do not regress

The tree connector lines in `OrgTree.tsx` were repeatedly broken by trying to connect a card to a trunk with a **fixed-width** stub, or by making split subtrees **overflow** (uncounted) to keep a card at a column edge — both fail when a child is itself a wide split (its card sits far from the trunk, and overflow overlaps siblings). The current design fixes this with **normal-flow layout + flex-fill leads**, so a split subtree takes real width (siblings make room, no overlap) and every card connects regardless of how far it is from the trunk.

**A vertical parent buckets its children by `stackSide` into a LEFT column (cards left of a central trunk) and a RIGHT column (cards right).** `arrangementOf(node, rendersVertical)` returns `"split"` (both sides), `"left"`/`"right"` (single side), or `null`. Pass `rendersVertical = compact || node.layoutVertical` — a compact node forces its children vertical even when its own `childLayout` is horizontal, so `node.layoutVertical` alone is wrong. `stackSide` inherits (see the data-flow section), so a subtree stays on one side unless a descendant is explicitly flipped.

- **Flex-fill lead (the key mechanism).** A node that is a row in a parent column (`incomingLead` set) renders its card in a `flex w-full items-center` row: `[spacer][cardBox shrink-0][spacer]`, both spacers `grow basis-2.5`. The spacer on the trunk side is a visible line (`bg-[#cfd7e2]`), the other is blank — so the card stays centred over its own subtree while a line fills the *variable* gap to the trunk. Never replace this with a fixed-width stub.
- **Split (both columns)**: `grid grid-cols-[1fr_auto_1fr]` centred under the parent card — the equal `1fr` side tracks put the `auto` middle track (the central trunk, `w-0.5 self-stretch`) exactly under the card centre / chevron, whatever the columns' widths. Left column feeds children `incomingLead="right"`, right column `incomingLead="left"`. A `left-1/2` head segment bridges the card bottom to the trunk. Everything is in flow, so a wide split child widens its column and the grid keeps both `1fr` tracks equal — the sibling column moves over instead of overlapping.
- **Single column**: `flex` with a `w-0.5 self-stretch` trunk beside a `column`, shifted `ml-[89px]`/`mr-[89px]` so the trunk lands under the parent card centre (x≈90). Children get `incomingLead` toward the trunk.
- **Horizontal rows**: unchanged — each child column draws half-bars from its card's anchor to the gap midpoint (`right-1/2`/`left-1/2` + `calc(50%+6px)` for centred children; `left-[89px]`/`right-[89px]` + `ml/mr-[89px]` for a child whose own stack is single-column `right`/`left`). `arrangementOf(child, child.layoutVertical)` picks the anchor; a **split** child is centred (anchor 50%).
- **The expand/collapse chevron is always bottom-center** (`-bottom-2.5 left-1/2 -translate-x-1/2`), `z-10` so trunk segments paint behind it.
- **Inside a vertical stack, descendants always render vertically** (`compact` forces `verticalChildren`), because a horizontal fan-out hanging off a stack row cannot connect cleanly to the trunk. Correspondingly, compact cards hide the layout toggle (but keep the side toggle, on the outer edge).

Interaction guards: `OrgChart`'s drag-to-pan ignores mousedown on `[data-card]` / `[data-chevron]`; keep those data attributes on anything clickable inside the canvas.
