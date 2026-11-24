import React, { useEffect, useMemo, useState } from "react";
import { Clock, Info, Search, Trash2, X } from "lucide-react";
import { formatMoney, formatSignedMoney } from "../utils/formatters.ts";
import type { AppraisalHistoryItem } from "../types/coop.ts";

interface HistoryDrawerProps {
  isOpen: boolean;
  items: AppraisalHistoryItem[];
  onClose: () => void;
  onRestore: (item: AppraisalHistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return "";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  items,
  onClose,
  onRestore,
  onDelete,
  onClearAll
}) => {
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("history-open");
    } else {
      document.body.classList.remove("history-open");
      setFilterQuery("");
    }
    return () => {
      document.body.classList.remove("history-open");
    };
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.staff || "").toLowerCase().includes(q) ||
        (item.facility || "").toLowerCase().includes(q)
    );
  }, [items, filterQuery]);

  return (
    <>
      <div
        className={`history-overlay fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        id="historyOverlay"
        onClick={onClose}
      />

      <aside
        className={`history-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] h-dvh flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        id="historyDrawer"
        role="dialog"
        aria-modal="true"
        aria-label="Session Assessment History"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Session Memory
            </span>
            <h3 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Appraisal History
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-red-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:text-red-400 transition-colors"
                id="btnClearHistory"
                title="Clear all assessments in this session"
                onClick={onClearAll}
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              id="btnCloseHistory"
              aria-label="Close history drawer"
              title="Close"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="relative flex items-center">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 text-slate-400 dark:text-slate-500"
              />
              <input
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter by name, Staff ID, or type…"
                className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 overscroll-contain" id="historyList">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400">
                <Clock size={20} strokeWidth={2} />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No assessments yet
              </h4>
              <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Appraisals you calculate during this session will appear here for quick recall.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching appraisals found for "{filterQuery}".
            </div>
          ) : (
            filteredItems.map((item) => {
              const facilityLabel =
                item.facility === "cash"
                  ? "Normal Loan"
                  : item.facility === "purchase"
                    ? "Purchase"
                    : item.facility === "special"
                      ? "Special Loan"
                      : "Withdrawal";

              const statusLabel = item.eligible
                ? item.isInquiry || item.facility === "withdrawal"
                  ? "Ready"
                  : "Pass"
                : "Fail";

              const metric1Label = item.facility === "withdrawal" ? "Savings" : "Requested";
              const amountDisplay =
                item.facility === "withdrawal"
                  ? formatMoney(item.savings || item.amount || 0)
                  : item.isInquiry
                    ? "Capacity check"
                    : formatMoney(item.amount || 0);

              const metric2Label =
                item.facility === "withdrawal" ? "Net Payout" : "Monthly Deduction";
              const monthlyDisplay =
                item.facility === "withdrawal"
                  ? formatSignedMoney(
                      item.result?.netDisbursement !== undefined
                        ? item.result.netDisbursement
                        : item.net ?? 0
                    )
                  : formatMoney(item.totalCoopMonthly || item.monthly || 0);

              const durationLabel =
                item.facility === "withdrawal"
                  ? item.inputs?.withdrawalType === "retirement"
                    ? "Retirement"
                    : "Voluntary"
                  : `${item.duration || 3} Mos`;

              return (
                <div
                  key={item.id}
                  className="group rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-slate-900 p-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  tabIndex={0}
                  role="button"
                  aria-label={`Restore assessment for ${item.name || "Member Record"}`}
                  onClick={() => {
                    onRestore(item);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRestore(item);
                      onClose();
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name || "Member Record"}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.staff && (
                          <>
                            <span className="font-mono-num">{item.staff}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{facilityLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            item.eligible
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{durationLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove this record"
                        aria-label="Remove appraisal"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {metric1Label}
                      </span>
                      <strong className="mt-0.5 block truncate font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {amountDisplay}
                      </strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {metric2Label}
                      </span>
                      <strong className="mt-0.5 block truncate font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {monthlyDisplay}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <Info size={13} strokeWidth={2} className="shrink-0" />
          <span>Saved for this browser session only. Clears when the tab closes.</span>
        </div>
      </aside>
    </>
  );
};
