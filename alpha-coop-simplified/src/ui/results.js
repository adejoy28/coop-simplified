// ==========================================================================
//  ALPHA COOP — RESULTS & CUSTOMER PROFILE VIEW RENDERER
// ==========================================================================

import { formatMoney, getLastMonthEndDate } from "../utils/formatters.js";
import { resolveElement, escapeHtml } from "../utils/dom.js";

export function renderEmptyResult() {
  const panel = resolveElement("resultPanel");
  if (!panel) return;
  panel.className = "glass-panel result-panel";
  panel.innerHTML = `
    <div class="empty-result">
      <div class="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
      <span class="eyebrow">Ready to assess</span>
      <h3>Your result will appear here.</h3>
      <p>Enter member details or choose a quick scenario to run an eligibility check.</p>
    </div>
  `;
}

export function renderMemberProfile(profile, callbacks = {}) {
  const panel = resolveElement("resultPanel");
  if (!panel || !profile) return;
  panel.className = "glass-panel result-panel has-result";

  const dateStr = escapeHtml(profile.asAt || getLastMonthEndDate());
  const formattedSavings = formatMoney(profile.savings);
  const hasLoan = profile.loan > 0;
  const hasCommodity = profile.commodity > 0;
  const hasPurchase = profile.purchase > 0;
  const safeName = escapeHtml(profile.name || "Member Record");
  const safeStaff = escapeHtml(profile.staff || "");
  const safeFormNo = escapeHtml(profile.formNo || "");

  let tilesHtml = `
    <div class="result-tile">
      <span>Current Savings</span>
      <strong class="accent">${formattedSavings}</strong>
    </div>
  `;

  if (hasLoan) {
    tilesHtml += `
      <div class="result-tile">
        <span>Normal Loan Outstanding</span>
        <strong>${formatMoney(profile.loan)}</strong>
      </div>
    `;
  }

  if (hasCommodity) {
    tilesHtml += `
      <div class="result-tile">
        <span>Special Loan Balance</span>
        <strong>${formatMoney(profile.commodity)}</strong>
      </div>
    `;
  }

  if (hasPurchase) {
    tilesHtml += `
      <div class="result-tile">
        <span>Purchase Balance</span>
        <strong>${formatMoney(profile.purchase)}</strong>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="result-head">
      <div>
        <span class="eyebrow">Customer Profile</span>
        <h3>
          ${safeName}
          <small>${safeStaff ? `${safeStaff} · ` : ""}As at ${dateStr}</small>
        </h3>
      </div>
      <span class="status-badge neutral">Active</span>
    </div>

    <!-- Profile Overview Tiles -->
    <div class="result-tile-grid">
      ${tilesHtml}
    </div>

    <!-- Member Portal Login Details -->
    <div class="profile-credential-box">
      <div class="profile-credential-head">
        <span>Online Member Portal</span>
        <a href="https://www.tacmsl.com" target="_blank" rel="noopener noreferrer">www.tacmsl.com ↗</a>
      </div>
      <div class="profile-credential-body">
        <div class="credential-item">
          <span class="cred-label">Username</span>
          <span class="cred-val">${safeFormNo || "—"}<small>(Form No)</small></span>
        </div>
        <div class="credential-item">
          <span class="cred-label">Password</span>
          <span class="cred-val">${safeStaff || "—"}<small>(Staff ID)</small></span>
        </div>
      </div>
    </div>

    <div class="result-action-row">
      <button class="share-button" id="btnShareWhatsApp" onclick="shareWhatsApp()" type="button">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        Share on WhatsApp
      </button>
      <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy profile details to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>
  `;
}

export function renderResult(res, callbacks = {}) {
  const panel = resolveElement("resultPanel");
  if (!panel || !res) return;
  panel.className = "glass-panel result-panel has-result";

  if (res.facility === "withdrawal") {
    const isRetirement = res.withdrawalType === "retirement";
    const statusClass = res.eligible ? "pass" : "fail";
    const statusLabel = res.eligible ? "Settlement ready" : "Deficit balance";
    const statusIcon = res.eligible
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    const tile2Breakdown = isRetirement
      ? "0% Charge (Retirement)"
      : `Less 5% Fee (${formatMoney(res.withdrawalFee)})`;

    let liabilitiesNote = [];
    if (res.existingLoan > 0) liabilitiesNote.push(`Loan: ${formatMoney(res.existingLoan)}`);
    if (res.existingPurchase > 0) liabilitiesNote.push(`Purchase: ${formatMoney(res.existingPurchase)}`);
    if (res.existingCommodity > 0) liabilitiesNote.push(`Special Loan: ${formatMoney(res.existingCommodity)}`);
    const tile3Breakdown = liabilitiesNote.length > 0 ? liabilitiesNote.join(" + ") : "No debt deductions";

    let deficitAdvisory = "";
    if (res.netDisbursement <= 0 && res.savings > 0) {
      deficitAdvisory = `
        <div class="advisory-box">
          <strong>Deficit Notice:</strong> Outstanding loan, purchase, and special loan obligations (${formatMoney(res.totalLiabilities)}) exceed savings proceeds. Member has a net outstanding balance of ${formatMoney(res.deficit)}.
        </div>
      `;
    }

    const safeName = escapeHtml(res.name);
    const safeStaff = escapeHtml(res.staff || "");

    panel.innerHTML = `
      <div class="result-head">
        <div>
          <span class="eyebrow">Withdrawal settlement</span>
          <h3>
            ${safeName}
            <small>${safeStaff ? `${safeStaff} · ` : ""}Withdrawal (${isRetirement ? "Retirement" : "Voluntary"})</small>
          </h3>
        </div>
        <span class="status-badge ${statusClass}">
          ${statusIcon}
          ${statusLabel}
        </span>
      </div>

      <!-- Overview Tiles -->
      <div class="result-tile-grid">
        <div class="result-tile">
          <span>Current Savings</span>
          <strong class="accent">${formatMoney(res.savings)}</strong>
          <span class="tile-breakdown">Total member savings</span>
        </div>
        <div class="result-tile">
          <span>Final Disbursement</span>
          <strong class="${res.netDisbursement > 0 ? "accent-green" : ""}">${formatMoney(Math.max(0, res.netDisbursement))}</strong>
          <span class="tile-breakdown">${tile2Breakdown}</span>
        </div>
        <div class="result-tile">
          <span>Total Deductions</span>
          <strong>${formatMoney(res.totalDeductions)}</strong>
          <span class="tile-breakdown">${tile3Breakdown}</span>
        </div>
        <div class="result-tile">
          <span>Type</span>
          <strong>${isRetirement ? "Retirement" : "Voluntary"}</strong>
          <span class="tile-breakdown">${isRetirement ? "0% fee applied" : "5% fee applied"}</span>
        </div>
      </div>

      ${deficitAdvisory}

      <div class="result-action-row quick-action-row">
        <button class="share-button" id="btnShareWhatsAppTop" onclick="shareWhatsApp()" type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          Share on WhatsApp
        </button>
        <button class="copy-report-button" id="btnCopyReportTop" onclick="copyAppraisalText()" type="button" title="Copy withdrawal details to clipboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>

      <!-- Audit Checks / Breakdown -->
      <div class="audit-checks">
        <!-- Settlement Breakdown Card -->
        <div class="audit-card pass-border">
          <div class="audit-head">
            <span class="audit-title">1. Withdrawal Settlement Breakdown</span>
            <span class="status-badge pass">BREAKDOWN</span>
          </div>
          <div class="audit-table">
            <div class="audit-row">
              <span class="audit-label">Total Current Savings</span>
              <span class="audit-value">${formatMoney(res.savings)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">${isRetirement ? "Retirement Charge (0%)" : "Voluntary Withdrawal Charge (5%)"}</span>
              <span class="audit-value ${res.withdrawalFee > 0 ? "highlight-deduct" : ""}">${res.withdrawalFee > 0 ? `- ${formatMoney(res.withdrawalFee)}` : "₦0.00 (Waived)"}</span>
            </div>
            ${res.existingLoan > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Outstanding Loan Payoff</span>
              <span class="audit-value highlight-deduct">- ${formatMoney(res.existingLoan)}</span>
            </div>` : ""}
            ${res.existingPurchase > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Outstanding Purchase Payoff</span>
              <span class="audit-value highlight-deduct">- ${formatMoney(res.existingPurchase)}</span>
            </div>` : ""}
            ${res.existingCommodity > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Outstanding Special Loan Payoff</span>
              <span class="audit-value highlight-deduct">- ${formatMoney(res.existingCommodity)}</span>
            </div>` : ""}
            <div class="audit-row audit-row-total">
              <span class="audit-label"><strong>Net Disbursement to Member</strong></span>
              <span class="audit-value"><strong class="accent">${formatMoney(res.netDisbursement)}</strong></span>
            </div>
          </div>
          <div class="audit-note pass">
            ${isRetirement
              ? "Retirement withdrawal: 0% administrative deduction applied on savings balance."
              : "Voluntary withdrawal: 5% administrative charge applied on savings balance."}
          </div>
        </div>

        <!-- Liabilities Clearance Card -->
        <div class="audit-card ${res.eligible ? "pass-border" : "fail-border"}">
          <div class="audit-head">
            <span class="audit-title">2. Liabilities &amp; Clearance Status</span>
            <span class="status-badge ${res.eligible ? "pass" : "fail"}">
              ${res.eligible ? "CLEARED" : "ACTION REQUIRED"}
            </span>
          </div>
          <div class="audit-table">
            <div class="audit-row">
              <span class="audit-label">Outstanding Loan Balance</span>
              <span class="audit-value">${formatMoney(res.existingLoan)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Outstanding Purchase Balance</span>
              <span class="audit-value">${formatMoney(res.existingPurchase)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Outstanding Special Loan Balance</span>
              <span class="audit-value">${formatMoney(res.existingCommodity || 0)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Total Cooperative Obligations</span>
              <span class="audit-value">${formatMoney(res.totalLiabilities)}</span>
            </div>
          </div>
          <div class="audit-note ${res.eligible ? "pass" : "fail"}">
            ${res.eligible
              ? (res.totalLiabilities > 0
                ? "All existing loan and purchase balances will be fully liquidated and closed from savings."
                : "Member has zero outstanding loan or purchase obligations.")
              : `Total obligations exceed member savings by ${formatMoney(res.deficit)}. Additional payment required to close accounts.`}
          </div>
        </div>
      </div>

      <div class="result-action-row">
        <button class="share-button" id="btnShareWhatsApp" onclick="shareWhatsApp()" type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          Share on WhatsApp
        </button>
        <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy withdrawal details to clipboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    `;

    const btnShareTop = panel.querySelector("#btnShareWhatsAppTop");
    const btnShareBottom = panel.querySelector("#btnShareWhatsApp");
    const btnCopyTop = panel.querySelector("#btnCopyReportTop");
    const btnCopyBottom = panel.querySelector("#btnCopyReport");

    if (callbacks.onShare) {
      btnShareTop?.addEventListener("click", callbacks.onShare);
      btnShareBottom?.addEventListener("click", callbacks.onShare);
    }
    if (callbacks.onCopy) {
      btnCopyTop?.addEventListener("click", () => callbacks.onCopy(btnCopyTop));
      btnCopyBottom?.addEventListener("click", () => callbacks.onCopy(btnCopyBottom));
    }
    return;
  }

  const statusClass = res.eligible ? "pass" : "fail";
  const statusLabel = res.eligible
    ? res.isInquiry
      ? "Capacity ready"
      : "Eligible"
    : "Not eligible";

  const statusIcon = res.eligible
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const facilityLabel =
    res.facility === "cash"
      ? "Normal Loan"
      : res.facility === "special"
        ? "Special Loan"
        : "Purchase";
  const capPct = Math.round((res.deductionRate || 0.40) * 100);
  const specRatePct = Math.round(((res.specialInterestRate !== undefined ? res.specialInterestRate : 0.20) * 100) * 10) / 10;

  if (res.facility === "special") {
    const safeName = escapeHtml(res.name);
    const safeStaff = escapeHtml(res.staff || "");
    const splitBreakdown = `${formatMoney(res.principalMonthly)} prin + ${formatMoney(res.interestMonthly)} int`;

    panel.innerHTML = `
      <div class="result-head">
        <div>
          <span class="eyebrow">Special loan appraisal</span>
          <h3>
            ${safeName}
            <small>${safeStaff} · Special Loan (${specRatePct}% flat)</small>
          </h3>
        </div>
        <span class="status-badge ${statusClass}">
          ${statusIcon}
          ${statusLabel}
        </span>
      </div>

      <div class="result-tile-grid">
        <div class="result-tile">
          <span>Special Loan (Principal)</span>
          <strong class="accent">${formatMoney(res.amount)}</strong>
          <span class="tile-breakdown">Disbursed in full (no upfront fee)</span>
        </div>
        <div class="result-tile">
          <span>Total Repayment</span>
          <strong>${formatMoney(res.totalRepayment)}</strong>
          <span class="tile-breakdown">Principal + ${formatMoney(res.interest)} (${specRatePct}% Int)</span>
        </div>
        <div class="result-tile">
          <span>Monthly Loan Split</span>
          <strong>${formatMoney(res.monthly)}</strong>
          <span class="tile-breakdown">${splitBreakdown}</span>
        </div>
        <div class="result-tile">
          <span>Duration</span>
          <strong>${res.duration} Mos</strong>
          <span class="tile-breakdown">Max 24 months</span>
        </div>
      </div>

      <div class="result-action-row quick-action-row">
        <button class="share-button" id="btnShareWhatsAppTop" onclick="shareWhatsApp()" type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          Share on WhatsApp
        </button>
        <button class="copy-report-button" id="btnCopyReportTop" onclick="copyAppraisalText()" type="button" title="Copy appraisal details to clipboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>

      <div class="audit-checks">
        <div class="audit-card pass-border">
          <div class="audit-head">
            <span class="audit-title">1. Principal &amp; Interest Split (${specRatePct}% Flat)</span>
            <span class="status-badge pass">SPLIT</span>
          </div>
          <div class="audit-table">
            <div class="audit-row">
              <span class="audit-label">Special Loan Principal</span>
              <span class="audit-value">${formatMoney(res.amount)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Flat Interest (${specRatePct}%)</span>
              <span class="audit-value">${formatMoney(res.interest)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Monthly Principal Deduction</span>
              <span class="audit-value">${formatMoney(res.principalMonthly)}</span>
            </div>
            <div class="audit-row">
              <span class="audit-label">Monthly Interest Deduction</span>
              <span class="audit-value">${formatMoney(res.interestMonthly)}</span>
            </div>
            <div class="audit-row highlight">
              <span class="audit-label">Total Monthly Special Loan Deduction</span>
              <span class="audit-value">${formatMoney(res.monthly)}</span>
            </div>
            ${res.existingCommodity > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Existing Special Loan Balance (Not Offset)</span>
              <span class="audit-value">${formatMoney(res.existingCommodity)}</span>
            </div>` : ""}
          </div>
          <div class="audit-note pass">
            Interest is not deducted upfront; ${formatMoney(res.principalMonthly)} principal and ${formatMoney(res.interestMonthly)} interest are deducted monthly over ${res.duration} months.
          </div>
        </div>

        <div class="audit-card pass-border">
          <div class="audit-head">
            <span class="audit-title">2. Monthly Cooperative &amp; Payslip Summary</span>
            <span class="status-badge pass">ADDED</span>
          </div>
          <div class="audit-table">
            <div class="audit-row">
              <span class="audit-label">Monthly Special Loan Repayment</span>
              <span class="audit-value">${formatMoney(res.monthly)}</span>
            </div>
            ${res.coopDed > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Current Coop Deduction (Kept)</span>
              <span class="audit-value">${formatMoney(res.coopDed)}</span>
            </div>` : ""}
            ${res.otherDed > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Other Ongoing Deductions</span>
              <span class="audit-value">${formatMoney(res.otherDed)}</span>
            </div>` : ""}
            ${res.nonCoop > 0 ? `
            <div class="audit-row">
              <span class="audit-label">Non-Coop Bank Deductions</span>
              <span class="audit-value">${formatMoney(res.nonCoop)}</span>
            </div>` : ""}
            <div class="audit-row highlight">
              <span class="audit-label">New Total Coop Monthly Deduction</span>
              <span class="audit-value">${formatMoney(res.totalCoopMonthly)}</span>
            </div>
            <div class="audit-row highlight">
              <span class="audit-label">New Total Payslip Deduction</span>
              <span class="audit-value">${formatMoney(res.newDeduction)}</span>
            </div>
          </div>
          <div class="audit-note pass">
            Special loan repayment is added on top of existing cooperative deductions. Savings limit (×2) and salary deduction cap are not enforced on Special Loans.
          </div>
        </div>
      </div>

      <div class="result-action-row">
        <button class="share-button" id="btnShareWhatsApp" onclick="shareWhatsApp()" type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          Share on WhatsApp
        </button>
        <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy appraisal details to clipboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    `;
    return;
  }

  const savingsExcess = Math.max(0, (res.facility === "cash" ? res.amount : res.financed) - res.savingsLimit);
  const savingsNote = res.savingsPass
    ? `Amount requested fits within the Savings Limit (x2) of ${formatMoney(res.savingsLimit)}.`
    : `Amount requested exceeds Savings Limit (x2) of ${formatMoney(res.savingsLimit)}${savingsExcess > 0 ? ` by ${formatMoney(savingsExcess)}` : ""}.`;

  const payrollRows =
    res.facility === "cash"
      ? `
      <div class="audit-row">
        <span class="audit-label">Monthly Loan Repayment</span>
        <span class="audit-value">${formatMoney(res.monthly)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">10% Upfront Charge (Deducted at Payout)</span>
        <span class="audit-value">${formatMoney(res.interest || res.upfrontCharge || res.amount * 0.10)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">Monthly Savings Contribution</span>
        <span class="audit-value">${formatMoney(res.monthlySavings)}</span>
      </div>
      ${res.otherDed > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Other Monthly Deductions</span>
        <span class="audit-value">${formatMoney(res.otherDed)}</span>
      </div>` : ""}
      ${res.nonCoop > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Non-Coop Bank Deductions</span>
        <span class="audit-value">${formatMoney(res.nonCoop)}</span>
      </div>` : ""}
      <div class="audit-row highlight">
        <span class="audit-label">New Total Monthly Deduction</span>
        <span class="audit-value">${formatMoney(res.newDeduction)}</span>
      </div>
      <div class="audit-row highlight">
        <span class="audit-label">Maximum Allowed Deduction (${capPct}% of Salary)</span>
        <span class="audit-value">${formatMoney(res.maxDeduction)}</span>
      </div>
    `
      : `
      <div class="audit-row">
        <span class="audit-label">Monthly Purchase Repayment</span>
        <span class="audit-value">${formatMoney(res.monthly)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">10% Interest Included</span>
        <span class="audit-value">${formatMoney(res.interest)}</span>
      </div>
      ${res.isDownPaymentActive ? `
      <div class="audit-row">
        <span class="audit-label">Down Payment Dropped (Payable Upfront)</span>
        <span class="audit-value">${formatMoney(res.down)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">Remaining Amount Financed</span>
        <span class="audit-value">${formatMoney(res.financed)}</span>
      </div>` : ""}
      ${res.coopDed > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Current Coop Deduction (Includes Savings)</span>
        <span class="audit-value">${formatMoney(res.coopDed)}</span>
      </div>` : ""}
      ${res.otherDed > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Other Ongoing Deductions</span>
        <span class="audit-value">${formatMoney(res.otherDed)}</span>
      </div>` : ""}
      ${res.nonCoop > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Non-Coop Bank Deductions</span>
        <span class="audit-value">${formatMoney(res.nonCoop)}</span>
      </div>` : ""}
      <div class="audit-row highlight">
        <span class="audit-label">Total Monthly Deduction</span>
        <span class="audit-value">${formatMoney(res.newDeduction)}</span>
      </div>
      <div class="audit-row highlight">
        <span class="audit-label">Maximum Allowed Deduction (${capPct}% of Salary)</span>
        <span class="audit-value">${formatMoney(res.maxDeduction)}</span>
      </div>
    `;

  const payrollNote = res.payrollPass
    ? `New monthly deduction (${formatMoney(res.newDeduction)}) fits within the allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`
    : `New monthly deduction (${formatMoney(res.newDeduction)}) exceeds allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`;

  let proposalAccordionHtml = "";
  if (res.needsProposal && res.counter > 0 && res.counterNet > 0) {
    proposalAccordionHtml = `
      <details class="proposal-accordion">
        <summary class="proposal-summary">
          <div class="proposal-title-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${res.zeroPayout ? "Proposable amount (with a real payout)" : "What You Can Get?"}</span>
          </div>
          <div class="proposal-meta">
            <span class="proposal-badge">${formatMoney(res.counter)}</span>
            <svg class="proposal-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div class="proposal-body">
          <p class="proposal-note">Proposable alternative calculated to satisfy both 2× savings limit and ${capPct}% deduction ceiling:</p>
          <div class="proposal-grid">
            <div class="proposal-card">
              <span>Proposable Amount</span>
              <strong>${formatMoney(res.counter)}</strong>
            </div>
            <div class="proposal-card">
              <span>Net Disbursed</span>
              <strong>${formatMoney(res.counterNet)}</strong>
            </div>
            <div class="proposal-card">
              <span>Monthly Deduction</span>
              <strong>${formatMoney(res.counterTotalMonthly || res.counterMonthly)}</strong>
            </div>
            <div class="proposal-card">
              <span>Duration</span>
              <strong>${res.duration} Mos</strong>
            </div>
          </div>
          <button type="button" class="apply-proposal-btn" id="btnApplyProposal" data-counter="${res.counter}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Apply Proposable Amount (${formatMoney(res.counter)})
          </button>
        </div>
      </details>
    `;
  } else if (res.needsProposal) {
    proposalAccordionHtml = `
      <div class="advisory-box">
        <strong>Notice:</strong> ${res.zeroPayout
          ? "Even the maximum amount this member could support under the savings limit and payroll margin would still net ₦0.00 after clearing the existing loan."
          : "Member currently has no allowable borrowing capacity under current debt and savings balances."}
      </div>
    `;
  }

  let netAdvisoryHtml = "";
  if (res.facility === "cash" && res.net <= 0 && res.amount > 0) {
    netAdvisoryHtml = `
      <div class="advisory-box">
        <strong>Zero Payout Warning:</strong> Outstanding loan balance (${formatMoney(res.existingLoan)}) offsets net proceeds (${formatMoney(res.amount - (res.interest || res.amount * 0.10))}).
      </div>
    `;
  }

  const breakdownNote =
    res.facility === "cash"
      ? `${formatMoney(res.monthly)} loan + ${formatMoney(res.monthlySavings)} sav${res.otherDed > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""}`
      : res.coopDed > 0
        ? `${formatMoney(res.monthly)} item + ${formatMoney(res.coopDed)} current coop${res.otherDed > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""}`
        : `${formatMoney(res.monthly)} item${res.otherDed > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""}`;

  const tile2Label = res.facility === "cash" ? "Net Disbursed" : "Total Repayment";
  const tile2Value = res.facility === "cash" ? formatMoney(res.net) : formatMoney(res.totalRepayment);
  const tile2Breakdown = res.facility === "cash"
    ? `Less ₦${(res.interest || res.amount * 0.10).toLocaleString()} (10% chg)${res.existingLoan > 0 ? ` & ₦${Number(res.existingLoan).toLocaleString()} (loan)` : ""}`
    : `Financed ${formatMoney(res.financed)} + ${formatMoney(res.interest)} (10% Int)`;

  const tile1Breakdown = res.facility === "purchase" && res.isDownPaymentActive
    ? `Down: ${formatMoney(res.down)} · Fin: ${formatMoney(res.financed)}`
    : "";

  const safeName = escapeHtml(res.name);
  const safeStaff = escapeHtml(res.staff || "");

  panel.innerHTML = `
    <div class="result-head">
      <div>
        <span class="eyebrow">Eligibility appraisal</span>
        <h3>
          ${safeName}
          <small>${safeStaff} · ${facilityLabel}</small>
        </h3>
      </div>
      <span class="status-badge ${statusClass}">
        ${statusIcon}
        ${statusLabel}
      </span>
    </div>

    <!-- Requested Facility Overview Tiles -->
    <div class="result-tile-grid">
      <div class="result-tile">
        <span>${res.facility === "cash" ? "Amount Requested" : "Purchase Amount"}</span>
        <strong class="accent">${formatMoney(res.amount)}</strong>
        ${tile1Breakdown ? `<span class="tile-breakdown">${tile1Breakdown}</span>` : ""}
      </div>
      <div class="result-tile">
        <span>${tile2Label}</span>
        <strong>${tile2Value}</strong>
        <span class="tile-breakdown">${tile2Breakdown}</span>
      </div>
      <div class="result-tile">
        <span>Monthly Deduction</span>
        <strong>${formatMoney(res.totalCoopMonthly || res.monthly)}</strong>
        <span class="tile-breakdown">${breakdownNote}</span>
      </div>
      <div class="result-tile">
        <span>Duration</span>
        <strong>${res.duration} Mos</strong>
      </div>
    </div>

    ${netAdvisoryHtml}

    <div class="result-action-row quick-action-row">
      <button class="share-button" id="btnShareWhatsAppTop" onclick="shareWhatsApp()" type="button">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        Share on WhatsApp
      </button>
      <button class="copy-report-button" id="btnCopyReportTop" onclick="copyAppraisalText()" type="button" title="Copy appraisal details to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>

    <!-- Audit Checks (Policy 1 & Policy 2) -->
    <div class="audit-checks">
      <!-- Check 1: Savings Limit -->
      <div class="audit-card ${res.savingsPass ? "pass-border" : "fail-border"}">
        <div class="audit-head">
          <span class="audit-title">1. Savings Limit (x2)</span>
          <span class="status-badge ${res.savingsPass ? "pass" : "fail"}">
            ${res.savingsPass ? "PASS" : "FAIL"}
          </span>
        </div>
        <div class="audit-table">
          <div class="audit-row">
            <span class="audit-label">Savings Limit (x2)</span>
            <span class="audit-value">${formatMoney(res.savingsLimit)}</span>
          </div>
          <div class="audit-row">
            <span class="audit-label">${res.facility === "cash" ? "Amount Requested" : "Amount Financed"}</span>
            <span class="audit-value">${formatMoney(res.facility === "cash" ? res.amount : res.financed)}</span>
          </div>
          ${res.facility === "purchase" && res.isDownPaymentActive ? `
          <div class="audit-row">
            <span class="audit-label">Down Payment Dropped</span>
            <span class="audit-value">${formatMoney(res.down)}</span>
          </div>` : ""}
        </div>
        <div class="audit-note ${res.savingsPass ? "pass" : "fail"}">
          ${savingsNote}
        </div>
      </div>

      <!-- Check 2: Payslip Deduction Check -->
      <div class="audit-card ${res.payrollPass ? "pass-border" : "fail-border"}">
        <div class="audit-head">
          <span class="audit-title">2. Payslip Deduction Check</span>
          <div class="audit-head-badges">
            <span class="cap-ratio-badge ${res.payrollPass ? "pass" : "fail"}" style="display: none;">
              ${(res.gross > 0 ? (res.newDeduction / res.gross * 100).toFixed(1) : (res.maxDeduction > 0 ? (res.newDeduction / res.maxDeduction * capPct).toFixed(1) : "0.0"))}% / ${capPct}% ${res.payrollPass ? "Cap" : "EXCEEDED"}
            </span>
            <span class="status-badge ${res.payrollPass ? "pass" : "fail"}">
              ${res.payrollPass ? "PASS" : "FAIL"}
            </span>
          </div>
        </div>
        <div class="audit-table">
          ${payrollRows}
        </div>
        <div class="audit-note ${res.payrollPass ? "pass" : "fail"}">
          ${payrollNote}
        </div>
      </div>
    </div>

    ${proposalAccordionHtml}

    <div class="result-action-row">
      <button class="share-button" id="btnShareWhatsApp" onclick="shareWhatsApp()" type="button">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        Share on WhatsApp
      </button>
      <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy appraisal details to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>
  `;

  const btnApply = panel.querySelector("#btnApplyProposal");
  if (btnApply && callbacks.onApplyCounterOffer) {
    btnApply.addEventListener("click", () => callbacks.onApplyCounterOffer(res.counter));
  }
}
