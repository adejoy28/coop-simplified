// ==========================================================================
//  ALPHA COOP — DOM HELPERS & INPUT BINDINGS
// ==========================================================================

import { parseNumber, formatInputDisplay, evaluateMathExpression } from "./formatters.js";

export function resolveElement(id) {
  return (
    document.getElementById(id) ||
    (id === "inp_existingLoan" ? document.getElementById("inp_loanBal") : null) ||
    (id === "inp_loanBal" ? document.getElementById("inp1_existingLoan") : null) ||
    (id === "resultPanel" ? document.getElementById("outputPanel") : null) ||
    (id === "outputPanel" ? document.getElementById("resultPanel") : null)
  );
}

export function setFieldValue(id, val, onRequestedChange = null) {
  const el = resolveElement(id);
  if (!el) return;
  if (el.classList.contains("money-input")) {
    el.value = formatInputDisplay(val);
  } else {
    el.value = val === undefined || val === null ? "" : val;
  }
  if (id === "inp_requested" && typeof onRequestedChange === "function") {
    onRequestedChange();
  }
}

export function getFieldValue(id) {
  const el = resolveElement(id);
  return el ? el.value : "";
}

export function getFieldNum(id) {
  return parseNumber(getFieldValue(id));
}

export function escapeHtml(val) {
  if (val === undefined || val === null) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function initMoneyInputs() {
  document.querySelectorAll(".money-input").forEach((input) => {
    // When clicking/focusing into the field, reveal formula if one was previously calculated
    input.addEventListener("focus", () => {
      if (input.dataset.calcFormula) {
        input.value = input.dataset.calcFormula;
        input.select();
      }
    });

    input.addEventListener("input", (e) => {
      const val = e.target.value;
      // If user is currently typing a math expression (e.g. 300 + 200), don't strip operators
      if (/[+\-*/]/.test(val)) {
        return;
      }

      // Normal numeric input: clear any previous formula
      delete input.dataset.calcFormula;
      input.removeAttribute("title");

      const cursor = e.target.selectionStart;
      const prevLength = val.length;
      const formatted = formatInputDisplay(val);
      e.target.value = formatted;
      const newLength = formatted.length;
      const newPos = Math.max(0, (cursor || 0) + (newLength - prevLength));
      try {
        e.target.setSelectionRange(newPos, newPos);
      } catch (_) { }
    });

    const evaluateAndFormat = () => {
      const raw = input.value.trim();
      if (!raw) {
        delete input.dataset.calcFormula;
        input.removeAttribute("title");
        return;
      }
      const mathResult = evaluateMathExpression(raw);
      if (mathResult !== null) {
        input.dataset.calcFormula = raw;
        input.title = `Formula: ${raw} = ${formatInputDisplay(mathResult)}`;
        input.value = formatInputDisplay(mathResult);
        // Trigger input event so live calculations and dependent chips update immediately
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        const num = parseNumber(raw);
        input.value = formatInputDisplay(num);
      }
    };

    // On blur (clicking away), evaluate math expression and display sum
    input.addEventListener("blur", evaluateAndFormat);

    // On Enter key, evaluate math expression immediately
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        evaluateAndFormat();
        input.blur();
      }
    });
  });
}
