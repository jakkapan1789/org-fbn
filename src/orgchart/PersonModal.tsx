import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { AnnotatedNode, PersonOverride } from "./types";
import { getLevelMeta } from "./levelMeta";

interface PersonModalProps {
  node: AnnotatedNode;
  onClose: () => void;
  onSave: (id: string, updates: PersonOverride) => void;
  /** Admin-only: removes this person and everyone under them from the current chart.
   *  Omitted/undefined (or `canDelete` false) hides the affordance — used for read-only
   *  preview and for the currently-loaded root, which can't delete itself. */
  onDelete?: (id: string) => void;
  canDelete?: boolean;
  /** Preview/live mode: view-only — hides the edit affordance entirely. */
  readOnly?: boolean;
}

export function PersonModal({ node, onClose, onSave, onDelete, canDelete = false, readOnly = false }: PersonModalProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(node.name);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [draftTeamName, setDraftTeamName] = useState(node.teamName ?? "");

  const meta = getLevelMeta(node.level);
  const chipBg = meta.color + "17";
  const avatarGrad = `linear-gradient(140deg, ${meta.grad[0]}, ${meta.grad[1]})`;

  function startEditing() {
    setDraftName(node.name);
    setDraftTitle(node.title);
    setDraftTeamName(node.teamName ?? "");
    setEditing(true);
  }

  function save() {
    onSave(node.id, {
      name: draftName.trim() || node.name,
      title: draftTitle.trim() || node.title,
      teamName: draftTeamName.trim() || undefined,
    });
    setEditing(false);
  }

  const inputClass =
    "w-full rounded-lg border border-[#e4e8ee] bg-[#f6f8fb] px-2.5 py-1.5 text-[13px] text-[#0f1c2e] outline-none focus:border-[#2E6FDB] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,111,219,0.12)]";

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(16,24,40,0.5)] backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[440px] max-w-[92vw] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_70px_rgba(16,24,40,0.32)]"
      >
        <button
          onClick={onClose}
          className="absolute right-[18px] top-[18px] z-[2] flex h-8 w-8 items-center justify-center rounded-full border-none bg-[rgba(16,24,40,0.05)] text-[#42506a] hover:bg-[rgba(16,24,40,0.09)]"
        >
          <X size={16} />
        </button>
        {!editing && !readOnly && (
          <button
            onClick={startEditing}
            title="แก้ไขข้อมูล"
            className="absolute right-[58px] top-[18px] z-[2] flex h-8 w-8 items-center justify-center rounded-full border-none bg-[rgba(16,24,40,0.05)] text-[#42506a] hover:bg-[rgba(16,24,40,0.09)]"
          >
            <Pencil size={14} />
          </button>
        )}

        <div className="px-[30px] pb-[22px] pt-[30px]">
          <div className="flex items-center gap-4">
            <div
              className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-[19px] text-2xl font-bold text-white"
              style={{ background: avatarGrad, boxShadow: `0 8px 20px ${meta.shadow}` }}
            >
              {node.initials}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[.03em] text-[#8b97a8]">
                      ชื่อ
                    </label>
                    <input className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[.03em] text-[#8b97a8]">
                      ตำแหน่ง
                    </label>
                    <input className={inputClass} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xl font-bold leading-[1.2] text-[#0f1c2e]">{node.name}</div>
                  <div className="mt-[3px] text-[13.5px] leading-[1.3] text-[#7a8699]">{node.title}</div>
                  <span
                    className="mt-[9px] inline-flex items-center rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[.03em]"
                    style={{ background: chipBg, color: meta.color }}
                  >
                    {meta.name} · {node.dept}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {editing ? (
          <div className="px-[30px] pb-[22px]">
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[.03em] text-[#8b97a8]">
              ชื่อทีม (Team Name) — แสดงเป็นป้ายเล็กบนการ์ด
            </label>
            <input
              className={inputClass}
              placeholder="เช่น Team Lead, MES Team"
              value={draftTeamName}
              onChange={(e) => setDraftTeamName(e.target.value)}
            />
          </div>
        ) : (
          node.teamName && (
            <div className="px-[30px] pb-[22px]">
              <span className="inline-flex items-center rounded-full bg-black px-2.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[.03em] text-white">
                {node.teamName}
              </span>
            </div>
          )
        )}

        {editing ? (
          <>
            <div className="flex gap-2.5 px-[30px] pb-2.5">
              <button
                onClick={save}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[11px] bg-[#2E6FDB] text-[13.5px] font-semibold text-white hover:bg-[#1d55c0]"
              >
                <Check size={15} /> บันทึก
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[11px] bg-[#f0f3f8] text-[13.5px] font-semibold text-[#42506a] hover:bg-[#e3e9f3]"
              >
                ยกเลิก
              </button>
            </div>
            {canDelete && onDelete && (
              <div className="px-[30px] pb-7">
                <button
                  onClick={() => {
                    if (window.confirm(`ลบ ${node.name} ออกจากผังนี้? ลูกทีมทั้งหมด (${node.headcount} คน) จะถูกลบไปด้วย และย้อนกลับไม่ได้`)) {
                      onDelete(node.id);
                      onClose();
                    }
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-[#fdecec] text-[13.5px] font-semibold text-[#c0392b] hover:bg-[#fbdada]"
                >
                  <Trash2 size={15} /> ลบคนนี้ออกจากผัง
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-3 px-[30px] pb-[22px]">
              <div className="flex-1 rounded-[14px] bg-[#f6f8fb] px-4 py-[15px]">
                <div className="text-2xl font-bold leading-none text-[#0f1c2e]">{node.children.length}</div>
                <div className="mt-[5px] text-[11.5px] leading-[1.2] text-[#8b97a8]">ลูกทีมโดยตรง</div>
              </div>
              <div className="flex-1 rounded-[14px] bg-[#f6f8fb] px-4 py-[15px]">
                <div className="text-2xl font-bold leading-none text-[#0f1c2e]">{node.headcount}</div>
                <div className="mt-[5px] text-[11.5px] leading-[1.2] text-[#8b97a8]">ทีมทั้งหมด (ทุกระดับ)</div>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 px-[30px] pb-7">
              <div className="flex items-center justify-between border-t border-[#f1f3f6] py-[11px]">
                <span className="text-[12.5px] text-[#8b97a8]">โทรศัพท์</span>
                <span className="font-mono text-[13px] text-[#0f1c2e]">{node.phone}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#f1f3f6] py-[11px]">
                <span className="text-[12.5px] text-[#8b97a8]">อีเมล</span>
                <span className="text-[13px] font-medium text-[#0f1c2e]">{node.email}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
