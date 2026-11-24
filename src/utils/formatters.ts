// Safe recursive-descent math evaluator (no eval or Function constructor)
function parseArithmeticExpression(expr: string): number | null {
  let pos = 0;
  const skipSpaces = () => {
    while (pos < expr.length && expr[pos] === " ") pos++;
  };

  const parseFactor = (): number | null => {
    skipSpaces();
    if (pos >= expr.length) return null;

    if (expr[pos] === "+" || expr[pos] === "-") {
      const sign = expr[pos] === "-" ? -1 : 1;
      pos++;
      const inner = parseFactor();
      return inner === null ? null : sign * inner;
    }

    if (expr[pos] === "(") {
      pos++;
      const inner = parseAddSub();
      skipSpaces();
      if (inner === null || expr[pos] !== ")") return null;
      pos++;
      return inner;
    }

    const start = pos;
    let hasDot = false;
    while (pos < expr.length && (/\d/.test(expr[pos]) || (expr[pos] === "." && !hasDot))) {
      if (expr[pos] === ".") hasDot = true;
      pos++;
    }
    if (pos === start) return null;
    const numStr = expr.slice(start, pos);
    if (numStr === ".") return null;
    const val = Number(numStr);
    return Number.isFinite(val) ? val : null;
  };

  const parseMulDiv = (): number | null => {
    let left = parseFactor();
    if (left === null) return null;
    while (true) {
      skipSpaces();
      const op = expr[pos];
      if (op !== "*" && op !== "/") break;
      pos++;
      const right = parseFactor();
      if (right === null) return null;
      if (op === "/") {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  };

  const parseAddSub = (): number | null => {
    let left = parseMulDiv();
    if (left === null) return null;
    while (true) {
      skipSpaces();
      const op = expr[pos];
      if (op !== "+" && op !== "-") break;
      pos++;
      const right = parseMulDiv();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const result = parseAddSub();
  skipSpaces();
  if (result === null || pos !== expr.length || !Number.isFinite(result)) {
    return null;
  }
  return result;
}

export function evaluateMathExpression(str: string): number | null {
  if (!str) return null;
  const clean = String(str).replace(/,/g, "").trim();
  if (!/[+\-*/]/.test(clean)) return null;
  if (!/^[\d\s+\-*/.()]+$/.test(clean)) return null;
  const res = parseArithmeticExpression(clean);
  if (res !== null && Number.isFinite(res)) {
    return Math.round(res * 100) / 100;
  }
  return null;
}

export const parseNumber = (val: unknown): number => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined || val === "") return 0;
  const str = String(val).replace(/,/g, "").trim();
  const mathVal = evaluateMathExpression(str);
  if (mathVal !== null) return mathVal;
  return Number(str.replace(/[^0-9.-]/g, "")) || 0;
};

export const formatMoney = (val: unknown): string => {
  const num = Math.max(0, Number(val) || 0);
  return (
    "₦" +
    num.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
};

export const formatSignedMoney = (val: unknown): string => {
  const raw = Number(val) || 0;
  const prefix = raw < 0 ? "-₦" : "₦";
  return (
    prefix +
    Math.abs(raw).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
};

export const formatInputDisplay = (val: unknown): string => {
  if (val === "" || val === null || val === undefined) return "";
  const clean = String(val).replace(/[^0-9.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  const whole = Number(parts[0] || 0).toLocaleString("en-US");
  return parts.length > 1 ? `${whole}.${parts[1].slice(0, 2)}` : whole;
};

export function getLastMonthEndDate(): string {
  const now = new Date();
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[prevMonthLastDay.getMonth()]} ${prevMonthLastDay.getDate()}, ${prevMonthLastDay.getFullYear()}`;
}

export function formatFormNumber(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (/^\d+$/.test(str) && str.length < 6) {
    return str.padStart(6, "0");
  }
  return str;
}

export function findKeyVal(obj: Record<string, unknown> | null | undefined, patterns: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  for (const p of patterns) {
    if (obj[p] !== undefined && obj[p] !== null && obj[p] !== "") return obj[p];
  }
  const keys = Object.keys(obj);
  for (const p of patterns) {
    const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanP);
    if (matchKey && obj[matchKey] !== undefined && obj[matchKey] !== null && obj[matchKey] !== "") {
      return obj[matchKey];
    }
  }
  return undefined;
}

export function formatLedgerDate(dateVal: unknown): string {
  if (!dateVal) return getLastMonthEndDate();
  if (typeof dateVal === "string" && /^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  const parsed = new Date(String(dateVal));
  if (!isNaN(parsed.getTime())) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
  }
  return String(dateVal);
}

export function formatAppraisalMoney(val: unknown, forceDecimals = false): string {
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
