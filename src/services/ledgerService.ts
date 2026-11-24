import { SHEET_API_URL } from "../config/constants.ts";
import { AlphaCrypto } from "../crypto/alphaCrypto.ts";
import { getActivePin } from "../utils/auth.ts";
import {
  parseNumber,
  formatFormNumber,
  formatLedgerDate,
  findKeyVal
} from "../utils/formatters.ts";
import type { LedgerSyncInfo, MemberProfile, MemberRecord } from "../types/coop.ts";

let localLedgerCache: MemberRecord[] = [
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

let syncStatus: LedgerSyncInfo = {
  status: "idle",
  count: localLedgerCache.length,
  lastSync: null,
  source: "default"
};

const syncListeners = new Set<(info: LedgerSyncInfo) => void>();

export function subscribeLedgerSync(fn: (info: LedgerSyncInfo) => void): () => void {
  syncListeners.add(fn);
  fn(syncStatus);
  return () => {
    syncListeners.delete(fn);
  };
}

function notifySync(update: Partial<LedgerSyncInfo>): void {
  syncStatus = { ...syncStatus, ...update };
  syncListeners.forEach((fn) => {
    try {
      fn(syncStatus);
    } catch {
      // ignore listener errors
    }
  });
}

export function getLedgerSyncStatus(): LedgerSyncInfo {
  return syncStatus;
}

export function initLedgerCache(pinOverride?: string): void {
  const activePin = pinOverride || getActivePin();
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
    const metaStr =
      (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("alpha_coop_sync_meta") : null) ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("alpha_coop_sync_meta") : null);
    const meta = metaStr ? (JSON.parse(metaStr) as { lastSync?: number }) : null;
    const storedCipher =
      (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("alpha_coop_encrypted_cache") : null) ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("alpha_coop_encrypted_cache") : null);

    if (storedCipher) {
      const dec = AlphaCrypto.decrypt(storedCipher, activePin);
      const parsed = JSON.parse(dec);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localLedgerCache = parsed as MemberRecord[];
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
  } catch {
    // ignore invalid cache
  }

  void prefetchLedger(false, activePin);
}

export async function prefetchLedger(
  force = false,
  pinOverride?: string
): Promise<{ success: boolean; count?: number; error?: unknown } | undefined> {
  const activePin = pinOverride || getActivePin();
  if (!activePin) return { success: false, error: new Error("Desk locked") };
  if (prefetchActive && !force) return undefined;
  prefetchActive = true;
  notifySync({ status: "syncing" });
  try {
    const url = `${SHEET_API_URL}?action=all&pin=${encodeURIComponent(activePin)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      status?: string;
      encrypted?: boolean;
      payload?: string;
      data?: MemberRecord[];
    };
    if (json && json.status === "success") {
      let data: MemberRecord[] | null = null;
      if (json.encrypted && json.payload) {
        const dec = AlphaCrypto.decrypt(json.payload, activePin);
        data = JSON.parse(dec) as MemberRecord[];
        try {
          sessionStorage.setItem("alpha_coop_encrypted_cache", json.payload);
        } catch {
          // ignore
        }
      } else if (Array.isArray(json.data)) {
        data = json.data;
      }

      if (Array.isArray(data) && data.length > 0) {
        localLedgerCache = data;
        const now = Date.now();
        try {
          sessionStorage.setItem(
            "alpha_coop_sync_meta",
            JSON.stringify({
              lastSync: now,
              memberCount: data.length,
              status: "fresh"
            })
          );
        } catch {
          // ignore
        }
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

export function findMatchingMembers(
  query: string,
  maxResults = 5,
  fieldHint: "staff" | "name" | "form" | null = null
): MemberRecord[] {
  if (!query) return [];
  const clean = query.trim().toLowerCase();
  const queryDigits = clean.replace(/[^0-9]/g, "");

  const scored: Array<{ member: MemberRecord; score: number }> = [];

  for (const m of localLedgerCache) {
    const staff = String(findKeyVal(m, ["Empl. No", "Empl No", "staff", "staffId"]) || "")
      .trim()
      .toLowerCase();
    const name = String(findKeyVal(m, ["Name", "name", "Member Name"]) || "")
      .trim()
      .toLowerCase();
    const form = String(findKeyVal(m, ["FormNo", "formNo", "Form No", "form"]) || "")
      .trim()
      .toLowerCase();

    const staffDigits = staff.replace(/[^0-9]/g, "");
    const formDigits = form.replace(/[^0-9]/g, "");

    let score = 0;

    if (staff === clean || (queryDigits && staffDigits && staffDigits === queryDigits)) {
      score = Math.max(score, fieldHint === "staff" ? 100 : 90);
    } else if (
      queryDigits.length >= 2 &&
      staffDigits &&
      (staffDigits.endsWith(queryDigits) || parseInt(staffDigits, 10) === parseInt(queryDigits, 10))
    ) {
      score = Math.max(score, fieldHint === "staff" ? 85 : 75);
    } else if (clean.length >= 2 && staff.includes(clean)) {
      score = Math.max(score, fieldHint === "staff" ? 70 : 60);
    }

    if (name === clean) {
      score = Math.max(score, fieldHint === "name" ? 100 : 85);
    } else if (clean.length >= 2 && name.startsWith(clean)) {
      score = Math.max(score, fieldHint === "name" ? 85 : 70);
    } else if (clean.length >= 3 && name.includes(clean)) {
      score = Math.max(score, fieldHint === "name" ? 70 : 55);
    }

    if (form === clean || (queryDigits && formDigits && formDigits === queryDigits)) {
      score = Math.max(score, fieldHint === "staff" ? 40 : fieldHint === "form" ? 100 : 50);
    } else if (queryDigits.length >= 2 && formDigits && parseInt(formDigits, 10) === parseInt(queryDigits, 10)) {
      score = Math.max(score, fieldHint === "staff" ? 30 : 45);
    } else if (clean.length >= 3 && form.includes(clean)) {
      score = Math.max(score, fieldHint === "staff" ? 20 : 35);
    }

    if (score > 0) {
      scored.push({ member: m, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map((s) => s.member);
}

export async function fetchMemberByStaffId(
  staffId: string,
  pinOverride?: string
): Promise<{ record: MemberRecord | null; source: string }> {
  const localMatches = findMatchingMembers(staffId, 1, "staff");
  if (localMatches.length > 0) {
    return { record: localMatches[0], source: "cache" };
  }

  const activePin = pinOverride || getActivePin();
  if (!activePin) {
    return { record: null, source: "locked" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const params = new URLSearchParams({
      staffId,
      query: staffId,
      pin: activePin
    });
    const url = `${SHEET_API_URL}?${params.toString()}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = (await response.json()) as {
      status?: string;
      encrypted?: boolean;
      payload?: string;
      data?: MemberRecord;
    };

    if (result && result.status === "success") {
      let record: MemberRecord | null = null;
      if (result.encrypted && result.payload) {
        const dec = AlphaCrypto.decrypt(result.payload, activePin);
        record = JSON.parse(dec) as MemberRecord;
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

export function extractMemberProfile(member: MemberRecord | null | undefined): MemberProfile | null {
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
