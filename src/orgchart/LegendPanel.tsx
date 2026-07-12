import { LEVEL_META } from "./levelMeta";

interface LegendPanelProps {
  /** Headcount per level index (0=Executive … 4=Team Member), for the current tree. */
  counts: number[];
}

export function LegendPanel({ counts }: LegendPanelProps) {
  return (
    <div className="absolute bottom-[22px] left-[22px] z-[15] rounded-[14px] border border-[#e9ecf1] bg-white px-[15px] py-[13px] shadow-[0_6px_20px_rgba(16,24,40,0.1)]">
      <div className="mb-[9px] text-[10px] font-semibold uppercase tracking-[.08em] text-[#8b97a8]">ระดับตำแหน่ง</div>
      <div className="flex flex-col gap-[7px]">
        {LEVEL_META.map((lv, i) => (
          <div key={lv.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: lv.color }} />
            <span className="text-xs font-medium text-[#4a5568]">{lv.name}</span>
            <span className="ml-auto pl-3 font-mono text-[11px] font-semibold text-[#8b97a8]">{counts[i] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
