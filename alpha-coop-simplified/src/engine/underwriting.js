// ==========================================================================
//  ALPHA COOP — UNDERWRITING RULES & FINANCIAL CALCULATION ENGINE
//  (Pure calculation functions, zero DOM dependencies)
// ==========================================================================

import { calculateSpecialLoan } from "./specialLoan.js";

export function getTieredDuration(requestedAmount) {
  const req = Math.max(0, Number(requestedAmount) || 0);
  if (req < 50000) return 3;
  if (req <= 200000) return 12;
  if (req <= 600000) return 18;
  return 24;
}

// Custom down payment percentages are stored as whole numbers (15 = 15%).
export function customPctToFraction(val) {
  return Math.max(0, Number(val) || 0) / 100;
}

export function calculateUnderwriting(params) {
  const {
    facility = "cash",
    name = "Member",
    staff = "No ID",
    gross = 0,
    savings = 0,
    existingLoan = 0,
    existingPurchase = 0,
    existingCommodity = 0,
    totalBank = 0,
    requested = 0,
    duration = 12,
    isInquiry = false,
    deductionRate = 0.40,
    coopDed = 0,
    monthlySavings = 10000,
    otherDed = 0,
    purchaseDownPayment = false,
    downPaymentMode = "zero", // 'zero' | '30' | 'custom_pct' | 'custom_amt'
    downPaymentVal = 0,
    withdrawalType = "voluntary", // 'voluntary' | 'retirement'
    specialInterestRate = 0.20
  } = params;

  if (facility === "special") {
    return calculateSpecialLoan({
      ...params,
      existingCommodity,
      specialInterestRate
    });
  }

  if (facility === "withdrawal") {
    const isRetirement = withdrawalType === "retirement";
    const feeRate = isRetirement ? 0 : 0.05;
    const withdrawalFee = savings * feeRate;
    const totalLiabilities =
      Math.max(0, existingLoan) +
      Math.max(0, existingPurchase) +
      Math.max(0, existingCommodity);
    const totalDeductions = withdrawalFee + totalLiabilities;
    const netDisbursement = savings - totalDeductions;
    const eligible = savings > 0 && netDisbursement >= 0;
    const deficit = netDisbursement < 0 ? Math.abs(netDisbursement) : 0;

    return {
      facility: "withdrawal",
      withdrawalType,
      isRetirement,
      name,
      staff,
      savings,
      existingLoan,
      existingPurchase,
      existingCommodity,
      feeRate,
      withdrawalFee,
      totalLiabilities,
      totalDeductions,
      netDisbursement,
      net: Math.max(0, netDisbursement),
      amount: savings,
      deficit,
      eligible,
      needsProposal: !eligible,
      duration: 0,
      monthly: 0,
      totalCoopMonthly: 0,
      savingsLimit: savings,
      maxDeduction: 0,
      newDeduction: 0,
      payrollPass: true,
      savingsPass: eligible,
      interest: withdrawalFee
    };
  }

  const rawDur = Number(duration) || 0;
  const validDuration = facility === "purchase"
    ? (rawDur > 0 ? Math.min(9, Math.max(1, rawDur)) : 9)
    : (rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : 3);
  const savingsLimit = savings * 2;
  const maxDeduction = gross * deductionRate;

  if (facility === "cash") {
    const nonCoop = Math.max(0, totalBank - coopDed);
    const allowance = Math.max(0, maxDeduction - nonCoop - monthlySavings - otherDed);
    const maximum = Math.max(0, Math.min(savingsLimit, allowance * validDuration));
    const amount = isInquiry || requested === 0 ? maximum : requested;
    const monthly = validDuration > 0 ? amount / validDuration : 0;
    const totalCoopMonthly = monthly + monthlySavings + otherDed;
    const newDeduction = nonCoop + totalCoopMonthly;

    const savingsPass = amount <= savingsLimit;
    const payrollPass = newDeduction <= maxDeduction;
    const eligible = isInquiry ? maximum > 0 : savingsPass && payrollPass;
    const upfrontCharge = amount * 0.10;
    const net = Math.max(0, amount - upfrontCharge - existingLoan);
    const zeroPayout = !isInquiry && eligible && (amount - upfrontCharge - existingLoan) <= 0;
    const needsProposal = !eligible || zeroPayout;
    const counterNet = Math.max(0, maximum * 0.90 - existingLoan);
    const counter = needsProposal && counterNet > 0 && maximum > 0 ? maximum : 0;
    const counterMonthly = validDuration > 0 ? counter / validDuration : 0;
    const counterTotalMonthly = counterMonthly > 0 ? counterMonthly + monthlySavings + otherDed : 0;

    return {
      facility: "cash",
      name,
      staff,
      duration: validDuration,
      deductionRate,
      isInquiry,
      amount,
      monthly,
      totalCoopMonthly,
      eligible,
      zeroPayout,
      needsProposal,
      savingsLimit,
      maxDeduction,
      allowance,
      savingsPass,
      payrollPass,
      interest: upfrontCharge,
      upfrontCharge,
      loanOffset: existingLoan,
      net,
      maximum,
      counter,
      counterNet,
      counterMonthly,
      counterTotalMonthly,
      down: 0,
      financed: amount,
      nonCoop,
      monthlySavings,
      otherDed,
      newDeduction,
      existingLoan,
      savings,
      gross
    };
  }

  // Facility: Purchase
  // Resolve down payment configuration
  let dpMode = downPaymentMode;
  let dpVal = Number(downPaymentVal) || 0;
  if (dpMode === "zero" && purchaseDownPayment) {
    dpMode = "30";
    dpVal = 0.30;
  }
  if (dpMode === "30") {
    dpVal = 0.30;
  }

  function resolveDownAndFinanced(target) {
    if (dpMode === "30") {
      const d = target * 0.30;
      return { down: d, financed: Math.max(0, target - d) };
    }
    if (dpMode === "custom_pct") {
      const d = target * customPctToFraction(dpVal);
      return { down: d, financed: Math.max(0, target - d) };
    }
    if (dpMode === "custom_amt") {
      const d = Math.min(target, dpVal);
      return { down: d, financed: Math.max(0, target - d) };
    }
    return { down: 0, financed: target };
  }

  const nonCoop = Math.max(0, totalBank - coopDed);
  const hasExistingCoop = coopDed > 0;
  // Under purchase, existing payroll/coop deduction already accounts for ongoing savings.
  // Savings is nulled (0) or ignored to prevent double deduction.
  const existingDeductions = hasExistingCoop
    ? Math.max(totalBank, coopDed + otherDed)
    : totalBank + otherDed;
  const allowance = Math.max(0, maxDeduction - existingDeductions);
  const maxFinanced = Math.max(0, Math.min(savingsLimit, (allowance * validDuration) / 1.10));

  let maximum = maxFinanced;
  if (dpMode === "30") {
    maximum = maxFinanced / 0.70;
  } else if (dpMode === "custom_pct") {
    const pct = customPctToFraction(dpVal);
    maximum = pct < 1 ? maxFinanced / (1 - pct) : maxFinanced;
  } else if (dpMode === "custom_amt") {
    maximum = maxFinanced + dpVal;
  }

  const amount = isInquiry || requested === 0 ? maximum : requested;
  const { down, financed } = resolveDownAndFinanced(amount);
  const interest = financed * 0.10;
  const totalRepayment = financed + interest;
  const monthly = validDuration > 0 ? totalRepayment / validDuration : 0;
  const totalCoopMonthly = monthly + (hasExistingCoop ? coopDed : 0) + otherDed;
  const newDeduction = existingDeductions + monthly;

  const savingsPass = financed <= savingsLimit;
  const payrollPass = newDeduction <= maxDeduction;
  const eligible = isInquiry ? maximum > 0 : savingsPass && payrollPass;
  const needsProposal = !eligible;
  const counter = needsProposal && maximum > 0 ? maximum : 0;
  const { down: counterDown, financed: counterFinanced } = resolveDownAndFinanced(counter);
  const counterMonthly = validDuration > 0 ? (counterFinanced * 1.10) / validDuration : 0;
  const counterTotalMonthly = counterMonthly > 0
    ? counterMonthly + (hasExistingCoop ? coopDed : 0) + otherDed
    : 0;

  const isDownPaymentActive = dpMode !== "zero" && down > 0;

  return {
    facility: "purchase",
    name,
    staff,
    duration: validDuration,
    deductionRate,
    isInquiry,
    amount,
    interest,
    totalRepayment,
    monthly,
    totalCoopMonthly,
    eligible,
    needsProposal,
    savingsLimit,
    maxDeduction,
    allowance,
    savingsPass,
    payrollPass,
    net: 0,
    maximum,
    counter,
    counterNet: counter,
    counterDown,
    counterFinanced,
    counterMonthly,
    counterTotalMonthly,
    down,
    financed,
    isDownPaymentActive,
    downPaymentMode: dpMode,
    downPaymentVal: dpVal,
    totalBank,
    coopDed,
    monthlySavings: 0,
    otherDed,
    nonCoop,
    newDeduction,
    existingDeductions,
    existingLoan,
    savings,
    gross,
    hasExistingCoop,
    effectiveSavingsDeduction: 0
  };
}
