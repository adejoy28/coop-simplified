import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Eraser, Pencil, Search, X } from "lucide-react";
import { MoneyInput } from "./MoneyInput.tsx";
import { extractMemberProfile, findMatchingMembers } from "../services/ledgerService.ts";
import { DEFAULT_SPECIAL_INTEREST_RATE, SWAP_DEDUCTION_RATE } from "../config/constants.ts";
import { customPctToFraction } from "../engine/underwriting.ts";
import { formatMoney, parseNumber } from "../utils/formatters.ts";
import type {
  DownPaymentCustomType,
  DownPaymentMode,
  FacilityType,
  MemberRecord,
  WithdrawalType
} from "../types/coop.ts";

export interface LookupStatusState {
  message: string;
  type: "loading" | "success" | "error";
}

interface ApplicationFormProps {
  facility: FacilityType;
  staff: string;
  name: string;
  savings: string;
  existingLoan: string;
  existingPurchase: string;
  existingCommodity: string;
  gross: string;
  totalBank: string;
  coopDed: string;
  monthlySavings: string;
  otherDed: string;
  requested: string;
  duration: string;
  isInquiry: boolean;
  deductionRate: number;
  customDeductionRate: number | null;
  downPaymentMode: DownPaymentMode;
  downPaymentVal: number;
  downPaymentCustomType: DownPaymentCustomType;
  specialInterestRate: number;
  withdrawalType: WithdrawalType;
  lookupStatus: LookupStatusState | null;
  onStaffChange: (val: string) => void;
  onNameChange: (val: string) => void;
  onSelectSuggestion: (record: MemberRecord) => void;
  onFetchByStaff: () => void;
  onFetchByName: () => void;
  onFieldChange: (
    field:
      | "savings"
      | "existingLoan"
      | "existingPurchase"
      | "existingCommodity"
      | "gross"
      | "totalBank"
      | "coopDed"
      | "monthlySavings"
      | "otherDed"
      | "requested"
      | "duration",
    val: string
  ) => void;
  onDurationBlur: () => void;
  onSwitchFacility: (fac: FacilityType) => void;
  onSetDeductionCap: (rate: number, isCustom?: boolean) => void;
  onSetWithdrawalType: (type: WithdrawalType) => void;
  onToggleInquiry: (checked: boolean) => void;
  onSetDownPaymentMode: (mode: DownPaymentMode, val?: number) => void;
  onSetDownPaymentCustomType: (type: DownPaymentCustomType) => void;
  onSetSpecialInterestRate: (rate: number) => void;
  onCalculate: () => void;
  onReset: () => void;
}

const STANDARD_INPUT_CLASS =
  "w-full min-h-[42px] sm:min-h-[40px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-colors";

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  facility,
  staff,
  name,
  savings,
  existingLoan,
  existingPurchase,
  existingCommodity,
  gross,
  totalBank,
  coopDed,
  monthlySavings,
  otherDed,
  requested,
  duration,
  isInquiry,
  deductionRate,
  customDeductionRate,
  downPaymentMode,
  downPaymentVal,
  downPaymentCustomType,
  specialInterestRate,
  withdrawalType,
  lookupStatus,
  onStaffChange,
  onNameChange,
  onSelectSuggestion,
  onFetchByStaff,
  onFetchByName,
  onFieldChange,
  onDurationBlur,
  onSwitchFacility,
  onSetDeductionCap,
  onSetWithdrawalType,
  onToggleInquiry,
  onSetDownPaymentMode,
  onSetDownPaymentCustomType,
  onSetSpecialInterestRate,
  onCalculate,
  onReset
}) => {
  const [staffSuggestions, setStaffSuggestions] = useState<MemberRecord[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<MemberRecord[]>([]);
  const [showCapEditor, setShowCapEditor] = useState(false);
  const [customCapDraft, setCustomCapDraft] = useState("40");
  const [showSpecRateEditor, setShowSpecRateEditor] = useState(false);
  const [customSpecRateDraft, setCustomSpecRateDraft] = useState("20");
  const [showDpEditor, setShowDpEditor] = useState(false);
  const [customDpDraft, setCustomDpDraft] = useState("");

  const formRef = useRef<HTMLElement>(null);
  const customCapInputRef = useRef<HTMLInputElement>(null);
  const customSpecRateInputRef = useRef<HTMLInputElement>(null);
  const customDpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest(".search-field-wrap")) {
        setStaffSuggestions([]);
        setNameSuggestions([]);
      }
    };
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  const handleStaffInput = (val: string) => {
    onStaffChange(val);
    const q = val.trim();
    setStaffSuggestions(q.length >= 1 ? findMatchingMembers(q, 5, "staff") : []);
  };

  const handleNameInput = (val: string) => {
    onNameChange(val);
    const q = val.trim();
    setNameSuggestions(q.length >= 1 ? findMatchingMembers(q, 5, "name") : []);
  };

  const openCapEditor = () => {
    setShowCapEditor((prev) => {
      const next = !prev;
      if (next) {
        setCustomCapDraft(String(Math.round((deductionRate || 0.40) * 100)));
        requestAnimationFrame(() => {
          customCapInputRef.current?.focus();
          customCapInputRef.current?.select();
        });
      }
      return next;
    });
  };

  const applyCap = () => {
    const raw = Number(customCapDraft);
    if (isNaN(raw) || raw < 5 || raw > 95) {
      customCapInputRef.current?.focus();
      return;
    }
    onSetDeductionCap(Math.round(raw) / 100, true);
    setShowCapEditor(false);
  };

  const openSpecRateEditor = () => {
    setShowSpecRateEditor((prev) => {
      const next = !prev;
      if (next) {
        setCustomSpecRateDraft(
          String(Math.round((specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE) * 1000) / 10)
        );
        requestAnimationFrame(() => {
          customSpecRateInputRef.current?.focus();
          customSpecRateInputRef.current?.select();
        });
      }
      return next;
    });
  };

  const applySpecRate = () => {
    const raw = Number(customSpecRateDraft);
    if (isNaN(raw) || raw < 0 || raw > 100) {
      customSpecRateInputRef.current?.focus();
      return;
    }
    onSetSpecialInterestRate(raw / 100);
    setShowSpecRateEditor(false);
  };

  const openDpEditor = () => {
    setShowDpEditor((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          customDpInputRef.current?.focus();
          customDpInputRef.current?.select();
        });
      }
      return next;
    });
  };

  const applyDp = () => {
    const raw = parseNumber(customDpDraft);
    if (downPaymentCustomType === "pct") {
      if (isNaN(raw) || raw < 1 || raw >= 95) {
        customDpInputRef.current?.focus();
        return;
      }
      onSetDownPaymentMode("custom_pct", Math.round(raw));
    } else {
      if (isNaN(raw) || raw <= 0) {
        customDpInputRef.current?.focus();
        return;
      }
      onSetDownPaymentMode("custom_amt", raw);
    }
    setShowDpEditor(false);
  };

  const isLoanFamily = facility === "cash" || facility === "special";
  const panelSubtitle =
    facility === "cash"
      ? "Normal Loan Request"
      : facility === "purchase"
        ? "Purchase / Asset Finance"
        : facility === "special"
          ? "Special Loan Request"
          : "Withdrawal Settlement";

  const labelRequested =
    facility === "purchase"
      ? "Purchase amount (₦)"
      : facility === "special"
        ? "Special loan amount (₦)"
        : "Amount requested (₦)";

  const labelDuration =
    facility === "purchase" ? "Duration (1–9 mos)" : "Duration (1–24 mos)";

  const btnCalculateText =
    facility === "special"
      ? "Calculate Special Loan"
      : facility === "withdrawal"
        ? "Calculate Settlement"
        : "Calculate Eligibility";

  const durationPresets = facility === "purchase" ? [3, 6, 9] : [3, 6, 12, 18, 24];

  const requestedNum = parseNumber(requested);
  const rawDur = parseNumber(duration);
  const validSpecDur = rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : 12;

  let specialHintText = "";
  if (facility === "special" && requestedNum > 0) {
    const interest = requestedNum * (specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE);
    specialHintText = `${formatMoney(requestedNum / validSpecDur)}/mo prin · ${formatMoney(
      interest / validSpecDur
    )}/mo int`;
  }

  let dpHintText = "";
  if (facility === "purchase" && downPaymentMode !== "zero" && requestedNum > 0) {
    let down = 0;
    if (downPaymentMode === "30") {
      down = requestedNum * 0.30;
    } else if (downPaymentMode === "custom_pct") {
      down = requestedNum * customPctToFraction(downPaymentVal);
    } else if (downPaymentMode === "custom_amt") {
      down = Math.min(requestedNum, downPaymentVal);
    }
    const financed = Math.max(0, requestedNum - down);
    dpHintText = `${formatMoney(down)} down · ${formatMoney(financed)} financed`;
  }

  const isCustomCapActive = customDeductionRate !== null;
  const isSpecRate10 = Math.abs(specialInterestRate - 0.10) < 0.0001;
  const isSpecRate20 = Math.abs(specialInterestRate - 0.20) < 0.0001;
  const isSpecRateCustom = !isSpecRate10 && !isSpecRate20;

  return (
    <section
      className="form-panel min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 sm:p-6"
      ref={formRef}
    >
      {/* Header + Loan Submode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Application Parameters
          </span>
          <h3
            id="panelSubtitle"
            className="mt-0.5 text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            {panelSubtitle}
          </h3>
        </div>

        {isLoanFamily && (
          <div
            className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1 shrink-0"
            id="loanSubmodeWrap"
            role="group"
            aria-label="Loan type"
          >
            <button
              type="button"
              id="btnSubNormal"
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                facility === "cash"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              onClick={() => onSwitchFacility("cash")}
              title="Normal loan (upfront 10% charge, 2x savings limit)"
            >
              Normal
            </button>
            <button
              type="button"
              id="btnSubSpecial"
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                facility === "special"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              onClick={() => onSwitchFacility("special")}
              title="Special / Commodity loan (monthly principal + interest split)"
            >
              Special
            </button>
          </div>
        )}
      </div>

      {/* Section 1: Member Lookup */}
      <div className="py-5 border-b border-slate-200/80 dark:border-slate-800/80">
        <p className="mb-3.5 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
          1. Member Identification
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4" id="memberFieldGrid">
          <div className="min-w-0" id="fieldStaff">
            <label
              htmlFor="inp_staff"
              className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Staff ID / Empl. No
            </label>
            <div className="search-field-wrap relative">
              <div className="flex min-w-0">
                <input
                  id="inp_staff"
                  placeholder="e.g. 0000 or LIRS/0000"
                  autoComplete="off"
                  value={staff}
                  onChange={(e) => handleStaffInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setStaffSuggestions([]);
                      onFetchByStaff();
                    } else if (e.key === "Escape") {
                      setStaffSuggestions([]);
                    }
                  }}
                  className={`${STANDARD_INPUT_CLASS} min-w-0 flex-1 rounded-r-none border-r-0`}
                />
                <button
                  type="button"
                  id="btn_search"
                  onClick={() => {
                    setStaffSuggestions([]);
                    onFetchByStaff();
                  }}
                  aria-label="Fetch member"
                  title="Fetch from Google Sheet"
                  className="inline-flex min-h-[42px] sm:min-h-[40px] w-11 shrink-0 items-center justify-center rounded-r-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Search size={16} strokeWidth={2} />
                </button>
              </div>

              {staffSuggestions.length > 0 && (
                <div
                  className="suggestions-dropdown absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-xl divide-y divide-slate-100 dark:divide-slate-800"
                  id="staffSuggestions"
                >
                  {staffSuggestions.map((m, idx) => {
                    const p = extractMemberProfile(m);
                    const displayName = p?.name || "Member";
                    const displayId = p?.staff || p?.formNo || "No ID";
                    return (
                      <button
                        type="button"
                        key={`${displayId}-${idx}`}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                        onClick={() => {
                          setStaffSuggestions([]);
                          onSelectSuggestion(m);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {displayName}
                          </div>
                          <div className="font-mono-num text-[11px] text-blue-600 dark:text-blue-400">
                            {displayId}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                          <div>Sav: ₦{(p?.savings || 0).toLocaleString()}</div>
                          <div>Loan: ₦{(p?.loan || 0).toLocaleString()}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="inp_name"
              className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Member Name
            </label>
            <div className="search-field-wrap relative">
              <div className="flex min-w-0">
                <input
                  id="inp_name"
                  placeholder="Full name or search"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => handleNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setNameSuggestions([]);
                      onFetchByName();
                    } else if (e.key === "Escape") {
                      setNameSuggestions([]);
                    }
                  }}
                  className={`${STANDARD_INPUT_CLASS} min-w-0 flex-1 rounded-r-none border-r-0`}
                />
                <button
                  type="button"
                  id="btn_search_name"
                  onClick={() => {
                    setNameSuggestions([]);
                    onFetchByName();
                  }}
                  aria-label="Search by name"
                  title="Search member by name"
                  className="inline-flex min-h-[42px] sm:min-h-[40px] w-11 shrink-0 items-center justify-center rounded-r-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Search size={16} strokeWidth={2} />
                </button>
              </div>

              {nameSuggestions.length > 0 && (
                <div
                  className="suggestions-dropdown absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-xl divide-y divide-slate-100 dark:divide-slate-800"
                  id="nameSuggestions"
                >
                  {nameSuggestions.map((m, idx) => {
                    const p = extractMemberProfile(m);
                    const displayName = p?.name || "Member";
                    const displayId = p?.staff || p?.formNo || "No ID";
                    return (
                      <button
                        type="button"
                        key={`${displayId}-${idx}`}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
                        onClick={() => {
                          setNameSuggestions([]);
                          onSelectSuggestion(m);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {displayName}
                          </div>
                          <div className="font-mono-num text-[11px] text-blue-600 dark:text-blue-400">
                            {displayId}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                          <div>Sav: ₦{(p?.savings || 0).toLocaleString()}</div>
                          <div>Loan: ₦{(p?.loan || 0).toLocaleString()}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {lookupStatus && (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed break-words ${
              lookupStatus.type === "success"
                ? "border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/30 text-slate-800 dark:text-slate-100"
                : lookupStatus.type === "error"
                  ? "border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300"
            }`}
            id="lookupStatus"
          >
            {lookupStatus.message}
          </div>
        )}
      </div>

      {/* Section 2: Current Balances */}
      <div className="py-5 border-b border-slate-200/80 dark:border-slate-800/80" id="sectionBalances">
        <p className="mb-3.5 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
          2. Current Account Balances
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4" id="balancesFieldGrid">
          <label className="min-w-0 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Current savings (₦)
            </span>
            <MoneyInput
              id="inp_savings"
              value={savings}
              onChange={(val) => onFieldChange("savings", val)}
            />
          </label>
          <label className="min-w-0 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Normal loan outstanding (₦)
            </span>
            <MoneyInput
              id="inp_existingLoan"
              value={existingLoan}
              onChange={(val) => onFieldChange("existingLoan", val)}
            />
          </label>
          <label className="min-w-0 block" id="fieldExistingPurchase">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Purchase outstanding (₦)
            </span>
            <MoneyInput
              id="inp_existingPurchase"
              value={existingPurchase}
              onChange={(val) => onFieldChange("existingPurchase", val)}
            />
          </label>
          <label className="min-w-0 block" id="fieldExistingCommodity">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Special loan outstanding (₦)
            </span>
            <MoneyInput
              id="inp_existingCommodity"
              value={existingCommodity}
              onChange={(val) => onFieldChange("existingCommodity", val)}
            />
          </label>
        </div>
      </div>

      {/* Withdrawal Options */}
      {facility === "withdrawal" && (
        <div className="py-5 border-b border-slate-200/80 dark:border-slate-800/80" id="withdrawalConfigSection">
          <p className="mb-3.5 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
            3. Withdrawal Type
          </p>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1"
            role="group"
            aria-label="Withdrawal type"
          >
            <button
              type="button"
              id="btnWithdrawalVoluntary"
              className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                withdrawalType === "voluntary"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              onClick={() => onSetWithdrawalType("voluntary")}
              title="Voluntary withdrawal (5% charge deducted from savings)"
            >
              Voluntary (5%)
            </button>
            <button
              type="button"
              id="btnWithdrawalRetirement"
              className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                withdrawalType === "retirement"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              onClick={() => onSetWithdrawalType("retirement")}
              title="Retirement withdrawal (0% charge - full savings)"
            >
              Retirement (0%)
            </button>
          </div>
        </div>
      )}

      {/* Payroll & Deductions */}
      {facility !== "withdrawal" && (
        <div className="py-5 border-b border-slate-200/80 dark:border-slate-800/80" id="sectionPayroll">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <p className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
              3. Payroll &amp; Deductions
            </p>

            <div className="cap-toggle-wrap flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">Cap</span>
              <div
                className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-0.5"
                role="group"
                aria-label="Salary deduction cap"
              >
                <button
                  type="button"
                  id="btnCap40"
                  className={`min-h-[30px] px-2.5 rounded text-xs font-medium tabular-nums transition-colors ${
                    !isCustomCapActive && deductionRate !== SWAP_DEDUCTION_RATE
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  onClick={() => onSetDeductionCap(0.40, false)}
                  title="Default 40% salary deduction cap"
                >
                  40%
                </button>
                <button
                  type="button"
                  id="btnCap50"
                  className={`min-h-[30px] px-2.5 rounded text-xs font-medium tabular-nums transition-colors ${
                    !isCustomCapActive && deductionRate === SWAP_DEDUCTION_RATE
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  onClick={() => onSetDeductionCap(0.50, false)}
                  title="Special 50% salary deduction cap"
                >
                  50%
                </button>
              </div>

              <button
                type="button"
                id="btnCapCustom"
                className={`inline-flex h-[32px] w-[32px] items-center justify-center rounded-md border transition-colors ${
                  isCustomCapActive || showCapEditor
                    ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                onClick={openCapEditor}
                title="Set custom salary deduction cap (e.g. 53%)"
                aria-label="Set custom cap"
              >
                <Pencil size={13} strokeWidth={2} />
              </button>

              {isCustomCapActive && (
                <div
                  className="inline-flex h-[32px] items-center gap-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2 font-mono-num text-xs font-semibold text-blue-700 dark:text-blue-300"
                  id="customCapBadge"
                >
                  <span id="customCapBadgeText">{Math.round(deductionRate * 100)}%</span>
                  <button
                    type="button"
                    className="text-blue-500 hover:text-red-600 dark:hover:text-red-400"
                    onClick={() => onSetDeductionCap(0.40, false)}
                    title="Reset cap to default 40%"
                    aria-label="Reset cap"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {showCapEditor && (
            <div
              className="mb-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-2.5"
              id="customCapPopover"
            >
              <span className="text-xs text-slate-600 dark:text-slate-300">Custom cap:</span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={customCapInputRef}
                  type="number"
                  id="inp_customCap"
                  min={5}
                  max={95}
                  step={1}
                  placeholder="53"
                  className="w-16 h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-center font-mono-num text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                  value={customCapDraft}
                  onChange={(e) => setCustomCapDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCap();
                    } else if (e.key === "Escape") {
                      setShowCapEditor(false);
                    }
                  }}
                />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">%</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  className="h-8 rounded bg-blue-600 hover:bg-blue-700 px-3 text-xs font-medium text-white transition-colors"
                  onClick={applyCap}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  onClick={() => setShowCapEditor(false)}
                  aria-label="Close custom cap editor"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <label className="min-w-0 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Gross monthly salary (₦)
              </span>
              <MoneyInput
                id="inp_gross"
                value={gross}
                onChange={(val) => onFieldChange("gross", val)}
              />
            </label>
            <label className="min-w-0 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Total monthly deductions (₦)
              </span>
              <MoneyInput
                id="inp_totalBank"
                value={totalBank}
                onChange={(val) => onFieldChange("totalBank", val)}
              />
            </label>
            <label className="min-w-0 block sm:col-span-2" id="cashCoopDedWrap">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Current coop deduction (₦)
              </span>
              <MoneyInput
                id="inp_coopDed"
                value={coopDed}
                onChange={(val) => onFieldChange("coopDed", val)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Other Deductions & Savings */}
      {facility !== "withdrawal" && (
        <div
          className="py-5 border-b border-slate-200/80 dark:border-slate-800/80"
          id="cashOtherDeductionsSection"
        >
          <p className="mb-3.5 text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
            4. Other Deductions &amp; Savings
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <label className="min-w-0 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Monthly savings contribution (₦)
              </span>
              <MoneyInput
                id="inp_monthlySavings"
                value={monthlySavings}
                placeholder="10,000"
                onChange={(val) => onFieldChange("monthlySavings", val)}
              />
            </label>
            <label className="min-w-0 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Other monthly deductions (₦)
              </span>
              <MoneyInput
                id="inp_otherDed"
                value={otherDed}
                onChange={(val) => onFieldChange("otherDed", val)}
              />
            </label>
          </div>
        </div>
      )}

      {/* Request Details */}
      {facility !== "withdrawal" && (
        <div className="py-5" id="sectionRequest">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <p className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-200">
              5. Request Details
            </p>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                id="chk_inquiry"
                checked={isInquiry}
                onChange={(e) => onToggleInquiry(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span>Capacity only</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="min-w-0" id="fieldRequested">
              <label
                htmlFor="inp_requested"
                id="labelRequested"
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                {labelRequested}
              </label>
              <MoneyInput
                id="inp_requested"
                value={isInquiry ? "" : requested}
                disabled={isInquiry}
                placeholder={isInquiry ? "Calculated automatically" : "Enter amount"}
                onChange={(val) => onFieldChange("requested", val)}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="inp_duration"
                id="labelDuration"
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                {labelDuration}
              </label>
              <input
                type="number"
                id="inp_duration"
                min={1}
                max={facility === "purchase" ? 9 : 24}
                value={duration}
                onChange={(e) => onFieldChange("duration", e.target.value)}
                onBlur={onDurationBlur}
                className={`${STANDARD_INPUT_CLASS} font-mono-num`}
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {durationPresets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onFieldChange("duration", String(m))}
                    className={`rounded border px-2 py-0.5 font-mono-num text-[11px] font-medium transition-colors ${
                      Number(duration) === m
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Special Loan Flat Interest Rate */}
          {facility === "special" && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80" id="specialInterestWrap">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Special loan flat interest rate
                </span>
                {specialHintText && (
                  <span
                    className="font-mono-num text-xs font-medium text-blue-600 dark:text-blue-400"
                    id="specialInterestHint"
                  >
                    {specialHintText}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="grid flex-1 min-w-[160px] grid-cols-2 gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1"
                  role="group"
                  aria-label="Special loan interest rate"
                >
                  <button
                    type="button"
                    id="btnSpecRate10"
                    className={`min-h-[34px] rounded-md px-3 text-xs font-medium tabular-nums transition-colors ${
                      isSpecRate10
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    onClick={() => onSetSpecialInterestRate(0.10)}
                    title="10% flat interest rate"
                  >
                    10%
                  </button>
                  <button
                    type="button"
                    id="btnSpecRate20"
                    className={`min-h-[34px] rounded-md px-3 text-xs font-medium tabular-nums transition-colors ${
                      isSpecRate20
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    onClick={() => onSetSpecialInterestRate(0.20)}
                    title="Standard 20% flat interest rate"
                  >
                    20%
                  </button>
                </div>

                <button
                  type="button"
                  id="btnSpecRateCustom"
                  className={`inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    isSpecRateCustom || showSpecRateEditor
                      ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  onClick={openSpecRateEditor}
                  title="Set custom flat interest rate (%)"
                  aria-label="Set custom interest rate"
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>

                {isSpecRateCustom && (
                  <div
                    className="inline-flex h-[42px] items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 font-mono-num text-xs font-semibold text-blue-700 dark:text-blue-300"
                    id="customSpecRateBadge"
                  >
                    <span id="customSpecRateBadgeText">
                      {Math.round(specialInterestRate * 1000) / 10}%
                    </span>
                    <button
                      type="button"
                      className="text-blue-500 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => {
                        onSetSpecialInterestRate(DEFAULT_SPECIAL_INTEREST_RATE);
                        setShowSpecRateEditor(false);
                      }}
                      title="Reset interest rate to 20%"
                      aria-label="Reset interest rate"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>

              {showSpecRateEditor && (
                <div
                  className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-2.5"
                  id="customSpecRatePopover"
                >
                  <span className="text-xs text-slate-600 dark:text-slate-300">Custom rate:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={customSpecRateInputRef}
                      type="number"
                      id="inp_customSpecRate"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="20"
                      className="w-20 h-8 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-center font-mono-num text-xs font-semibold text-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                      autoComplete="off"
                      value={customSpecRateDraft}
                      onChange={(e) => setCustomSpecRateDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applySpecRate();
                        } else if (e.key === "Escape") {
                          setShowSpecRateEditor(false);
                        }
                      }}
                    />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">%</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      className="h-8 rounded bg-blue-600 hover:bg-blue-700 px-3 text-xs font-medium text-white transition-colors"
                      onClick={applySpecRate}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      onClick={() => setShowSpecRateEditor(false)}
                      aria-label="Close custom rate editor"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Purchase Down Payment */}
          {facility === "purchase" && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80" id="purchaseDownPaymentWrap">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Down payment
                </span>
                {dpHintText && (
                  <span
                    className="font-mono-num text-xs font-medium text-blue-600 dark:text-blue-400"
                    id="dpCalculatedHint"
                  >
                    {dpHintText}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="grid flex-1 min-w-[160px] grid-cols-2 gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1"
                  role="group"
                  aria-label="Purchase down payment"
                >
                  <button
                    type="button"
                    id="btnDpZero"
                    className={`min-h-[34px] rounded-md px-3 text-xs font-medium transition-colors ${
                      downPaymentMode === "zero"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    onClick={() => onSetDownPaymentMode("zero", 0)}
                    title="Zero down payment"
                  >
                    Zero
                  </button>
                  <button
                    type="button"
                    id="btnDp30"
                    className={`min-h-[34px] rounded-md px-3 text-xs font-medium tabular-nums transition-colors ${
                      downPaymentMode === "30"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    onClick={() => onSetDownPaymentMode("30", 0.30)}
                    title="Standard 30% down payment"
                  >
                    30%
                  </button>
                </div>

                <button
                  type="button"
                  id="btnDpCustom"
                  className={`inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    downPaymentMode === "custom_pct" || downPaymentMode === "custom_amt" || showDpEditor
                      ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  onClick={openDpEditor}
                  title="Set custom down payment (% or ₦ amount)"
                  aria-label="Set custom down payment"
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>

                {(downPaymentMode === "custom_pct" || downPaymentMode === "custom_amt") && (
                  <div
                    className="inline-flex h-[42px] items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-2.5 font-mono-num text-xs font-semibold text-blue-700 dark:text-blue-300"
                    id="customDpBadge"
                  >
                    <span id="customDpBadgeText">
                      {downPaymentMode === "custom_pct"
                        ? `${downPaymentVal}%`
                        : `₦${Math.round(downPaymentVal).toLocaleString()}`}
                    </span>
                    <button
                      type="button"
                      className="text-blue-500 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => {
                        onSetDownPaymentMode("zero", 0);
                        setShowDpEditor(false);
                      }}
                      title="Reset down payment to Zero"
                      aria-label="Reset down payment"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>

              {showDpEditor && (
                <div
                  className="mt-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-3"
                  id="customDpPopover"
                >
                  <div className="mb-2 grid grid-cols-2 gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-0.5">
                    <button
                      type="button"
                      id="btnDpTypePct"
                      className={`h-7 rounded text-xs font-medium transition-colors ${
                        downPaymentCustomType === "pct"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      onClick={() => {
                        onSetDownPaymentCustomType("pct");
                        setCustomDpDraft("");
                      }}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      id="btnDpTypeAmt"
                      className={`h-7 rounded text-xs font-medium transition-colors ${
                        downPaymentCustomType === "amt"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      onClick={() => {
                        onSetDownPaymentCustomType("amt");
                        setCustomDpDraft("");
                      }}
                    >
                      ₦ Fixed Amount
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-[120px] flex-1 items-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 h-8">
                      {downPaymentCustomType === "amt" && (
                        <span className="mr-1 text-xs text-slate-500" id="dpAffixPrefix">
                          ₦
                        </span>
                      )}
                      <input
                        ref={customDpInputRef}
                        type="text"
                        id="inp_customDp"
                        placeholder={downPaymentCustomType === "pct" ? "15" : "45,000"}
                        className="w-full min-w-0 bg-transparent font-mono-num text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                        autoComplete="off"
                        value={customDpDraft}
                        onChange={(e) => setCustomDpDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyDp();
                          } else if (e.key === "Escape") {
                            setShowDpEditor(false);
                          }
                        }}
                      />
                      {downPaymentCustomType === "pct" && (
                        <span className="ml-1 text-xs text-slate-500" id="dpAffixSuffix">
                          %
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="h-8 rounded bg-blue-600 hover:bg-blue-700 px-3 text-xs font-medium text-white transition-colors"
                      onClick={applyDp}
                    >
                      <Check size={13} className="inline mr-1" />
                      Apply
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      onClick={() => setShowDpEditor(false)}
                      aria-label="Close down payment editor"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Footer: Primary Calculate + Clean Inline Reset */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
        <button
          className="inline-flex min-h-[44px] sm:min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          id="btnClear"
          onClick={onReset}
          type="button"
          title="Clear desk & reset all inputs"
        >
          <Eraser size={15} strokeWidth={2} />
          <span>Clear Desk</span>
        </button>

        <button
          className="primary-button calculate flex-1 inline-flex min-h-[44px] sm:min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          id="btnCalculate"
          onClick={onCalculate}
          type="button"
        >
          <span id="btnCalculateText">{btnCalculateText}</span>
          <ArrowRight size={16} strokeWidth={2} />
        </button>
      </div>
    </section>
  );
};
