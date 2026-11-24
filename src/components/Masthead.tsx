import React from "react";
import { Clock, HelpCircle, Moon, RefreshCw, Sun } from "lucide-react";
import type { FacilityType, LedgerSyncInfo, ThemeMode } from "../types/coop.ts";

interface MastheadProps {
  facility: FacilityType;
  deductionRate: number;
  ledgerSync: LedgerSyncInfo;
  historyCount: number;
  theme: ThemeMode;
  isScrolled: boolean;
  isUnlocked: boolean;
  onToggleFacilityQuick: () => void;
  onRefreshLedger: () => void;
  onStartOnboarding: () => void;
  onToggleHistory: () => void;
  onToggleTheme: () => void;
}

const FACILITY_LABELS: Record<FacilityType, string> = {
  cash: "Normal Loan",
  purchase: "Purchase",
  special: "Special Loan",
  withdrawal: "Withdrawal"
};

function formatLastCached(timestamp: number | null): string {
  if (!timestamp) return "Offline";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Offline";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return timeStr;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export const Masthead: React.FC<MastheadProps> = ({
  facility,
  deductionRate,
  ledgerSync,
  historyCount,
  theme,
  isScrolled,
  isUnlocked,
  onToggleFacilityQuick,
  onRefreshLedger,
  onStartOnboarding,
  onToggleHistory,
  onToggleTheme
}) => {
  const currentLabel = FACILITY_LABELS[facility] || "Normal Loan";
  const status = ledgerSync.status || "idle";

  let syncText = "Offline";
  let syncTitle = "Click to sync ledger with Google Sheets.";
  let syncToneClass = "text-slate-500 dark:text-slate-400";

  if (status === "syncing") {
    syncText = "Syncing…";
    syncTitle = "Fetching latest records from Google Sheets...";
    syncToneClass = "text-blue-600 dark:text-blue-400";
  } else if (status === "fresh") {
    const cachedTime = formatLastCached(ledgerSync.lastSync);
    syncText = `Ledger · ${cachedTime}`;
    const fullDate = ledgerSync.lastSync ? new Date(ledgerSync.lastSync).toLocaleString() : "offline";
    syncTitle = `Synced: ${fullDate} (${ledgerSync.count} members). Click to re-sync.`;
    syncToneClass = "text-emerald-700 dark:text-emerald-400";
  } else if (status === "cached") {
    const cachedTime = formatLastCached(ledgerSync.lastSync);
    syncText = `Cached · ${cachedTime}`;
    const fullDate = ledgerSync.lastSync ? new Date(ledgerSync.lastSync).toLocaleString() : "offline";
    syncTitle = `Last cached: ${fullDate} (${ledgerSync.count} members). Click to re-sync.`;
    syncToneClass = "text-amber-700 dark:text-amber-400";
  } else if (status === "error") {
    syncText = "Sync error";
    syncTitle = "Unable to connect to Google Sheets ledger. Click to retry.";
    syncToneClass = "text-red-600 dark:text-red-400";
  }

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-150 ${
        isScrolled
          ? "border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md"
          : "border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0b0f17]/90 backdrop-blur-sm"
      }`}
      id="masthead"
      inert={!isUnlocked ? true : undefined}
    >
      <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Title */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 font-mono-num text-sm font-semibold text-white"
            aria-hidden="true"
          >
            ₦
          </div>
          <span className="truncate text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap">
            Cooperative Desk
          </span>
        </div>

        {/* Zone 2: Subtle inline context on large screens */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={onToggleFacilityQuick}
            className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title={`Active facility: ${currentLabel} (Click to cycle)`}
          >
            {currentLabel}
          </button>
          <span aria-hidden="true">·</span>
          <span>Savings ×2</span>
          <span aria-hidden="true">·</span>
          <span id="mastheadCapLabel" className="tabular-nums">
            {Math.round(deductionRate * 100)}% Payroll Cap
          </span>
        </div>

        {/* Zone 3: Ledger sync + Desk Utility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            id="ledgerSyncBadge"
            onClick={onRefreshLedger}
            title={syncTitle}
            className={`inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md px-2 sm:px-2.5 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${syncToneClass}`}
          >
            <RefreshCw
              size={13}
              strokeWidth={2}
              className={status === "syncing" ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline" id="ledgerSyncLabel">
              {syncText}
            </span>
          </button>

          <button
            className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            id="btnHelpGuide"
            onClick={onStartOnboarding}
            type="button"
            aria-label="Interactive guide"
            title="Interactive guide"
          >
            <HelpCircle size={16} strokeWidth={2} />
          </button>

          <button
            className="relative inline-flex h-10 sm:h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            id="btnToggleHistory"
            onClick={onToggleHistory}
            type="button"
            aria-label="Appraisal history"
            title="Appraisal history"
          >
            <Clock size={15} strokeWidth={2} />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span
                className="font-mono-num text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                id="historyBadgeCount"
              >
                {historyCount > 99 ? "99+" : historyCount}
              </span>
            )}
          </button>

          <button
            className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            id="themeToggle"
            onClick={onToggleTheme}
            type="button"
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </header>
  );
};
