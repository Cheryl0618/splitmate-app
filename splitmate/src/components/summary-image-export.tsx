"use client";

import html2canvas from "html2canvas";
import { useRef, useState } from "react";

import { useCurrentUser } from "@/lib/current-user";
import { formatCents } from "@/lib/format";
import type { ExportSummaryData } from "@/server/export-summary";

function shortDate(value: string | null) {
  if (!value) return "暂无账单";
  return value.slice(0, 10);
}

function downloadDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function SummaryImageExport({ data }: { data: ExportSummaryData }) {
  const { currentUserId } = useCurrentUser();
  const nodeRef = useRef<HTMLDivElement>(null);
  const generatedAtRef = useRef<HTMLSpanElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const currentMemberId = data.balances.find(
    (member) => member.userId === currentUserId
  )?.memberId;
  const name = (memberId: string, displayName: string) =>
    memberId === currentMemberId ? "你" : displayName;

  async function exportImage() {
    if (!nodeRef.current || exporting) return;
    setExporting(true);
    setError("");
    try {
      if (generatedAtRef.current) {
        generatedAtRef.current.textContent = new Date().toLocaleString("zh-CN");
      }
      await document.fonts.ready;
      const canvas = await html2canvas(nodeRef.current, {
        backgroundColor: "#f8fafc",
        scale: 2,
        width: 750,
        windowWidth: 750,
        logging: false,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("图片生成失败"))),
          "image/png"
        );
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.groupName.replace(/[\\/:*?"<>|]/g, "-")}-${downloadDate()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      console.error("[SummaryImageExport] failed", caught);
      setError("导出失败，请再试一次");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start">
        <button
          type="button"
          disabled={exporting}
          onClick={() => void exportImage()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? "生成图片中…" : "导出图片"}
        </button>
        {error ? <span className="mt-1 text-xs font-semibold text-rose-600">{error}</span> : null}
      </div>

      <div className="fixed left-[-10000px] top-0" aria-hidden="true">
        <div
          ref={nodeRef}
          style={{ width: 750, padding: 48, fontSize: 24, lineHeight: 1.5 }}
          className="bg-slate-50 text-slate-900"
        >
          <p className="font-bold text-teal-700">SplitMate 群组摘要</p>
          <h1 style={{ fontSize: 44 }} className="mt-3 font-black tracking-tight">
            {data.groupName}
          </h1>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-white p-5">
              <p className="text-slate-500">统计区间</p>
              <p className="mt-2 font-bold">
                {shortDate(data.periodStart)} 至 {shortDate(data.periodEnd)}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-5">
              <p className="text-slate-500">总花费</p>
              <p style={{ fontSize: 32 }} className="mt-2 font-black tabular-nums">
                {formatCents(data.totalCents, data.currency)}
              </p>
            </div>
          </div>

          <section className="mt-6 rounded-3xl bg-white p-6">
            <h2 style={{ fontSize: 30 }} className="font-extrabold">成员净额</h2>
            <div className="mt-4 divide-y divide-slate-200">
              {data.balances.map((member) => (
                <div key={member.memberId} className="flex justify-between gap-6 py-3">
                  <span className="font-bold">{name(member.memberId, member.displayName)}</span>
                  <span className="font-black tabular-nums">
                    {member.amountCents > 0 ? "+" : ""}
                    {formatCents(member.amountCents, data.currency)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6">
            <h2 style={{ fontSize: 30 }} className="font-extrabold">建议转账方案</h2>
            <div className="mt-4 space-y-3">
              {data.transfers.length > 0 ? (
                data.transfers.map((transfer) => (
                  <p key={`${transfer.fromMemberId}:${transfer.toMemberId}`} className="font-bold">
                    {name(transfer.fromMemberId, transfer.fromName)}付给
                    {name(transfer.toMemberId, transfer.toName)}：
                    <span className="tabular-nums">
                      {formatCents(transfer.amountCents, data.currency)}
                    </span>
                  </p>
                ))
              ) : (
                <p className="font-bold text-emerald-700">所有成员均已结清，无需转账</p>
              )}
            </div>
          </section>

          <div className="mt-8 flex justify-between gap-6 border-t border-slate-300 pt-5 text-slate-500">
            <span>{data.expenseCount} 笔账单</span>
            <span>生成于 <span ref={generatedAtRef}>—</span></span>
          </div>
        </div>
      </div>
    </>
  );
}
