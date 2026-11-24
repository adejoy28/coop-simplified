// ==========================================================================
//  ALPHA COOP — AUTHENTICATION MODAL, PIN VERIFICATION & AUTO-LOCK
// ==========================================================================

import { CRYPTO_SALT, PIN_VERIFICATION_HASH, INACTIVITY_TIMEOUT_MS } from "../config/constants.js";
import { sha256, toHex } from "../crypto/alphaCrypto.js";

let inactivityTimer = null;
let lastInteractionRecordTime = 0;
let isActivityListenerAttached = false;
let activeSessionPin = "";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "input"];

export function verifyPinDigest(pin) {
  if (!pin) return false;
  const candidate = String(pin).trim();
  const digest = toHex(sha256(`AUTH_VERIFY::${CRYPTO_SALT}::${candidate}`));
  return digest === PIN_VERIFICATION_HASH;
}

export function getActivePin() {
  if (activeSessionPin) return activeSessionPin;
  try {
    return sessionStorage.getItem("alpha_coop_session_pin") || "";
  } catch (_) {
    return "";
  }
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  if (sessionStorage.getItem("alpha_coop_unlocked") === "true") {
    const now = Date.now();
    try {
      sessionStorage.setItem("alpha_coop_last_active", now.toString());
    } catch (_) {}

    inactivityTimer = setTimeout(() => {
      lockDesk();
    }, INACTIVITY_TIMEOUT_MS);
  }
}

function handleUserActivity() {
  const now = Date.now();
  // Throttle writes to sessionStorage to avoid overhead on rapid events like mousemove
  if (now - lastInteractionRecordTime > 2000) {
    lastInteractionRecordTime = now;
    resetInactivityTimer();
  }
}

function checkInactivityExpiry() {
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") === "true") {
      const lastActive = parseInt(sessionStorage.getItem("alpha_coop_last_active") || "0", 10);
      if (lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
        lockDesk();
        return true;
      }
    }
  } catch (_) {}
  return false;
}

export function isDeskUnlocked() {
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") !== "true") {
      return false;
    }
    const lastActive = parseInt(sessionStorage.getItem("alpha_coop_last_active") || "0", 10);
    if (lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
      lockDesk();
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

export function lockDesk() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  activeSessionPin = "";
  try {
    sessionStorage.removeItem("alpha_coop_unlocked");
    sessionStorage.removeItem("alpha_coop_last_active");
    sessionStorage.removeItem("alpha_coop_session_pin");
    localStorage.removeItem("alpha_coop_encrypted_cache");
    localStorage.removeItem("alpha_coop_sync_meta");
  } catch (_) {}

  document.body.classList.add("is-locked");
  document.body.classList.remove("is-unlocked");

  const layer = document.getElementById("authLayer") || document.getElementById("authOverlay");
  if (layer) {
    layer.style.display = "grid";
  }

  const masthead = document.getElementById("masthead");
  const appShell = document.querySelector(".app-shell");
  if (masthead) masthead.setAttribute("inert", "");
  if (appShell) appShell.setAttribute("inert", "");

  const pinInput = document.getElementById("authPin");
  if (pinInput) {
    pinInput.value = "";
    setTimeout(() => pinInput.focus(), 50);
  }
}

export function unlockDesk(enteredPin = "") {
  if (enteredPin) {
    activeSessionPin = String(enteredPin).trim();
  }
  document.body.classList.remove("is-locked");
  document.body.classList.add("is-unlocked");

  const masthead = document.getElementById("masthead");
  const appShell = document.querySelector(".app-shell");
  if (masthead) masthead.removeAttribute("inert");
  if (appShell) appShell.removeAttribute("inert");

  const layer = document.getElementById("authLayer") || document.getElementById("authOverlay");
  if (layer) {
    layer.style.display = "none";
  }
  const errorEl = document.getElementById("authError");
  if (errorEl) {
    errorEl.classList.remove("visible");
    errorEl.style.display = "none";
  }
  try {
    sessionStorage.setItem("alpha_coop_unlocked", "true");
    sessionStorage.setItem("alpha_coop_last_active", Date.now().toString());
    if (activeSessionPin) {
      sessionStorage.setItem("alpha_coop_session_pin", activeSessionPin);
    }
  } catch (_) {}

  // Start 1-hour inactivity countdown
  resetInactivityTimer();

  if (typeof window.onDeskUnlocked === "function") {
    window.onDeskUnlocked();
  }
  if (typeof window.initOnboardingAfterAuth === "function") {
    window.initOnboardingAfterAuth();
  }
}

export function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const pinInput = document.getElementById("authPin");
  const errorEl = document.getElementById("authError");
  const enteredPin = pinInput ? pinInput.value.trim() : "";

  if (verifyPinDigest(enteredPin)) {
    unlockDesk(enteredPin);
  } else {
    if (errorEl) {
      errorEl.classList.add("visible");
      errorEl.style.display = "flex";
    }
    if (pinInput) {
      pinInput.focus();
      pinInput.select();
    }
  }
  return false;
}

export function initAuth() {
  // Attach activity tracking listeners once
  if (!isActivityListenerAttached && typeof window !== "undefined") {
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (!checkInactivityExpiry()) {
          resetInactivityTimer();
        }
      }
    });

    window.addEventListener("focus", () => {
      if (!checkInactivityExpiry()) {
        resetInactivityTimer();
      }
    });

    isActivityListenerAttached = true;
  }

  if (isDeskUnlocked() && verifyPinDigest(getActivePin())) {
    unlockDesk(getActivePin());
  } else {
    lockDesk();
  }

  const authPin = document.getElementById("authPin");
  const authError = document.getElementById("authError");
  if (authPin) {
    authPin.addEventListener("input", (e) => {
      if (authError) {
        authError.classList.remove("visible");
        authError.style.display = "none";
      }
      const val = e.target.value.trim();
      if (verifyPinDigest(val)) {
        unlockDesk(val);
      }
    });
  }
}
