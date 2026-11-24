export const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycbyuTv4eYcB13B5GD-ug_8swVw05vnFeAfwuqRoTjINe_9U1ToQQP8BJMrpveMJaKZdm/exec";

export const CRYPTO_SALT = "AlphaCoop@Lagos#2026";

// SHA-256 digest of ("AUTH_VERIFY::" + CRYPTO_SALT + "::" + officePin)
export const PIN_VERIFICATION_HASH =
  "9d86706c8b2667aa4ab64531c6d93f7d7ddaf2814a6089f12793b805e69fe105";

export const DEFAULT_DEDUCTION_RATE = 0.40;
export const SWAP_DEDUCTION_RATE = 0.50;
export const DEFAULT_SPECIAL_INTEREST_RATE = 0.20;
export const DEFAULT_MONTHLY_SAVINGS = 10000;
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
