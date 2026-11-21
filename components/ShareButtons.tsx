"use client";

import { useEffect, useState } from "react";

const TEXT = "มีไข้ ไอ เจ็บคอ? ลองคุยกับ “พูดได้” ประเมินอาการไข้หวัดใหญ่ฟรี 2 นาที รู้เลยว่าควรไปหาหมอไหม";

/** Share the citizen screener: the native share sheet when available, plus LINE and copy-link. */
export default function ShareButtons({ title = "ชวนคนที่คุณห่วงใยมาประเมินอาการ", compact = false }: { title?: string; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/screen`);
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function nativeShare() {
    try {
      await navigator.share({ title: "พูดได้", text: TEXT, url });
    } catch {
      /* user cancelled */
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${TEXT}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  const line = `https://line.me/R/share?text=${encodeURIComponent(`${TEXT}\n${url}`)}`;

  return (
    <div className={compact ? "" : "rounded-xl border border-line p-3"}>
      {!compact && <div className="mb-2 text-[15px] font-semibold">{title}</div>}
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button onClick={nativeShare} className="press flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white">
            <ShareIcon /> แชร์
          </button>
        )}
        <a href={line} target="_blank" rel="noreferrer" className="press flex min-h-11 items-center gap-2 rounded-xl bg-[#06c755] px-4 text-sm font-semibold text-white">
          ส่งทาง LINE
        </a>
        <button onClick={copy} className="press flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm">
          {copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}
