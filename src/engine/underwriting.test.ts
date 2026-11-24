import test from "node:test";
import assert from "node:assert/strict";
import { calculateUnderwriting, getTieredDuration } from "./underwriting.ts";
import { evaluateMathExpression, formatSignedMoney } from "../utils/formatters.ts";

test("calculateUnderwriting - Voluntary withdrawal with loan and purchase", () => {
  const result = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "voluntary",
    savings: 1000000,
    existingLoan: 150000,
    existingPurchase: 50000
  });

  // 5% fee on savings of 1,000,000 = 50,000
  assert.equal(result.withdrawalFee, 50000);
  assert.equal(result.feeRate, 0.05);
  assert.equal(result.totalLiabilities, 200000);
  assert.equal(result.totalDeductions, 250000);
  // Net disbursement = 1,000,000 - 50,000 - 150,000 - 50,000 = 750,000
  assert.equal(result.netDisbursement, 750000);
  assert.equal(result.net, 750000);
  assert.equal(result.eligible, true);
  assert.equal(result.deficit, 0);
  assert.equal(result.isRetirement, false);
});

test("calculateUnderwriting - Retirement withdrawal with loan and purchase (0% fee)", () => {
  const result = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "retirement",
    savings: 1000000,
    existingLoan: 150000,
    existingPurchase: 50000
  });

  // 0% fee for retirement
  assert.equal(result.withdrawalFee, 0);
  assert.equal(result.feeRate, 0);
  assert.equal(result.totalLiabilities, 200000);
  assert.equal(result.totalDeductions, 200000);
  // Net disbursement = 1,000,000 - 0 - 150,000 - 50,000 = 800,000
  assert.equal(result.netDisbursement, 800000);
  assert.equal(result.net, 800000);
  assert.equal(result.eligible, true);
  assert.equal(result.deficit, 0);
  assert.equal(result.isRetirement, true);
});

test("calculateUnderwriting - Voluntary withdrawal with deficit (debts exceed savings)", () => {
  const result = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "voluntary",
    savings: 200000,
    existingLoan: 200000,
    existingPurchase: 50000
  });

  // 5% fee on 200,000 = 10,000
  assert.equal(result.withdrawalFee, 10000);
  assert.equal(result.totalLiabilities, 250000);
  assert.equal(result.totalDeductions, 260000);
  // Net disbursement = 200,000 - 260,000 = -60,000
  assert.equal(result.netDisbursement, -60000);
  assert.equal(result.net, 0);
  assert.equal(result.eligible, false);
  assert.equal(result.deficit, 60000);
  assert.equal(formatSignedMoney(result.netDisbursement), "-₦60,000.00");
});

test("calculateUnderwriting - Exact zero net retirement withdrawal is eligible with zero deficit", () => {
  const result = calculateUnderwriting({
    facility: "withdrawal",
    withdrawalType: "retirement",
    savings: 250000,
    existingLoan: 200000,
    existingPurchase: 50000
  });

  assert.equal(result.netDisbursement, 0);
  assert.equal(result.eligible, true);
  assert.equal(result.deficit, 0);
});

test("calculateUnderwriting - Cash loan regression check", () => {
  const result = calculateUnderwriting({
    facility: "cash",
    gross: 650000,
    savings: 500000,
    existingLoan: 0,
    totalBank: 100000,
    requested: 400000,
    duration: 12
  });

  assert.equal(result.facility, "cash");
  assert.equal(result.eligible, true);
  assert.equal(result.amount, 400000);
  assert.equal(result.upfrontCharge, 40000);
  assert.equal(result.net, 360000);
});

test("calculateUnderwriting - Purchase regression check", () => {
  const result = calculateUnderwriting({
    facility: "purchase",
    gross: 650000,
    savings: 500000,
    existingLoan: 0,
    totalBank: 100000,
    requested: 300000,
    duration: 9
  });

  assert.equal(result.facility, "purchase");
  assert.equal(result.eligible, true);
  assert.equal(result.amount, 300000);
  assert.equal(result.interest, 30000);
  assert.equal(result.totalRepayment, 330000);
});

const approx = (actual: number | undefined, expected: number) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 0.01, `expected ${expected}, got ${actual}`);

const purchaseBase = {
  facility: "purchase" as const,
  gross: 650000,
  savings: 500000,
  totalBank: 100000,
  requested: 300000,
  duration: 9
};

test("calculateUnderwriting - Custom 1% down payment is 1%, not 100%", () => {
  const result = calculateUnderwriting({ ...purchaseBase, downPaymentMode: "custom_pct", downPaymentVal: 1 });

  approx(result.down, 3000);
  approx(result.financed, 297000);
  assert.equal(result.isDownPaymentActive, true);
});

test("calculateUnderwriting - Custom 15% down payment", () => {
  const result = calculateUnderwriting({ ...purchaseBase, downPaymentMode: "custom_pct", downPaymentVal: 15 });

  approx(result.down, 45000);
  approx(result.financed, 255000);
});

test("calculateUnderwriting - Custom 1% capacity grosses up by 1/0.99", () => {
  const result = calculateUnderwriting({
    ...purchaseBase,
    isInquiry: true,
    downPaymentMode: "custom_pct",
    downPaymentVal: 1
  });

  // maxFinanced is capped by savings limit (1,000,000)
  approx(result.maximum, 1000000 / 0.99);
});

test("getTieredDuration & safe evaluateMathExpression", () => {
  assert.equal(getTieredDuration(40000), 3);
  assert.equal(getTieredDuration(150000), 12);
  assert.equal(getTieredDuration(500000), 18);
  assert.equal(getTieredDuration(1000000), 24);

  assert.equal(evaluateMathExpression("50000 + 25000 * 2"), 100000);
  assert.equal(evaluateMathExpression("(100,000 - 20,000) / 4"), 20000);
  assert.equal(evaluateMathExpression("100 / 0"), null);
  assert.equal(evaluateMathExpression("alert(1)"), null);
  assert.equal(evaluateMathExpression("50000"), null);
});
