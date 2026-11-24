// ==========================================================================
//  ALPHA COOP — INTERACTIVE ONBOARDING TOUR & COACHMARK SPOTLIGHT
// ==========================================================================

const STORAGE_KEY = "alpha_coop_onboarded";

import { isDeskUnlocked } from "./auth.js";
export { isDeskUnlocked };

export const ONBOARDING_STEPS = [
  {
    target: ".mode-switch",
    title: "1. Choose Facility Type",
    text: "Select Loan for direct disbursements (up to 24 months) or Purchase for asset financing (up to 9 months at 10% flat interest).",
    placement: "bottom"
  },
  {
    target: "#memberFieldGrid",
    title: "2. Instant Member Lookup",
    text: "Type a member's Staff ID or name to auto-populate current savings, existing loans, and member portal credentials from the live ledger.",
    placement: "bottom"
  },
  {
    target: "#sectionBalances",
    title: "3. Current Balances",
    text: "Review or enter the member's current thrift savings and outstanding loan balances, used directly in the eligibility and 2x limit calculations.",
    placement: "bottom"
  },
  {
    target: ".cap-toggle-wrap",
    title: "4. Salary Deduction Cap",
    text: "Defaults to the standard 40% salary deduction cap. Switch to 50% or tap the pencil to set custom caps.",
    placement: "bottom"
  },
  {
    target: "#fieldRequested",
    title: "5. Request or Capacity Check",
    text: "Enter loan amount and tenure, or toggle 'Capacity only' to discover the maximum loan a member qualifies for without manual guessing.",
    placement: "top"
  },
  {
    target: ".primary-button.calculate",
    title: "6. Run Audit Appraisal",
    text: "Tap Calculate eligibility to instantly test the request against Policy 1 (2x Savings Limit) and Policy 2 (Net Pay & Debt Capacity Check).",
    placement: "top"
  },
  {
    target: "#resultPanel",
    title: "7. Eligibility Appraisal Result",
    text: "Displays the complete assessment verdict, policy audit checks, net proceeds, counter-offers, and one-click WhatsApp sharing.",
    placement: "left"
  },
  {
    target: "#btnClear",
    title: "8. Clear or Reset Desk",
    text: "Tap Clear anytime to reset the desk and wipe all inputs back to default.",
    placement: "left"
  },
  {
    target: "#scenarioSection",
    title: "9. Test Scenarios",
    text: "Use one-click test scenarios to quickly simulate different loan conditions and edge cases.",
    placement: "bottom"
  },
  {
    target: "#btnHelpGuide",
    title: "10. Replay Tour Anytime",
    text: "Need a refresher? Tap Guide in the navigation bar anytime to replay this walkthrough.",
    placement: "bottom"
  }
];

class OnboardingTour {
  constructor(steps = ONBOARDING_STEPS) {
    this.steps = steps;
    this.currentIndex = 0;
    this.isActive = false;
    this.overlayEl = null;
    this.tooltipEl = null;
    this.highlightEl = null;
    this.activeTarget = null;
    this.scrollAnimId = null;
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  start(force = false) {
    // Never show onboarding if the desk is not authenticated
    if (!isDeskUnlocked()) {
      return;
    }
    if (!force && localStorage.getItem(STORAGE_KEY) === "true") {
      return;
    }
    this.currentIndex = 0;
    this.isActive = true;
    this.createDom();
    this.renderStep(this.currentIndex);
    window.addEventListener("keydown", this.handleKeydown);
    window.addEventListener("scroll", this.handleScroll, { passive: true, capture: true });
    window.addEventListener("resize", this.handleResize, { passive: true });
  }

  stop() {
    this.isActive = false;
    localStorage.setItem(STORAGE_KEY, "true");
    window.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("scroll", this.handleScroll, { capture: true });
    window.removeEventListener("resize", this.handleResize);

    if (this.scrollAnimId) {
      cancelAnimationFrame(this.scrollAnimId);
      this.scrollAnimId = null;
    }
    if (this.activeTarget) {
      this.activeTarget.classList.remove("tour-active-target");
      this.activeTarget = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
    if (this.highlightEl) {
      this.highlightEl.remove();
      this.highlightEl = null;
    }
  }

  next() {
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++;
      this.renderStep(this.currentIndex);
    } else {
      this.stop();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.renderStep(this.currentIndex);
    }
  }

  createDom() {
    document.querySelectorAll(".tour-overlay, .tour-tooltip, .tour-spotlight").forEach((el) => el.remove());

    // Transparent overlay that captures clicks outside
    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "tour-overlay";
    this.overlayEl.addEventListener("click", () => this.stop());
    document.body.appendChild(this.overlayEl);

    // Glowing target spotlight ring with clean box-shadow overlay (NO blur)
    this.highlightEl = document.createElement("div");
    this.highlightEl.className = "tour-spotlight";
    document.body.appendChild(this.highlightEl);

    // Tooltip Card
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "tour-tooltip";
    this.tooltipEl.setAttribute("role", "dialog");
    this.tooltipEl.setAttribute("aria-modal", "true");
    document.body.appendChild(this.tooltipEl);
  }

  renderStep(index) {
    const step = this.steps[index];
    if (!step) return;

    let targetEl = document.querySelector(step.target);
    if (!targetEl) {
      targetEl = document.body;
    }

    if (this.activeTarget) {
      this.activeTarget.classList.remove("tour-active-target");
    }
    this.activeTarget = targetEl !== document.body ? targetEl : null;
    if (this.activeTarget) {
      this.activeTarget.classList.add("tour-active-target");
    }

    // Smoothly scroll target into comfortable view (skip if element is already fixed in viewport)
    const pos = targetEl !== document.body ? window.getComputedStyle(targetEl).position : "static";
    if (targetEl !== document.body && pos !== "fixed") {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // Allow smooth scroll to settle, then position with smooth easing
    setTimeout(() => {
      this.positionHighlight(targetEl, true);
      this.renderTooltipContent(step, index);
      this.positionTooltip(targetEl, step.placement, true);
    }, 120);
  }

  positionHighlight(targetEl, smooth = true) {
    if (!this.highlightEl || !targetEl || targetEl === document.body) {
      if (this.highlightEl) this.highlightEl.style.display = "none";
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const pad = 8;

    this.highlightEl.style.transition = smooth
      ? "all 280ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "none";

    this.highlightEl.style.display = "block";
    this.highlightEl.style.top = `${rect.top - pad}px`;
    this.highlightEl.style.left = `${rect.left - pad}px`;
    this.highlightEl.style.width = `${rect.width + pad * 2}px`;
    this.highlightEl.style.height = `${rect.height + pad * 2}px`;
    this.highlightEl.style.borderRadius = window.getComputedStyle(targetEl).borderRadius || "8px";
  }

  renderTooltipContent(step, index) {
    const isFirst = index === 0;
    const isLast = index === this.steps.length - 1;
    const total = this.steps.length;

    const dotsHtml = this.steps
      .map((_, i) => `<span class="tour-dot ${i === index ? "active" : ""}"></span>`)
      .join("");

    this.tooltipEl.innerHTML = `
      <div class="tour-tooltip-header">
        <span class="tour-badge">Step ${index + 1} of ${total}</span>
        <button type="button" class="tour-close-btn" aria-label="Skip tour" title="Skip tour">✕</button>
      </div>
      <h4 class="tour-title">${step.title}</h4>
      <p class="tour-text">${step.text}</p>
      <div class="tour-footer">
        <div class="tour-dots">${dotsHtml}</div>
        <div class="tour-actions">
          ${!isFirst ? `<button type="button" class="tour-btn tour-btn-secondary" id="btnTourPrev">Back</button>` : `<button type="button" class="tour-btn tour-btn-secondary" id="btnTourSkip">Skip</button>`}
          <button type="button" class="tour-btn tour-btn-primary" id="btnTourNext">${isLast ? "Got it" : "Next"}</button>
        </div>
      </div>
    `;

    this.tooltipEl.querySelector(".tour-close-btn")?.addEventListener("click", () => this.stop());
    this.tooltipEl.querySelector("#btnTourSkip")?.addEventListener("click", () => this.stop());
    this.tooltipEl.querySelector("#btnTourPrev")?.addEventListener("click", () => this.prev());
    this.tooltipEl.querySelector("#btnTourNext")?.addEventListener("click", () => this.next());
  }

  positionTooltip(targetEl, preferredPlacement = "bottom", smooth = true) {
    if (!this.tooltipEl || !targetEl) return;

    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const margin = 14;
    const isMobile = window.innerWidth < 640;

    this.tooltipEl.style.transition = smooth
      ? "top 280ms cubic-bezier(0.16, 1, 0.3, 1), left 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease"
      : "none";

    if (isMobile) {
      const rect = targetEl.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const tooltipWidth = Math.min(340, vw - 24);
      const tooltipHeight = tooltipRect.height || 180;

      let top = 0;
      // Position card cleanly below or above the target based on space
      if (rect.bottom + tooltipHeight + 16 < vh) {
        top = rect.bottom + 12;
      } else if (rect.top - tooltipHeight - 16 > 60) {
        top = rect.top - tooltipHeight - 12;
      } else {
        const spaceBelow = vh - rect.bottom;
        const spaceAbove = rect.top - 60;
        if (spaceBelow >= spaceAbove) {
          top = Math.min(vh - tooltipHeight - 12, rect.bottom + 8);
        } else {
          top = Math.max(64, rect.top - tooltipHeight - 8);
        }
      }

      const left = Math.max(12, Math.min(vw - tooltipWidth - 12, (vw - tooltipWidth) / 2));

      this.tooltipEl.style.position = "fixed";
      this.tooltipEl.style.top = `${Math.round(top)}px`;
      this.tooltipEl.style.left = `${Math.round(left)}px`;
      this.tooltipEl.style.right = "auto";
      this.tooltipEl.style.bottom = "auto";
      this.tooltipEl.style.width = `${tooltipWidth}px`;
      this.tooltipEl.style.transform = "none";
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    let top = 0;
    let left = 0;

    if (preferredPlacement === "bottom") {
      top = rect.bottom + margin;
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    } else if (preferredPlacement === "top") {
      top = rect.top - tooltipRect.height - margin;
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    } else if (preferredPlacement === "left") {
      top = rect.top + rect.height / 2 - tooltipRect.height / 2;
      left = rect.left - tooltipRect.width - margin;
    } else {
      top = rect.top + rect.height / 2 - tooltipRect.height / 2;
      left = rect.right + margin;
    }

    const maxLeft = window.innerWidth - tooltipRect.width - margin;
    const minLeft = margin;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    if (top < margin) {
      top = rect.bottom + margin;
    } else if (top + tooltipRect.height > window.innerHeight - margin) {
      top = rect.top - tooltipRect.height - margin;
    }

    this.tooltipEl.style.position = "fixed";
    this.tooltipEl.style.top = `${Math.max(margin, top)}px`;
    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.right = "auto";
    this.tooltipEl.style.bottom = "auto";
    this.tooltipEl.style.width = "360px";
  }

  handleScroll() {
    if (!this.isActive) return;
    if (this.scrollAnimId) return;
    this.scrollAnimId = requestAnimationFrame(() => {
      this.scrollAnimId = null;
      if (!this.isActive) return;
      const step = this.steps[this.currentIndex];
      if (!step) return;
      const targetEl = document.querySelector(step.target);
      if (targetEl) {
        // Real-time zero-lag lock to element coordinates while scrolling
        this.positionHighlight(targetEl, false);
        this.positionTooltip(targetEl, step.placement, false);
      }
    });
  }

  handleResize() {
    if (!this.isActive) return;
    const step = this.steps[this.currentIndex];
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      this.positionHighlight(targetEl, false);
      this.positionTooltip(targetEl, step.placement, false);
    }
  }

  handleKeydown(e) {
    if (!this.isActive) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.stop();
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      this.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.prev();
    }
  }
}

export const onboarding = new OnboardingTour();

export function initOnboarding() {
  // Only start onboarding if authenticated and not already seen
  if (!isDeskUnlocked()) {
    return;
  }
  if (localStorage.getItem(STORAGE_KEY) !== "true") {
    setTimeout(() => {
      onboarding.start(false);
    }, 600);
  }
}

export function startTour() {
  onboarding.start(true);
}
