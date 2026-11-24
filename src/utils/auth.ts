import { CRYPTO_SALT, PIN_VERIFICATION_HASH, INACTIVITY_TIMEOUT_MS } from "../config/constants.ts";
import { sha256, toHex } from "../crypto/alphaCrypto.ts";

export function verifyPinDigest(pin: string): boolean {
  if (!pin) return false;
  const candidate = String(pin).trim();
  const digest = toHex(sha256(`AUTH_VERIFY::${CRYPTO_SALT}::${candidate}`));
  return digest === PIN_VERIFICATION_HASH;
}

export function getActivePin(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem("alpha_coop_session_pin") || "";
  } catch {
    return "";
  }
}

export function hasUnlockedSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") !== "true") {
      return false;
    }
    const lastActive = parseInt(sessionStorage.getItem("alpha_coop_last_active") || "0", 10);
    if (lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
      return false;
    }
    return verifyPinDigest(getActivePin());
  } catch {
    return false;
  }
}

export function persistSessionUnlocked(pin: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem("alpha_coop_unlocked", "true");
    sessionStorage.setItem("alpha_coop_last_active", Date.now().toString());
    if (pin) {
      sessionStorage.setItem("alpha_coop_session_pin", pin.trim());
    }
  } catch {
    // ignore storage errors
  }
}

export function touchSessionActivity(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") === "true") {
      sessionStorage.setItem("alpha_coop_last_active", Date.now().toString());
    }
  } catch {
    // ignore storage errors
  }
}

export function isSessionExpired(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") === "true") {
      const lastActive = parseInt(sessionStorage.getItem("alpha_coop_last_active") || "0", 10);
      return lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS;
    }
  } catch {
    return false;
  }
  return false;
}

export function clearSessionAuth(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("alpha_coop_unlocked");
      sessionStorage.removeItem("alpha_coop_last_active");
      sessionStorage.removeItem("alpha_coop_session_pin");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("alpha_coop_encrypted_cache");
      localStorage.removeItem("alpha_coop_sync_meta");
    }
  } catch {
    // ignore storage errors
  }
}
