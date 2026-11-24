import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface OnboardingStep {
  target: string;
  title: string;
  text: string;
  placement: "top" | "bottom" | "left" | "right";
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: ".mode-switch",
    title: "1. Choose Facility Type",
    text: "Select Normal Loan for direct disbursements (up to 24 months), Purchase for asset financing (up to 9 months at 10% flat interest), or Withdrawal for exit settlements.",
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
    text: "Review or enter the member's current thrift savings and outstanding loan balances, used directly in the eligibility and 2× limit calculations.",
    placement: "bottom"
  },
  {
    target: ".cap-toggle-wrap",
    title: "4. Salary Deduction Cap",
    text: "Defaults to the standard 40% salary deduction cap. Switch to 50% or tap the pencil icon to enter a custom cap inline.",
    placement: "bottom"
  },
  {
    target: "#fieldRequested",
    title: "5. Request or Capacity Check",
    text: "Enter loan amount and tenure, or toggle 'Capacity only' to calculate the maximum loan a member qualifies for automatically.",
    placement: "top"
  },
  {
    target: ".primary-button.calculate",
    title: "6. Run Audit Appraisal",
    text: "Tap Calculate Eligibility to test the request against Policy 1 (2× Savings Limit) and Policy 2 (Payslip Deduction Cap).",
    placement: "top"
  },
  {
    target: "#resultPanel",
    title: "7. Eligibility Appraisal Result",
    text: "Displays the assessment verdict, policy audit breakdown, net proceeds, counter-offers, and one-click WhatsApp sharing.",
    placement: "left"
  },
  {
    target: "#btnClear",
    title: "8. Clear or Reset Desk",
    text: "Tap Clear Desk anytime to reset the workspace and wipe all inputs back to default.",
    placement: "top"
  },
  {
    target: "#scenarioSection",
    title: "9. Quick Test Scenarios",
    text: "Use one-click test scenarios to quickly simulate different loan conditions and edge cases.",
    placement: "bottom"
  },
  {
    target: "#btnHelpGuide",
    title: "10. Replay Tour Anytime",
    text: "Need a refresher? Tap the guide button in the top bar anytime to replay this walkthrough.",
    placement: "bottom"
  }
];

interface OnboardingTourProps {
  isActive: boolean;
  onStop: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isActive, onStop }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<Element | null>(null);

  const step = ONBOARDING_STEPS[stepIndex];

  const positionElements = useCallback(
    (smooth: boolean) => {
      if (!step) return;
      const targetEl = document.querySelector(step.target) || document.body;
      const spotlight = spotlightRef.current;
      const tooltip = tooltipRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (spotlight) {
        if (targetEl === document.body) {
          spotlight.style.display = "none";
        } else {
          const rect = targetEl.getBoundingClientRect();
          const pad = 6;
          const clampedLeft = Math.max(4, rect.left - pad);
          const clampedWidth = Math.min(vw - clampedLeft - 4, rect.width + pad * 2);
          spotlight.style.transition = smooth
            ? "top 260ms cubic-bezier(0.16, 1, 0.3, 1), left 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1), height 260ms cubic-bezier(0.16, 1, 0.3, 1)"
            : "none";
          spotlight.style.display = "block";
          spotlight.style.top = `${Math.max(4, rect.top - pad)}px`;
          spotlight.style.left = `${clampedLeft}px`;
          spotlight.style.width = `${Math.max(24, clampedWidth)}px`;
          spotlight.style.height = `${Math.max(24, rect.height + pad * 2)}px`;
          spotlight.style.borderRadius = window.getComputedStyle(targetEl).borderRadius || "8px";
        }
      }

      if (tooltip) {
        const tooltipRect = tooltip.getBoundingClientRect();
        const margin = 12;
        const isMobile = vw < 640;

        tooltip.style.transition = smooth
          ? "top 260ms cubic-bezier(0.16, 1, 0.3, 1), left 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease"
          : "none";

        const rect = targetEl.getBoundingClientRect();

        if (isMobile) {
          const tooltipWidth = Math.min(340, vw - 24);
          const tooltipHeight = tooltipRect.height || 180;

          let top = 0;
          if (rect.bottom + tooltipHeight + 16 < vh) {
            top = rect.bottom + 12;
          } else if (rect.top - tooltipHeight - 16 > 64) {
            top = rect.top - tooltipHeight - 12;
          } else {
            const spaceBelow = vh - rect.bottom;
            const spaceAbove = rect.top - 64;
            if (spaceBelow >= spaceAbove) {
              top = Math.min(vh - tooltipHeight - 12, rect.bottom + 8);
            } else {
              top = Math.max(64, rect.top - tooltipHeight - 8);
            }
          }

          const left = Math.max(12, Math.min(vw - tooltipWidth - 12, (vw - tooltipWidth) / 2));
          tooltip.style.position = "fixed";
          tooltip.style.top = `${Math.round(top)}px`;
          tooltip.style.left = `${Math.round(left)}px`;
          tooltip.style.width = `${tooltipWidth}px`;
          return;
        }

        const tooltipWidth = Math.min(360, vw - 24);
        const tooltipHeight = tooltipRect.height || 180;
        let top = 0;
        let left = 0;

        if (step.placement === "bottom") {
          top = rect.bottom + margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (step.placement === "top") {
          top = rect.top - tooltipHeight - margin;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else if (step.placement === "left") {
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - margin;
        } else {
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + margin;
        }

        left = Math.max(margin, Math.min(left, vw - tooltipWidth - margin));
        if (top < margin) {
          top = rect.bottom + margin;
        } else if (top + tooltipHeight > vh - margin) {
          top = Math.max(margin, rect.top - tooltipHeight - margin);
        }

        tooltip.style.position = "fixed";
        tooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.width = `${tooltipWidth}px`;
      }
    },
    [step]
  );

  useEffect(() => {
    if (isActive) {
      setStepIndex(0);
    } else if (activeTargetRef.current) {
      activeTargetRef.current.classList.remove("tour-active-target");
      activeTargetRef.current = null;
    }
  }, [isActive]);

  useLayoutEffect(() => {
    if (!isActive || !step) return;

    const targetEl = document.querySelector(step.target) || document.body;
    if (activeTargetRef.current) {
      activeTargetRef.current.classList.remove("tour-active-target");
    }
    activeTargetRef.current = targetEl !== document.body ? targetEl : null;
    if (activeTargetRef.current) {
      activeTargetRef.current.classList.add("tour-active-target");
    }

    const pos = targetEl !== document.body ? window.getComputedStyle(targetEl).position : "static";
    if (targetEl !== document.body && pos !== "fixed" && pos !== "sticky") {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    const timer = setTimeout(() => {
      positionElements(true);
    }, 120);

    return () => {
      clearTimeout(timer);
      if (activeTargetRef.current) {
        activeTargetRef.current.classList.remove("tour-active-target");
        activeTargetRef.current = null;
      }
    };
  }, [isActive, step, positionElements]);

  useEffect(() => {
    if (!isActive) return;

    let animId: number | null = null;
    const handleScroll = () => {
      if (animId) return;
      animId = requestAnimationFrame(() => {
        animId = null;
        positionElements(false);
      });
    };

    const handleResize = () => positionElements(false);

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onStop();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (stepIndex < ONBOARDING_STEPS.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          onStop();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stepIndex > 0) {
          setStepIndex((i) => i - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleResize);
    };
  }, [isActive, stepIndex, onStop, positionElements]);

  if (!isActive || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  return (
    <>
      <div className="tour-overlay" onClick={onStop} />
      <div className="tour-spotlight" ref={spotlightRef} />
      <div
        className="tour-tooltip rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-4 sm:p-5 shadow-2xl"
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono-num text-xs font-semibold text-blue-600 dark:text-blue-400">
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Skip tour"
            title="Skip tour"
            onClick={onStop}
          >
            <X size={14} />
          </button>
        </div>

        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{step.title}</h4>
        <p className="mt-1.5 mb-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {step.text}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {ONBOARDING_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex
                    ? "w-3.5 bg-blue-600 dark:bg-blue-500"
                    : "w-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isFirst ? (
              <button
                type="button"
                className="h-8 rounded-md border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                id="btnTourPrev"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                className="h-8 rounded-md border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                id="btnTourSkip"
                onClick={onStop}
              >
                Skip
              </button>
            )}
            <button
              type="button"
              className="h-8 rounded-md bg-blue-600 hover:bg-blue-700 px-3.5 text-xs font-semibold text-white transition-colors"
              id="btnTourNext"
              onClick={() => {
                if (isLast) {
                  onStop();
                } else {
                  setStepIndex((i) => i + 1);
                }
              }}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
