import { useLayoutEffect, useRef, useState } from "react";
import type { AnnotatedNode, DisplayOptions, LayoutDirection, StackSide } from "./types";
import { OrgCard } from "./OrgCard";
import { computeLayout } from "./layout";

interface OrgTreeProps {
  node: AnnotatedNode;
  onToggle: (id: string) => void;
  onSelect: (node: AnnotatedNode) => void;
  onToggleLayout: (id: string, next: LayoutDirection) => void;
  onToggleSide: (id: string, next: StackSide) => void;
  displayOptions: DisplayOptions;
  readOnly?: boolean;
}

const LINE_COLOR = "#cfd7e2";
// Used only until the hidden measurement card below reports the real height for the
// current displayOptions; corrected synchronously before paint, so this never shows.
const FALLBACK_CARD_HEIGHT = 47;

function flatten(
  node: AnnotatedNode,
  compact: Set<string>,
  out: { node: AnnotatedNode; compact: boolean }[] = [],
): { node: AnnotatedNode; compact: boolean }[] {
  out.push({ node, compact: compact.has(node.id) });
  if (node.expanded) for (const child of node.children) flatten(child, compact, out);
  return out;
}

export function OrgTree({
  node,
  onToggle,
  onSelect,
  onToggleLayout,
  onToggleSide,
  displayOptions,
  readOnly = false,
}: OrgTreeProps) {
  const shared = { onToggle, onSelect, onToggleLayout, onToggleSide, displayOptions, readOnly };
  const measureRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(FALLBACK_CARD_HEIGHT);

  // Card height depends only on which fields are shown (text is always single-line/
  // truncated), not on which node it is — so one hidden reference card, remeasured
  // whenever displayOptions changes, is enough to keep every position pixel-accurate.
  useLayoutEffect(() => {
    const h = measureRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - cardHeight) > 0.5) setCardHeight(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayOptions.showAvatar, displayOptions.showName, displayOptions.showPosition]);

  const layout = computeLayout(node, cardHeight);
  const flat = flatten(node, layout.compact);

  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <div ref={measureRef} className="pointer-events-none absolute left-0 top-0 opacity-0" aria-hidden>
        <OrgCard node={node} compact={false} {...shared} />
      </div>

      <svg className="pointer-events-none absolute left-0 top-0" width={layout.width} height={layout.height}>
        {layout.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={LINE_COLOR} strokeWidth={2} />
        ))}
      </svg>

      {flat.map(({ node: n, compact }) => {
        const box = layout.boxes.get(n.id)!;
        return (
          <div key={n.id} className="absolute" style={{ left: box.x, top: box.y }}>
            <OrgCard node={n} compact={compact} {...shared} />
          </div>
        );
      })}
    </div>
  );
}
