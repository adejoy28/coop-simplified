// ==========================================================================
//  ALPHA COOP — APPLICATION ORCHESTRATOR & ENTRY POINT
// ==========================================================================

import { DEFAULT_DEDUCTION_RATE, SWAP_DEDUCTION_RATE, DEFAULT_SPECIAL_INTEREST_RATE } from "./config/constants.js";
import { formatMoney, parseNumber } from "./utils/formatters.js";
import { resolveElement, setFieldValue, getFieldValue, getFieldNum, initMoneyInputs, escapeHtml } from "./utils/dom.js";
import { getTieredDuration, calculateUnderwriting, customPctToFraction } from "./engine/underwriting.js";
import {
  initLedgerCache,
  findMatchingMembers,
  fetchMemberByStaffId,
  extractMemberProfile,
  subscribeLedgerSync,
  prefetchLedger
} from "./services/ledgerService.js";
import { getState, setState } from "./state/appState.js";
import { initTheme, toggleTheme } from "./ui/theme.js";
import { initAuth, handleAuthSubmit, unlockDesk, lockDesk, isDeskUnlocked } from "./ui/auth.js";
import { renderScenarios } from "./ui/scenarios.js";
import { renderEmptyResult, renderMemberProfile, renderResult } from "./ui/results.js";
import { getAppraisalText, getProfileShareText, shareWhatsApp, copyToClipboard } from "./ui/share.js";
import { initOnboarding, startTour } from "./ui/onboarding.js";
import { addAppraisalToHistory, getAppraisalHistory } from "./state/appState.js";
import {
  initHistoryDrawer,
  openHistoryDrawer,
  closeHistoryDrawer,
  toggleHistoryDrawer,
  updateHistoryBadge
} from "./ui/historyDrawer.js";

// --------------------------------------------------------------------------
// DURATION & TIERED RULES
// --------------------------------------------------------------------------
export function updateTieredDuration(force = false) {
  const { facility, isDurationOverridden } = getState();
  if (facility !== "cash") return;
  const requested = getFieldNum("inp_requested");
  const recommended = requested > 0 ? getTieredDuration(requested) : 3;
  const inpDuration = document.getElementById("inp_duration");

  if (!isDurationOverridden || force) {
    setState({ isDurationOverridden: false });
    if (inpDuration) {
      inpDuration.value = recommended;
    }
  }
}

export function restoreTierDuration() {
  const { facility, lastResult } = getState();
  if (facility !== "cash") return;
  setState({ isDurationOverridden: false });
  updateTieredDuration(true);
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_requested") > 0) {
    calculateEligibility();
  }
}

export function applyCounterOffer(amount) {
  setFieldValue("inp_requested", amount);
  setState({ isDurationOverridden: false });
  updateTieredDuration(true);
  calculateEligibility();
  const panel = resolveElement("resultPanel");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// --------------------------------------------------------------------------
// DEDUCTION CAP SWITCH & CUSTOM CAP OVERRIDE
// --------------------------------------------------------------------------
export function setDeductionCap(rate) {
  setState({ deductionRate: rate, customDeductionRate: null });
  const btn40 = document.getElementById("btnCap40");
  const btn50 = document.getElementById("btnCap50");
  const customBadge = document.getElementById("customCapBadge");
  const btnCustom = document.getElementById("btnCapCustom");
  if (customBadge) customBadge.style.display = "none";
  if (btnCustom) btnCustom.classList.remove("active");

  if (btn40 && btn50) {
    if (rate === SWAP_DEDUCTION_RATE) {
      btn50.classList.add("active");
      btn40.classList.remove("active");
    } else {
      btn40.classList.add("active");
      btn50.classList.remove("active");
    }
  }

  const mastheadCap = document.getElementById("mastheadCapLabel");
  if (mastheadCap) {
    mastheadCap.textContent = `Deduction ${Math.round(rate * 100)}%`;
  }

  const { lastResult } = getState();
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

export function toggleCustomCapInput(forceShow) {
  const popover = document.getElementById("customCapPopover");
  const input = document.getElementById("inp_customCap");
  if (!popover) return;
  const isHidden = popover.style.display === "none" || popover.style.display === "";
  const show = forceShow !== undefined ? forceShow : isHidden;
  popover.style.display = show ? "block" : "none";
  if (show && input) {
    const currentRate = getState().deductionRate || 0.40;
    input.value = Math.round(currentRate * 100);
    input.focus();
    input.select();
  }
}

export function applyCustomCap() {
  const input = document.getElementById("inp_customCap");
  if (!input) return;
  const raw = Number(input.value);
  if (isNaN(raw) || raw < 5 || raw > 95) {
    input.focus();
    return;
  }
  const rate = Math.round(raw) / 100;
  setState({ deductionRate: rate, customDeductionRate: rate });

  const btn40 = document.getElementById("btnCap40");
  const btn50 = document.getElementById("btnCap50");
  btn40?.classList.remove("active");
  btn50?.classList.remove("active");

  const btnCustom = document.getElementById("btnCapCustom");
  btnCustom?.classList.add("active");

  const customBadge = document.getElementById("customCapBadge");
  const customBadgeText = document.getElementById("customCapBadgeText");
  if (customBadge && customBadgeText) {
    customBadgeText.textContent = `${Math.round(rate * 100)}%`;
    customBadge.style.display = "inline-flex";
  }

  toggleCustomCapInput(false);

  const mastheadCap = document.getElementById("mastheadCapLabel");
  if (mastheadCap) {
    mastheadCap.textContent = `Deduction ${Math.round(rate * 100)}%`;
  }

  const { lastResult } = getState();
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

export function resetCustomCap() {
  setDeductionCap(DEFAULT_DEDUCTION_RATE);
}

// --------------------------------------------------------------------------
// FACILITY CONTROLLER
// --------------------------------------------------------------------------
export function switchFacility(type) {
  if (!isDeskUnlocked()) return;
  setState({ facility: type });
  const btnCash = document.getElementById("btnTabCash");
  const btnPurchase = document.getElementById("btnTabPurchase");
  const btnWithdrawal = document.getElementById("btnTabWithdrawal");
  const loanSubmodeWrap = document.getElementById("loanSubmodeWrap");
  const btnSubNormal = document.getElementById("btnSubNormal");
  const btnSubSpecial = document.getElementById("btnSubSpecial");
  const panelSubtitle = document.getElementById("panelSubtitle");
  const cashCoopDed = document.getElementById("cashCoopDedWrap");
  const cashOtherDed = document.getElementById("cashOtherDeductionsSection");
  const purchaseDp = document.getElementById("purchaseDownPaymentWrap");
  const specialRateWrap = document.getElementById("specialInterestWrap");
  const labelRequested = document.getElementById("labelRequested");
  const labelDuration = document.getElementById("labelDuration");
  const inpDuration = document.getElementById("inp_duration");
  const sectionPayroll = document.getElementById("sectionPayroll");
  const sectionRequest = document.getElementById("sectionRequest");
  const withdrawalConfig = document.getElementById("withdrawalConfigSection");
  const btnCalculateText = document.getElementById("btnCalculateText");

  const facilityLabels = {
    cash: "Normal Loan",
    purchase: "Purchase",
    special: "Special Loan",
    withdrawal: "Withdrawal"
  };
  const currentLabel = facilityLabels[type] || "Normal Loan";

  const navFacilityText = document.getElementById("navFacilityText");
  const navFacilityBadge = document.getElementById("navFacilityBadge");
  if (navFacilityText) {
    navFacilityText.textContent = currentLabel;
  }
  if (navFacilityBadge) {
    navFacilityBadge.className = "nav-facility-badge " + type;
    navFacilityBadge.title = "Active facility: " + currentLabel + " (Click to toggle)";
  }

  const isLoanFamily = type === "cash" || type === "special";
  btnCash?.classList.toggle("active", isLoanFamily);
  btnPurchase?.classList.toggle("active", type === "purchase");
  btnWithdrawal?.classList.toggle("active", type === "withdrawal");

  if (loanSubmodeWrap) {
    loanSubmodeWrap.style.display = isLoanFamily ? "inline-grid" : "none";
  }
  btnSubNormal?.classList.toggle("active", type === "cash");
  btnSubSpecial?.classList.toggle("active", type === "special");

  if (type === "cash") {
    if (panelSubtitle) panelSubtitle.textContent = "Normal loan request";
    if (sectionPayroll) sectionPayroll.style.display = "block";
    if (cashCoopDed) cashCoopDed.style.display = "grid";
    if (cashOtherDed) cashOtherDed.style.display = "block";
    if (sectionRequest) sectionRequest.style.display = "block";
    if (purchaseDp) purchaseDp.style.display = "none";
    if (specialRateWrap) specialRateWrap.style.display = "none";
    if (withdrawalConfig) withdrawalConfig.style.display = "none";
    if (labelRequested) labelRequested.textContent = "Amount requested (₦)";
    if (labelDuration) labelDuration.textContent = "Duration (1–24 months)";
    if (btnCalculateText) btnCalculateText.textContent = "Calculate eligibility";
    if (inpDuration) {
      inpDuration.min = "1";
      inpDuration.max = "24";
    }

    // Restore monthly savings contribution when switching back to Normal Loan
    const savedContribution = getState().lastSavingsInput || 10000;
    setFieldValue("inp_monthlySavings", savedContribution);

    // Duration switches to match Normal Loan condition
    setState({ isDurationOverridden: false });
    updateTieredDuration(true);
  } else if (type === "purchase") {
    if (panelSubtitle) panelSubtitle.textContent = "Purchase request";
    if (sectionPayroll) sectionPayroll.style.display = "block";
    if (cashCoopDed) cashCoopDed.style.display = "grid";
    if (cashOtherDed) cashOtherDed.style.display = "block";
    if (sectionRequest) sectionRequest.style.display = "block";
    if (purchaseDp) purchaseDp.style.display = "block";
    if (specialRateWrap) specialRateWrap.style.display = "none";
    if (withdrawalConfig) withdrawalConfig.style.display = "none";
    if (labelRequested) labelRequested.textContent = "Purchase amount (₦)";
    if (labelDuration) labelDuration.textContent = "Duration (1–9 months)";
    if (btnCalculateText) btnCalculateText.textContent = "Calculate eligibility";
    if (inpDuration) {
      inpDuration.min = "1";
      inpDuration.max = "9";
      // Purchase condition duration is 9 months
      inpDuration.value = "9";
    }

    // Remember previous savings input and null (0) savings in purchase to prevent double deduction
    const curSav = getFieldNum("inp_monthlySavings");
    if (curSav > 0) {
      setState({ lastSavingsInput: curSav });
    }
    setFieldValue("inp_monthlySavings", "0");

    setState({ isDurationOverridden: false });
    updateDownPaymentHint();
  } else if (type === "special") {
    if (panelSubtitle) panelSubtitle.textContent = "Special loan request";
    if (sectionPayroll) sectionPayroll.style.display = "block";
    if (cashCoopDed) cashCoopDed.style.display = "grid";
    if (cashOtherDed) cashOtherDed.style.display = "block";
    if (sectionRequest) sectionRequest.style.display = "block";
    if (purchaseDp) purchaseDp.style.display = "none";
    if (specialRateWrap) specialRateWrap.style.display = "block";
    if (withdrawalConfig) withdrawalConfig.style.display = "none";
    if (labelRequested) labelRequested.textContent = "Special loan amount (₦)";
    if (labelDuration) labelDuration.textContent = "Duration (1–24 months)";
    if (btnCalculateText) btnCalculateText.textContent = "Calculate special loan";
    if (inpDuration) {
      inpDuration.min = "1";
      inpDuration.max = "24";
      inpDuration.value = "12";
    }

    // Special loan is added on top of existing coop deduction; null monthly savings to avoid double-counting
    const curSav = getFieldNum("inp_monthlySavings");
    if (curSav > 0) {
      setState({ lastSavingsInput: curSav });
    }
    setFieldValue("inp_monthlySavings", "0");

    setState({ isDurationOverridden: false });
    updateSpecialInterestHint();
  } else if (type === "withdrawal") {
    if (panelSubtitle) panelSubtitle.textContent = "Withdrawal settlement";
    if (sectionPayroll) sectionPayroll.style.display = "none";
    if (cashOtherDed) cashOtherDed.style.display = "none";
    if (sectionRequest) sectionRequest.style.display = "none";
    if (purchaseDp) purchaseDp.style.display = "none";
    if (specialRateWrap) specialRateWrap.style.display = "none";
    if (withdrawalConfig) withdrawalConfig.style.display = "block";
    if (btnCalculateText) btnCalculateText.textContent = "Calculate settlement";

    const curType = getState().withdrawalType || "voluntary";
    setWithdrawalType(curType, false);
  }

  renderScenarios(type, loadScenario);

  // Rerun eligibility if ran before. If not, maintain tab display profiling.
  const { lastResult, currentMemberProfile } = getState();
  if (lastResult) {
    calculateEligibility();
  } else if (currentMemberProfile) {
    renderMemberProfile(currentMemberProfile, {
      onShare: () => handleShare(),
      onCopy: (btn) => handleCopy(btn)
    });
  }
  updateQuickRequestChips();
}

export function toggleFacilityQuick() {
  const current = getState().facility;
  const next = (current === "cash" || current === "special")
    ? "purchase"
    : (current === "purchase" ? "withdrawal" : "cash");
  switchFacility(next);
}

export function setSpecialInterestRate(rate, recalculate = true) {
  const raw = Number(rate);
  const normalized = !isNaN(raw) && raw >= 0 ? (raw > 1 ? raw / 100 : raw) : DEFAULT_SPECIAL_INTEREST_RATE;
  setState({ specialInterestRate: normalized });

  const btn10 = document.getElementById("btnSpecRate10");
  const btn20 = document.getElementById("btnSpecRate20");
  const btnCustom = document.getElementById("btnSpecRateCustom");
  const customBadge = document.getElementById("customSpecRateBadge");
  const customBadgeText = document.getElementById("customSpecRateBadgeText");

  btn10?.classList.remove("active");
  btn20?.classList.remove("active");
  btnCustom?.classList.remove("active");
  if (customBadge) customBadge.style.display = "none";

  if (Math.abs(normalized - 0.10) < 0.0001) {
    btn10?.classList.add("active");
  } else if (Math.abs(normalized - 0.20) < 0.0001) {
    btn20?.classList.add("active");
  } else {
    btnCustom?.classList.add("active");
    if (customBadge && customBadgeText) {
      customBadgeText.textContent = `${Math.round(normalized * 1000) / 10}%`;
      customBadge.style.display = "inline-flex";
    }
  }

  updateSpecialInterestHint();

  if (recalculate && getState().facility === "special") {
    const { lastResult } = getState();
    if (lastResult || getFieldNum("inp_requested") > 0) {
      calculateEligibility();
    }
  }
}

export function toggleCustomSpecialRateInput(forceShow) {
  const popover = document.getElementById("customSpecRatePopover");
  const input = document.getElementById("inp_customSpecRate");
  if (!popover) return;
  const isHidden = popover.style.display === "none" || popover.style.display === "";
  const show = forceShow !== undefined ? forceShow : isHidden;
  popover.style.display = show ? "block" : "none";
  if (show && input) {
    const curRate = getState().specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE;
    input.value = Math.round(curRate * 1000) / 10;
    input.focus();
    input.select();
  }
}

export function applyCustomSpecialRate() {
  const input = document.getElementById("inp_customSpecRate");
  if (!input) return;
  const raw = Number(input.value);
  if (isNaN(raw) || raw < 0 || raw > 100) {
    input.focus();
    return;
  }
  setSpecialInterestRate(raw / 100);
  toggleCustomSpecialRateInput(false);
}

export function resetSpecialInterestRate() {
  setSpecialInterestRate(DEFAULT_SPECIAL_INTEREST_RATE);
  toggleCustomSpecialRateInput(false);
}

export function updateSpecialInterestHint() {
  const hintEl = document.getElementById("specialInterestHint");
  if (!hintEl) return;
  const { facility, specialInterestRate } = getState();
  if (facility !== "special") {
    hintEl.style.display = "none";
    hintEl.textContent = "";
    return;
  }
  const requested = getFieldNum("inp_requested");
  const rawDur = getFieldNum("inp_duration");
  const dur = rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : 12;
  if (requested <= 0) {
    hintEl.style.display = "none";
    hintEl.textContent = "";
    return;
  }
  const rate = specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE;
  const interest = requested * rate;
  const prinMo = requested / dur;
  const intMo = interest / dur;
  hintEl.textContent = `${formatMoney(prinMo)}/mo prin + ${formatMoney(intMo)}/mo int`;
  hintEl.style.display = "inline-flex";
}

export function setWithdrawalType(type, recalculate = true) {
  setState({ withdrawalType: type });
  const btnVol = document.getElementById("btnWithdrawalVoluntary");
  const btnRet = document.getElementById("btnWithdrawalRetirement");
  btnVol?.classList.toggle("active", type === "voluntary");
  btnRet?.classList.toggle("active", type === "retirement");

  if (recalculate && getState().facility === "withdrawal") {
    const { lastResult } = getState();
    if (lastResult || getFieldNum("inp_savings") > 0) {
      calculateEligibility();
    }
  }
}

export function setDownPaymentMode(mode, val = 0) {
  const isEnabled = mode !== "zero";
  const numVal = Number(val) || (mode === "30" ? 0.30 : 0);
  setState({
    purchaseDownPayment: isEnabled,
    downPaymentMode: mode,
    downPaymentVal: numVal
  });

  const btnZero = document.getElementById("btnDpZero");
  const btn30 = document.getElementById("btnDp30");
  const btnCustom = document.getElementById("btnDpCustom");
  const customBadge = document.getElementById("customDpBadge");
  const customBadgeText = document.getElementById("customDpBadgeText");

  btnZero?.classList.remove("active");
  btn30?.classList.remove("active");
  btnCustom?.classList.remove("active");
  if (customBadge) customBadge.style.display = "none";

  if (mode === "zero") {
    btnZero?.classList.add("active");
  } else if (mode === "30") {
    btn30?.classList.add("active");
  } else {
    btnCustom?.classList.add("active");
    if (customBadge && customBadgeText) {
      if (mode === "custom_pct") {
        customBadgeText.textContent = `${numVal}%`;
      } else {
        customBadgeText.textContent = `₦${Math.round(numVal).toLocaleString()}`;
      }
      customBadge.style.display = "inline-flex";
    }
  }

  updateDownPaymentHint();

  const { lastResult } = getState();
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
  updateQuickRequestChips();
}

export function setDownPayment(enabled) {
  setDownPaymentMode(enabled ? "30" : "zero", enabled ? 0.30 : 0);
}

export function toggleCustomDpInput(forceShow) {
  const popover = document.getElementById("customDpPopover");
  const input = document.getElementById("inp_customDp");
  if (!popover) return;
  const isHidden = popover.style.display === "none" || popover.style.display === "";
  const show = forceShow !== undefined ? forceShow : isHidden;
  popover.style.display = show ? "block" : "none";
  if (show && input) {
    input.focus();
    input.select();
  }
}

export function setCustomDpType(type) {
  setState({ downPaymentCustomType: type });
  const btnPct = document.getElementById("btnDpTypePct");
  const btnAmt = document.getElementById("btnDpTypeAmt");
  const prefix = document.getElementById("dpAffixPrefix");
  const suffix = document.getElementById("dpAffixSuffix");
  const input = document.getElementById("inp_customDp");

  if (type === "pct") {
    btnPct?.classList.add("active");
    btnAmt?.classList.remove("active");
    if (prefix) prefix.style.display = "none";
    if (suffix) suffix.style.display = "inline";
    if (input) {
      input.placeholder = "15";
      input.value = "";
    }
  } else {
    btnAmt?.classList.add("active");
    btnPct?.classList.remove("active");
    if (prefix) prefix.style.display = "inline";
    if (suffix) suffix.style.display = "none";
    if (input) {
      input.placeholder = "45,000";
      input.value = "";
    }
  }
}

export function applyCustomDownPayment() {
  const input = document.getElementById("inp_customDp");
  if (!input) return;
  const raw = parseNumber(input.value);
  const type = getState().downPaymentCustomType || "pct";

  if (type === "pct") {
    if (isNaN(raw) || raw < 1 || raw >= 95) {
      input.focus();
      return;
    }
    setDownPaymentMode("custom_pct", Math.round(raw));
  } else {
    if (isNaN(raw) || raw <= 0) {
      input.focus();
      return;
    }
    setDownPaymentMode("custom_amt", raw);
  }

  toggleCustomDpInput(false);
}

export function resetDownPayment() {
  setDownPaymentMode("zero", 0);
  toggleCustomDpInput(false);
}

export function updateDownPaymentHint() {
  const hintEl = document.getElementById("dpCalculatedHint");
  if (!hintEl) return;
  const { facility, purchaseDownPayment, downPaymentMode, downPaymentVal } = getState();
  if (facility !== "purchase" || !purchaseDownPayment || downPaymentMode === "zero") {
    hintEl.style.display = "none";
    hintEl.textContent = "";
    return;
  }

  const requested = getFieldNum("inp_requested");
  if (requested <= 0) {
    hintEl.style.display = "none";
    hintEl.textContent = "";
    return;
  }

  let down = 0;
  if (downPaymentMode === "30") {
    down = requested * 0.30;
  } else if (downPaymentMode === "custom_pct") {
    down = requested * customPctToFraction(downPaymentVal);
  } else if (downPaymentMode === "custom_amt") {
    down = Math.min(requested, downPaymentVal);
  }

  const financed = Math.max(0, requested - down);
  hintEl.textContent = `${formatMoney(down)} down · ${formatMoney(financed)} financed`;
  hintEl.style.display = "inline-flex";
}

export function toggleInquiryMode() {
  const isChecked = Boolean(document.getElementById("chk_inquiry")?.checked);
  const reqInput = document.getElementById("inp_requested");
  if (reqInput) {
    if (isChecked) {
      reqInput.value = "";
      reqInput.disabled = true;
      reqInput.placeholder = "Capacity mode (calculated automatically)";
    } else {
      reqInput.disabled = false;
      reqInput.placeholder = "Enter amount";
    }
  }
  const { lastResult } = getState();
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
  updateQuickRequestChips();
}

// --------------------------------------------------------------------------
// QUICK-FILL SUGGESTED REQUEST CHIPS
// --------------------------------------------------------------------------
export function updateQuickRequestChips() {
  const container = document.getElementById("quickRequestChips");
  if (!container) return;

  // Disabled per user preference - preserved for future activation
  container.style.display = "none";
  container.innerHTML = "";
  return;

  const isInquiry = Boolean(document.getElementById("chk_inquiry")?.checked);
  if (isInquiry) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const state = getState();
  if (state.facility === "withdrawal") {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const gross = getFieldNum("inp_gross");
  const savings = getFieldNum("inp_savings");
  if (gross <= 0 && savings <= 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const existingLoan = getFieldNum("inp_existingLoan");
  // Capacity comes from the engine itself so chip amounts can never drift from the appraisal rules
  const capacity = calculateUnderwriting({ ...readUnderwritingParams(), isInquiry: true });
  let maxAmount = capacity.maximum || 0;

  maxAmount = Math.floor(maxAmount / 1000) * 1000;
  if (maxAmount <= 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const halfAmount = Math.floor((maxAmount * 0.5) / 1000) * 1000;
  let clearLoanAmount = 0;
  if (state.facility === "cash" && existingLoan > 0) {
    clearLoanAmount = Math.ceil((existingLoan / 0.90) / 1000) * 1000;
  }

  let html = `<button type="button" class="quick-chip" data-amt="${maxAmount}"><span class="chip-label">Max</span>₦${maxAmount.toLocaleString("en-NG")}</button>`;

  if (halfAmount > 0 && halfAmount !== maxAmount) {
    html += `<button type="button" class="quick-chip" data-amt="${halfAmount}"><span class="chip-label">50%</span>₦${halfAmount.toLocaleString("en-NG")}</button>`;
  }

  if (clearLoanAmount > 0 && clearLoanAmount <= maxAmount && clearLoanAmount !== maxAmount && clearLoanAmount !== halfAmount) {
    html += `<button type="button" class="quick-chip" data-amt="${clearLoanAmount}"><span class="chip-label">Clear Loan</span>₦${clearLoanAmount.toLocaleString("en-NG")}</button>`;
  }

  container.innerHTML = html;
  container.style.display = "flex";

  container.querySelectorAll(".quick-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const amt = Number(btn.getAttribute("data-amt")) || 0;
      if (amt > 0) {
        setFieldValue("inp_requested", amt);
        if (getState().facility === "cash" && !getState().isDurationOverridden) {
          updateTieredDuration();
        }
        calculateEligibility();
      }
    });
  });
}

// --------------------------------------------------------------------------
// UNDERWRITING CALCULATION ORCHESTRATION
// --------------------------------------------------------------------------
function readUnderwritingParams() {
  const state = getState();
  const rawDur = getFieldNum("inp_duration");
  const defaultDur = state.facility === "purchase" ? 9 : (state.facility === "special" ? 12 : 3);
  const duration = state.facility === "purchase"
    ? (rawDur > 0 ? Math.min(9, Math.max(1, rawDur)) : 9)
    : (rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : defaultDur);
  const monthlySavingsRaw = getFieldValue("inp_monthlySavings").trim();

  return {
    facility: state.facility,
    name: getFieldValue("inp_name").trim() || "Member",
    staff: getFieldValue("inp_staff").trim() || "No ID",
    gross: getFieldNum("inp_gross"),
    savings: getFieldNum("inp_savings"),
    existingLoan: getFieldNum("inp_existingLoan"),
    existingPurchase: getFieldNum("inp_existingPurchase"),
    existingCommodity: getFieldNum("inp_existingCommodity"),
    totalBank: getFieldNum("inp_totalBank"),
    requested: getFieldNum("inp_requested"),
    duration,
    isInquiry: Boolean(document.getElementById("chk_inquiry")?.checked),
    deductionRate: state.deductionRate,
    coopDed: getFieldNum("inp_coopDed"),
    monthlySavings: monthlySavingsRaw === "" ? 10000 : parseNumber(monthlySavingsRaw),
    otherDed: getFieldNum("inp_otherDed"),
    purchaseDownPayment: state.purchaseDownPayment,
    downPaymentMode: state.downPaymentMode,
    downPaymentVal: state.downPaymentVal,
    withdrawalType: state.withdrawalType || "voluntary",
    specialInterestRate: state.specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE
  };
}

export function calculateEligibility() {
  if (!isDeskUnlocked()) return;
  const params = readUnderwritingParams();
  const { facility, name, staff, savings, existingLoan, existingPurchase, existingCommodity, duration, isInquiry, withdrawalType } = params;

  const res = calculateUnderwriting(params);

  setState({ lastResult: res });

  renderResult(res, {
    onApplyCounterOffer: (amount) => applyCounterOffer(amount),
    onShare: () => handleShare(),
    onCopy: (btn) => handleCopy(btn)
  });

  if (window.innerWidth < 960) {
    const panel = resolveElement("resultPanel");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Record appraisal in session memory
  const appraisalRecord = {
    id: "appr_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    timestamp: Date.now(),
    facility,
    name: name || "Member Record",
    staff: staff || "",
    amount: res.amount,
    net: res.net,
    duration: duration,
    eligible: res.eligible,
    isInquiry: isInquiry,
    monthly: res.monthly,
    totalCoopMonthly: res.totalCoopMonthly || res.monthly,
    savings: savings,
    existingLoan: existingLoan,
    existingPurchase: existingPurchase,
    existingCommodity: existingCommodity,
    withdrawalType,
    inputs: { ...params },
    result: res
  };
  addAppraisalToHistory(appraisalRecord);
  updateHistoryBadge();

  updateQuickRequestChips();
  return res;
}

export function restoreAppraisal(item) {
  if (!item || !item.inputs) return;
  const inp = item.inputs;

  // 1. Switch facility tab
  switchFacility(inp.facility || "cash");

  // 2. Populate input fields
  setFieldValue("inp_name", inp.name || "");
  setFieldValue("inp_staff", inp.staff || "");
  setFieldValue("inp_gross", inp.gross || "");
  setFieldValue("inp_savings", inp.savings || "");
  setFieldValue("inp_existingLoan", inp.existingLoan || "");
  setFieldValue("inp_existingPurchase", inp.existingPurchase || "");
  setFieldValue("inp_existingCommodity", inp.existingCommodity || "");
  setFieldValue("inp_totalBank", inp.totalBank || "");
  setFieldValue("inp_coopDed", inp.coopDed || "");
  setFieldValue("inp_monthlySavings", inp.monthlySavings !== undefined ? inp.monthlySavings : (inp.facility === "cash" ? "10,000" : "0"));
  setFieldValue("inp_otherDed", inp.otherDed || "");
  setFieldValue("inp_requested", inp.requested || "");
  setFieldValue("inp_duration", inp.duration || (inp.facility === "cash" ? 3 : (inp.facility === "special" ? 12 : 9)));

  // 3. Set cap
  setDeductionCap(inp.deductionRate || DEFAULT_DEDUCTION_RATE);

  // 4. Down payment / Special rate
  if (inp.facility === "purchase") {
    if (inp.downPaymentMode) {
      setDownPaymentMode(inp.downPaymentMode, inp.downPaymentVal || 0);
    } else {
      setDownPayment(Boolean(inp.purchaseDownPayment));
    }
  } else if (inp.facility === "special") {
    setSpecialInterestRate(inp.specialInterestRate ?? DEFAULT_SPECIAL_INTEREST_RATE, false);
  }

  // 5. Withdrawal type
  if (inp.facility === "withdrawal") {
    setWithdrawalType(inp.withdrawalType || "voluntary", false);
  }

  // 6. Inquiry mode
  const inquiryCheck = document.getElementById("chk_inquiry");
  if (inquiryCheck) {
    inquiryCheck.checked = Boolean(inp.isInquiry);
    toggleInquiryMode();
  }

  // 7. Restore result & state
  setState({
    lastResult: item.result,
    currentMemberProfile: null
  });

  renderResult(item.result, {
    onApplyCounterOffer: (amount) => applyCounterOffer(amount),
    onShare: () => handleShare(),
    onCopy: (btn) => handleCopy(btn)
  });

  updateQuickRequestChips();

  if (window.innerWidth < 960) {
    const panel = resolveElement("resultPanel");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

export function resetForm() {
  setFieldValue("inp_name", "");
  setFieldValue("inp_staff", "");
  setFieldValue("inp_gross", "");
  setFieldValue("inp_savings", "");
  setFieldValue("inp_existingLoan", "");
  setFieldValue("inp_existingPurchase", "");
  setFieldValue("inp_existingCommodity", "");
  setFieldValue("inp_totalBank", "");
  setFieldValue("inp_coopDed", "");
  setFieldValue("inp_monthlySavings", "10,000");
  setFieldValue("inp_otherDed", "");
  setFieldValue("inp_requested", "");
  setWithdrawalType("voluntary", false);
  setSpecialInterestRate(DEFAULT_SPECIAL_INTEREST_RATE, false);

  setState({ isDurationOverridden: false, lastResult: null, currentMemberProfile: null });

  if (getState().facility === "cash" && !getState().isDurationOverridden) {
    updateTieredDuration();
  } else if (getState().facility === "purchase") {
    setFieldValue("inp_duration", "9");
  } else if (getState().facility === "special") {
    setFieldValue("inp_duration", "12");
  } else {
    setFieldValue("inp_duration", "3");
  }

  const inquiryCheck = document.getElementById("chk_inquiry");
  if (inquiryCheck) inquiryCheck.checked = false;
  toggleInquiryMode();
  setDownPayment(false);
  setDeductionCap(DEFAULT_DEDUCTION_RATE);
  hideLookupStatus();
  renderEmptyResult();
  updateQuickRequestChips();
}

// --------------------------------------------------------------------------
// MEMBER LOOKUP & PROFILE DISPLAY
// --------------------------------------------------------------------------
export function resetFinancialFields() {
  setFieldValue("inp_gross", "");
  setFieldValue("inp_savings", "");
  setFieldValue("inp_existingLoan", "");
  setFieldValue("inp_existingPurchase", "");
  setFieldValue("inp_existingCommodity", "");
  setFieldValue("inp_totalBank", "");
  setFieldValue("inp_coopDed", "");
  setFieldValue("inp_monthlySavings", "10,000");
  setFieldValue("inp_otherDed", "");
  setFieldValue("inp_requested", "");
  // Auto reset cap to default 40% on member change
  setDeductionCap(DEFAULT_DEDUCTION_RATE);
  setState({ lastResult: null, currentMemberProfile: null });
  renderEmptyResult();
  updateQuickRequestChips();
}

export function applyMemberRecord(member) {
  // Clear financial fields first so stale data from a previous member never carries over
  resetFinancialFields();

  // Use the same tolerant header matching as the profile card so the form inputs
  // (which drive the calculation) never miss a balance the card displays.
  const profile = extractMemberProfile(member);
  const { staff, name, savings, loan, purchase, commodity } = profile;

  setFieldValue("inp_staff", staff);
  if (name) setFieldValue("inp_name", name);
  if (savings > 0) setFieldValue("inp_savings", savings);
  if (loan > 0) setFieldValue("inp_existingLoan", loan);
  if (purchase > 0) setFieldValue("inp_existingPurchase", purchase);
  if (commodity > 0) setFieldValue("inp_existingCommodity", commodity);
  if (member.gross) setFieldValue("inp_gross", member.gross);
  if (member.coopDed) setFieldValue("inp_coopDed", member.coopDed);
  if (member.monthlySavings) setFieldValue("inp_monthlySavings", member.monthlySavings);
  if (member.totalBank) setFieldValue("inp_totalBank", member.totalBank);

  if (getState().facility === "cash") {
    setState({ isDurationOverridden: false });
    updateTieredDuration();
  } else if (getState().facility === "purchase" || getState().facility === "special") {
    setFieldValue("inp_monthlySavings", "0");
  }

  const formattedSavings = formatMoney(savings || 0);
  const formattedLoan = formatMoney(loan || 0);
  const commodityNote = commodity > 0 ? ` · Special Loan: ${formatMoney(commodity)}` : "";
  const purchaseNote = purchase > 0 ? ` · Purchase: ${formatMoney(purchase)}` : "";
  showLookupStatus(`✓ Found: ${name || staff} · Savings: ${formattedSavings} · Loan: ${formattedLoan}${commodityNote}${purchaseNote}`, "success");

  setState({ currentMemberProfile: profile, lastResult: null });

  renderMemberProfile(profile, {
    onShare: () => handleShare(),
    onCopy: (btn) => handleCopy(btn)
  });
  updateQuickRequestChips();
}

export async function fetchMember() {
  if (!isDeskUnlocked()) return;
  const staffInput = document.getElementById("inp_staff");
  const staffId = staffInput ? staffInput.value.trim() : "";
  const dropdown = document.getElementById("staffSuggestions");
  if (dropdown) dropdown.style.display = "none";

  if (!staffId) {
    showLookupStatus("Please enter a Staff ID or number", "error");
    staffInput?.focus();
    return;
  }

  showLookupStatus(`Checking ledger for "${staffId}"…`, "loading");
  try {
    const { record } = await fetchMemberByStaffId(staffId);
    if (record) {
      applyMemberRecord(record);
    } else {
      showLookupStatus(`Member "${staffId}" not found`, "error");
    }
  } catch (_) {
    showLookupStatus(`Member "${staffId}" not found`, "error");
  }
}

export async function fetchMemberByName() {
  if (!isDeskUnlocked()) return;
  const nameInput = document.getElementById("inp_name");
  const query = nameInput ? nameInput.value.trim() : "";
  const dropdown = document.getElementById("nameSuggestions");
  if (dropdown) dropdown.style.display = "none";

  if (!query) {
    showLookupStatus("Please enter a member name to search", "error");
    nameInput?.focus();
    return;
  }

  showLookupStatus(`Searching ledger for "${query}"…`, "loading");
  try {
    const matches = findMatchingMembers(query, 1, "name");
    if (matches.length > 0) {
      applyMemberRecord(matches[0]);
    } else {
      const { record } = await fetchMemberByStaffId(query);
      if (record) {
        applyMemberRecord(record);
      } else {
        showLookupStatus(`Member "${query}" not found`, "error");
      }
    }
  } catch (_) {
    showLookupStatus(`Member "${query}" not found`, "error");
  }
}

export function showLookupStatus(msg, type) {
  const statusEl = document.getElementById("lookupStatus");
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = `lookup-status ${type}`;
  statusEl.style.display = "block";
}

export function hideLookupStatus() {
  const statusEl = document.getElementById("lookupStatus");
  if (!statusEl) return;
  statusEl.style.display = "none";
}

export function loadScenario(data) {
  if (!isDeskUnlocked() || !data) return;
  const fac = getState().facility;
  setFieldValue("inp_name", data.name || "");
  setFieldValue("inp_staff", data.staff || "");
  setFieldValue("inp_gross", data.gross || 0);
  setFieldValue("inp_savings", data.savings || 0);
  setFieldValue("inp_existingLoan", data.existingLoan !== undefined ? data.existingLoan : data.loanBal || 0);
  setFieldValue("inp_existingPurchase", data.existingPurchase !== undefined ? data.existingPurchase : 0);
  setFieldValue("inp_existingCommodity", data.existingCommodity !== undefined ? data.existingCommodity : 0);
  setFieldValue("inp_totalBank", data.totalBank || 0);
  setFieldValue("inp_duration", data.duration || (fac === "cash" ? 3 : (fac === "special" ? 12 : 9)));

  setFieldValue("inp_coopDed", data.coopDed || 0);
  setFieldValue("inp_monthlySavings", data.monthlySavings || 0);
  setFieldValue("inp_otherDed", data.otherDed || 0);

  if (fac === "purchase") {
    setDownPayment(Boolean(data.downPayment !== undefined ? data.downPayment : data.dp));
  }

  if (fac === "special" && data.specialInterestRate !== undefined) {
    setSpecialInterestRate(data.specialInterestRate, false);
  }

  if (fac === "withdrawal" && data.withdrawalType) {
    setWithdrawalType(data.withdrawalType, false);
  }

  const inquiryCheck = document.getElementById("chk_inquiry");
  if (inquiryCheck) {
    inquiryCheck.checked = Boolean(data.inquiry);
    toggleInquiryMode();
  }

  if (!data.inquiry) {
    setFieldValue("inp_requested", data.requested || "");
  }

  hideLookupStatus();
  calculateEligibility();
}

function handleShare() {
  const { lastResult, currentMemberProfile, purchaseDownPayment } = getState();
  const text = lastResult
    ? getAppraisalText(lastResult, purchaseDownPayment)
    : currentMemberProfile ? getProfileShareText(currentMemberProfile) : "";
  shareWhatsApp(text);
}

function handleCopy(btn) {
  const btnEl = (btn && btn.nodeType === 1) ? btn : document.getElementById("btnCopyReport");
  const { lastResult, currentMemberProfile, purchaseDownPayment } = getState();
  const text = lastResult
    ? getAppraisalText(lastResult, purchaseDownPayment)
    : currentMemberProfile ? getProfileShareText(currentMemberProfile) : "";
  copyToClipboard(text, btnEl);
}

// --------------------------------------------------------------------------
// LEDGER CACHE & SYNC UI HANDLERS
// --------------------------------------------------------------------------
function formatLastCached(timestamp) {
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

  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
}

export async function refreshLedgerData() {
  const el = document.getElementById("ledgerSyncBadge");
  if (el) el.classList.add("syncing");
  try {
    await prefetchLedger(true);
  } finally {
    if (el) el.classList.remove("syncing");
  }
}

function updateLedgerSyncUI(sync) {
  const el = document.getElementById("ledgerSyncBadge");
  const label = document.getElementById("ledgerSyncLabel");
  if (!el) return;

  const status = sync.status || "idle";
  el.className = `ledger-sync-status ${status}`;

  if (status === "syncing") {
    if (label) label.textContent = "Syncing ledger…";
    el.title = "Fetching latest records from Google Sheets...";
  } else if (status === "fresh" || status === "cached") {
    const cachedTime = formatLastCached(sync.lastSync);
    if (label) label.textContent = `Cached: ${cachedTime}`;
    const fullDate = sync.lastSync ? new Date(sync.lastSync).toLocaleString() : "offline";
    el.title = `Last cached: ${fullDate} (${sync.count} members). Click to re-sync.`;
  } else if (status === "error") {
    if (label) label.textContent = "Sync error";
    el.title = "Unable to connect to Google Sheets ledger. Click to retry.";
  } else {
    const cachedTime = formatLastCached(sync.lastSync);
    if (label) label.textContent = `Cached: ${cachedTime}`;
    el.title = "Click to sync ledger with Google Sheets.";
  }
}

// --------------------------------------------------------------------------
// DOM INITIALIZATION
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initMoneyInputs();
  renderScenarios(getState().facility, loadScenario);
  renderEmptyResult();
  subscribeLedgerSync(updateLedgerSyncUI);
  initLedgerCache();
  initAuth();
  initTheme();
  initOnboarding();
  initHistoryDrawer({
    onRestore: restoreAppraisal,
    onClear: () => updateHistoryBadge(),
    onDelete: () => updateHistoryBadge()
  });
  updateHistoryBadge();

  const syncBadge = document.getElementById("ledgerSyncBadge");
  if (syncBadge) {
    syncBadge.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        refreshLedgerData();
      }
    });
  }

  // Reusable helper for Member Search Autocomplete (both Staff ID and Name)
  function attachMemberAutocomplete({ inputEl, dropdownEl, onFetch, fieldHint = null }) {
    if (!inputEl || !dropdownEl) return;

    inputEl.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      hideLookupStatus();

      // If user edits text away from the loaded profile, auto-reset downstream fields
      const activeProfile = getState().currentMemberProfile;
      if (activeProfile) {
        const staffVal = (activeProfile.staff || "").toLowerCase();
        const nameVal = (activeProfile.name || "").toLowerCase();
        const qLow = q.toLowerCase();
        if (qLow !== staffVal && qLow !== nameVal) {
          resetFinancialFields();
        }
      }

      if (q.length >= 1) {
        const matches = findMatchingMembers(q, 5, fieldHint);
        if (matches.length === 0) {
          dropdownEl.style.display = "none";
          return;
        }
        dropdownEl.innerHTML = matches
          .map((m, idx) => {
            const p = extractMemberProfile(m) || {};
            const displayName = escapeHtml(p.name || m.name || "Member");
            const displayId = escapeHtml(p.staff || p.formNo || m.staff || m.formNo || "No ID");
            const displaySavings = (Number(p.savings) || 0).toLocaleString();
            const displayLoan = (Number(p.loan) || 0).toLocaleString();
            return `
            <div class="suggestion-item" data-idx="${idx}">
              <div class="suggestion-main">
                <span class="suggestion-name">${displayName}</span>
                <span class="suggestion-id">${displayId}</span>
              </div>
              <div class="suggestion-meta">
                Savings: ₦${displaySavings}<br/>
                Loan: ₦${displayLoan}
              </div>
            </div>
          `;
          })
          .join("");
        dropdownEl.style.display = "block";
        dropdownEl.querySelectorAll(".suggestion-item").forEach((item) => {
          item.addEventListener("click", () => {
            const idx = parseInt(item.getAttribute("data-idx"), 10);
            applyMemberRecord(matches[idx]);
            dropdownEl.style.display = "none";
          });
        });
      } else {
        dropdownEl.style.display = "none";
      }
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        dropdownEl.style.display = "none";
        onFetch();
      } else if (e.key === "Escape") {
        dropdownEl.style.display = "none";
      }
    });
  }

  // Attach to Staff ID field
  const staffInput = document.getElementById("inp_staff");
  const staffDropdown = document.getElementById("staffSuggestions");
  attachMemberAutocomplete({
    inputEl: staffInput,
    dropdownEl: staffDropdown,
    onFetch: fetchMember,
    fieldHint: "staff"
  });

  // Attach to Name field (functions identically to Empl ID field)
  const nameInput = document.getElementById("inp_name");
  const nameDropdown = document.getElementById("nameSuggestions");
  attachMemberAutocomplete({
    inputEl: nameInput,
    dropdownEl: nameDropdown,
    onFetch: fetchMemberByName,
    fieldHint: "name"
  });

  // Close dropdowns & popovers when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-field-wrap")) {
      if (staffDropdown) staffDropdown.style.display = "none";
      if (nameDropdown) nameDropdown.style.display = "none";
    }
    if (!e.target.closest(".custom-cap-wrap")) {
      const capPopover = document.getElementById("customCapPopover");
      if (capPopover) capPopover.style.display = "none";
    }
    if (!e.target.closest(".custom-dp-wrap")) {
      const dpPopover = document.getElementById("customDpPopover");
      if (dpPopover) dpPopover.style.display = "none";
      const specPopover = document.getElementById("customSpecRatePopover");
      if (specPopover) specPopover.style.display = "none";
    }
  });

  // Custom Special Interest Rate Enter key listener
  const customSpecRateInput = document.getElementById("inp_customSpecRate");
  if (customSpecRateInput) {
    customSpecRateInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomSpecialRate();
      } else if (e.key === "Escape") {
        toggleCustomSpecialRateInput(false);
      }
    });
  }

  // Custom Cap input Enter key listener
  const customCapInput = document.getElementById("inp_customCap");
  if (customCapInput) {
    customCapInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomCap();
      } else if (e.key === "Escape") {
        toggleCustomCapInput(false);
      }
    });
  }

  // Custom Down Payment Enter key listener
  const customDpInput = document.getElementById("inp_customDp");
  if (customDpInput) {
    customDpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomDownPayment();
      } else if (e.key === "Escape") {
        toggleCustomDpInput(false);
      }
    });
  }

  const requestedInput = document.getElementById("inp_requested");
  if (requestedInput) {
    requestedInput.addEventListener("input", () => {
      if (getState().facility === "cash" && !getState().isDurationOverridden) {
        updateTieredDuration();
      }
      updateDownPaymentHint();
      updateSpecialInterestHint();
      // Recalculate live if results already exist so changes immediately reflect accurately
      if (getState().lastResult) {
        calculateEligibility();
      }
    });
  }

  const durationInput = document.getElementById("inp_duration");
  if (durationInput) {
    durationInput.addEventListener("input", () => {
      if (getState().facility === "cash") {
        setState({ isDurationOverridden: true });
        updateTieredDuration();
      } else {
        setState({ isDurationOverridden: true });
      }
      updateSpecialInterestHint();
      if (getState().lastResult) {
        calculateEligibility();
      }
    });
    durationInput.addEventListener("change", () => {
      const isPurchase = getState().facility === "purchase";
      const val = Number(durationInput.value);
      if (isPurchase) {
        if (!val || val <= 0 || val > 9) {
          durationInput.value = val > 9 ? "9" : (val < 1 && val > 0 ? "1" : "9");
        }
      } else {
        if (!val || val <= 0 || val > 24) {
          durationInput.value = val > 24 ? "24" : (val < 1 && val > 0 ? "1" : "3");
        }
      }
    });
  }

  updateTieredDuration();

  // Live updates for quick chips on financial input changes
  ["inp_gross", "inp_savings", "inp_existingLoan", "inp_existingPurchase", "inp_existingCommodity", "inp_totalBank", "inp_coopDed", "inp_monthlySavings", "inp_otherDed", "inp_duration"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => {
        updateQuickRequestChips();
      });
    }
  });

  updateQuickRequestChips();

  window.addEventListener("scroll", () => {
    const masthead = document.getElementById("masthead");
    if (masthead) {
      if (window.scrollY > 15) {
        masthead.classList.add("is-scrolled");
      } else {
        masthead.classList.remove("is-scrolled");
      }
    }
  }, { passive: true });
});

// Run theme immediately for flicker-free initialization
initTheme();

// --------------------------------------------------------------------------
// GLOBAL WINDOW BRIDGE (For backwards-compatibility with inline HTML attributes)
// --------------------------------------------------------------------------
window.calculateEligibility = calculateEligibility;
window.calculate = calculateEligibility;
window.resetForm = resetForm;
window.resetAll = resetForm;
window.switchFacility = switchFacility;
window.toggleFacilityQuick = toggleFacilityQuick;
window.setWithdrawalType = setWithdrawalType;
window.setSpecialInterestRate = setSpecialInterestRate;
window.toggleCustomSpecialRateInput = toggleCustomSpecialRateInput;
window.applyCustomSpecialRate = applyCustomSpecialRate;
window.resetSpecialInterestRate = resetSpecialInterestRate;
window.setDownPayment = setDownPayment;
window.setDownPaymentMode = setDownPaymentMode;
window.toggleCustomDpInput = toggleCustomDpInput;
window.setCustomDpType = setCustomDpType;
window.applyCustomDownPayment = applyCustomDownPayment;
window.resetDownPayment = resetDownPayment;
window.setDeductionCap = setDeductionCap;
window.toggleCustomCapInput = toggleCustomCapInput;
window.applyCustomCap = applyCustomCap;
window.resetCustomCap = resetCustomCap;
window.toggleInquiryMode = toggleInquiryMode;
window.restoreTierDuration = restoreTierDuration;
window.applyCounterOffer = applyCounterOffer;
window.fetchMember = fetchMember;
window.fetchMemberByName = fetchMemberByName;
window.shareWhatsApp = handleShare;
window.copyAppraisalText = () => handleCopy(document.getElementById("btnCopyReport"));
window.handleAuthSubmit = handleAuthSubmit;
window.verifyPin = handleAuthSubmit;
window.unlockDesk = unlockDesk;
window.lockDesk = lockDesk;
window.isDeskUnlocked = isDeskUnlocked;
window.toggleTheme = toggleTheme;
window.updateQuickRequestChips = updateQuickRequestChips;
window.refreshLedgerData = refreshLedgerData;
window.startOnboardingTour = startTour;
window.initOnboardingAfterAuth = initOnboarding;
window.onDeskUnlocked = initLedgerCache;
window.toggleHistoryDrawer = toggleHistoryDrawer;
window.openHistoryDrawer = openHistoryDrawer;
window.closeHistoryDrawer = closeHistoryDrawer;
window.restoreAppraisal = restoreAppraisal;

