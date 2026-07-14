import { useRef, useState } from "react";
import { ArrowRight, Search, Upload } from "lucide-react";
import type { OrgSnapshot, PersonSummary } from "./types";
import { findPersonByEn } from "./api";
import { isOrgSnapshot } from "./snapshot";
import { getLevelMeta } from "./levelMeta";

interface RootPickerProps {
  onSelect: (en: string) => void;
  /** Loads a previously-exported .json directly as the current org, bypassing the live
   *  fetch entirely — the other way to "select" an org besides searching by EN. */
  onImport: (snapshot: OrgSnapshot) => void;
}

/** Outcome of the last EN search. `null` result = a valid search that matched nobody,
 *  which the UI reports as "not found" rather than as an error. */
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; person: PersonSummary | null }
  | { status: "error" };

export function RootPicker({ onSelect, onImport }: RootPickerProps) {
  const [en, setEn] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [importError, setImportError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Only the newest search may write to state — an admin who edits the EN and searches
  // again must never see the slower earlier lookup's answer land on top.
  const searchSeq = useRef(0);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!en.trim()) return;
    const seq = ++searchSeq.current;
    setSearch({ status: "loading" });
    setAvatarError(false);
    try {
      const person = await findPersonByEn(en);
      if (seq === searchSeq.current) setSearch({ status: "done", person });
    } catch {
      if (seq === searchSeq.current) setSearch({ status: "error" });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isOrgSnapshot(parsed)) throw new Error("invalid shape");
      setImportError(null);
      onImport(parsed);
    } catch {
      setImportError("ไฟล์ไม่ถูกต้อง หรือไม่ใช่ไฟล์ที่ Export จากระบบนี้");
    }
  }

  const person = search.status === "done" ? search.person : null;
  const meta = person ? getLevelMeta(person.level) : null;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-h-full w-[480px] max-w-[92vw] flex-col overflow-auto rounded-2xl border border-[#e9ecf1] bg-white p-6 shadow-[0_12px_40px_rgba(16,24,40,0.12)]">
        <div className="text-[17px] font-bold text-[#0f1c2e]">สร้างผังองค์กร (Admin)</div>
        <div className="mt-1 text-[12.5px] text-[#8b97a8]">
          กรอกรหัสพนักงาน (EN) ของคนที่จะอยู่บนสุดของผัง แล้วกดค้นหา — ระบบจะดึงข้อมูลคนใต้การดูแลทั้งหมดมาให้ปรับแต่งและ Export ได้
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search size={15} className="pointer-events-none absolute left-3 text-[#9aa5b5]" />
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="รหัสพนักงาน เช่น EN00001"
              autoFocus
              className="h-10 w-full rounded-[10px] border border-[#e4e8ee] bg-[#f6f8fb] pl-9 pr-3.5 font-mono text-[13px] text-[#0f1c2e] outline-none placeholder:font-sans placeholder:text-[#a2adbd] focus:border-[#2E6FDB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,111,219,0.12)]"
            />
          </div>
          <button
            type="submit"
            disabled={!en.trim() || search.status === "loading"}
            className="h-10 shrink-0 rounded-[10px] bg-[#2E6FDB] px-4 text-[12.5px] font-semibold text-white hover:bg-[#1d55c0] disabled:cursor-not-allowed disabled:bg-[#c3ccd9]"
          >
            {search.status === "loading" ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </form>

        {search.status === "error" && (
          <div className="mt-3 rounded-[10px] border border-[#f3d6d2] bg-[#fdf4f3] px-3.5 py-3 text-[12.5px] text-[#c0392b]">
            ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </div>
        )}

        {search.status === "done" && !person && (
          <div className="mt-3 rounded-[10px] border border-[#f1f3f6] bg-[#f9fafc] px-3.5 py-3 text-[12.5px] text-[#8b97a8]">
            ไม่พบพนักงานรหัส <span className="font-mono text-[#42506a]">{en.trim()}</span> — ตรวจสอบรหัสอีกครั้ง
          </div>
        )}

        {person && meta && (
          <div className="mt-3 rounded-[12px] border border-[#e4e8ee] bg-[#f9fafc] p-3.5">
            <div className="flex items-center gap-3">
              {person.avatarUrl && !avatarError ? (
                <img
                  src={person.avatarUrl}
                  alt={person.name}
                  onError={() => setAvatarError(true)}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white"
                  style={{ background: `linear-gradient(140deg, ${meta.grad[0]}, ${meta.grad[1]})` }}
                >
                  {person.initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-[#0f1c2e]">{person.name}</div>
                <div className="truncate text-[11.5px] text-[#8b97a8]">
                  {person.title} · {person.dept}
                </div>
                <div className="truncate font-mono text-[10.5px] text-[#a2adbd]">{person.en}</div>
              </div>
              {person.headcount > 0 && (
                <span
                  className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-semibold"
                  style={{ background: "rgba(46,111,219,0.09)", color: "#2E6FDB" }}
                >
                  {person.headcount} คน
                </span>
              )}
            </div>

            <button
              onClick={() => onSelect(person.en)}
              className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2E6FDB] text-[12.5px] font-semibold text-white hover:bg-[#1d55c0]"
            >
              สร้างผังองค์กร
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#f1f3f6]" />
          <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-[#a2adbd]">หรือ</span>
          <div className="h-px flex-1 bg-[#f1f3f6]" />
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#d7dee8] bg-[#f9fafc] text-[12.5px] font-semibold text-[#42506a] hover:border-[#2E6FDB] hover:text-[#2E6FDB]"
        >
          <Upload size={15} />
          Import จากไฟล์ Export (.json)
        </button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
        {importError && <div className="mt-2 text-[11.5px] text-[#c0392b]">{importError}</div>}
      </div>
    </div>
  );
}
