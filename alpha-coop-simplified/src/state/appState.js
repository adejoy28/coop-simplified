// ==========================================================================
//  ALPHA COOP — CENTRALIZED APPLICATION STATE
// ==========================================================================

import { DEFAULT_DEDUCTION_RATE, DEFAULT_SPECIAL_INTEREST_RATE } from "../config/constants.js";

const HISTORY_STORAGE_KEY = "alpha_coop_appraisal_history";
const MAX_HISTORY_ITEMS = 25;

function loadStoredHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveHistoryToStorage(items) {
  try {
    sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch (_) {}
}

const state = {
  facility: "cash", // 'cash' | 'purchase' | 'special' | 'withdrawal'
  withdrawalType: "voluntary", // 'voluntary' | 'retirement'
  specialInterestRate: DEFAULT_SPECIAL_INTEREST_RATE, // 0.20 default, configurable
  purchaseDownPayment: false, // true if down payment active (> 0), false = zero
  downPaymentMode: "zero", // 'zero' | '30' | 'custom_pct' | 'custom_amt'
  downPaymentVal: 0,
  downPaymentCustomType: "pct", // 'pct' | 'amt'
  deductionRate: DEFAULT_DEDUCTION_RATE, // 0.40 | 0.50
  customDeductionRate: null, // number | null e.g. 0.53
  isDurationOverridden: false,
  lastSavingsInput: 10000,
  lastResult: null,
  currentMemberProfile: null,
  history: loadStoredHistory()
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAppraisalHistory() {
  return state.history || [];
}

export function addAppraisalToHistory(record) {
  if (!record) return;
  const current = state.history || [];
  // Avoid immediate duplicate logs for identical calculations
  const filtered = current.filter((item) => {
    const isSameMember = (item.staff && item.staff === record.staff) || (item.name && item.name === record.name);
    const isSameAmount = item.amount === record.amount;
    const isSameFacility = item.facility === record.facility;
    return !(isSameMember && isSameAmount && isSameFacility);
  });
  const updated = [record, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  state.history = updated;
  saveHistoryToStorage(updated);
  listeners.forEach((fn) => fn(state));
  return updated;
}

export function clearAppraisalHistory() {
  state.history = [];
  try {
    sessionStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (_) {}
  listeners.forEach((fn) => fn(state));
}

export function deleteAppraisalFromHistory(id) {
  if (!id) return;
  const updated = (state.history || []).filter((item) => item.id !== id);
  state.history = updated;
  saveHistoryToStorage(updated);
  listeners.forEach((fn) => fn(state));
  return updated;
}
