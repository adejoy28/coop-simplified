import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import {
  DEFAULT_DEDUCTION_RATE,
  DEFAULT_SPECIAL_INTEREST_RATE,
  INACTIVITY_TIMEOUT_MS
} from "./config/constants.ts";
import { calculateUnderwriting, getTieredDuration } from "./engine/underwriting.ts";
import {
  extractMemberProfile,
  fetchMemberByStaffId,
  findMatchingMembers,
  getLedgerSyncStatus,
  initLedgerCache,
  prefetchLedger,
  subscribeLedgerSync
} from "./services/ledgerService.ts";
import {
  clearSessionAuth,
  getActivePin,
  hasUnlockedSession,
  isSessionExpired,
  persistSessionUnlocked,
  touchSessionActivity,
  verifyPinDigest
} from "./utils/auth.ts";
import { formatInputDisplay, formatMoney, parseNumber } from "./utils/formatters.ts";
import {
  copyTextToClipboard,
  getAppraisalText,
  getProfileShareText,
  shareWhatsApp
} from "./utils/share.ts";
import { AuthOverlay } from "./components/AuthOverlay.tsx";
import { Masthead } from "./components/Masthead.tsx";
import { ScenariosCarousel } from "./components/ScenariosCarousel.tsx";
import { ApplicationForm, type LookupStatusState } from "./components/ApplicationForm.tsx";
import { ResultPanel } from "./components/ResultPanel.tsx";
import { HistoryDrawer } from "./components/HistoryDrawer.tsx";
import { OnboardingTour } from "./components/OnboardingTour.tsx";
import type {
  AppraisalHistoryItem,
  AppraisalInputs,
  DownPaymentCustomType,
  DownPaymentMode,
  FacilityType,
  LedgerSyncInfo,
  MemberProfile,
  MemberRecord,
  ScenarioData,
  ThemeMode,
  UnderwritingResult,
  WithdrawalType
} from "./types/coop.ts";

const HISTORY_STORAGE_KEY = "alpha_coop_appraisal_history";
const ONBOARDING_STORAGE_KEY = "alpha_coop_onboarded";
const MAX_HISTORY_ITEMS = 25;

interface FormValues {
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
}

const DEFAULT_FORM: FormValues = {
  staff: "",
  name: "",
  savings: "",
  existingLoan: "",
  existingPurchase: "",
  existingCommodity: "",
  gross: "",
  totalBank: "",
  coopDed: "",
  monthlySavings: "10,000",
  otherDed: "",
  requested: "",
  duration: "3"
};

function loadInitialHistory(): AppraisalHistoryItem[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AppraisalHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: AppraisalHistoryItem[]): void {
  try {
    sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

function loadInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem("alpha_theme");
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => hasUnlockedSession());
  const [theme, setTheme] = useState<ThemeMode>(() => loadInitialTheme());
  const [isScrolled, setIsScrolled] = useState(false);

  const [facility, setFacility] = useState<FacilityType>("cash");
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType>("voluntary");
  const [specialInterestRate, setSpecialInterestRate] = useState<number>(DEFAULT_SPECIAL_INTEREST_RATE);
  const [downPaymentMode, setDownPaymentMode] = useState<DownPaymentMode>("zero");
  const [downPaymentVal, setDownPaymentVal] = useState<number>(0);
  const [downPaymentCustomType, setDownPaymentCustomType] = useState<DownPaymentCustomType>("pct");
  const [deductionRate, setDeductionRate] = useState<number>(DEFAULT_DEDUCTION_RATE);
  const [customDeductionRate, setCustomDeductionRate] = useState<number | null>(null);
  const [isInquiry, setIsInquiry] = useState<boolean>(false);
  const [isDurationOverridden, setIsDurationOverridden] = useState<boolean>(false);
  const [lastSavingsInput, setLastSavingsInput] = useState<number>(10000);

  const [form, setForm] = useState<FormValues>(DEFAULT_FORM);
  const [lookupStatus, setLookupStatus] = useState<LookupStatusState | null>(null);
  const [currentMemberProfile, setCurrentMemberProfile] = useState<MemberProfile | null>(null);
  const [lastResult, setLastResult] = useState<UnderwritingResult | null>(null);
  const [history, setHistory] = useState<AppraisalHistoryItem[]>(() => loadInitialHistory());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [ledgerSync, setLedgerSync] = useState<LedgerSyncInfo>(() => getLedgerSyncStatus());

  const resultPanelRef = useRef<HTMLElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityWriteRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("alpha_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (isUnlocked) {
      document.body.classList.remove("is-locked");
      document.body.classList.add("is-unlocked");
    } else {
      document.body.classList.add("is-locked");
      document.body.classList.remove("is-unlocked");
    }
  }, [isUnlocked]);

  useEffect(() => {
    const unsub = subscribeLedgerSync(setLedgerSync);
    if (isUnlocked) {
      initLedgerCache(getActivePin());
    }
    return unsub;
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked) {
      setIsTourActive(false);
      return;
    }
    try {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true") {
        const t = setTimeout(() => setIsTourActive(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [isUnlocked]);

  const lockDesk = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    clearSessionAuth();
    setIsUnlocked(false);
    setIsHistoryOpen(false);
    setIsTourActive(false);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (isUnlocked) {
      touchSessionActivity();
      inactivityTimerRef.current = setTimeout(() => {
        lockDesk();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [isUnlocked, lockDesk]);

  useEffect(() => {
    if (!isUnlocked) return;
    resetInactivityTimer();

    const activityEvents = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "input"];
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current > 2000) {
        lastActivityWriteRef.current = now;
        resetInactivityTimer();
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" || document.hasFocus()) {
        if (isSessionExpired()) {
          lockDesk();
        } else {
          resetInactivityTimer();
        }
      }
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [isUnlocked, resetInactivityTimer, lockDesk]);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAttemptPin = useCallback((candidatePin: string): boolean => {
    if (verifyPinDigest(candidatePin)) {
      const cleanPin = candidatePin.trim();
      persistSessionUnlocked(cleanPin);
      setIsUnlocked(true);
      initLedgerCache(cleanPin);
      return true;
    }
    return false;
  }, []);

  const recordHistory = useCallback((inputs: AppraisalInputs, res: UnderwritingResult) => {
    const appraisalRecord: AppraisalHistoryItem = {
      id: "appr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      timestamp: Date.now(),
      facility: inputs.facility,
      name: inputs.name || "Member Record",
      staff: inputs.staff || "",
      amount: res.amount,
      net: res.net,
      duration: inputs.duration,
      eligible: res.eligible,
      isInquiry: inputs.isInquiry,
      monthly: res.monthly,
      totalCoopMonthly: res.totalCoopMonthly || res.monthly,
      savings: inputs.savings,
      existingLoan: inputs.existingLoan,
      existingPurchase: inputs.existingPurchase,
      existingCommodity: inputs.existingCommodity,
      withdrawalType: inputs.withdrawalType,
      inputs: { ...inputs },
      result: res
    };

    setHistory((prev) => {
      const filtered = prev.filter((item) => {
        const isSameMember =
          (item.staff && item.staff === appraisalRecord.staff) ||
          (item.name && item.name === appraisalRecord.name);
        const isSameAmount = item.amount === appraisalRecord.amount;
        const isSameFacility = item.facility === appraisalRecord.facility;
        return !(isSameMember && isSameAmount && isSameFacility);
      });
      const updated = [appraisalRecord, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const runUnderwriting = useCallback(
    (
      overrides?: Partial<{
        facility: FacilityType;
        form: FormValues;
        isInquiry: boolean;
        deductionRate: number;
        downPaymentMode: DownPaymentMode;
        downPaymentVal: number;
        withdrawalType: WithdrawalType;
        specialInterestRate: number;
      }>,
      shouldScroll = false
    ) => {
      if (!isUnlocked) return null;
      const activeFac = overrides?.facility ?? facility;
      const activeForm = overrides?.form ?? form;
      const activeInq = overrides?.isInquiry ?? isInquiry;
      const activeDedRate = overrides?.deductionRate ?? deductionRate;
      const activeDpMode = overrides?.downPaymentMode ?? downPaymentMode;
      const activeDpVal = overrides?.downPaymentVal ?? downPaymentVal;
      const activeWithdrawal = overrides?.withdrawalType ?? withdrawalType;
      const activeSpecRate = overrides?.specialInterestRate ?? specialInterestRate;

      const rawDur = parseNumber(activeForm.duration);
      const defaultDur = activeFac === "purchase" ? 9 : activeFac === "special" ? 12 : 3;
      const validDur =
        activeFac === "purchase"
          ? rawDur > 0
            ? Math.min(9, Math.max(1, rawDur))
            : 9
          : rawDur > 0
            ? Math.min(24, Math.max(1, rawDur))
            : defaultDur;

      const monthlySavingsTrimmed = activeForm.monthlySavings.trim();
      const inputs: AppraisalInputs = {
        facility: activeFac,
        name: activeForm.name.trim() || "Member",
        staff: activeForm.staff.trim() || "No ID",
        gross: parseNumber(activeForm.gross),
        savings: parseNumber(activeForm.savings),
        existingLoan: parseNumber(activeForm.existingLoan),
        existingPurchase: parseNumber(activeForm.existingPurchase),
        existingCommodity: parseNumber(activeForm.existingCommodity),
        totalBank: parseNumber(activeForm.totalBank),
        requested: parseNumber(activeForm.requested),
        duration: validDur,
        isInquiry: activeInq,
        deductionRate: activeDedRate,
        coopDed: parseNumber(activeForm.coopDed),
        monthlySavings: monthlySavingsTrimmed === "" ? 10000 : parseNumber(monthlySavingsTrimmed),
        otherDed: parseNumber(activeForm.otherDed),
        purchaseDownPayment: activeDpMode !== "zero",
        downPaymentMode: activeDpMode,
        downPaymentVal: activeDpVal,
        withdrawalType: activeWithdrawal,
        specialInterestRate: activeSpecRate
      };

      const res = calculateUnderwriting(inputs);
      setLastResult(res);
      recordHistory(inputs, res);

      if (shouldScroll && window.innerWidth < 1024) {
        requestAnimationFrame(() => {
          resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }

      return res;
    },
    [
      isUnlocked,
      facility,
      form,
      isInquiry,
      deductionRate,
      downPaymentMode,
      downPaymentVal,
      withdrawalType,
      specialInterestRate,
      recordHistory
    ]
  );

  // Keyboard shortcut: Ctrl/Cmd + Enter runs appraisal
  useEffect(() => {
    if (!isUnlocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runUnderwriting(undefined, true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isUnlocked, runUnderwriting]);

  const handleSwitchFacility = useCallback(
    (nextFac: FacilityType) => {
      if (!isUnlocked) return;
      setFacility(nextFac);

      const nextForm = { ...form };
      if (nextFac === "cash") {
        const restoredSavings = lastSavingsInput || 10000;
        nextForm.monthlySavings = formatInputDisplay(restoredSavings);
        const reqNum = parseNumber(nextForm.requested);
        nextForm.duration = String(reqNum > 0 ? getTieredDuration(reqNum) : 3);
        setIsDurationOverridden(false);
      } else if (nextFac === "purchase") {
        const curSav = parseNumber(nextForm.monthlySavings);
        if (curSav > 0) setLastSavingsInput(curSav);
        nextForm.monthlySavings = "0";
        nextForm.duration = "9";
        setIsDurationOverridden(false);
      } else if (nextFac === "special") {
        const curSav = parseNumber(nextForm.monthlySavings);
        if (curSav > 0) setLastSavingsInput(curSav);
        nextForm.monthlySavings = "0";
        nextForm.duration = "12";
        setIsDurationOverridden(false);
      }

      setForm(nextForm);
      if (lastResult) {
        runUnderwriting({ facility: nextFac, form: nextForm });
      }
    },
    [isUnlocked, form, lastSavingsInput, lastResult, runUnderwriting]
  );

  const handleToggleFacilityQuick = useCallback(() => {
    const next: FacilityType =
      facility === "cash" || facility === "special"
        ? "purchase"
        : facility === "purchase"
          ? "withdrawal"
          : "cash";
    handleSwitchFacility(next);
  }, [facility, handleSwitchFacility]);

  const handleSetDeductionCap = useCallback(
    (rate: number, isCustom = false) => {
      setDeductionRate(rate);
      setCustomDeductionRate(isCustom ? rate : null);
      if (lastResult || parseNumber(form.gross) > 0 || parseNumber(form.savings) > 0) {
        runUnderwriting({ deductionRate: rate });
      }
    },
    [lastResult, form.gross, form.savings, runUnderwriting]
  );

  const handleSetWithdrawalType = useCallback(
    (type: WithdrawalType) => {
      setWithdrawalType(type);
      if (facility === "withdrawal" && (lastResult || parseNumber(form.savings) > 0)) {
        runUnderwriting({ withdrawalType: type });
      }
    },
    [facility, lastResult, form.savings, runUnderwriting]
  );

  const handleToggleInquiry = useCallback(
    (checked: boolean) => {
      setIsInquiry(checked);
      const nextForm = checked ? { ...form, requested: "" } : form;
      if (checked) setForm(nextForm);
      if (lastResult || parseNumber(nextForm.gross) > 0 || parseNumber(nextForm.savings) > 0) {
        runUnderwriting({ isInquiry: checked, form: nextForm });
      }
    },
    [form, lastResult, runUnderwriting]
  );

  const handleSetDownPaymentMode = useCallback(
    (mode: DownPaymentMode, val = 0) => {
      const resolvedVal = val || (mode === "30" ? 0.30 : 0);
      setDownPaymentMode(mode);
      setDownPaymentVal(resolvedVal);
      if (lastResult || parseNumber(form.gross) > 0 || parseNumber(form.savings) > 0) {
        runUnderwriting({ downPaymentMode: mode, downPaymentVal: resolvedVal });
      }
    },
    [lastResult, form.gross, form.savings, runUnderwriting]
  );

  const handleSetSpecialInterestRate = useCallback(
    (rate: number) => {
      const normalized =
        !isNaN(rate) && rate >= 0 ? (rate > 1 ? rate / 100 : rate) : DEFAULT_SPECIAL_INTEREST_RATE;
      setSpecialInterestRate(normalized);
      if (facility === "special" && (lastResult || parseNumber(form.requested) > 0)) {
        runUnderwriting({ specialInterestRate: normalized });
      }
    },
    [facility, lastResult, form.requested, runUnderwriting]
  );

  const handleFieldChange = useCallback(
    (
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
    ) => {
      const nextForm = { ...form, [field]: val };

      if (field === "requested" && facility === "cash" && !isDurationOverridden) {
        const reqNum = parseNumber(val);
        nextForm.duration = String(reqNum > 0 ? getTieredDuration(reqNum) : 3);
      }
      if (field === "duration") {
        setIsDurationOverridden(true);
      }

      setForm(nextForm);

      if ((field === "requested" || field === "duration") && lastResult) {
        runUnderwriting({ form: nextForm });
      }
    },
    [form, facility, isDurationOverridden, lastResult, runUnderwriting]
  );

  const handleDurationBlur = useCallback(() => {
    const val = Number(form.duration);
    let corrected = form.duration;
    if (facility === "purchase") {
      if (!val || val <= 0 || val > 9) {
        corrected = val > 9 ? "9" : val < 1 && val > 0 ? "1" : "9";
      }
    } else {
      if (!val || val <= 0 || val > 24) {
        corrected = val > 24 ? "24" : val < 1 && val > 0 ? "1" : "3";
      }
    }
    if (corrected !== form.duration) {
      const nextForm = { ...form, duration: corrected };
      setForm(nextForm);
      if (lastResult) {
        runUnderwriting({ form: nextForm });
      }
    }
  }, [form, facility, lastResult, runUnderwriting]);

  const resetFinancialFields = useCallback(
    (keepStaff?: string, keepName?: string) => {
      setForm((prev) => ({
        ...DEFAULT_FORM,
        staff: keepStaff !== undefined ? keepStaff : prev.staff,
        name: keepName !== undefined ? keepName : prev.name,
        duration: prev.duration,
        monthlySavings: facility === "purchase" || facility === "special" ? "0" : "10,000"
      }));
      setDeductionRate(DEFAULT_DEDUCTION_RATE);
      setCustomDeductionRate(null);
      setLastResult(null);
      setCurrentMemberProfile(null);
    },
    [facility]
  );

  const handleStaffChange = useCallback(
    (val: string) => {
      setLookupStatus(null);
      if (currentMemberProfile) {
        const qLow = val.trim().toLowerCase();
        const staffVal = (currentMemberProfile.staff || "").toLowerCase();
        const nameVal = (currentMemberProfile.name || "").toLowerCase();
        if (qLow !== staffVal && qLow !== nameVal) {
          resetFinancialFields(val, "");
          return;
        }
      }
      setForm((prev) => ({ ...prev, staff: val }));
    },
    [currentMemberProfile, resetFinancialFields]
  );

  const handleNameChange = useCallback(
    (val: string) => {
      setLookupStatus(null);
      if (currentMemberProfile) {
        const qLow = val.trim().toLowerCase();
        const staffVal = (currentMemberProfile.staff || "").toLowerCase();
        const nameVal = (currentMemberProfile.name || "").toLowerCase();
        if (qLow !== staffVal && qLow !== nameVal) {
          resetFinancialFields("", val);
          return;
        }
      }
      setForm((prev) => ({ ...prev, name: val }));
    },
    [currentMemberProfile, resetFinancialFields]
  );

  const applyMemberRecord = useCallback(
    (member: MemberRecord) => {
      const profile = extractMemberProfile(member);
      if (!profile) return;

      const nextDuration =
        facility === "cash"
          ? "3"
          : facility === "purchase"
            ? "9"
            : facility === "special"
              ? "12"
              : form.duration;

      setIsDurationOverridden(false);
      setDeductionRate(DEFAULT_DEDUCTION_RATE);
      setCustomDeductionRate(null);

      setForm({
        staff: profile.staff,
        name: profile.name,
        savings: profile.savings > 0 ? formatInputDisplay(profile.savings) : "",
        existingLoan: profile.loan > 0 ? formatInputDisplay(profile.loan) : "",
        existingPurchase: profile.purchase > 0 ? formatInputDisplay(profile.purchase) : "",
        existingCommodity: profile.commodity > 0 ? formatInputDisplay(profile.commodity) : "",
        gross: member.gross ? formatInputDisplay(member.gross) : "",
        coopDed: member.coopDed ? formatInputDisplay(member.coopDed) : "",
        monthlySavings:
          facility === "purchase" || facility === "special"
            ? "0"
            : member.monthlySavings
              ? formatInputDisplay(member.monthlySavings)
              : "10,000",
        totalBank: member.totalBank ? formatInputDisplay(member.totalBank) : "",
        otherDed: "",
        requested: "",
        duration: nextDuration
      });

      const formattedSavings = formatMoney(profile.savings || 0);
      const formattedLoan = formatMoney(profile.loan || 0);
      const commodityNote =
        profile.commodity > 0 ? ` · Special Loan: ${formatMoney(profile.commodity)}` : "";
      const purchaseNote =
        profile.purchase > 0 ? ` · Purchase: ${formatMoney(profile.purchase)}` : "";
      setLookupStatus({
        message: `Found: ${profile.name || profile.staff} · Savings: ${formattedSavings} · Loan: ${formattedLoan}${commodityNote}${purchaseNote}`,
        type: "success"
      });

      setCurrentMemberProfile(profile);
      setLastResult(null);
    },
    [facility, form.duration]
  );

  const handleFetchByStaff = useCallback(async () => {
    if (!isUnlocked) return;
    const staffId = form.staff.trim();
    if (!staffId) {
      setLookupStatus({ message: "Please enter a Staff ID or number", type: "error" });
      return;
    }
    setLookupStatus({ message: `Checking ledger for "${staffId}"…`, type: "loading" });
    try {
      const { record } = await fetchMemberByStaffId(staffId, getActivePin());
      if (record) {
        applyMemberRecord(record);
      } else {
        setLookupStatus({ message: `Member "${staffId}" not found`, type: "error" });
      }
    } catch {
      setLookupStatus({ message: `Member "${staffId}" not found`, type: "error" });
    }
  }, [isUnlocked, form.staff, applyMemberRecord]);

  const handleFetchByName = useCallback(async () => {
    if (!isUnlocked) return;
    const query = form.name.trim();
    if (!query) {
      setLookupStatus({ message: "Please enter a member name to search", type: "error" });
      return;
    }
    setLookupStatus({ message: `Searching ledger for "${query}"…`, type: "loading" });
    try {
      const matches = findMatchingMembers(query, 1, "name");
      if (matches.length > 0) {
        applyMemberRecord(matches[0]);
      } else {
        const { record } = await fetchMemberByStaffId(query, getActivePin());
        if (record) {
          applyMemberRecord(record);
        } else {
          setLookupStatus({ message: `Member "${query}" not found`, type: "error" });
        }
      }
    } catch {
      setLookupStatus({ message: `Member "${query}" not found`, type: "error" });
    }
  }, [isUnlocked, form.name, applyMemberRecord]);

  const handleSelectScenario = useCallback(
    (data: ScenarioData) => {
      if (!isUnlocked || !data) return;

      const defaultDur = facility === "cash" ? 3 : facility === "special" ? 12 : 9;
      const nextDuration = String(data.duration || defaultDur);
      const nextInq = Boolean(data.inquiry);
      const nextDpMode: DownPaymentMode =
        facility === "purchase"
          ? Boolean(data.downPayment !== undefined ? data.downPayment : data.dp)
            ? "30"
            : "zero"
          : downPaymentMode;
      const nextDpVal = nextDpMode === "30" ? 0.30 : 0;
      const nextSpecRate =
        facility === "special" && data.specialInterestRate !== undefined
          ? data.specialInterestRate
          : specialInterestRate;
      const nextWithdrawal =
        facility === "withdrawal" && data.withdrawalType ? data.withdrawalType : withdrawalType;

      const existingLoanVal =
        data.existingLoan !== undefined ? data.existingLoan : data.loanBal || 0;

      const nextForm: FormValues = {
        name: data.name || "",
        staff: data.staff || "",
        gross: formatInputDisplay(data.gross || 0),
        savings: formatInputDisplay(data.savings || 0),
        existingLoan: formatInputDisplay(existingLoanVal),
        existingPurchase: formatInputDisplay(data.existingPurchase ?? 0),
        existingCommodity: formatInputDisplay(data.existingCommodity ?? 0),
        totalBank: formatInputDisplay(data.totalBank || 0),
        coopDed: formatInputDisplay(data.coopDed || 0),
        monthlySavings: formatInputDisplay(data.monthlySavings || 0),
        otherDed: formatInputDisplay(data.otherDed || 0),
        requested: nextInq ? "" : data.requested ? formatInputDisplay(data.requested) : "",
        duration: nextDuration
      };

      setForm(nextForm);
      setIsInquiry(nextInq);
      setDownPaymentMode(nextDpMode);
      setDownPaymentVal(nextDpVal);
      setSpecialInterestRate(nextSpecRate);
      setWithdrawalType(nextWithdrawal);
      setIsDurationOverridden(true);
      setLookupStatus(null);
      setCurrentMemberProfile(null);

      runUnderwriting(
        {
          form: nextForm,
          isInquiry: nextInq,
          downPaymentMode: nextDpMode,
          downPaymentVal: nextDpVal,
          specialInterestRate: nextSpecRate,
          withdrawalType: nextWithdrawal
        },
        true
      );
    },
    [isUnlocked, facility, downPaymentMode, specialInterestRate, withdrawalType, runUnderwriting]
  );

  const handleApplyCounterOffer = useCallback(
    (amount: number, counterDuration: number) => {
      const durToUse =
        counterDuration > 0
          ? counterDuration
          : facility === "cash"
            ? getTieredDuration(amount)
            : Number(form.duration) || 9;
      const nextForm: FormValues = {
        ...form,
        requested: formatInputDisplay(amount),
        duration: String(durToUse)
      };
      setForm(nextForm);
      setIsDurationOverridden(true);
      runUnderwriting({ form: nextForm }, false);
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    },
    [facility, form, runUnderwriting]
  );

  const handleRestoreAppraisal = useCallback((item: AppraisalHistoryItem) => {
    if (!item || !item.inputs) return;
    const inp = item.inputs;
    const fac = inp.facility || "cash";

    setFacility(fac);
    setDeductionRate(inp.deductionRate || DEFAULT_DEDUCTION_RATE);
    setCustomDeductionRate(
      inp.deductionRate && inp.deductionRate !== 0.40 && inp.deductionRate !== 0.50
        ? inp.deductionRate
        : null
    );

    if (fac === "purchase") {
      if (inp.downPaymentMode) {
        setDownPaymentMode(inp.downPaymentMode);
        setDownPaymentVal(inp.downPaymentVal || 0);
      } else {
        setDownPaymentMode(inp.purchaseDownPayment ? "30" : "zero");
        setDownPaymentVal(inp.purchaseDownPayment ? 0.30 : 0);
      }
    } else if (fac === "special") {
      setSpecialInterestRate(inp.specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE);
    } else if (fac === "withdrawal") {
      setWithdrawalType(inp.withdrawalType || "voluntary");
    }

    setIsInquiry(Boolean(inp.isInquiry));
    setIsDurationOverridden(true);
    setLookupStatus(null);

    const restoredForm: FormValues = {
      name: inp.name || "",
      staff: inp.staff || "",
      gross: inp.gross ? formatInputDisplay(inp.gross) : "",
      savings: inp.savings ? formatInputDisplay(inp.savings) : "",
      existingLoan: inp.existingLoan ? formatInputDisplay(inp.existingLoan) : "",
      existingPurchase: inp.existingPurchase ? formatInputDisplay(inp.existingPurchase) : "",
      existingCommodity: inp.existingCommodity ? formatInputDisplay(inp.existingCommodity) : "",
      totalBank: inp.totalBank ? formatInputDisplay(inp.totalBank) : "",
      coopDed: inp.coopDed ? formatInputDisplay(inp.coopDed) : "",
      monthlySavings:
        inp.monthlySavings !== undefined
          ? formatInputDisplay(inp.monthlySavings)
          : fac === "cash"
            ? "10,000"
            : "0",
      otherDed: inp.otherDed ? formatInputDisplay(inp.otherDed) : "",
      requested: inp.isInquiry ? "" : inp.requested ? formatInputDisplay(inp.requested) : "",
      duration: String(inp.duration || (fac === "cash" ? 3 : fac === "special" ? 12 : 9))
    };

    setForm(restoredForm);
    setCurrentMemberProfile(null);
    setLastResult(item.result);

    if (window.innerWidth < 1024) {
      requestAnimationFrame(() => {
        resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, []);

  const handleResetForm = useCallback(() => {
    const defaultDur = facility === "purchase" ? "9" : facility === "special" ? "12" : "3";
    setForm({
      ...DEFAULT_FORM,
      duration: defaultDur,
      monthlySavings: facility === "purchase" || facility === "special" ? "0" : "10,000"
    });
    setWithdrawalType("voluntary");
    setSpecialInterestRate(DEFAULT_SPECIAL_INTEREST_RATE);
    setIsDurationOverridden(false);
    setIsInquiry(false);
    setDownPaymentMode("zero");
    setDownPaymentVal(0);
    setDeductionRate(DEFAULT_DEDUCTION_RATE);
    setCustomDeductionRate(null);
    setLookupStatus(null);
    setLastResult(null);
    setCurrentMemberProfile(null);
  }, [facility]);

  const handleShare = useCallback(() => {
    const text = lastResult
      ? getAppraisalText(lastResult)
      : currentMemberProfile
        ? getProfileShareText(currentMemberProfile)
        : "";
    shareWhatsApp(text);
  }, [lastResult, currentMemberProfile]);

  const handleCopy = useCallback(async () => {
    const text = lastResult
      ? getAppraisalText(lastResult)
      : currentMemberProfile
        ? getProfileShareText(currentMemberProfile)
        : "";
    return copyTextToClipboard(text);
  }, [lastResult, currentMemberProfile]);

  const handleStopTour = useCallback(() => {
    setIsTourActive(false);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <AuthOverlay isUnlocked={isUnlocked} onAttemptPin={handleAttemptPin} />

      <Masthead
        facility={facility}
        deductionRate={deductionRate}
        ledgerSync={ledgerSync}
        historyCount={history.length}
        theme={theme}
        isScrolled={isScrolled}
        isUnlocked={isUnlocked}
        onToggleFacilityQuick={handleToggleFacilityQuick}
        onRefreshLedger={() => void prefetchLedger(true, getActivePin())}
        onStartOnboarding={() => setIsTourActive(true)}
        onToggleHistory={() => setIsHistoryOpen((o) => !o)}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <main className="app-shell min-h-screen w-full overflow-x-clip" inert={!isUnlocked ? true : undefined}>
        <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-14">
          {/* Page Intro & Policy Context */}
          <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 sm:pb-5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Member Underwriting
              </p>
              <h2 className="mt-0.5 text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
                Check what a member can access.
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 lg:hidden">
              <span>Savings ×2</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Payroll Cap {Math.round(deductionRate * 100)}%</span>
            </div>
          </section>

          {/* Primary Facility Segmented Control */}
          <div
            className="mode-switch grid w-full grid-cols-3 gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1"
            aria-label="Facility type"
          >
            <button
              className={`min-h-[40px] min-w-0 truncate rounded-md px-2 sm:px-4 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                facility === "cash" || facility === "special"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              id="btnTabCash"
              onClick={() => handleSwitchFacility("cash")}
              type="button"
            >
              Normal Loan
            </button>
            <button
              className={`min-h-[40px] min-w-0 truncate rounded-md px-2 sm:px-4 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                facility === "purchase"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              id="btnTabPurchase"
              onClick={() => handleSwitchFacility("purchase")}
              type="button"
            >
              Purchase
            </button>
            <button
              className={`min-h-[40px] min-w-0 truncate rounded-md px-2 sm:px-4 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                facility === "withdrawal"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              id="btnTabWithdrawal"
              onClick={() => handleSwitchFacility("withdrawal")}
              type="button"
            >
              Withdrawal
            </button>
          </div>

          <ScenariosCarousel facility={facility} onSelectScenario={handleSelectScenario} />

          {/* Main 2-Column Workspace Grid */}
          <div className="workspace-grid grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
            <ApplicationForm
              facility={facility}
              staff={form.staff}
              name={form.name}
              savings={form.savings}
              existingLoan={form.existingLoan}
              existingPurchase={form.existingPurchase}
              existingCommodity={form.existingCommodity}
              gross={form.gross}
              totalBank={form.totalBank}
              coopDed={form.coopDed}
              monthlySavings={form.monthlySavings}
              otherDed={form.otherDed}
              requested={form.requested}
              duration={form.duration}
              isInquiry={isInquiry}
              deductionRate={deductionRate}
              customDeductionRate={customDeductionRate}
              downPaymentMode={downPaymentMode}
              downPaymentVal={downPaymentVal}
              downPaymentCustomType={downPaymentCustomType}
              specialInterestRate={specialInterestRate}
              withdrawalType={withdrawalType}
              lookupStatus={lookupStatus}
              onStaffChange={handleStaffChange}
              onNameChange={handleNameChange}
              onSelectSuggestion={applyMemberRecord}
              onFetchByStaff={() => void handleFetchByStaff()}
              onFetchByName={() => void handleFetchByName()}
              onFieldChange={handleFieldChange}
              onDurationBlur={handleDurationBlur}
              onSwitchFacility={handleSwitchFacility}
              onSetDeductionCap={handleSetDeductionCap}
              onSetWithdrawalType={handleSetWithdrawalType}
              onToggleInquiry={handleToggleInquiry}
              onSetDownPaymentMode={handleSetDownPaymentMode}
              onSetDownPaymentCustomType={setDownPaymentCustomType}
              onSetSpecialInterestRate={handleSetSpecialInterestRate}
              onCalculate={() => {
                runUnderwriting(undefined, true);
              }}
              onReset={handleResetForm}
            />

            <ResultPanel
              panelRef={resultPanelRef}
              result={lastResult}
              memberProfile={currentMemberProfile}
              onApplyCounterOffer={handleApplyCounterOffer}
              onShare={handleShare}
              onCopy={handleCopy}
            />
          </div>

          <footer className="app-footer mt-10 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-flex items-center gap-1.5">
              <Lock size={13} strokeWidth={2} />
              <span>Confidential · Internal Cooperative Use Only</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <span>Designed &amp; Developed by</span>
              <a
                href="https://adebayosystems.com.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
              >
                Adebayo Systems
              </a>
            </div>
          </footer>
        </div>
      </main>

      <HistoryDrawer
        isOpen={isHistoryOpen}
        items={history}
        onClose={() => setIsHistoryOpen(false)}
        onRestore={handleRestoreAppraisal}
        onDelete={(id) => {
          setHistory((prev) => {
            const updated = prev.filter((item) => item.id !== id);
            saveHistory(updated);
            return updated;
          });
        }}
        onClearAll={() => {
          setHistory([]);
          try {
            sessionStorage.removeItem(HISTORY_STORAGE_KEY);
          } catch {
            // ignore
          }
        }}
      />

      <OnboardingTour isActive={isTourActive} onStop={handleStopTour} />
    </>
  );
}
