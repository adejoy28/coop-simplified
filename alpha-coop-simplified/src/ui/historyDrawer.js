// ==========================================================================
//  ALPHA COOP — SESSION APPRAISAL HISTORY DRAWER
// ==========================================================================

import { formatMoney } from "../utils/formatters.js";
import { escapeHtml } from "../utils/dom.js";
import { getAppraisalHistory, clearAppraisalHistory, deleteAppraisalFromHistory } from "../state/appState.js";

let drawerContainer = null;
let callbacksRef = {};

function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function initHistoryDrawer(callbacks = {}) {
  callbacksRef = callbacks;
  if (!drawerContainer) {
    createDrawerDom();
  }
  updateHistoryBadge();
}

function createDrawerDom() {
  document.querySelectorAll(".history-overlay, .history-drawer").forEach((el) => el.remove());

  // Backdrop overlay
  const overlay = document.createElement("div");
  overlay.className = "history-overlay";
  overlay.id = "historyOverlay";
  overlay.addEventListener("click", closeHistoryDrawer);
  document.body.appendChild(overlay);

  // Side Drawer
  const drawer = document.createElement("aside");
  drawer.className = "history-drawer";
  drawer.id = "historyDrawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Session Assessment History");

  drawer.innerHTML = `
    <div class="history-drawer-inner">
      <div class="history-header">
        <div>
          <span class="eyebrow">Session memory</span>
          <h3>Appraisal History</h3>
        </div>
        <div class="history-head-actions">
          <button type="button" class="history-clear-btn" id="btnClearHistory" title="Clear all assessments in this session">Clear</button>
          <button type="button" class="history-close-btn" id="btnCloseHistory" aria-label="Close history drawer" title="Close">✕</button>
        </div>
      </div>

      <div class="history-body" id="historyList">
        <!-- Dynamically injected cards -->
      </div>

      <div class="history-footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>Temporarily saved for this session. Clears when browser tab closes.</span>
      </div>
    </div>
  `;

  document.body.appendChild(drawer);
  drawerContainer = drawer;

  drawer.querySelector("#btnCloseHistory")?.addEventListener("click", closeHistoryDrawer);
  drawer.querySelector("#btnClearHistory")?.addEventListener("click", () => {
    clearAppraisalHistory();
    renderHistoryCards();
    updateHistoryBadge();
    if (typeof callbacksRef.onClear === "function") {
      callbacksRef.onClear();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isHistoryOpen()) {
      closeHistoryDrawer();
    }
  });
}

export function isHistoryOpen() {
  const drawer = document.getElementById("historyDrawer");
  return Boolean(drawer && drawer.classList.contains("open"));
}

export function openHistoryDrawer() {
  if (!drawerContainer) {
    createDrawerDom();
  }
  renderHistoryCards();
  const drawer = document.getElementById("historyDrawer");
  const overlay = document.getElementById("historyOverlay");
  if (drawer && overlay) {
    overlay.classList.add("open");
    drawer.classList.add("open");
    document.body.classList.add("history-open");
  }
}

export function closeHistoryDrawer() {
  const drawer = document.getElementById("historyDrawer");
  const overlay = document.getElementById("historyOverlay");
  if (drawer && overlay) {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.classList.remove("history-open");
  }
}

export function toggleHistoryDrawer() {
  if (isHistoryOpen()) {
    closeHistoryDrawer();
  } else {
    openHistoryDrawer();
  }
}

export function updateHistoryBadge() {
  const items = getAppraisalHistory();
  const badge = document.getElementById("historyBadgeCount");
  if (!badge) return;

  const count = items.length;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

function renderHistoryCards() {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;

  const items = getAppraisalHistory();
  if (!items || items.length === 0) {
    listEl.innerHTML = `
      <div class="history-empty">
        <div class="empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h4>No assessments yet</h4>
        <p>Appraisals you calculate during this session will automatically appear here for quick recall.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items
    .map((item, idx) => {
      const facilityLabel =
        item.facility === "cash"
          ? "Normal Loan"
          : item.facility === "purchase"
            ? "Purchase"
            : item.facility === "special"
              ? "Special Loan"
              : "Withdrawal";
      const statusClass = item.eligible ? "pass" : "fail";
      const statusLabel = item.eligible
        ? item.isInquiry
          ? "READY"
          : (item.facility === "withdrawal" ? "READY" : "PASS")
        : "FAIL";
      const timeStr = formatTimeAgo(item.timestamp);
      const memberTitle = escapeHtml(item.name || "Member Record");
      const staffBadge = item.staff ? `<span class="history-staff-id">${escapeHtml(item.staff)}</span>` : "";

      const metric1Label = item.facility === "withdrawal" ? "Savings" : "Requested";
      const amountDisplay = item.facility === "withdrawal"
        ? formatMoney(item.savings || item.amount || 0)
        : (item.isInquiry ? "Capacity check" : formatMoney(item.amount || 0));

      const metric2Label = item.facility === "withdrawal" ? "Net Payout" : "Monthly deduction";
      const monthlyDisplay = item.facility === "withdrawal"
        ? formatMoney(item.net !== undefined ? item.net : 0)
        : formatMoney(item.totalCoopMonthly || item.monthly || 0);

      const durationPill = item.facility === "withdrawal"
        ? `<span class="history-pill duration">${item.inputs?.withdrawalType === "retirement" ? "Retirement" : "Voluntary"}</span>`
        : `<span class="history-pill duration">${item.duration || 3} Mos</span>`;

      return `
        <div class="history-card" data-idx="${idx}" data-id="${item.id}" tabindex="0" role="button" aria-label="Restore assessment for ${memberTitle}">
          <div class="history-card-head">
            <div class="history-member-info">
              <span class="history-member-name">${memberTitle}</span>
              ${staffBadge}
            </div>
            <div class="history-card-meta">
              <span class="history-time">${timeStr}</span>
              <button type="button" class="history-delete-single" data-del-id="${item.id}" title="Remove this record" aria-label="Remove appraisal">✕</button>
            </div>
          </div>

          <div class="history-card-pills">
            <span class="history-pill facility">${facilityLabel}</span>
            <span class="history-pill status ${statusClass}">${statusLabel}</span>
            ${durationPill}
          </div>

          <div class="history-card-metrics">
            <div class="history-metric">
              <span>${metric1Label}</span>
              <strong>${amountDisplay}</strong>
            </div>
            <div class="history-metric">
              <span>${metric2Label}</span>
              <strong>${monthlyDisplay}</strong>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach card click handlers to restore
  listEl.querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      // If user clicked the single delete button, do not restore
      if (e.target.closest(".history-delete-single")) return;

      const idx = parseInt(card.getAttribute("data-idx"), 10);
      const item = items[idx];
      if (item && typeof callbacksRef.onRestore === "function") {
        callbacksRef.onRestore(item);
        closeHistoryDrawer();
      }
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const idx = parseInt(card.getAttribute("data-idx"), 10);
        const item = items[idx];
        if (item && typeof callbacksRef.onRestore === "function") {
          callbacksRef.onRestore(item);
          closeHistoryDrawer();
        }
      }
    });
  });

  // Attach individual delete button handlers
  listEl.querySelectorAll(".history-delete-single").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-del-id");
      if (id) {
        deleteAppraisalFromHistory(id);
        renderHistoryCards();
        updateHistoryBadge();
        if (typeof callbacksRef.onDelete === "function") {
          callbacksRef.onDelete(id);
        }
      }
    });
  });
}
