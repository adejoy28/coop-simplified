import { formatMoney, formatSignedMoney, formatAppraisalMoney, getLastMonthEndDate } from "./formatters.ts";
import type { MemberProfile, UnderwritingResult } from "../types/coop.ts";

export function getProfileShareText(p: MemberProfile | null): string {
  if (!p) return "";
  const lines: string[] = [];
  const header = p.staff ? `${p.name} (${p.staff})` : p.name || "Member Profile";
  lines.push(header);
  lines.push("");
  lines.push(`As at ${p.asAt || getLastMonthEndDate()}`);
  lines.push("");
  lines.push(`Savings: ${formatAppraisalMoney(p.savings)}`);
  if (p.loan > 0) {
    lines.push(`Normal Loan: ${formatAppraisalMoney(p.loan, true)}`);
  }
  if (p.commodity > 0) {
    lines.push(`Special Loan: ${formatAppraisalMoney(p.commodity, true)}`);
  }
  if (p.purchase > 0) {
    lines.push(`Purchase: ${formatAppraisalMoney(p.purchase, true)}`);
  }
  lines.push("");
  lines.push("www.tacmsl.com ( pls type in your browser)");
  lines.push("");
  if (p.formNo) {
    lines.push(`Username: ${p.formNo}`);
  }
  if (p.staff) {
    lines.push(`Password: ${p.staff}`);
  }
  return lines.join("\n");
}

export function getAppraisalText(res: UnderwritingResult | null): string {
  if (!res) return "";

  const statusTitle = res.eligible
    ? res.isInquiry ? "CAPACITY READY ✅" : "ELIGIBLE ✅"
    : "NOT ELIGIBLE ❌";

  if (res.facility === "withdrawal") {
    const isRetirement = res.withdrawalType === "retirement";
    const statusWithdrawal = res.eligible ? "SETTLEMENT READY ✅" : "DEFICIT NOTICE ❌";
    const memberHeader = res.staff ? `${res.name || "Member"} (${res.staff})` : res.name || "Member";

    const lines = [
      memberHeader,
      `Facility: Savings Withdrawal (${isRetirement ? "Retirement" : "Voluntary"})`,
      `Status: ${statusWithdrawal}`,
      "",
      `WITHDRAWAL SETTLEMENT BREAKDOWN`,
      `Total Current Savings: ${formatMoney(res.savings)}`,
      ...(isRetirement
        ? [`Retirement Charge (0%): ₦0.00 (Waived)`]
        : [`Less 5% Voluntary Charge: ${formatMoney(res.withdrawalFee)}`]),
      ...(res.existingLoan > 0 ? [`Less Outstanding Loan Payoff: ${formatMoney(res.existingLoan)}`] : []),
      ...((res.existingPurchase ?? 0) > 0 ? [`Less Outstanding Purchase Payoff: ${formatMoney(res.existingPurchase)}`] : []),
      ...((res.existingCommodity ?? 0) > 0 ? [`Less Outstanding Special Loan Payoff: ${formatMoney(res.existingCommodity)}`] : []),
      `Total Deductions: ${formatMoney(res.totalDeductions)}`,
      "",
      `*Net Disbursement to Member: ${formatSignedMoney(res.netDisbursement)}*`,
      "",
      res.eligible
        ? ((res.totalLiabilities ?? 0) > 0
          ? `All loan and purchase accounts will be liquidated and fully cleared from savings.`
          : `Member has zero outstanding debt obligations.`)
        : `Notice: Outstanding liabilities exceed savings by ${formatMoney(res.deficit)}. Additional payment required for clearance.`
    ];

    return lines.join("\n");
  }

  if (res.facility === "purchase") {
    const targetAmount = res.needsProposal && (res.counter ?? 0) > 0 ? (res.counter ?? res.amount) : res.amount;
    const isDownActive = Boolean(res.isDownPaymentActive || (res.down && res.down > 0));
    const downAmount = isDownActive ? (res.down ?? 0) : 0;
    const financed = isDownActive ? (res.financed ?? targetAmount) : targetAmount;
    const interest = res.interest !== undefined ? res.interest : financed * 0.10;
    const totalRepayment = res.totalRepayment !== undefined ? res.totalRepayment : financed + interest;
    const monthly = res.duration > 0 ? totalRepayment / res.duration : 0;

    const maxAccessible = res.maximum || targetAmount;
    const accessLine =
      res.needsProposal || targetAmount >= maxAccessible
        ? `Member can access purchase financing of ${formatAppraisalMoney(maxAccessible)}`
        : `Member can access purchase financing of ${formatAppraisalMoney(targetAmount)}`;

    const memberHeader = res.staff ? `${res.name || "Member"} (${res.staff})` : res.name || "Member";

    const lines = [
      memberHeader,
      `Facility: Purchase / Asset Finance`,
      `Status: ${statusTitle}`,
      "",
      accessLine,
      "",
      `Purchase amount = *${formatAppraisalMoney(targetAmount)}*`,
      ...(isDownActive
        ? [
            `Down payment dropped = ${formatAppraisalMoney(downAmount)} (Payable upfront)`,
            `Amount financed = ${formatAppraisalMoney(financed)}`
          ]
        : []),
      `10% Interest = ${formatAppraisalMoney(interest)}`,
      `Total Repayment = ${formatAppraisalMoney(totalRepayment)}`,
      "",
      `Repayment duration: ${res.duration} Months`,
      `Monthly purchase repayment: ${formatAppraisalMoney(monthly)}/mo`,
      ...((res.coopDed ?? 0) > 0
        ? [`Current coop deduction: ${formatAppraisalMoney(res.coopDed)} (incl. savings)`]
        : ((res.monthlySavings ?? 0) > 0 ? [`Monthly savings contribution: ${formatAppraisalMoney(res.monthlySavings)}`] : [])),
      ...((res.otherDed ?? 0) > 0 ? [`Other ongoing deductions: ${formatAppraisalMoney(res.otherDed)}`] : []),
      "",
      `Monthly Cooperative deduction: ${formatAppraisalMoney(
        res.totalCoopMonthly || monthly + ((res.coopDed ?? 0) > 0 ? (res.coopDed ?? 0) : (res.monthlySavings || 0)) + (res.otherDed || 0)
      )}/mo`,
      `Total Payslip deduction: ${formatAppraisalMoney(res.newDeduction)}/mo (Cap: ${formatAppraisalMoney(res.maxDeduction)})`
    ];

    return lines.join("\n");
  }

  if (res.facility === "special") {
    const ratePct = Math.round(((res.specialInterestRate !== undefined ? res.specialInterestRate : 0.20) * 100) * 10) / 10;
    const memberHeader = res.staff ? `${res.name || "Member"} (${res.staff})` : res.name || "Member";
    const lines = [
      memberHeader,
      `Facility: Special Loan`,
      `Duration: ${res.duration} Months`,
      `Status: ${statusTitle}`,
      "",
      `LOAN & REPAYMENT BREAKDOWN`,
      `Special Loan Amount (Principal): *${formatMoney(res.amount)}*`,
      `Flat Interest (${ratePct}%): ${formatMoney(res.interest)}`,
      `Total Repayment: *${formatMoney(res.totalRepayment)}*`,
      `Net Disbursed to Member: *${formatMoney(res.net)}* (No upfront charge)`,
      ...((res.existingCommodity ?? 0) > 0
        ? [`Existing Special Loan Balance: ${formatMoney(res.existingCommodity)} (Not offset)`]
        : []),
      "",
      `MONTHLY DEDUCTION SPLIT`,
      `Monthly Principal Deduction: ${formatMoney(res.principalMonthly)}/mo`,
      `Monthly Interest Deduction: ${formatMoney(res.interestMonthly)}/mo`,
      `Monthly Special Loan Repayment: *${formatMoney(res.monthly)}/mo*`,
      ...((res.coopDed ?? 0) > 0 ? [`Current Coop Deduction: ${formatMoney(res.coopDed)}/mo`] : []),
      ...((res.otherDed ?? 0) > 0 ? [`Other Ongoing Deductions: ${formatMoney(res.otherDed)}/mo`] : []),
      ...((res.nonCoop ?? 0) > 0 ? [`Non-Coop Bank Deductions: ${formatMoney(res.nonCoop)}/mo`] : []),
      `New Total Monthly Coop Deduction: ${formatMoney(res.totalCoopMonthly || res.monthly)}/mo`,
      `New Total Payslip Deduction: ${formatMoney(res.newDeduction)}/mo`
    ];
    return lines.join("\n");
  }

  const upfrontCharge = res.interest || res.upfrontCharge || res.amount * 0.10;
  const lines = [
    `Member: ${res.name || "Member"}${res.staff ? ` (${res.staff})` : ""}`,
    `Facility: Normal Loan`,
    `Duration: ${res.duration} Months`,
    "",
    `FINANCIAL STANDING`,
    `Current Savings: ${formatMoney(res.savings)} (Limit ×2: ${formatMoney(res.savingsLimit)})`,
    `Loan Outstanding: ${formatMoney(res.existingLoan)}`,
    "",
    `LOAN DISBURSEMENT BREAKDOWN`,
    `Amount Requested: *${formatMoney(res.amount)}*`,
    `Less 10% Upfront Charge: ${formatMoney(upfrontCharge)}`,
    ...(res.existingLoan > 0 ? [`Less Existing Loan Payoff: ${formatMoney(res.existingLoan)}`] : []),
    `Net Disbursed to Member: *${formatMoney(res.net)}*`,
    "",
    `MONTHLY PAYROLL REPAYMENT`,
    `Monthly Loan Repayment: ${formatMoney(res.monthly)}/mo`,
    `Monthly Savings: ${formatMoney(res.monthlySavings)}/mo`,
    ...((res.otherDed ?? 0) > 0 ? [`Other Deductions: ${formatMoney(res.otherDed)}/mo`] : []),
    ...((res.nonCoop ?? 0) > 0 ? [`Non-Coop Bank Deductions: ${formatMoney(res.nonCoop)}/mo`] : []),
    `Monthly Cooperative Deduction: ${formatMoney(res.totalCoopMonthly || res.monthly)}/mo`,
    `New Total Payslip Deduction: ${formatMoney(res.newDeduction)}/mo (Cap: ${formatMoney(res.maxDeduction)})`,
    "",
    `Status: ${statusTitle}`
  ];

  if (res.zeroPayout) {
    lines.push("", `Notice: Outstanding loan balance offsets net loan proceeds (Net Payout: ₦0.00).`);
  }

  if (res.needsProposal && (res.counter ?? 0) > 0 && (res.counterNet ?? 0) > 0) {
    lines.push(
      "",
      `PROPOSABLE OFFER`,
      `Amount Proposable: ${formatMoney(res.counter)}`,
      `Net Disbursed: ${formatMoney(res.counterNet)}`,
      `Loan Repayment: ${formatMoney(res.counterMonthly)}/mo`,
      `Monthly Savings: ${formatMoney(res.monthlySavings)}/mo`,
      ...((res.otherDed ?? 0) > 0 ? [`Other Deductions: ${formatMoney(res.otherDed)}/mo`] : []),
      `Monthly Deduction: ${formatMoney(res.counterTotalMonthly || res.counterMonthly)}/mo`
    );
  }

  return lines.join("\n");
}

export function shareWhatsApp(text: string): void {
  if (!text) return;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const a = document.createElement("a");
  a.href = waUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    return true;
  } catch {
    return false;
  }
}
