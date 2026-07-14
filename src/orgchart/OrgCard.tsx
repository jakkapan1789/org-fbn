import { useState } from "react";
import { ArrowLeft, ArrowRight, Columns3, Minus, Plus, Rows3 } from "lucide-react";
import type { AnnotatedNode, DisplayOptions, LayoutDirection, StackSide } from "./types";
import { getLevelMeta } from "./levelMeta";

interface OrgCardProps {
  node: AnnotatedNode;
  onToggle: (id: string) => void;
  onSelect: (node: AnnotatedNode) => void;
  onToggleLayout: (id: string, next: LayoutDirection) => void;
  onToggleSide: (id: string, next: StackSide) => void;
  displayOptions: DisplayOptions;
  /** Row of a vertical stack: hides the layout toggle (nested children are always
   *  vertical) and shows the side toggle on the card's outer edge. The card itself
   *  renders identically — the chevron always sits bottom-center on the trunk. */
  compact?: boolean;
  /** Preview/live mode: hides layout-toggle and side-toggle (both mutate persisted
   *  structure), keeping the chevron/select/pan/zoom/search — those never write data. */
  readOnly?: boolean;
}

// All cards are exactly this wide; OrgTree's connector constants derive from it.
export const CARD_WIDTH = 180;

export function OrgCard({
  node,
  onToggle,
  onSelect,
  onToggleLayout,
  onToggleSide,
  displayOptions,
  compact = false,
  readOnly = false,
}: OrgCardProps) {
  const [hovered, setHovered] = useState(false);
  const [chevronHovered, setChevronHovered] = useState(false);

  // Side toggle: on a stack member (compact) it moves that card to the other column of
  // its parent's split; on a non-compact vertical parent it sets the default column its
  // children fall into. Either way it flips `node.stackSide` (children inherit it). Sits
  // vertically centred on whichever edge (left/right) it currently hangs on — centred
  // rather than pinned to the top corner so it never collides with the previous stack
  // row's chevron when rows are packed tightly.
  const showSideToggle = !readOnly && (compact || (node.hasChildren && node.layoutVertical));
  const showLayoutToggle = !readOnly && node.hasChildren && !compact;
  const sidePosition = node.stackSide === "right" ? "-right-1.5" : "-left-1.5";

  const meta = getLevelMeta(node.level);
  const chipBg = meta.color + "17";
  const avatarGrad = `linear-gradient(140deg, ${meta.grad[0]}, ${meta.grad[1]})`;
  const avatarOnly = displayOptions.showAvatar && !displayOptions.showName && !displayOptions.showPosition;
  // centerContent is an explicit checkbox; avatarOnly is the pre-existing auto-centre
  // for "just the avatar, nothing else" — either one centres the card's content.
  const centerAll = avatarOnly || displayOptions.centerContent;
  const showHeadcountBadge = displayOptions.showHeadcount && displayOptions.showAvatar && node.headcount > 0;

  const boxShadow = node.highlighted
    ? "0 0 0 2px #2E6FDB, 0 8px 18px rgba(46,111,219,0.2)"
    : hovered
      ? "0 4px 12px rgba(16,24,40,0.12)"
      : "0 1px 2px rgba(16,24,40,0.07)";

  return (
    <div
      data-card
      onClick={() => onSelect(node)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex w-[180px] cursor-pointer items-center gap-2 rounded-lg border border-[#e9ecf1] bg-white py-1.5 pl-2.5 pr-3 text-left transition-[box-shadow,transform,border-color] duration-[180ms] ${centerAll ? "justify-center" : ""}`}
      style={{
        borderLeft: `3px solid ${meta.color}`,
        boxShadow,
        opacity: node.dimmed ? 0.34 : 1,
        transform: hovered ? "translateY(-2px)" : undefined,
        borderColor: hovered ? "#d4dbe6" : undefined,
      }}
    >
      {node.teamName && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.04em] text-white shadow-[0_1px_3px_rgba(16,24,40,0.2)]"
          title={node.teamName}
        >
          {node.teamName}
        </div>
      )}

      {displayOptions.showAvatar && (
        <div className="relative shrink-0">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-[10.5px] font-bold text-white"
            style={{ background: avatarGrad, boxShadow: `0 2px 6px ${meta.shadow}` }}
          >
            {node.initials}
          </div>
          {/* Team size, badged on the avatar corner rather than taking its own row —
              180px cards have no room to spare, and this reads fine at a glance. */}
          {showHeadcountBadge && (
            <span
              className="absolute -bottom-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white px-[3px] text-[8px] font-bold text-white"
              style={{ background: meta.color }}
              title={`${node.headcount} คนในทีม (ทุกระดับ)`}
            >
              {node.headcount}
            </span>
          )}
        </div>
      )}

      {(displayOptions.showName || displayOptions.showPosition) && (
        <div className="flex min-w-0 flex-col items-start gap-1">
          {displayOptions.showName && (
            <div className="max-w-full truncate text-[11.5px] font-semibold leading-tight text-[#0f1c2e]">{node.name}</div>
          )}
          {displayOptions.showPosition && (
            <div className="flex max-w-full items-center gap-1">
              {/* Position = the person's actual title (VP, Director, Lead System Analyst, …), colored by level. */}
              <span
                className="inline-flex min-w-0 items-center rounded-full px-1.5 py-px text-[8px] font-semibold uppercase tracking-[.03em]"
                style={{ background: chipBg, color: meta.color }}
              >
                <span className="truncate">{node.title}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {showLayoutToggle && (
        <button
          data-layout-toggle
          title={node.layoutHorizontal ? "สลับลูกทีมเป็นแนวตั้ง" : "สลับลูกทีมเป็นแนวนอน"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLayout(node.en, node.layoutHorizontal ? "vertical" : "horizontal");
          }}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#dbe1ea] bg-white p-0 text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
          style={{ boxShadow: "0 1px 4px rgba(16,24,40,0.12)" }}
        >
          {node.layoutHorizontal ? <Columns3 size={10} strokeWidth={2.5} /> : <Rows3 size={10} strokeWidth={2.5} />}
        </button>
      )}

      {showSideToggle && (
        <button
          data-side-toggle
          title={
            compact
              ? node.stackSide === "right"
                ? "ย้ายการ์ดนี้ไปทางซ้าย"
                : "ย้ายการ์ดนี้ไปทางขวา"
              : node.stackSide === "right"
                ? "ให้ลูกทีมเริ่มทางซ้าย"
                : "ให้ลูกทีมเริ่มทางขวา"
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleSide(node.en, node.stackSide === "right" ? "left" : "right");
          }}
          className={`absolute top-1/2 -translate-y-1/2 ${sidePosition} flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#dbe1ea] bg-white p-0 text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]`}
          style={{ boxShadow: "0 1px 4px rgba(16,24,40,0.12)" }}
        >
          {node.stackSide === "right" ? <ArrowLeft size={11} strokeWidth={2.5} /> : <ArrowRight size={11} strokeWidth={2.5} />}
        </button>
      )}

      {node.hasChildren && (
        <button
          data-chevron
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.en);
          }}
          onMouseEnter={() => setChevronHovered(true)}
          onMouseLeave={() => setChevronHovered(false)}
          className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-[1.5px] bg-white p-0"
          style={{
            borderColor: chevronHovered ? "#2E6FDB" : "#dbe1ea",
            color: chevronHovered ? "#2E6FDB" : "#42506a",
            boxShadow: "0 1px 4px rgba(16,24,40,0.12)",
          }}
        >
          {node.expanded ? <Minus size={10} strokeWidth={2.5} /> : <Plus size={10} strokeWidth={2.5} />}
        </button>
      )}
    </div>
  );
}
