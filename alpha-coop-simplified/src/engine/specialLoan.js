// ==========================================================================
//  ALPHA COOP — SPECIAL LOAN (COMMODITY LOAN) UNDERWRITING ENGINE
//  - Flat interest rate (defaults to 20%, configurable)
//  - Interest is NOT deducted upfront; deductions are split between
//    principal and interest each month
//  - Added on top of existing cooperative deductions
//  - Does not enforce the 2x savings limit or salary deduction cap
//  - Does not offset or liquidate an existing Special/Commodity loan
//  - Duration capped at 24 months
// ==========================================================================

export function calculateSpecialLoan(params) {
  const {
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
    otherDed = 0,
    specialInterestRate = 0.20
  } = params;

  const rawDur = Number(duration) || 0;
  const validDuration = rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : 12;

  const rawRate = Number(specialInterestRate);
  const interestRate = !isNaN(rawRate) && rawRate >= 0
    ? (rawRate > 1 ? rawRate / 100 : rawRate)
    : 0.20;

  const savingsLimit = savings * 2;
  const maxDeduction = gross * deductionRate;
  const nonCoop = Math.max(0, totalBank - coopDed);
  const hasExistingCoop = coopDed > 0;
  const existingDeductions = hasExistingCoop
    ? Math.max(totalBank, coopDed + otherDed)
    : totalBank + otherDed;
  const allowance = Math.max(0, maxDeduction - existingDeductions);

  const amount = Math.max(0, Number(requested) || 0);
  const interest = amount * interestRate;
  const totalRepayment = amount + interest;

  const principalMonthly = validDuration > 0 ? amount / validDuration : 0;
  const interestMonthly = validDuration > 0 ? interest / validDuration : 0;
  const monthly = principalMonthly + interestMonthly;

  const totalCoopMonthly = monthly + (hasExistingCoop ? coopDed : 0) + otherDed;
  const newDeduction = existingDeductions + monthly;

  // Special Loan does not enforce 2x savings or the salary deduction cap
  const savingsPass = true;
  const payrollPass = true;
  const eligible = isInquiry ? true : amount > 0;

  return {
    facility: "special",
    name,
    staff,
    duration: validDuration,
    deductionRate,
    specialInterestRate: interestRate,
    isInquiry,
    amount,
    interest,
    totalRepayment,
    principalMonthly,
    interestMonthly,
    monthly,
    totalCoopMonthly,
    eligible,
    zeroPayout: false,
    needsProposal: false,
    savingsLimit,
    maxDeduction,
    allowance,
    savingsPass,
    payrollPass,
    upfrontCharge: 0,
    loanOffset: 0,
    net: amount,
    maximum: amount,
    counter: 0,
    counterNet: 0,
    counterMonthly: 0,
    counterTotalMonthly: 0,
    down: 0,
    financed: amount,
    isDownPaymentActive: false,
    totalBank,
    coopDed,
    monthlySavings: 0,
    otherDed,
    nonCoop,
    newDeduction,
    existingDeductions,
    existingLoan,
    existingPurchase,
    existingCommodity,
    savings,
    gross,
    hasExistingCoop
  };
}

