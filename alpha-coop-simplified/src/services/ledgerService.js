// ==========================================================================
//  ALPHA COOP — LEDGER SERVICE & DATA ACCESS LAYER
// ==========================================================================

import { SHEET_API_URL } from "../config/constants.js";
import { AlphaCrypto } from "../crypto/alphaCrypto.js";
import { getActivePin } from "../ui/auth.js";
import {
  parseNumber,
  formatFormNumber,
  formatLedgerDate,
  findKeyVal
} from "../utils/formatters.js";

let localLedgerCache = [
  {
    "s/n": 1,
    "Name": "Akingbade Ademola Thomas",
    "FormNo": "000780",
    "Empl. No": "LIRS/9999",
    "Date": "September 25, 2026",
    "Admin Fee": 0,
    "Entrance Fee": 0,
    "Shares Savings": 100000,
    "Thrift Savings": 1610278,
    "Normal Loan": 80138,
    "Interest": 0,
    "Commodity Loan": 0,
    "LAND Loan": 0,
    "Land Subscription": 0,
    "Fence Subscription": 0,
    "PURCHASE/ASSET FINANCE": 0,
    "Mortgage Subscription": 0,
    gross: 550000,
    coopDed: 25000,
    monthlySavings: 15000,
    totalBank: 0
  },
  {
    "s/n": 2,
    "Name": "Olusegun Demol",
    "FormNo": "000607",
    "Empl. No": "LIRS/9997",
    "Date": "August 31, 2026",
    "Admin Fee": 0,
    "Entrance Fee": 0,
    "Shares Savings": 50000,
    "Thrift Savings": 55000,
    "Normal Loan": 850000,
    "Interest": 30000,
    "Commodity Loan": 150000,
    "LAND Loan": 0,
    "Land Subscription": 0,
    "Fence Subscription": 0,
    "PURCHASE/ASSET FINANCE": 120000,
    "Mortgage Subscription": 0,
    gross: 300000,
    coopDed: 97917,
    monthlySavings: 5000,
    totalBank: 0
  }
];

let prefetchActive = false;

let syncStatus = {
  status: "idle",
  count: localLedgerCache.length,
  lastSync: null,
  source: "default"
};

const syncListeners = new Set();

export function subscribeLedgerSync(fn) {
  syncListeners.add(fn);
  fn(syncStatus);
  return () => syncListeners.delete(fn);
}

function notifySync(update) {
  syncStatus = Object.assign({}, syncStatus, update);
  syncListeners.forEach((fn) => {
    try { fn(syncStatus); } catch (_) {}
  });
}

export function getLedgerSyncStatus() {
  return syncStatus;
}

export function initLedgerCache() {
  const activePin = getActivePin();
  if (!activePin) {
    notifySync({
      status: "idle",
      count: localLedgerCache.length,
      lastSync: null,
      source: "default"
    });
    return;
  }

  try {
    const metaStr = sessionStorage.getItem("alpha_coop_sync_meta") || localStorage.getItem("alpha_coop_sync_meta");
    const meta = metaStr ? JSON.parse(metaStr) : null;
    const storedCipher = sessionStorage.getItem("alpha_coop_encrypted_cache") || localStorage.getItem("alpha_coop_encrypted_cache");
    if (storedCipher) {
      const dec = AlphaCrypto.decrypt(storedCipher, activePin);
      const parsed = JSON.parse(dec);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localLedgerCache = parsed;
        notifySync({
          status: "cached",
          count: parsed.length,
          lastSync: meta?.lastSync || null,
          source: "cache"
        });
      }
    } else {
      notifySync({
        status: "idle",
        count: localLedgerCache.length,
        lastSync: null,
        source: "default"
      });
    }
  } catch (_) { }

  prefetchLedger();
}

export async function prefetchLedger(force = false) {
  const activePin = getActivePin();
  if (!activePin) return { success: false, error: new Error("Desk locked") };
  if (prefetchActive && !force) return;
  prefetchActive = true;
  notifySync({ status: "syncing" });
  try {
    const url = `${SHEET_API_URL}?action=all&pin=${encodeURIComponent(activePin)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.status === "success") {
      let data = null;
      if (json.encrypted && json.payload) {
        const dec = AlphaCrypto.decrypt(json.payload, activePin);
        data = JSON.parse(dec);
        try {
          sessionStorage.setItem("alpha_coop_encrypted_cache", json.payload);
        } catch (_) { }
      } else if (Array.isArray(json.data)) {
        data = json.data;
      }

      if (Array.isArray(data) && data.length > 0) {
        localLedgerCache = data;
        const now = Date.now();
        try {
          sessionStorage.setItem("alpha_coop_sync_meta", JSON.stringify({
            lastSync: now,
            memberCount: data.length,
            status: "fresh"
          }));
        } catch (_) { }
        notifySync({
          status: "fresh",
          count: data.length,
          lastSync: now,
          source: "live"
        });
        return { success: true, count: data.length };
      }
    }
    throw new Error("Invalid ledger response");
  } catch (err) {
    notifySync({
      status: localLedgerCache.length > 2 ? "cached" : "error",
      count: localLedgerCache.length
    });
    return { success: false, error: err };
  } finally {
    prefetchActive = false;
  }
}

export function findMatchingMembers(query, maxResults = 5, fieldHint = null) {
  if (!query) return [];
  const clean = query.trim().toLowerCase();
  const queryDigits = clean.replace(/[^0-9]/g, "");

  const scored = [];

  for (const m of localLedgerCache) {
    const staff = String(findKeyVal(m, ["Empl. No", "Empl No", "staff", "staffId"]) || "").trim().toLowerCase();
    const name = String(findKeyVal(m, ["Name", "name", "Member Name"]) || "").trim().toLowerCase();
    const form = String(findKeyVal(m, ["FormNo", "formNo", "Form No", "form"]) || "").trim().toLowerCase();

    const staffDigits = staff.replace(/[^0-9]/g, "");
    const formDigits = form.replace(/[^0-9]/g, "");

    let score = 0;

    // 1. Staff ID matching (Top priority when fieldHint === "staff" or general search)
    if (staff === clean || (queryDigits && staffDigits && staffDigits === queryDigits)) {
      score = Math.max(score, fieldHint === "staff" ? 100 : 90);
    } else if (queryDigits.length >= 2 && staffDigits && (staffDigits.endsWith(queryDigits) || parseInt(staffDigits, 10) === parseInt(queryDigits, 10))) {
      score = Math.max(score, fieldHint === "staff" ? 85 : 75);
    } else if (clean.length >= 2 && staff.includes(clean)) {
      score = Math.max(score, fieldHint === "staff" ? 70 : 60);
    }

    // 2. Name matching (Top priority when fieldHint === "name")
    if (name === clean) {
      score = Math.max(score, fieldHint === "name" ? 100 : 85);
    } else if (clean.length >= 2 && name.startsWith(clean)) {
      score = Math.max(score, fieldHint === "name" ? 85 : 70);
    } else if (clean.length >= 3 && name.includes(clean)) {
      score = Math.max(score, fieldHint === "name" ? 70 : 55);
    }

    // 3. Form Number matching (Secondary when searching by Staff ID to avoid collisions)
    if (form === clean || (queryDigits && formDigits && formDigits === queryDigits)) {
      score = Math.max(score, fieldHint === "staff" ? 40 : (fieldHint === "form" ? 100 : 50));
    } else if (queryDigits.length >= 2 && formDigits && parseInt(formDigits, 10) === parseInt(queryDigits, 10)) {
      score = Math.max(score, fieldHint === "staff" ? 30 : 45);
    } else if (clean.length >= 3 && form.includes(clean)) {
      score = Math.max(score, fieldHint === "staff" ? 20 : 35);
    }

    if (score > 0) {
      scored.push({ member: m, score });
    }
  }

  // Rank by highest match score first
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map((s) => s.member);
}

export async function fetchMemberByStaffId(staffId) {
  const localMatches = findMatchingMembers(staffId, 1, "staff");
  if (localMatches.length > 0) {
    return { record: localMatches[0], source: "cache" };
  }

  const activePin = getActivePin();
  if (!activePin) {
    return { record: null, source: "locked" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const params = new URLSearchParams({
      staffId: staffId,
      query: staffId,
      pin: activePin
    });
    const url = `${SHEET_API_URL}?${params.toString()}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result && result.status === "success") {
      let record = null;
      if (result.encrypted && result.payload) {
        const dec = AlphaCrypto.decrypt(result.payload, activePin);
        record = JSON.parse(dec);
      } else if (result.data) {
        record = result.data;
      }

      if (record) {
        const recProfile = extractMemberProfile(record);
        if (!localLedgerCache.some((m) => extractMemberProfile(m)?.staff === recProfile?.staff)) {
          localLedgerCache.push(record);
        }
        return { record, source: "remote" };
      }
    }
    return { record: null, source: "remote" };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export function extractMemberProfile(member) {
  if (!member) return null;
  const staff = String(findKeyVal(member, ["Empl. No", "Empl No", "staff", "staffId", "Staff ID"]) || "").trim();
  const name = String(findKeyVal(member, ["Name", "name", "Member Name"]) || "").trim();
  const rawSavings = findKeyVal(member, ["Thrift Savings", "savings", "Savings", "Thrift"]);
  const savings = parseNumber(rawSavings);
  const rawLoan = findKeyVal(member, ["Normal Loan", "loan", "Loan", "existingLoan", "Normal"]);
  const loan = parseNumber(rawLoan);
  const rawCommodity = findKeyVal(member, [
    "Commodity Loan",
    "commodityLoan",
    "existingCommodity",
    "Special Loan",
    "specialLoan",
    "commodity",
    "Commodity"
  ]);
  const rawInterest = findKeyVal(member, [
    "Interest",
    "interest",
    "Commodity Interest",
    "Special Loan Interest"
  ]);
  const commodityPrincipal = member.commodityPrincipal !== undefined
    ? parseNumber(member.commodityPrincipal)
    : parseNumber(rawCommodity);
  const commodityInterest = member.commodityInterest !== undefined
    ? parseNumber(member.commodityInterest)
    : parseNumber(rawInterest);
  const commodity = commodityPrincipal + commodityInterest;
  const rawPurchase = findKeyVal(member, [
    "PURCHASE/ASSET FINANCE",
    "Purchase/Asset Finance",
    "Purchase / Asset Finance",
    "PURCHASE / ASSET FINANCE",
    "PURCHASE",
    "purchase",
    "purchaseLoan",
    "existingPurchase",
    "Asset Finance",
    "Purchase Loan"
  ]);
  const purchase = parseNumber(rawPurchase);
  const rawShares = findKeyVal(member, ["Shares Savings", "Share Savings", "sharesSavings"]);
  const sharesSavings = parseNumber(rawShares);
  const rawLandLoan = findKeyVal(member, ["LAND Loan", "Land Loan", "landLoan"]);
  const landLoan = parseNumber(rawLandLoan);
  const rawForm = findKeyVal(member, ["FormNo", "formNo", "Form No", "form", "Form"]);
  const formNo = formatFormNumber(rawForm);
  const rawDate = findKeyVal(member, ["Date", "date", "asAt"]);
  const asAt = formatLedgerDate(rawDate);

  return {
    name,
    staff,
    savings,
    loan,
    commodity,
    commodityPrincipal,
    commodityInterest,
    purchase,
    sharesSavings,
    landLoan,
    formNo,
    asAt
  };
}
