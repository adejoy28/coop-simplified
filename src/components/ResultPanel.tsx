import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  HelpCircle,
  MessageCircle,
  X
} from "lucide-react";
import { formatMoney, formatSignedMoney, getLastMonthEndDate } from "../utils/formatters.ts";
import type { MemberProfile, UnderwritingResult } from "../types/coop.ts";

interface ResultPanelProps {
  panelRef?: React.RefObject<HTMLElement | null>;
  result: UnderwritingResult | null;
  memberProfile: MemberProfile | null;
  onApplyCounterOffer: (amount: number, duration: number) => void;
  onShare: () => void;
  onCopy: () => Promise<boolean>;
}

const StatusBadge: React.FC<{
  tone: "pass" | "fail" | "neutral";
  label: string;
}> = ({ tone, label }) => {
  const styles =
    tone === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300"
      : tone === "fail"
        ? "border-red-200 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300"
        : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${styles}`}
    >
      {tone === "pass" && <Check size={13} strokeWidth={2.5} />}
      {tone === "fail" && <X size={13} strokeWidth={2.5} />}
      <span>{label}</span>
    </span>
  );
};

const ActionRow: React.FC<{
  copiedKey: string | null;
  rowId: string;
  copyTitle: string;
  onShare: () => void;
  onCopyClick: (rowId: string) => void;
}> = ({ copiedKey, rowId, copyTitle, onShare, onCopyClick }) => {
  const isCopied = copiedKey === rowId;
  return (
    <div className="result-action-row flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
      <button
        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={onShare}
        type="button"
      >
        <MessageCircle size={16} strokeWidth={2} />
        <span>Share on WhatsApp</span>
      </button>
      <button
        className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isCopied
            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100"
        }`}
        onClick={() => onCopyClick(rowId)}
        type="button"
        title={copyTitle}
      >
        {isCopied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
        <span>{isCopied ? "Copied" : "Copy Report"}</span>
      </button>
    </div>
  );
};

export const ResultPanel: React.FC<ResultPanelProps> = ({
  panelRef,
  result,
  memberProfile,
  onApplyCounterOffer,
  onShare,
  onCopy
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setCopiedKey(null);
  }, [result, memberProfile]);

  const handleCopyClick = async (rowId: string) => {
    const ok = await onCopy();
    if (ok) {
      setCopiedKey(rowId);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === rowId ? null : curr));
      }, 2000);
    }
  };

  if (!result && !memberProfile) {
    return (
      <section
        className="result-panel min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] lg:sticky lg:top-20"
        id="resultPanel"
        aria-live="polite"
        ref={panelRef}
      >
        <div className="flex min-h-[340px] lg:min-h-[440px] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            <ArrowRight size={20} strokeWidth={2} />
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Ready to Assess
          </span>
          <h3 className="mt-1 text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50">
            Appraisal results appear here
          </h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Look up a cooperative member, enter balances, or pick a quick scenario to run an
            underwriting check.
          </p>
        </div>
      </section>
    );
  }

  if (!result && memberProfile) {
    const dateStr = memberProfile.asAt || getLastMonthEndDate();
    return (
      <section
        className="result-panel has-result min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] lg:sticky lg:top-20"
        id="resultPanel"
        aria-live="polite"
        ref={panelRef}
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Member Ledger Snapshot
            </span>
            <h3 className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50 break-words">
              {memberProfile.name || "Member Record"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              {memberProfile.staff ? `${memberProfile.staff} · ` : ""}As at {dateStr}
            </p>
          </div>
          <StatusBadge tone="neutral" label="Profile Loaded" />
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Current Savings
              </span>
              <strong className="mt-1 block font-mono-num text-lg font-semibold text-blue-600 dark:text-blue-400">
                {formatMoney(memberProfile.savings)}
              </strong>
            </div>
            {memberProfile.loan > 0 && (
              <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Normal Loan Outstanding
                </span>
                <strong className="mt-1 block font-mono-num text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {formatMoney(memberProfile.loan)}
                </strong>
              </div>
            )}
            {memberProfile.commodity > 0 && (
              <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Special Loan Balance
                </span>
                <strong className="mt-1 block font-mono-num text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {formatMoney(memberProfile.commodity)}
                </strong>
              </div>
            )}
            {memberProfile.purchase > 0 && (
              <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Purchase Balance
                </span>
                <strong className="mt-1 block font-mono-num text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {formatMoney(memberProfile.purchase)}
                </strong>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-200/80 dark:divide-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50/70 dark:bg-slate-900/60">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Online Member Portal
              </span>
              <a
                href="https://www.tacmsl.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                www.tacmsl.com ↗
              </a>
            </div>
            <div className="px-3.5 py-2.5 space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Username (Form No)</span>
                <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {memberProfile.formNo || "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">Password (Staff ID)</span>
                <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {memberProfile.staff || "—"}
                </span>
              </div>
            </div>
          </div>

          <ActionRow
            copiedKey={copiedKey}
            rowId="profile-bottom"
            copyTitle="Copy profile details to clipboard"
            onShare={onShare}
            onCopyClick={handleCopyClick}
          />
        </div>
      </section>
    );
  }

  const res = result!;

  if (res.facility === "withdrawal") {
    const isRetirement = res.withdrawalType === "retirement";
    const statusLabel = res.eligible ? "Settlement Ready" : "Deficit Balance";
    const netDisbursement = res.netDisbursement ?? 0;

    const tile2Breakdown = isRetirement
      ? "0% Charge (Retirement)"
      : `Less 5% Fee (${formatMoney(res.withdrawalFee)})`;

    const liabilitiesNote: string[] = [];
    if (res.existingLoan > 0) liabilitiesNote.push(`Loan: ${formatMoney(res.existingLoan)}`);
    if ((res.existingPurchase ?? 0) > 0)
      liabilitiesNote.push(`Purchase: ${formatMoney(res.existingPurchase)}`);
    if ((res.existingCommodity ?? 0) > 0)
      liabilitiesNote.push(`Special: ${formatMoney(res.existingCommodity)}`);
    const tile3Breakdown =
      liabilitiesNote.length > 0 ? liabilitiesNote.join(" · ") : "No debt deductions";

    return (
      <section
        className="result-panel has-result min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] lg:sticky lg:top-20"
        id="resultPanel"
        aria-live="polite"
        ref={panelRef}
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Withdrawal Settlement
            </span>
            <h3 className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50 break-words">
              {res.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {res.staff ? `${res.staff} · ` : ""}
              {isRetirement ? "Retirement Withdrawal" : "Voluntary Withdrawal"}
            </p>
          </div>
          <StatusBadge tone={res.eligible ? "pass" : "fail"} label={statusLabel} />
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Current Savings
              </span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
                {formatMoney(res.savings)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Total member savings
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Final Disbursement
              </span>
              <strong
                className={`mt-1 block font-mono-num text-base sm:text-lg font-semibold ${
                  netDisbursement > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : netDisbursement < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-900 dark:text-slate-50"
                }`}
              >
                {formatSignedMoney(netDisbursement)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
                {tile2Breakdown}
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Total Deductions
              </span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatMoney(res.totalDeductions)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
                {tile3Breakdown}
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Withdrawal Mode
              </span>
              <strong className="mt-1 block text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                {isRetirement ? "Retirement" : "Voluntary"}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                {isRetirement ? "0% fee applied" : "5% fee applied"}
              </span>
            </div>
          </div>

          {netDisbursement < 0 && res.savings > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-800 dark:text-red-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <strong>Deficit Notice:</strong> Outstanding obligations (
                {formatMoney(res.totalLiabilities)}) exceed savings proceeds. Net deficit:{" "}
                <span className="font-mono-num font-semibold">{formatMoney(res.deficit)}</span>.
              </div>
            </div>
          )}

          <ActionRow
            copiedKey={copiedKey}
            rowId="withdrawal-actions"
            copyTitle="Copy withdrawal details to clipboard"
            onShare={onShare}
            onCopyClick={handleCopyClick}
          />

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  1. Settlement Breakdown
                </span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {isRetirement ? "0% Fee" : "5% Fee"}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Total Current Savings
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.savings)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    {isRetirement ? "Retirement Charge (0%)" : "Voluntary Charge (5%)"}
                  </span>
                  <span
                    className={`shrink-0 font-mono-num font-medium ${
                      (res.withdrawalFee ?? 0) > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {(res.withdrawalFee ?? 0) > 0
                      ? `- ${formatMoney(res.withdrawalFee)}`
                      : "₦0.00 (Waived)"}
                  </span>
                </div>
                {res.existingLoan > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Outstanding Loan Payoff
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-red-600 dark:text-red-400">
                      - {formatMoney(res.existingLoan)}
                    </span>
                  </div>
                )}
                {(res.existingPurchase ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Outstanding Purchase Payoff
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-red-600 dark:text-red-400">
                      - {formatMoney(res.existingPurchase)}
                    </span>
                  </div>
                )}
                {(res.existingCommodity ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Outstanding Special Loan Payoff
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-red-600 dark:text-red-400">
                      - {formatMoney(res.existingCommodity)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                  <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                    Net Disbursement to Member
                  </span>
                  <span
                    className={`shrink-0 font-mono-num font-bold ${
                      netDisbursement < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {formatSignedMoney(netDisbursement)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`rounded-lg border p-4 ${
                res.eligible
                  ? "border-slate-200 dark:border-slate-800"
                  : "border-red-300 dark:border-red-900/70"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  2. Liabilities &amp; Clearance
                </span>
                <span
                  className={`text-xs font-semibold ${
                    res.eligible
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {res.eligible ? "Cleared" : "Action Required"}
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Normal Loan Balance
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.existingLoan)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Purchase Balance
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.existingPurchase)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Special Loan Balance
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.existingCommodity || 0)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                  <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                    Total Cooperative Obligations
                  </span>
                  <span className="shrink-0 font-mono-num font-semibold text-slate-900 dark:text-slate-50">
                    {formatMoney(res.totalLiabilities)}
                  </span>
                </div>
              </div>
              <p
                className={`mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed ${
                  res.eligible
                    ? "text-slate-600 dark:text-slate-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {res.eligible
                  ? (res.totalLiabilities ?? 0) > 0
                    ? "All existing loan and purchase balances will be liquidated and closed from savings."
                    : "Member has zero outstanding loan or purchase obligations."
                  : `Total obligations exceed member savings by ${formatMoney(
                      res.deficit
                    )}. Additional payment required to close accounts.`}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const statusLabel = res.eligible
    ? res.isInquiry
      ? "Capacity Ready"
      : "Eligible"
    : "Not Eligible";
  const specRatePct =
    Math.round(((res.specialInterestRate !== undefined ? res.specialInterestRate : 0.20) * 100) * 10) /
    10;

  if (res.facility === "special") {
    const splitBreakdown = `${formatMoney(res.principalMonthly)} prin · ${formatMoney(
      res.interestMonthly
    )} int`;

    return (
      <section
        className="result-panel has-result min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] lg:sticky lg:top-20"
        id="resultPanel"
        aria-live="polite"
        ref={panelRef}
      >
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Special Loan Appraisal
            </span>
            <h3 className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50 break-words">
              {res.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              {res.staff} · Special Loan ({specRatePct}% flat)
            </p>
          </div>
          <StatusBadge tone={res.eligible ? "pass" : "fail"} label={statusLabel} />
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Special Loan (Principal)
              </span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
                {formatMoney(res.amount)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Disbursed in full (no upfront fee)
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Total Repayment
              </span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatMoney(res.totalRepayment)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
                Principal + {formatMoney(res.interest)} ({specRatePct}% Int)
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Monthly Loan Split
              </span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatMoney(res.monthly)}
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
                {splitBreakdown}
              </span>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
              <span className="block text-xs text-slate-500 dark:text-slate-400">Duration</span>
              <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                {res.duration} Months
              </strong>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                Max 24 months
              </span>
            </div>
          </div>

          <ActionRow
            copiedKey={copiedKey}
            rowId="special-actions"
            copyTitle="Copy appraisal details to clipboard"
            onShare={onShare}
            onCopyClick={handleCopyClick}
          />

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  1. Principal &amp; Interest Split ({specRatePct}% Flat)
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Split
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Special Loan Principal
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.amount)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Flat Interest ({specRatePct}%)
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.interest)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Monthly Principal Deduction
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.principalMonthly)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Monthly Interest Deduction
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.interestMonthly)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                  <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                    Total Monthly Special Loan Deduction
                  </span>
                  <span className="shrink-0 font-mono-num font-bold text-blue-600 dark:text-blue-400">
                    {formatMoney(res.monthly)}
                  </span>
                </div>
                {(res.existingCommodity ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Existing Special Loan Balance (Not Offset)
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.existingCommodity)}
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Interest is not deducted upfront; {formatMoney(res.principalMonthly)} principal and{" "}
                {formatMoney(res.interestMonthly)} interest are deducted monthly over {res.duration}{" "}
                months.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  2. Monthly Cooperative &amp; Payslip Summary
                </span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Stacked
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Monthly Special Loan Repayment
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.monthly)}
                  </span>
                </div>
                {(res.coopDed ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Current Coop Deduction (Kept)
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.coopDed)}
                    </span>
                  </div>
                )}
                {(res.otherDed ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Other Ongoing Deductions
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.otherDed)}
                    </span>
                  </div>
                )}
                {(res.nonCoop ?? 0) > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Non-Coop Bank Deductions
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.nonCoop)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                    New Total Coop Monthly Deduction
                  </span>
                  <span className="shrink-0 font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                    {formatMoney(res.totalCoopMonthly)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                  <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                    New Total Payslip Deduction
                  </span>
                  <span className="shrink-0 font-mono-num font-bold text-slate-900 dark:text-slate-50">
                    {formatMoney(res.newDeduction)}
                  </span>
                </div>
              </div>
              <p className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Special loan repayment stacks onto existing cooperative deductions. Savings limit (×2)
                and salary cap are not enforced on Special Loans.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Normal Loan ("cash") or Purchase ("purchase")
  const facilityLabel = res.facility === "cash" ? "Normal Loan" : "Purchase";
  const capPct = Math.round((res.deductionRate || 0.40) * 100);
  const testedSavingsTarget = res.facility === "cash" ? res.amount : (res.financed ?? res.amount);
  const savingsExcess = Math.max(0, testedSavingsTarget - res.savingsLimit);
  const savingsNote = res.savingsPass
    ? `Amount requested fits within the Savings Limit (×2) of ${formatMoney(res.savingsLimit)}.`
    : `Amount requested exceeds Savings Limit (×2) of ${formatMoney(res.savingsLimit)}${
        savingsExcess > 0 ? ` by ${formatMoney(savingsExcess)}` : ""
      }.`;

  const payrollNote = res.payrollPass
    ? `New monthly deduction (${formatMoney(
        res.newDeduction
      )}) fits within the allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`
    : `New monthly deduction (${formatMoney(
        res.newDeduction
      )}) exceeds allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`;

  const breakdownNote =
    res.facility === "cash"
      ? `${formatMoney(res.monthly)} loan + ${formatMoney(res.monthlySavings)} sav${
          (res.otherDed ?? 0) > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""
        }`
      : (res.coopDed ?? 0) > 0
        ? `${formatMoney(res.monthly)} item + ${formatMoney(res.coopDed)} coop${
            (res.otherDed ?? 0) > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""
          }`
        : `${formatMoney(res.monthly)} item${
            (res.otherDed ?? 0) > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""
          }`;

  const tile2Label = res.facility === "cash" ? "Net Disbursed" : "Total Repayment";
  const tile2Value = res.facility === "cash" ? formatMoney(res.net) : formatMoney(res.totalRepayment);
  const tile2Breakdown =
    res.facility === "cash"
      ? `Less ₦${(res.interest || res.amount * 0.10).toLocaleString()} (10% chg)${
          res.existingLoan > 0 ? ` & ₦${Number(res.existingLoan).toLocaleString()} (loan)` : ""
        }`
      : `Financed ${formatMoney(res.financed)} + ${formatMoney(res.interest)} (10% Int)`;

  const tile1Breakdown =
    res.facility === "purchase" && res.isDownPaymentActive
      ? `Down: ${formatMoney(res.down)} · Fin: ${formatMoney(res.financed)}`
      : "";

  return (
    <section
      className="result-panel has-result min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] lg:sticky lg:top-20"
      id="resultPanel"
      aria-live="polite"
      ref={panelRef}
    >
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Eligibility Appraisal
          </span>
          <h3 className="mt-0.5 text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-50 break-words">
            {res.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {res.staff} · {facilityLabel}
          </p>
        </div>
        <StatusBadge tone={res.eligible ? "pass" : "fail"} label={statusLabel} />
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {res.facility === "cash" ? "Amount Requested" : "Purchase Amount"}
            </span>
            <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400">
              {formatMoney(res.amount)}
            </strong>
            {tile1Breakdown && (
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
                {tile1Breakdown}
              </span>
            )}
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">{tile2Label}</span>
            <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
              {tile2Value}
            </strong>
            <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
              {tile2Breakdown}
            </span>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Monthly Deduction
            </span>
            <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
              {formatMoney(res.totalCoopMonthly || res.monthly)}
            </strong>
            <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400 break-words">
              {breakdownNote}
            </span>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">Duration</span>
            <strong className="mt-1 block font-mono-num text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
              {res.duration} Months
            </strong>
            <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-slate-400">
              {capPct}% payroll cap applied
            </span>
          </div>
        </div>

        {res.facility === "cash" && res.net <= 0 && res.amount > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-800 dark:text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <strong>Zero Payout Warning:</strong> Outstanding loan balance (
              {formatMoney(res.existingLoan)}) offsets net proceeds (
              {formatMoney(res.amount - (res.interest || res.amount * 0.10))}).
            </div>
          </div>
        )}

        <ActionRow
          copiedKey={copiedKey}
          rowId="standard-actions"
          copyTitle="Copy appraisal details to clipboard"
          onShare={onShare}
          onCopyClick={handleCopyClick}
        />

        {/* Policy Audit Checks */}
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-4 ${
              res.savingsPass
                ? "border-slate-200 dark:border-slate-800"
                : "border-red-300 dark:border-red-900/70"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                1. Savings Limit (×2)
              </span>
              <span
                className={`text-xs font-semibold ${
                  res.savingsPass
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {res.savingsPass ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              <div className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-slate-600 dark:text-slate-400">Savings Limit (×2)</span>
                <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                  {formatMoney(res.savingsLimit)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 text-slate-600 dark:text-slate-400">
                  {res.facility === "cash" ? "Amount Requested" : "Amount Financed"}
                </span>
                <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                  {formatMoney(testedSavingsTarget)}
                </span>
              </div>
              {res.facility === "purchase" && res.isDownPaymentActive && (
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-slate-600 dark:text-slate-400">
                    Down Payment Dropped
                  </span>
                  <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                    {formatMoney(res.down)}
                  </span>
                </div>
              )}
            </div>
            <p
              className={`mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed ${
                res.savingsPass
                  ? "text-slate-600 dark:text-slate-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {savingsNote}
            </p>
          </div>

          <div
            className={`rounded-lg border p-4 ${
              res.payrollPass
                ? "border-slate-200 dark:border-slate-800"
                : "border-red-300 dark:border-red-900/70"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                2. Payslip Deduction Check
              </span>
              <span
                className={`text-xs font-semibold ${
                  res.payrollPass
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {res.payrollPass ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {res.facility === "cash" ? (
                <>
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Monthly Loan Repayment
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.monthly)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      10% Upfront Charge (Deducted at Payout)
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.interest || res.upfrontCharge || res.amount * 0.10)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Monthly Savings Contribution
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.monthlySavings)}
                    </span>
                  </div>
                  {(res.otherDed ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-slate-600 dark:text-slate-400">
                        Other Monthly Deductions
                      </span>
                      <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(res.otherDed)}
                      </span>
                    </div>
                  )}
                  {(res.nonCoop ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-slate-600 dark:text-slate-400">
                        Non-Coop Bank Deductions
                      </span>
                      <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(res.nonCoop)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      Monthly Purchase Repayment
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.monthly)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 text-slate-600 dark:text-slate-400">
                      10% Interest Included
                    </span>
                    <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                      {formatMoney(res.interest)}
                    </span>
                  </div>
                  {res.isDownPaymentActive && (
                    <>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <span className="min-w-0 text-slate-600 dark:text-slate-400">
                          Down Payment Dropped (Upfront)
                        </span>
                        <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                          {formatMoney(res.down)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 py-2">
                        <span className="min-w-0 text-slate-600 dark:text-slate-400">
                          Remaining Amount Financed
                        </span>
                        <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                          {formatMoney(res.financed)}
                        </span>
                      </div>
                    </>
                  )}
                  {(res.coopDed ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-slate-600 dark:text-slate-400">
                        Current Coop Deduction (Incl. Savings)
                      </span>
                      <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(res.coopDed)}
                      </span>
                    </div>
                  )}
                  {(res.otherDed ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-slate-600 dark:text-slate-400">
                        Other Ongoing Deductions
                      </span>
                      <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(res.otherDed)}
                      </span>
                    </div>
                  )}
                  {(res.nonCoop ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 text-slate-600 dark:text-slate-400">
                        Non-Coop Bank Deductions
                      </span>
                      <span className="shrink-0 font-mono-num font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(res.nonCoop)}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                  {res.facility === "cash" ? "New Total Monthly Deduction" : "Total Monthly Deduction"}
                </span>
                <span className="shrink-0 font-mono-num font-bold text-blue-600 dark:text-blue-400">
                  {formatMoney(res.newDeduction)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-2.5 pb-1">
                <span className="min-w-0 font-semibold text-slate-900 dark:text-slate-50">
                  Maximum Allowed ({capPct}% of Salary)
                </span>
                <span className="shrink-0 font-mono-num font-semibold text-slate-900 dark:text-slate-50">
                  {formatMoney(res.maxDeduction)}
                </span>
              </div>
            </div>
            <p
              className={`mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed ${
                res.payrollPass
                  ? "text-slate-600 dark:text-slate-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {payrollNote}
            </p>
          </div>
        </div>

        {/* Proposable Counter-Offer Accordion */}
        {res.needsProposal && (res.counter ?? 0) > 0 && (res.counterNet ?? 0) > 0 ? (
          <details className="group rounded-lg border border-blue-200 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <HelpCircle size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="truncate">
                  {res.zeroPayout ? "Proposable amount (with payout)" : "Recommended Alternative"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono-num text-blue-600 dark:text-blue-400">
                  {formatMoney(res.counter)}
                </span>
                <ChevronDown
                  size={15}
                  className="text-slate-500 transition-transform group-open:rotate-180"
                />
              </div>
            </summary>
            <div className="border-t border-blue-200/70 dark:border-blue-800/60 p-4 space-y-3">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Calculated to satisfy both 2× savings limit and {capPct}% payroll deduction cap:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Proposable Amount
                  </span>
                  <strong className="mt-0.5 block font-mono-num text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {formatMoney(res.counter)}
                  </strong>
                </div>
                <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Net Disbursed
                  </span>
                  <strong className="mt-0.5 block font-mono-num text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatMoney(res.counterNet)}
                  </strong>
                </div>
                <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Monthly Deduction
                  </span>
                  <strong className="mt-0.5 block font-mono-num text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatMoney(res.counterTotalMonthly || res.counterMonthly)}
                  </strong>
                </div>
                <div className="rounded border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Duration
                  </span>
                  <strong className="mt-0.5 block font-mono-num text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {res.duration} Months
                  </strong>
                </div>
              </div>
              <button
                type="button"
                className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:text-white px-4 py-2 text-xs font-semibold transition-colors"
                id="btnApplyProposal"
                onClick={() => onApplyCounterOffer(res.counter!, res.duration)}
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Apply Proposable Amount ({formatMoney(res.counter)})</span>
              </button>
            </div>
          </details>
        ) : res.needsProposal ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 p-3.5 text-xs leading-relaxed text-red-800 dark:text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <strong>Notice:</strong>{" "}
              {res.zeroPayout
                ? "Even the maximum amount supportable under savings and payroll limits nets ₦0.00 after clearing the existing loan."
                : "Member currently has no allowable borrowing capacity under current debt and savings balances."}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
