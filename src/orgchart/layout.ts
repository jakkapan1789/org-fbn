import type { AnnotatedNode } from "./types";
import { CARD_WIDTH } from "./OrgCard";

// Minimum horizontal clearance kept between the ink of any two subtrees that end up
// adjacent after compaction — whether they are direct siblings or unrelated branches
// that happen to land next to each other once whitespace is squeezed out.
const MIN_GAP = 6;
// Vertical gap between stacked cards in a vertical column.
const ROW_GAP = 4;
// Vertical gap between a parent row and a horizontal children row.
const LEVEL_GAP = 36;
// How far below the parent card the horizontal "bus" line sits, for a row of children.
const BUS_DROP = 18;
// Horizontal gap from a vertical stack's trunk (centred under the parent card) to the
// stack's card column.
const STACK_GAP = 20;
// Extra clearance reserved above a card that shows a `teamName` label (OrgCard renders
// it at -top-6 off the card's own top edge) so the label never overlaps the connector
// line or row above it.
const TEAM_LABEL_EXTRA = 28;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutResult {
  boxes: Map<string, Box>;
  /** ENs of nodes that should render as a compact stack-row card. */
  compact: Set<string>;
  lines: ConnectorLine[];
  width: number;
  height: number;
}

type Arrangement = "split" | "left" | "right" | null;

function arrangementOf(n: AnnotatedNode, rendersVertical: boolean): Arrangement {
  if (!(n.expanded && n.children.length > 0 && rendersVertical)) return null;
  const hasLeft = n.children.some((c) => c.stackSide === "left");
  const hasRight = n.children.some((c) => c.stackSide === "right");
  if (hasLeft && hasRight) return "split";
  return hasRight ? "right" : "left";
}

// A boundary segment: over y in [y0, y1), the subtree's silhouette reaches out to x.
interface Seg {
  y0: number;
  y1: number;
  x: number;
}

interface Subtree {
  boxes: Map<string, Box>;
  compact: Set<string>;
  lines: ConnectorLine[];
  leftContour: Seg[];
  rightContour: Seg[];
  bottom: number;
  ownBox: Box;
}

function shift(s: Subtree, dx: number, dy: number): Subtree {
  if (dx === 0 && dy === 0) return s;
  const boxes = new Map<string, Box>();
  for (const [id, b] of s.boxes) boxes.set(id, { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
  return {
    boxes,
    compact: s.compact,
    lines: s.lines.map((l) => ({ x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy })),
    leftContour: s.leftContour.map((seg) => ({ y0: seg.y0 + dy, y1: seg.y1 + dy, x: seg.x + dx })),
    rightContour: s.rightContour.map((seg) => ({ y0: seg.y0 + dy, y1: seg.y1 + dy, x: seg.x + dx })),
    bottom: s.bottom + dy,
    ownBox: { x: s.ownBox.x + dx, y: s.ownBox.y + dy, w: s.ownBox.w, h: s.ownBox.h },
  };
}

// Smallest rightward shift that must be applied to `rightContour` so nothing in it comes
// within MIN_GAP of `leftContour`, for every y-range where the two subtrees overlap.
function minShiftToClear(leftContour: Seg[], rightContour: Seg[]): number {
  let need = 0;
  for (const l of leftContour) {
    for (const r of rightContour) {
      const overlap = Math.min(l.y1, r.y1) - Math.max(l.y0, r.y0);
      if (overlap > 0) {
        const req = l.x + MIN_GAP - r.x;
        if (req > need) need = req;
      }
    }
  }
  return need;
}

function mergeBoxes(subs: Subtree[]): Map<string, Box> {
  const out = new Map<string, Box>();
  for (const s of subs) for (const [id, b] of s.boxes) out.set(id, b);
  return out;
}
function mergeCompact(subs: Subtree[]): Set<string> {
  const out = new Set<string>();
  for (const s of subs) for (const id of s.compact) out.add(id);
  return out;
}
function mergeLines(subs: Subtree[]): ConnectorLine[] {
  return subs.flatMap((s) => s.lines);
}

// Normalises a subtree so its leftmost content sits at x = 0 (the caller can then shift
// it wherever it needs to go). Every subtree returned by layoutSubtree satisfies this.
//
// `extraContour` covers connector *lines* that reach further out than any card — e.g. a
// vertical stack's trunk sits under the parent's centre, which for a "left" stack can be
// to the right of every child card. Without it, a neighbouring branch's compaction only
// sees card edges and can compact right through a trunk/bus line that isn't under a card.
function normalise(
  ownBox: Box,
  placedChildren: Subtree[],
  extraLines: ConnectorLine[],
  extraContour: Seg[],
  compactSelf: Set<string>,
): Subtree {
  let minX = ownBox.x;
  for (const p of placedChildren) for (const seg of p.leftContour) minX = Math.min(minX, seg.x);
  for (const seg of extraContour) minX = Math.min(minX, seg.x);

  const dx = -minX;
  const box = { x: ownBox.x + dx, y: ownBox.y, w: ownBox.w, h: ownBox.h };
  const shiftedChildren = placedChildren.map((p) => shift(p, dx, 0));
  const shiftedExtraLines = extraLines.map((l) => ({ x1: l.x1 + dx, y1: l.y1, x2: l.x2 + dx, y2: l.y2 }));
  const shiftedExtraContour = extraContour.map((seg) => ({ ...seg, x: seg.x + dx }));

  const boxes = mergeBoxes(shiftedChildren);

  const leftContour: Seg[] = [
    { y0: box.y, y1: box.y + box.h, x: box.x },
    ...shiftedExtraContour,
    ...shiftedChildren.flatMap((p) => p.leftContour),
  ];
  const rightContour: Seg[] = [
    { y0: box.y, y1: box.y + box.h, x: box.x + box.w },
    ...shiftedExtraContour,
    ...shiftedChildren.flatMap((p) => p.rightContour),
  ];
  const bottom = shiftedChildren.length ? Math.max(box.y + box.h, ...shiftedChildren.map((p) => p.bottom)) : box.y + box.h;

  return {
    boxes,
    compact: new Set([...compactSelf, ...mergeCompact(shiftedChildren)]),
    lines: [...shiftedExtraLines, ...mergeLines(shiftedChildren)],
    leftContour,
    rightContour,
    bottom,
    ownBox: box,
  };
}

function layoutSubtree(node: AnnotatedNode, y: number, cardHeight: number, compactSelf: boolean): Subtree {
  const ownBox: Box = { x: 0, y, w: CARD_WIDTH, h: cardHeight };
  const selfCompact = new Set<string>(compactSelf ? [node.en] : []);
  const verticalChildren = compactSelf || node.layoutVertical;
  const arrangement = arrangementOf(node, verticalChildren);
  const showChildren = node.expanded && node.children.length > 0;

  if (!showChildren) {
    const result = normalise(ownBox, [], [], [], selfCompact);
    result.boxes.set(node.en, result.ownBox);
    return result;
  }

  if (arrangement === null) {
    // If any child in the row carries a team-name label, push the whole row down by the
    // same amount so every card in the row still lines up at one y — a label on just one
    // card must not stagger it out of line with its siblings.
    const rowExtra = node.children.some((c) => c.teamName) ? TEAM_LABEL_EXTRA : 0;
    const childY = y + cardHeight + LEVEL_GAP + rowExtra;
    const placed: Subtree[] = [];
    for (const child of node.children) {
      let cl = layoutSubtree(child, childY, cardHeight, false);
      let maxShift = 0;
      for (const prev of placed) {
        const req = minShiftToClear(prev.rightContour, cl.leftContour);
        if (req > maxShift) maxShift = req;
      }
      if (maxShift > 0) cl = shift(cl, maxShift, 0);
      placed.push(cl);
    }

    const childrenLeft = Math.min(...placed.map((p) => p.ownBox.x));
    const childrenRight = Math.max(...placed.map((p) => p.ownBox.x + CARD_WIDTH));
    const cardX = (childrenLeft + childrenRight) / 2 - CARD_WIDTH / 2;
    const box = { ...ownBox, x: cardX };

    const parentCx = cardX + CARD_WIDTH / 2;
    const busY = y + cardHeight + BUS_DROP;
    const centres = placed.map((p) => p.ownBox.x + CARD_WIDTH / 2);
    const busLeft = Math.min(parentCx, ...centres);
    const busRight = Math.max(parentCx, ...centres);
    const lines: ConnectorLine[] = [
      { x1: parentCx, y1: y + cardHeight, x2: parentCx, y2: busY },
      { x1: busLeft, y1: busY, x2: busRight, y2: busY },
      ...placed.map((p) => {
        const cx = p.ownBox.x + CARD_WIDTH / 2;
        return { x1: cx, y1: busY, x2: cx, y2: p.ownBox.y };
      }),
    ];

    const busContour: Seg[] = [
      { y0: y + cardHeight, y1: busY, x: parentCx },
      { y0: busY, y1: busY + 0.001, x: busLeft },
      { y0: busY, y1: busY + 0.001, x: busRight },
    ];
    const result = normalise(box, placed, lines, busContour, selfCompact);
    result.boxes.set(node.en, result.ownBox);
    return result;
  }

  // arrangement is "split" | "left" | "right" — a vertical stack, trunk centred under
  // the parent card. "left" puts all children in the left column, "right" in the right
  // column, "split" divides them by stackSide.
  const leftKids = arrangement === "split" ? node.children.filter((c) => c.stackSide === "left") : arrangement === "left" ? node.children : [];
  const rightKids = arrangement === "split" ? node.children.filter((c) => c.stackSide === "right") : arrangement === "right" ? node.children : [];
  const trunkX = CARD_WIDTH / 2; // relative to ownBox.x = 0, i.e. under the parent card's centre
  const childTop = y + cardHeight + LEVEL_GAP;

  // A single report never needs the side-offset stack column — it just drops straight
  // down, centred under the parent, connected by one plain vertical line (no bend, no
  // side-toggle, since there's no other column for it to move to).
  if (leftKids.length + rightKids.length === 1) {
    const onlyChild = leftKids[0] ?? rightKids[0];
    const extra = onlyChild.teamName ? TEAM_LABEL_EXTRA : 0;
    let cl = layoutSubtree(onlyChild, childTop + extra, cardHeight, false);
    cl = shift(cl, -cl.ownBox.x, 0);
    const line: ConnectorLine = { x1: trunkX, y1: y + cardHeight, x2: trunkX, y2: cl.ownBox.y };
    const result = normalise(ownBox, [cl], [line], [], selfCompact);
    result.boxes.set(node.en, result.ownBox);
    return result;
  }

  function stackColumn(kids: AnnotatedNode[], side: "left" | "right"): Subtree[] {
    const out: Subtree[] = [];
    let rowY = childTop;
    for (const kid of kids) {
      const extra = kid.teamName ? TEAM_LABEL_EXTRA : 0;
      let cl = layoutSubtree(kid, rowY + extra, cardHeight, true);
      const desiredX = side === "right" ? trunkX + STACK_GAP : trunkX - STACK_GAP - CARD_WIDTH;
      cl = shift(cl, desiredX - cl.ownBox.x, 0);
      out.push(cl);
      rowY = cl.bottom + ROW_GAP;
    }
    if (out.length === 0) return out;

    // A stack member's card sits flush against the trunk, but ITS OWN descendants can
    // spread wider than one card (e.g. a compact row with a split of its own) — wide
    // enough to reach back across the trunk that continues past it down to the next
    // sibling below. Check every member's outward contour against the trunk's full span
    // and, if anything intrudes, push the whole column further out uniformly (so cards
    // stay aligned on one x instead of just the offending member jogging sideways).
    const trunkSpan: Seg = { y0: childTop, y1: out[out.length - 1].ownBox.y + cardHeight / 2, x: trunkX };
    let extraOut = 0;
    for (const p of out) {
      for (const seg of side === "left" ? p.rightContour : p.leftContour) {
        const overlap = Math.min(seg.y1, trunkSpan.y1) - Math.max(seg.y0, trunkSpan.y0);
        if (overlap <= 0) continue;
        const req = side === "left" ? seg.x + MIN_GAP - trunkSpan.x : trunkSpan.x + MIN_GAP - seg.x;
        if (req > extraOut) extraOut = req;
      }
    }
    if (extraOut > 0) {
      const dx = side === "left" ? -extraOut : extraOut;
      return out.map((p) => shift(p, dx, 0));
    }
    return out;
  }

  let leftPlaced = stackColumn(leftKids, "left");
  let rightPlaced = stackColumn(rightKids, "right");

  // The two columns are each cleared against the shared trunk independently above, but
  // never against EACH OTHER — so a member with its own nested split (a compact row
  // whose own left branch reaches back out) can cross the trunk *and* keep going, right
  // into the opposite column's actual cards. Check the two columns' full contours
  // against each other and, if they'd overlap, push both outward symmetrically so the
  // trunk stays centred under the parent card.
  if (leftPlaced.length > 0 && rightPlaced.length > 0) {
    const leftOuter = leftPlaced.flatMap((p) => p.rightContour);
    const rightOuter = rightPlaced.flatMap((p) => p.leftContour);
    const req = minShiftToClear(leftOuter, rightOuter);
    if (req > 0) {
      const half = req / 2;
      leftPlaced = leftPlaced.map((p) => shift(p, -half, 0));
      rightPlaced = rightPlaced.map((p) => shift(p, half, 0));
    }
  }

  const lines: ConnectorLine[] = [{ x1: trunkX, y1: y + cardHeight, x2: trunkX, y2: childTop }];
  // The trunk runs at the parent's centre, which for a "left" stack sits to the right of
  // every child card (children are pushed further left) — and symmetrically to the left
  // for a "right" stack. Either way the trunk itself must count as occupied space so a
  // neighbouring branch can't compact through it, so it goes in trunkContour alongside
  // the actual connector lines below.
  const trunkContour: Seg[] = [{ y0: y + cardHeight, y1: childTop, x: trunkX }];
  function connectColumn(placed: Subtree[], side: "left" | "right") {
    if (placed.length === 0) return;
    const lastCy = placed[placed.length - 1].ownBox.y + cardHeight / 2;
    lines.push({ x1: trunkX, y1: childTop, x2: trunkX, y2: lastCy });
    trunkContour.push({ y0: childTop, y1: lastCy, x: trunkX });
    for (const p of placed) {
      const cy = p.ownBox.y + cardHeight / 2;
      const cardEdgeX = side === "right" ? p.ownBox.x : p.ownBox.x + CARD_WIDTH;
      lines.push({ x1: trunkX, y1: cy, x2: cardEdgeX, y2: cy });
    }
  }
  connectColumn(leftPlaced, "left");
  connectColumn(rightPlaced, "right");

  const result = normalise(ownBox, [...leftPlaced, ...rightPlaced], lines, trunkContour, selfCompact);
  result.boxes.set(node.en, result.ownBox);
  return result;
}

// Extra room below the last row so a chevron button (which pokes below its card) or a
// hover shadow never sits flush against the container's edge.
const BOTTOM_MARGIN = 16;

export function computeLayout(root: AnnotatedNode, cardHeight: number): LayoutResult {
  const s = layoutSubtree(root, 0, cardHeight, false);
  let maxX = 0;
  for (const [, b] of s.boxes) maxX = Math.max(maxX, b.x + b.w);
  for (const l of s.lines) maxX = Math.max(maxX, l.x1, l.x2);
  return {
    boxes: s.boxes,
    compact: s.compact,
    lines: s.lines,
    width: maxX,
    height: s.bottom + BOTTOM_MARGIN,
  };
}
