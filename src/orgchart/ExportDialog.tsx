import { useState } from "react";
import { Download, X } from "lucide-react";
import { slugifyTitle } from "./snapshot";

interface ExportDialogProps {
  /** Seeded from the root person — a name the admin will usually just accept. */
  defaultTitle: string;
  onClose: () => void;
  onConfirm: (title: string) => void;
}

/** Names the chart before Export. The title becomes the .json file's name and the
 *  `?title=` of its read-only link, so the admin sees both spelled out here before
 *  committing — the file has to be moved into `public/orgs/` by hand afterwards. */
export function ExportDialog({ defaultTitle, onClose, onConfirm }: ExportDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const slug = slugifyTitle(title);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (slug) onConfirm(title);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.45)] p-6" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(16,24,40,0.28)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[16px] font-bold text-[#0f1c2e]">Export ผังองค์กร</div>
            <div className="mt-1 text-[12.5px] text-[#8b97a8]">ตั้งชื่อผังนี้ — ใช้เป็นชื่อไฟล์ .json และลิงก์สำหรับดูอย่างเดียว</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#9aa5b5] hover:bg-[#f6f8fb] hover:text-[#42506a]">
            <X size={18} />
          </button>
        </div>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[.06em] text-[#8b97a8]">ชื่อผัง</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น engineering-2026"
          autoFocus
          className="mt-1.5 h-10 w-full rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] px-3.5 text-[13px] text-[#0f1c2e] outline-none placeholder:text-[#a2adbd] focus:border-[#2E6FDB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,111,219,0.12)]"
        />

        {slug ? (
          <div className="mt-3 rounded-[10px] border border-[#f1f3f6] bg-[#f9fafc] px-3.5 py-3 text-[11.5px] leading-relaxed text-[#8b97a8]">
            <div>
              ไฟล์ที่ได้: <span className="font-mono text-[#42506a]">{slug}.json</span> — วางไว้ที่{" "}
              <span className="font-mono text-[#42506a]">public/orgs/</span>
            </div>
            <div className="mt-1">
              ลิงก์ดูอย่างเดียว: <span className="font-mono text-[#2E6FDB]">?source=jsonfile&amp;title={slug}</span>
            </div>
            <div className="mt-1">หลังกด Export ระบบจะพาไปหน้าดูอย่างเดียวทันที</div>
          </div>
        ) : (
          <div className="mt-3 text-[11.5px] text-[#c0392b]">กรุณาตั้งชื่อผัง (ใช้ตัวอักษร ตัวเลข หรือภาษาไทย)</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] px-4 text-[12.5px] font-semibold text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!slug}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-[#2E6FDB] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1d55c0] disabled:cursor-not-allowed disabled:bg-[#c3ccd9]"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </form>
    </div>
  );
}
