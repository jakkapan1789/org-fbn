import { Minus, Plus } from "lucide-react";

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function ZoomControls({ zoomLevel, onZoomIn, onZoomOut, onZoomReset }: ZoomControlsProps) {
  const zoomPct = Math.round(zoomLevel * 100) + "%";

  return (
    <div className="absolute bottom-[22px] right-[22px] z-[15] flex items-center gap-[3px] rounded-xl border border-[#e9ecf1] bg-white p-1 shadow-[0_6px_20px_rgba(16,24,40,0.1)]">
      <button
        onClick={onZoomOut}
        className="flex h-9 w-9 items-center justify-center rounded-[9px] border-none bg-transparent text-[#42506a] hover:bg-[#f0f3f8]"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={onZoomReset}
        className="h-9 min-w-[56px] rounded-[9px] border-none bg-transparent font-mono text-[12.5px] font-semibold text-[#42506a] hover:bg-[#f0f3f8]"
      >
        {zoomPct}
      </button>
      <button
        onClick={onZoomIn}
        className="flex h-9 w-9 items-center justify-center rounded-[9px] border-none bg-transparent text-[#42506a] hover:bg-[#f0f3f8]"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
