import test from "node:test";
import assert from "node:assert/strict";
import { calculateUnderwriting } from "./underwriting.js";
import { getAppraisalText } from "../ui/share.js";
import { extractMemberProfile } from "../services/ledgerService.js";

test("Withdrawal integration - Full ledger member to voluntary withdrawal", () => {
  const member = {
    "S/N": 2,
    "Name": "Olusegun Demol",
    "FormNo": "000607",
    "Empl. No": "LIRS/9997",
    "Thrift Savings": 1850000,
    "Normal Loan": 300000,
    "PURCHASE/ASSET FINANCE": 120000
  };

  const profile = extractMemberProfile(member);
  assert.equal(profile.savings, 1850000);
  assert.equal(profile.loan, 300000);
  assert.equal(profile.purchase, 120000);

  // 1. Calculate Voluntary Withdrawal
  const voluntaryRes = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "voluntary",
    name: profile.name,
    staff: profile.staff,
    savings: profile.savings,
    existingLoan: profile.loan,
    existingPurchase: profile.purchase
  });

  assert.equal(voluntaryRes.withdrawalFee, 92500);
  assert.equal(voluntaryRes.totalLiabilities, 420000);
  assert.equal(voluntaryRes.totalDeductions, 512500);
  assert.equal(voluntaryRes.netDisbursement, 1337500);
  assert.equal(voluntaryRes.eligible, true);

  // Test WhatsApp share text
  const shareText = getAppraisalText(voluntaryRes);
  assert.match(shareText, /Olusegun Demol \(LIRS\/9997\)/);
  assert.match(shareText, /Facility: Savings Withdrawal \(Voluntary\)/);
  assert.match(shareText, /Total Current Savings: ₦1,850,000\.00/);
  assert.match(shareText, /Less 5% Voluntary Charge: ₦92,500\.00/);
  assert.match(shareText, /Less Outstanding Loan Payoff: ₦300,000\.00/);
  assert.match(shareText, /Less Outstanding Purchase Payoff: ₦120,000\.00/);
  assert.match(shareText, /\*Net Disbursement to Member: ₦1,337,500\.00\*/);
  assert.match(shareText, /SETTLEMENT READY ✅/);

  // 2. Calculate Retirement Withdrawal
  const retirementRes = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "retirement",
    name: profile.name,
    staff: profile.staff,
    savings: profile.savings,
    existingLoan: profile.loan,
    existingPurchase: profile.purchase
  });

  assert.equal(retirementRes.withdrawalFee, 0);
  assert.equal(retirementRes.totalDeductions, 420000);
  assert.equal(retirementRes.netDisbursement, 1430000);
  assert.equal(retirementRes.eligible, true);

  const retShareText = getAppraisalText(retirementRes);
  assert.match(retShareText, /Facility: Savings Withdrawal \(Retirement\)/);
  assert.match(retShareText, /Retirement Charge \(0%\): ₦0\.00 \(Waived\)/);
  assert.match(retShareText, /\*Net Disbursement to Member: ₦1,430,000\.00\*/);
});

test("Withdrawal integration - purchase balance resolved from ledger header variants", () => {
  const headerVariants = [
    "PURCHASE / ASSET FINANCE",
    "Purchase / Asset Finance",
    "PURCHASE/ASSET FINANCE ",
    "Purchase Loan"
  ];

  for (const header of headerVariants) {
    const profile = extractMemberProfile({
      "Name": "Olusegun Demol",
      "Empl. No": "LIRS/9997",
      "Thrift Savings": "1,850,000",
      "Normal Loan": "300,000",
      [header]: "120,000"
    });
    assert.equal(profile.purchase, 120000, `purchase not resolved for header "${header}"`);

    const res = calculateUnderwriting({
      facility: "withdrawal",
      withdrawalType: "retirement",
      savings: profile.savings,
      existingLoan: profile.loan,
      existingPurchase: profile.purchase
    });
    assert.equal(res.totalLiabilities, 420000);
    assert.equal(res.netDisbursement, 1430000);
  }
});

test("New 17-column sheet layout - Commodity Loan is separate from Purchase and deducted on Withdrawal", () => {
  const newSheetRow = {
    "s/n": 2,
    "Name": "Olusegun Demol",
    "FormNo": "607",
    "Empl. No": "LIRS/9997",
    "Date": "August 31, 2026",
    "Admin Fee": 0,
    "Entrance Fee": 0,
    "Shares Savings": 50000,
    "Thrift Savings": 1850000,
    "Normal Loan": 300000,
    "Interest": 30000,
    "Commodity Loan": 150000,
    "LAND Loan": 200000,
    "Land Subscription": 0,
    "Fence Subscription": 0,
    "PURCHASE/ASSET FINANCE": 0,
    "Mortgage Subscription": 0
  };

  const profile = extractMemberProfile(newSheetRow);
  // Purchase must stay 0 (never collide with Commodity Loan)
  assert.equal(profile.purchase, 0);
  // Special Loan balance combines Commodity Loan (150,000) + Interest (30,000) = 180,000
  assert.equal(profile.commodityPrincipal, 150000);
  assert.equal(profile.commodityInterest, 30000);
  assert.equal(profile.commodity, 180000);
  // Shares savings must not be added to thrift savings
  assert.equal(profile.savings, 1850000);

  const withdrawalRes = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "retirement",
    name: profile.name,
    staff: profile.staff,
    savings: profile.savings,
    existingLoan: profile.loan,
    existingPurchase: profile.purchase,
    existingCommodity: profile.commodity
  });

  // Total liabilities = 300,000 (Normal Loan) + 0 (Purchase) + 180,000 (Special Loan + Interest) = 480,000
  assert.equal(withdrawalRes.totalLiabilities, 480000);
  assert.equal(withdrawalRes.netDisbursement, 1370000);

  const shareText = getAppraisalText(withdrawalRes);
  assert.match(shareText, /Less Outstanding Special Loan Payoff: ₦180,000\.00/);

  // Ensure a record mapped by Code.gs (with commodityPrincipal + interest already combined in commodity) never double-counts interest
  const appsScriptMapped = {
    staff: "LIRS/9997",
    name: "Olusegun Demol",
    savings: 1850000,
    loan: 300000,
    interest: 30000,
    commodityPrincipal: 150000,
    commodityInterest: 30000,
    commodity: 180000,
    commodityLoan: 180000,
    purchase: 0
  };
  assert.equal(extractMemberProfile(appsScriptMapped).commodity, 180000);
});

test("Special Loan - splits monthly deduction into principal and interest, stacks on coopDed, no 2x/cap block", () => {
  const res = calculateUnderwriting({
    facility: "special",
    name: "Olusegun Demol",
    staff: "LIRS/9997",
    gross: 300000,
    savings: 55000, // 2x limit would be 110,000, but Special Loan ignores it
    existingLoan: 850000,
    existingCommodity: 150000, // existing commodity loan is NOT offset from net proceeds
    totalBank: 0,
    coopDed: 97917,
    otherDed: 0,
    requested: 300000,
    duration: 12,
    specialInterestRate: 0.20
  });

  assert.equal(res.facility, "special");
  assert.equal(res.eligible, true);
  assert.equal(res.savingsPass, true);
  assert.equal(res.payrollPass, true);
  assert.equal(res.amount, 300000);
  assert.equal(res.net, 300000); // full principal disbursed, no upfront charge, no offset
  assert.equal(res.interest, 60000); // 20% flat
  assert.equal(res.totalRepayment, 360000);
  assert.equal(res.principalMonthly, 25000); // 300,000 / 12
  assert.equal(res.interestMonthly, 5000); // 60,000 / 12
  assert.equal(res.monthly, 30000);
  assert.equal(res.totalCoopMonthly, 127917); // 30,000 + 97,917 existing coopDed

  const shareText = getAppraisalText(res);
  assert.match(shareText, /Facility: Special Loan/);
  assert.match(shareText, /Monthly Principal Deduction: ₦25,000\.00\/mo/);
  assert.match(shareText, /Monthly Interest Deduction: ₦5,000\.00\/mo/);
});
