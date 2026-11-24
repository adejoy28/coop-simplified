// ==========================================================================
//  ALPHA COOP — NUMBER, CURRENCY & DATE FORMATTING UTILITIES
// ==========================================================================

export function evaluateMathExpression(str) {
  if (!str) return null;
  const clean = String(str).replace(/,/g, "").trim();
  // Check if contains math operators +, -, *, /
  if (!/[+\-*/]/.test(clean)) return null;
  // Strictly allow only numbers, decimal points, spaces, and math operators
  if (!/^[\d\s+\-*/.()]+$/.test(clean)) return null;
  try {
    const res = Function(`"use strict"; return (${clean})`)();
    if (typeof res === "number" && !isNaN(res) && isFinite(res)) {
      return Math.round(res * 100) / 100;
    }
  } catch (_) {}
  return null;
}

export const parseNumber = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val).replace(/,/g, "").trim();
  const mathVal = evaluateMathExpression(str);
  if (mathVal !== null) return mathVal;
  return Number(str.replace(/[^0-9.-]/g, "")) || 0;
};

export const formatMoney = (val) => {
  const num = Math.max(0, Number(val) || 0);
  return (
    "₦" +
    num.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
};

export const formatInputDisplay = (val) => {
  if (val === "" || val === null || val === undefined) return "";
  const clean = String(val).replace(/[^0-9.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  const whole = Number(parts[0] || 0).toLocaleString("en-US");
  return parts.length > 1 ? `${whole}.${parts[1].slice(0, 2)}` : whole;
};

export function getLastMonthEndDate() {
  const now = new Date();
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[prevMonthLastDay.getMonth()]} ${prevMonthLastDay.getDate()}, ${prevMonthLastDay.getFullYear()}`;
}

export function formatFormNumber(val) {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (/^\d+$/.test(str) && str.length < 6) {
    return str.padStart(6, "0");
  }
  return str;
}

export function findKeyVal(obj, patterns) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const p of patterns) {
    if (obj[p] !== undefined && obj[p] !== null && obj[p] !== "") return obj[p];
  }
  const keys = Object.keys(obj);
  for (const p of patterns) {
    const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanP);
    if (matchKey && obj[matchKey] !== undefined && obj[matchKey] !== null && obj[matchKey] !== "") {
      return obj[matchKey];
    }
  }
  return undefined;
}

export function formatLedgerDate(dateVal) {
  if (!dateVal) return getLastMonthEndDate();
  if (typeof dateVal === "string" && /^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  const parsed = new Date(dateVal);
  if (!isNaN(parsed.getTime())) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }
  return String(dateVal);
}

export function formatAppraisalMoney(val, forceDecimals = false) {
  const num = Math.max(0, Number(val) || 0);
  const hasDecimals = Math.abs(num - Math.round(num)) > 0.001;
  const showDec = forceDecimals || hasDecimals;
  return (
    "₦" +
    num.toLocaleString("en-NG", {
      minimumFractionDigits: showDec ? 2 : 0,
      maximumFractionDigits: 2
    })
  );
}
