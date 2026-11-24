// ==========================================================================
//  ALPHA COOP SIMPLIFIED — DESK UNDERWRITING ENGINE & CONTROLLER
// ==========================================================================

const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyuTv4eYcB13B5GD-ug_8swVw05vnFeAfwuqRoTjINe_9U1ToQQP8BJMrpveMJaKZdm/exec";
const EXPECTED_PIN = "2026";

let currentFacility = "cash"; // 'cash' | 'purchase'
let purchaseDownPayment = false; // true = 30%, false = 0%
let deductionRate = 0.40; // 0.40 (40% default) | 0.50 (50% swappable)
let isDurationOverridden = false; // tracks if user manually overwrote tiered duration
let lastResult = null;
let currentMemberProfile = null;

// --------------------------------------------------------------------------
// TIERED DURATION RULES (by Requested Amount)
// <50k => 3m | 51k–200k => 12m | 201k–599k => 18m | 600k+ => 24m (default)
// --------------------------------------------------------------------------
function getTieredDuration(requestedAmount) {
  const req = Math.max(0, Number(requestedAmount) || 0);
  if (req < 50000) return 3;
  if (req <= 200000) return 12;
  if (req < 600000) return 18;
  return 24;
}

function updateTieredDuration(force = false) {
  if (currentFacility !== "cash") return;
  const requested = getFieldNum("inp_requested");
  const recommended = requested > 0 ? getTieredDuration(requested) : 3;
  const inpDuration = document.getElementById("inp_duration");

  if (!isDurationOverridden || force) {
    isDurationOverridden = false;
    if (inpDuration) {
      inpDuration.value = recommended;
    }
  }
}

function restoreTierDuration() {
  if (currentFacility !== "cash") return;
  isDurationOverridden = false;
  updateTieredDuration(true);
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_requested") > 0) {
    calculateEligibility();
  }
}

function applyCounterOffer(amount) {
  setFieldValue("inp_requested", amount);
  isDurationOverridden = false;
  updateTieredDuration(true);
  calculateEligibility();
  const panel = resolveElement("resultPanel");
  if (panel) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// --------------------------------------------------------------------------
// DEDUCTION CAP SWITCH & CUSTOM CAP OVERRIDE
// --------------------------------------------------------------------------
function setDeductionCap(rate) {
  deductionRate = rate;
  const btn40 = document.getElementById("btnCap40");
  const btn50 = document.getElementById("btnCap50");
  const customBadge = document.getElementById("customCapBadge");
  const btnCustom = document.getElementById("btnCapCustom");
  if (customBadge) customBadge.style.display = "none";
  if (btnCustom) btnCustom.classList.remove("active");

  if (btn40 && btn50) {
    if (rate === 0.50) {
      btn50.classList.add("active");
      btn40.classList.remove("active");
    } else {
      btn40.classList.add("active");
      btn50.classList.remove("active");
    }
  }

  const mastheadCap = document.getElementById("mastheadCapLabel");
  if (mastheadCap) {
    mastheadCap.textContent = `Deduction ${Math.round(rate * 100)}%`;
  }

  // Recalculate if result or input exists
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

function toggleCustomCapInput(forceShow) {
  const popover = document.getElementById("customCapPopover");
  const input = document.getElementById("inp_customCap");
  if (!popover) return;
  const isHidden = popover.style.display === "none" || popover.style.display === "";
  const show = forceShow !== undefined ? forceShow : isHidden;
  popover.style.display = show ? "block" : "none";
  if (show && input) {
    input.value = Math.round(deductionRate * 100);
    input.focus();
    input.select();
  }
}

function applyCustomCap() {
  const input = document.getElementById("inp_customCap");
  if (!input) return;
  const raw = Number(input.value);
  if (isNaN(raw) || raw < 5 || raw > 95) {
    input.focus();
    return;
  }
  const rate = Math.round(raw) / 100;
  deductionRate = rate;

  const btn40 = document.getElementById("btnCap40");
  const btn50 = document.getElementById("btnCap50");
  btn40?.classList.remove("active");
  btn50?.classList.remove("active");

  const btnCustom = document.getElementById("btnCapCustom");
  btnCustom?.classList.add("active");

  const customBadge = document.getElementById("customCapBadge");
  const customBadgeText = document.getElementById("customCapBadgeText");
  if (customBadge && customBadgeText) {
    customBadgeText.textContent = `${Math.round(rate * 100)}%`;
    customBadge.style.display = "inline-flex";
  }

  toggleCustomCapInput(false);

  const mastheadCap = document.getElementById("mastheadCapLabel");
  if (mastheadCap) {
    mastheadCap.textContent = `Deduction ${Math.round(rate * 100)}%`;
  }

  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

function resetCustomCap() {
  setDeductionCap(0.40);
}

// Preset Scenarios
const scenarios = {
  cash: [
    {
      label: "Eligible loan",
      tone: "good",
      data: {
        name: "KAYODE BALOGUN",
        staff: "EMP-1021",
        FormNo: "001021",
        gross: 650000,
        savings: 500000,
        existingLoan: 150000,
        totalBank: 210000,
        coopDed: 80000,
        monthlySavings: 15000,
        otherDed: 0,
        requested: 600000,
        duration: 18,
        inquiry: false
      }
    },
    {
      label: "Savings limit fail",
      tone: "bad",
      data: {
        name: "EMEKA NWOSU",
        staff: "EMP-3042",
        FormNo: "003042",
        gross: 550000,
        savings: 200000,
        existingLoan: 100000,
        totalBank: 190000,
        coopDed: 50000,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 800000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Payslip deduction fail",
      tone: "bad",
      data: {
        name: "YUSUF MOHAMMED",
        staff: "EMP-4180",
        FormNo: "004180",
        gross: 400000,
        savings: 800000,
        existingLoan: 0,
        totalBank: 130000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 600000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "New deductions exceed cap",
      tone: "bad",
      data: {
        name: "SEGUN ADEWALE",
        staff: "EMP-5520",
        FormNo: "005520",
        gross: 320000,
        savings: 500000,
        existingLoan: 0,
        totalBank: 140000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 250000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Zero payout",
      tone: "bad",
      data: {
        name: "AISHA BELLO",
        staff: "EMP-5198",
        FormNo: "005198",
        gross: 600000,
        savings: 450000,
        existingLoan: 380000,
        totalBank: 120000,
        coopDed: 0,
        monthlySavings: 15000,
        otherDed: 0,
        requested: 200000,
        duration: 12,
        inquiry: false
      }
    },
    {
      label: "Capacity inquiry",
      tone: "neutral",
      data: {
        name: "TOLU OGUNLEWE",
        staff: "EMP-6004",
        FormNo: "006004",
        gross: 700000,
        savings: 600000,
        existingLoan: 200000,
        totalBank: 220000,
        coopDed: 90000,
        monthlySavings: 20000,
        otherDed: 0,
        requested: "",
        duration: 24,
        inquiry: true
      }
    }
  ],
  purchase: [
    {
      label: "Phone purchase (VIHO)",
      tone: "good",
      data: {
        name: "Olusegun VIHO",
        staff: "LIRS/0607",
        FormNo: "000607",
        gross: 300000,
        savings: 55000,
        existingLoan: 850000,
        totalBank: 0,
        coopDed: 97917,
        monthlySavings: 5000,
        otherDed: 0,
        requested: 110000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Eligible · zero down",
      tone: "good",
      data: {
        name: "CHINAZA EZE",
        staff: "EMP-7110",
        FormNo: "007110",
        gross: 580000,
        savings: 450000,
        existingLoan: 100000,
        totalBank: 180000,
        requested: 320000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Eligible · 30% down",
      tone: "good",
      data: {
        name: "CHINAZA EZE",
        staff: "EMP-7110",
        FormNo: "007110",
        gross: 580000,
        savings: 450000,
        existingLoan: 100000,
        totalBank: 180000,
        requested: 600000,
        duration: 9,
        downPayment: true,
        inquiry: false
      }
    },
    {
      label: "Payslip deduction fail",
      tone: "bad",
      data: {
        name: "IBRAHIM DANLADI",
        staff: "EMP-6731",
        FormNo: "006731",
        gross: 350000,
        savings: 600000,
        existingLoan: 0,
        totalBank: 110000,
        coopDed: 0,
        monthlySavings: 10000,
        otherDed: 0,
        requested: 450000,
        duration: 9,
        downPayment: false,
        inquiry: false
      }
    },
    {
      label: "Counter offer",
      tone: "bad",
      data: {
        name: "BABATUNDE ALAO",
        staff: "EMP-8245",
        FormNo: "008245",
        gross: 420000,
        savings: 220000,
        existingLoan: 60000,
        totalBank: 140000,
        requested: 850000,
        duration: 9,
        downPayment: true,
        inquiry: false
      }
    },
    {
      label: "Purchase capacity",
      tone: "neutral",
      data: {
        name: "FUNKE ADELEKE",
        staff: "EMP-9031",
        FormNo: "009031",
        gross: 640000,
        savings: 500000,
        existingLoan: 100000,
        totalBank: 190000,
        requested: "",
        duration: 9,
        downPayment: true,
        inquiry: true
      }
    }
  ]
};

// --------------------------------------------------------------------------
// FORMATTING HELPERS
// --------------------------------------------------------------------------
const parseNumber = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  return Number(String(val).replace(/,/g, "")) || 0;
};

const formatMoney = (val) => {
  const num = Math.max(0, Number(val) || 0);
  return "₦" + num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

function getLastMonthEndDate() {
  const now = new Date();
  const prevMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${monthNames[prevMonthLastDay.getMonth()]} ${prevMonthLastDay.getDate()}, ${prevMonthLastDay.getFullYear()}`;
}

function formatFormNumber(val) {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).trim();
  if (/^\d+$/.test(str) && str.length < 6) {
    return str.padStart(6, "0");
  }
  return str;
}

function findKeyVal(obj, patterns) {
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

function formatLedgerDate(dateVal) {
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

const formatInputDisplay = (val) => {
  if (val === "" || val === null || val === undefined) return "";
  const clean = String(val).replace(/[^0-9.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  const whole = Number(parts[0] || 0).toLocaleString("en-US");
  return parts.length > 1 ? `${whole}.${parts[1].slice(0, 2)}` : whole;
};

// Bind auto-formatter on input
function initMoneyInputs() {
  document.querySelectorAll(".money-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const cursor = e.target.selectionStart;
      const prevLength = e.target.value.length;
      const formatted = formatInputDisplay(e.target.value);
      e.target.value = formatted;
      const newLength = formatted.length;
      const newPos = Math.max(0, (cursor || 0) + (newLength - prevLength));
      try {
        e.target.setSelectionRange(newPos, newPos);
      } catch (_) { }
    });
  });
}

function resolveElement(id) {
  return (
    document.getElementById(id) ||
    (id === "inp_existingLoan" ? document.getElementById("inp_loanBal") : null) ||
    (id === "inp_loanBal" ? document.getElementById("inp_existingLoan") : null) ||
    (id === "resultPanel" ? document.getElementById("outputPanel") : null) ||
    (id === "outputPanel" ? document.getElementById("resultPanel") : null)
  );
}

function setFieldValue(id, val) {
  const el = resolveElement(id);
  if (!el) return;
  if (el.classList.contains("money-input")) {
    el.value = formatInputDisplay(val);
  } else {
    el.value = val === undefined || val === null ? "" : val;
  }
  if (id === "inp_requested" && currentFacility === "cash" && !isDurationOverridden) {
    updateTieredDuration();
  }
}

function getFieldValue(id) {
  const el = resolveElement(id);
  return el ? el.value : "";
}

function getFieldNum(id) {
  return parseNumber(getFieldValue(id));
}

// --------------------------------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------------------------------
function unlockDesk() {
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
  } catch (_) { }
}

function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const pinInput = document.getElementById("authPin");
  const errorEl = document.getElementById("authError");
  const enteredPin = pinInput ? pinInput.value.trim() : "";

  if (enteredPin === EXPECTED_PIN) {
    unlockDesk();
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

// Backward-compatibility alias for legacy onsubmit handlers
function verifyPin(e) {
  return handleAuthSubmit(e);
}


// --------------------------------------------------------------------------
// FACILITY SWITCHING & SCENARIO CAROUSEL
// --------------------------------------------------------------------------
function switchFacility(type) {
  currentFacility = type;
  const btnCash = document.getElementById("btnTabCash");
  const btnPurchase = document.getElementById("btnTabPurchase");
  const panelSubtitle = document.getElementById("panelSubtitle");
  const cashCoopDed = document.getElementById("cashCoopDedWrap");
  const cashOtherDed = document.getElementById("cashOtherDeductionsSection");
  const purchaseDp = document.getElementById("purchaseDownPaymentWrap");
  const labelRequested = document.getElementById("labelRequested");
  const labelDuration = document.getElementById("labelDuration");
  const inpDuration = document.getElementById("inp_duration");

  // Push active facility state subtly into the sticky nav bar
  const navFacilityText = document.getElementById("navFacilityText");
  const navFacilityBadge = document.getElementById("navFacilityBadge");
  if (navFacilityText) {
    navFacilityText.textContent = type === "cash" ? "Cash loan" : "Purchase";
  }
  if (navFacilityBadge) {
    navFacilityBadge.className = "nav-facility-badge " + type;
    navFacilityBadge.title = "Active facility: " + (type === "cash" ? "Cash loan" : "Purchase") + " (Click to toggle)";
  }

  if (type === "cash") {
    btnCash.classList.add("active");
    btnPurchase.classList.remove("active");
    panelSubtitle.textContent = "Cash loan request";
    if (cashCoopDed) cashCoopDed.style.display = "grid";
    if (cashOtherDed) cashOtherDed.style.display = "block";
    purchaseDp.style.display = "none";
    labelRequested.textContent = "Amount requested (₦)";
    labelDuration.textContent = "Duration (1–24 months)";
    if (inpDuration) {
      inpDuration.min = "1";
      inpDuration.max = "24";
      const curDur = Number(inpDuration.value) || 0;
      if (curDur <= 0 || curDur > 24) {
        inpDuration.value = "3";
      }
    }
    if (!isDurationOverridden) {
      updateTieredDuration();
    }
  } else {
    btnPurchase.classList.add("active");
    btnCash.classList.remove("active");
    panelSubtitle.textContent = "Purchase request";
    if (cashCoopDed) cashCoopDed.style.display = "grid";
    if (cashOtherDed) cashOtherDed.style.display = "block";
    purchaseDp.style.display = "block";
    labelRequested.textContent = "Purchase amount (₦)";
    labelDuration.textContent = "Duration (1–9 months)";
    if (inpDuration) {
      inpDuration.min = "1";
      inpDuration.max = "9";
      const curDur = Number(inpDuration.value) || 0;
      if (curDur <= 0 || curDur > 9) {
        inpDuration.value = "9";
      }
    }
  }

  renderScenarios();

  // Rerun eligibility if ran before. If not, maintain tab display profiling.
  if (lastResult) {
    calculateEligibility();
  } else if (currentMemberProfile) {
    renderMemberProfile(currentMemberProfile);
  }
}

function toggleFacilityQuick() {
  const next = currentFacility === "cash" ? "purchase" : "cash";
  switchFacility(next);
}

function setDownPayment(enabled) {
  purchaseDownPayment = enabled;
  const btn30 = document.getElementById("btnDp30");
  const btnZero = document.getElementById("btnDpZero");
  if (enabled) {
    btn30.classList.add("active");
    btnZero.classList.remove("active");
  } else {
    btnZero.classList.add("active");
    btn30.classList.remove("active");
  }
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

function toggleInquiryMode() {
  const isChecked = document.getElementById("chk_inquiry").checked;
  const reqInput = document.getElementById("inp_requested");
  if (isChecked) {
    reqInput.value = "";
    reqInput.disabled = true;
    reqInput.placeholder = "Capacity mode (calculated automatically)";
  } else {
    reqInput.disabled = false;
    reqInput.placeholder = "Enter amount";
  }
  if (lastResult || getFieldNum("inp_gross") > 0 || getFieldNum("inp_savings") > 0) {
    calculateEligibility();
  }
}

// --------------------------------------------------------------------------
// APPLE FLUID DIRECT MANIPULATION & MOMENTUM SCROLL FOR SCENARIOS
// --------------------------------------------------------------------------
function initFluidScenarioScroll() {
  const scroller = document.getElementById("scenarioScroll");
  if (!scroller || scroller.dataset.fluidInit) return;
  scroller.dataset.fluidInit = "true";

  let isPointerDown = false;
  let startX = 0;
  let scrollStart = 0;
  let hasDragged = false;
  let history = [];
  let animId = null;

  scroller.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (animId) cancelAnimationFrame(animId);

    isPointerDown = true;
    hasDragged = false;
    startX = e.clientX;
    scrollStart = scroller.scrollLeft;
    history = [{ x: e.clientX, t: performance.now() }];
    scroller.style.scrollBehavior = "auto";
  });

  window.addEventListener("pointermove", (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) {
      hasDragged = true;
    }
    scroller.scrollLeft = scrollStart - dx;

    const now = performance.now();
    history.push({ x: e.clientX, t: now });
    while (history.length > 1 && now - history[0].t > 100) {
      history.shift();
    }
  });

  const endDrag = () => {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (hasDragged) {
      let velocity = 0;
      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const dt = newest.t - oldest.t;
        if (dt > 10) {
          velocity = (oldest.x - newest.x) / (dt / 1000);
        }
      }

      // Apple exponential momentum decay
      const decelerationRate = 0.992;
      let currentVelocity = velocity;

      function stepMomentum() {
        if (Math.abs(currentVelocity) < 15) return;
        scroller.scrollLeft += currentVelocity * (16 / 1000);
        currentVelocity *= decelerationRate;
        animId = requestAnimationFrame(stepMomentum);
      }

      if (Math.abs(velocity) > 60) {
        animId = requestAnimationFrame(stepMomentum);
      }
    }
  };

  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // Prevent accidental activation of scenario click if pointer dragged
  scroller.addEventListener(
    "click",
    (e) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    },
    true
  );
}

function renderScenarios() {
  const container = document.getElementById("scenarioScroll");
  if (!container) return;
  const list = scenarios[currentFacility] || [];

  container.innerHTML = list
    .map(
      (item, idx) => `
      <button class="scenario" type="button" onclick="loadScenario(${idx})">
        <span class="scenario-dot ${item.tone}"></span>
        <span>${item.label}</span>
      </button>
    `
    )
    .join("");

  initFluidScenarioScroll();
}

function loadScenario(arg) {
  let d = null;
  if (typeof arg === "number") {
    const scenario = scenarios[currentFacility]?.[arg];
    d = scenario ? scenario.data : null;
  } else if (arg && typeof arg === "object") {
    d = arg.data || arg;
  }
  if (!d) return;

  setFieldValue("inp_name", d.name || "");
  setFieldValue("inp_staff", d.staff || "");
  setFieldValue("inp_gross", d.gross || 0);
  setFieldValue("inp_savings", d.savings || 0);
  setFieldValue("inp_existingLoan", d.existingLoan !== undefined ? d.existingLoan : (d.loanBal || 0));
  setFieldValue("inp_totalBank", d.totalBank || 0);
  setFieldValue("inp_duration", d.duration || (currentFacility === "cash" ? 3 : 9));

  setFieldValue("inp_coopDed", d.coopDed || 0);
  setFieldValue("inp_monthlySavings", d.monthlySavings || 0);
  setFieldValue("inp_otherDed", d.otherDed || 0);

  if (currentFacility === "purchase") {
    setDownPayment(Boolean(d.downPayment !== undefined ? d.downPayment : d.dp));
  }

  const inquiryCheck = document.getElementById("chk_inquiry");
  if (inquiryCheck) {
    inquiryCheck.checked = Boolean(d.inquiry);
    toggleInquiryMode();
  }

  if (!d.inquiry) {
    setFieldValue("inp_requested", d.requested || "");
  }

  hideLookupStatus();
  calculateEligibility();
}

function resetForm() {
  setFieldValue("inp_name", "");
  setFieldValue("inp_staff", "");
  setFieldValue("inp_gross", "");
  setFieldValue("inp_savings", "");
  setFieldValue("inp_existingLoan", "");
  setFieldValue("inp_totalBank", "");
  setFieldValue("inp_coopDed", "");
  setFieldValue("inp_monthlySavings", "10,000");
  setFieldValue("inp_otherDed", "");
  setFieldValue("inp_requested", "");

  isDurationOverridden = false;
  if (currentFacility === "cash" && !isDurationOverridden) {
    updateTieredDuration();
  } else if (currentFacility === "purchase") {
    setFieldValue("inp_duration", "9");
  } else {
    setFieldValue("inp_duration", "3");
  }

  const inquiryCheck = document.getElementById("chk_inquiry");
  if (inquiryCheck) inquiryCheck.checked = false;
  toggleInquiryMode();
  setDownPayment(false);
  setDeductionCap(0.40);
  hideLookupStatus();

  lastResult = null;
  currentMemberProfile = null;
  renderEmptyResult();
}

// --------------------------------------------------------------------------
// CRYPTOGRAPHIC ENGINE (ChaCha20 + SHA-256 in pure JS)
// --------------------------------------------------------------------------
const AlphaCrypto = (function () {
  function sha256(str) {
    function rotr(n, s) { return (n >>> s) | (n << (32 - s)); }
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0x0bef9a3f, 0xc67178f2
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var b = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
      else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
    }
    var l = b.length * 8;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0);
    for (var i = 7; i >= 0; i--) b.push((l >>> (i * 8)) & 255);
    for (var i = 0; i < b.length; i += 64) {
      var w = new Int32Array(64);
      for (var j = 0; j < 16; j++) {
        w[j] = (b[i + j * 4] << 24) | (b[i + j * 4 + 1] << 16) | (b[i + j * 4 + 2] << 8) | (b[i + j * 4 + 3]);
      }
      for (var j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = H[0], e = H[1], c_ = H[2], d = H[3], e_ = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var S1 = rotr(e_, 6) ^ rotr(e_, 11) ^ rotr(e_, 25);
        var ch = (e_ & f) ^ ((~e_) & g);
        var temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & e) ^ (a & c_) ^ (e & c_);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e_; e_ = (d + temp1) | 0;
        d = c_; c_ = e; e = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + e) | 0; H[2] = (H[2] + c_) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e_) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var res = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      res[i * 4] = (H[i] >>> 24) & 255; res[i * 4 + 1] = (H[i] >>> 16) & 255;
      res[i * 4 + 2] = (H[i] >>> 8) & 255; res[i * 4 + 3] = H[i] & 255;
    }
    return res;
  }

  function chacha20(keyBytes, nonceBytes, counter, inputBytes) {
    function rotl(a, b) { return ((a << b) | (a >>> (32 - b))) | 0; }
    function qr(s, a, b, c, d) {
      s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 16);
      s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 12);
      s[a] = (s[a] + s[b]) | 0; s[d] = rotl(s[d] ^ s[a], 8);
      s[c] = (s[c] + s[d]) | 0; s[b] = rotl(s[b] ^ s[c], 7);
    }
    var key = new Int32Array(8);
    for (var i = 0; i < 8; i++) {
      key[i] = keyBytes[i * 4] | (keyBytes[i * 4 + 1] << 8) | (keyBytes[i * 4 + 2] << 16) | (keyBytes[i * 4 + 3] << 24);
    }
    var nonce = new Int32Array(3);
    for (var i = 0; i < 3; i++) {
      nonce[i] = nonceBytes[i * 4] | (nonceBytes[i * 4 + 1] << 8) | (nonceBytes[i * 4 + 2] << 16) | (nonceBytes[i * 4 + 3] << 24);
    }
    var output = new Uint8Array(inputBytes.length);
    var state = new Int32Array(16);
    var working = new Int32Array(16);
    var block = new Uint8Array(64);
    var pos = 0;
    var currentCounter = counter;
    while (pos < inputBytes.length) {
      state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
      for (var i = 0; i < 8; i++) state[4 + i] = key[i];
      state[12] = currentCounter;
      state[13] = nonce[0]; state[14] = nonce[1]; state[15] = nonce[2];
      for (var i = 0; i < 16; i++) working[i] = state[i];
      for (var i = 0; i < 10; i++) {
        qr(working, 0, 4, 8, 12); qr(working, 1, 5, 9, 13); qr(working, 2, 6, 10, 14); qr(working, 3, 7, 11, 15);
        qr(working, 0, 5, 10, 15); qr(working, 1, 6, 11, 12); qr(working, 2, 7, 8, 13); qr(working, 3, 4, 9, 14);
      }
      for (var i = 0; i < 16; i++) {
        var val = (working[i] + state[i]) | 0;
        block[i * 4] = val & 255; block[i * 4 + 1] = (val >>> 8) & 255;
        block[i * 4 + 2] = (val >>> 16) & 255; block[i * 4 + 3] = (val >>> 24) & 255;
      }
      var take = Math.min(64, inputBytes.length - pos);
      for (var i = 0; i < take; i++) output[pos + i] = inputBytes[pos + i] ^ block[i];
      pos += take;
      currentCounter++;
    }
    return output;
  }

  function utf8Encode(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) { b.push((c >> 6) | 192); b.push((c & 63) | 128); }
      else { b.push((c >> 12) | 224); b.push(((c >> 6) & 63) | 128); b.push((c & 63) | 128); }
    }
    return new Uint8Array(b);
  }

  function utf8Decode(b) {
    var s = '';
    var i = 0;
    while (i < b.length) {
      var c = b[i++];
      if (c < 128) s += String.fromCharCode(c);
      else if (c > 191 && c < 224) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
      else s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    }
    return s;
  }

  function toHex(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) {
      var h = b[i].toString(16);
      s += (h.length < 2 ? '0' : '') + h;
    }
    return s;
  }

  function fromHex(h) {
    var b = new Uint8Array(h.length / 2);
    for (var i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
    return b;
  }

  const SALT = 'AlphaCoop@Lagos#2026';

  function deriveKey(pin) {
    return sha256(SALT + '::' + pin + '::' + SALT);
  }

  return {
    encrypt: function (text, pin) {
      var key = deriveKey(pin);
      var nonce = new Uint8Array(12);
      for (var i = 0; i < 12; i++) nonce[i] = (Math.random() * 256) | 0;
      var hashHeader = toHex(sha256('CHECK::' + text).slice(0, 8));
      var payload = utf8Encode(hashHeader + ':::' + text);
      var enc = chacha20(key, nonce, 1, payload);
      return toHex(nonce) + ':' + toHex(enc);
    },
    decrypt: function (ciphertext, pin) {
      var parts = ciphertext.split(':');
      if (parts.length !== 2) throw new Error('Invalid format');
      var nonce = fromHex(parts[0]);
      var enc = fromHex(parts[1]);
      var key = deriveKey(pin);
      var dec = chacha20(key, nonce, 1, enc);
      var text = utf8Decode(dec);
      var sepIdx = text.indexOf(':::');
      if (sepIdx === -1) throw new Error('Decryption failed');
      var hashHeader = text.slice(0, sepIdx);
      var original = text.slice(sepIdx + 3);
      var expectedHash = toHex(sha256('CHECK::' + original).slice(0, 8));
      if (hashHeader !== expectedHash) throw new Error('Decryption failed');
      return original;
    }
  };
})();

// --------------------------------------------------------------------------
// LOCAL LEDGER CACHE & AUTO-SUGGEST (Encrypted at Rest, 0ms in Memory)
// --------------------------------------------------------------------------
let localLedgerCache = [
  {
    "S/N": 1,
    "Name": "Akingbade Ademola Thomas",
    "FormNo": "000780",
    "Empl. No": "LIRS/3316",
    "Pin": "2026",
    "Date": "September 25, 2026",
    "Thrift Savings": 1610278,
    "Normal Loan": 80138,
    "Interest": 8013.8,
    "PURCHASE/ASSET FINANCE": 0,
    "Mortgage Subscription": 0,
    gross: 550000,
    coopDed: 25000,
    monthlySavings: 15000,
    totalBank: 0
  },
  {
    "S/N": 2,
    "Name": "Olusegun VIHO",
    "FormNo": "000607",
    "Empl. No": "LIRS/0607",
    "Pin": "2026",
    "Date": "August 31, 2026",
    "Thrift Savings": 55000,
    "Normal Loan": 850000,
    "Interest": 85000,
    "PURCHASE/ASSET FINANCE": 120000,
    "Mortgage Subscription": 0,
    gross: 300000,
    coopDed: 97917,
    monthlySavings: 5000,
    totalBank: 0
  }
];
let prefetchActive = false;

// Load persisted encrypted cache on startup
function initLedgerCache() {
  try {
    const storedCipher = localStorage.getItem("alpha_coop_encrypted_cache");
    if (storedCipher) {
      // Decrypt in memory using 2026
      const dec = AlphaCrypto.decrypt(storedCipher, EXPECTED_PIN);
      const parsed = JSON.parse(dec);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((p) => {
          const id = p.staff || p.staffId;
          const idx = localLedgerCache.findIndex(m => (m.staff || m.staffId) === id);
          if (idx >= 0) {
            localLedgerCache[idx] = Object.assign({}, localLedgerCache[idx], p);
          } else {
            localLedgerCache.push(p);
          }
        });
      }
    }
  } catch (_) { }

  // Background prefetch from Google Sheet to ensure cache is fresh
  prefetchLedger();
}

async function prefetchLedger() {
  if (prefetchActive) return;
  prefetchActive = true;
  try {
    const url = `${SHEET_API_URL}?action=all&pin=${encodeURIComponent(EXPECTED_PIN)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    if (json && json.status === "success") {
      let data = null;
      if (json.encrypted && json.payload) {
        // Decrypt payload in-memory using 2026
        const dec = AlphaCrypto.decrypt(json.payload, EXPECTED_PIN);
        data = JSON.parse(dec);
        // Persist only the encrypted ciphertext in localStorage
        try {
          localStorage.setItem("alpha_coop_encrypted_cache", json.payload);
        } catch (_) { }
      } else if (Array.isArray(json.data)) {
        data = json.data;
      }

      if (Array.isArray(data) && data.length > 0) {
        localLedgerCache = data;
      }
    }
  } catch (_) { }
  finally {
    prefetchActive = false;
  }
}

// Flexible member matcher supporting partial IDs, numbers (e.g. "0000" matches "LIRS/0000"), or Names
function findMatchingMembers(query, maxResults = 5) {
  if (!query) return [];
  const clean = query.trim().toLowerCase();
  const queryDigits = clean.replace(/[^0-9]/g, "");

  return localLedgerCache.filter((m) => {
    const staff = String(findKeyVal(m, ["Empl. No", "Empl No", "staff", "staffId"]) || "").toLowerCase();
    const name = String(findKeyVal(m, ["Name", "name"]) || "").toLowerCase();
    const form = String(findKeyVal(m, ["FormNo", "formNo", "Form No", "form"]) || "").toLowerCase();
    const staffDigits = staff.replace(/[^0-9]/g, "");
    const formDigits = form.replace(/[^0-9]/g, "");

    // 1. Direct contains
    if (staff.includes(clean) || form.includes(clean) || name.includes(clean)) return true;

    // 2. Partial number matching: e.g. "3316" or "000780"
    if (queryDigits.length >= 2) {
      if (
        (staffDigits && (staffDigits === queryDigits || staffDigits.endsWith(queryDigits) || parseInt(staffDigits, 10) === parseInt(queryDigits, 10))) ||
        (formDigits && (formDigits === queryDigits || parseInt(formDigits, 10) === parseInt(queryDigits, 10)))
      ) {
        return true;
      }
    }
    return false;
  }).slice(0, maxResults);
}

function renderSuggestions(matches, targetDropdownId = "staffSuggestions") {
  const dropdown = document.getElementById(targetDropdownId);
  if (!dropdown) return;

  if (!matches || matches.length === 0) {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    return;
  }

  dropdown.innerHTML = matches
    .map((m, idx) => `
      <div class="suggestion-item" data-idx="${idx}">
        <div class="suggestion-main">
          <span class="suggestion-name">${m.name || "Member"}</span>
          <span class="suggestion-id">${m.staff || m.formNo || "No ID"}</span>
        </div>
        <div class="suggestion-meta">
          Savings: ₦${(Number(m.savings) || 0).toLocaleString()}<br/>
          Loan: ₦${(Number(m.loan) || 0).toLocaleString()}
        </div>
      </div>
    `)
    .join("");

  dropdown.style.display = "block";

  // Bind click handlers on suggestion items
  dropdown.querySelectorAll(".suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-idx"), 10);
      const selected = matches[idx];
      if (selected) applyMemberRecord(selected);
      dropdown.style.display = "none";
    });
  });
}

function resetFinancialFields() {
  setFieldValue("inp_gross", "");
  setFieldValue("inp_savings", "");
  setFieldValue("inp_existingLoan", "");
  setFieldValue("inp_totalBank", "");
  setFieldValue("inp_coopDed", "");
  setFieldValue("inp_monthlySavings", "10,000");
  setFieldValue("inp_otherDed", "");
  setFieldValue("inp_requested", "");
  // Auto reset cap to default 40% on member change
  setDeductionCap(0.40);
  lastResult = null;
  currentMemberProfile = null;
  renderEmptyResult();
}

function applyMemberRecord(member) {
  // Clear financial fields first so stale data from a previous member never carries over
  resetFinancialFields();

  const staff = String(findKeyVal(member, ["Empl. No", "Empl No", "staff", "staffId", "Staff ID"]) || "").trim();
  const name = String(findKeyVal(member, ["Name", "name", "Member Name"]) || "").trim();
  const rawSavings = findKeyVal(member, ["Thrift Savings", "savings", "Savings", "Thrift"]);
  const rawLoan = findKeyVal(member, ["Normal Loan", "loan", "Loan", "existingLoan", "Normal"]);
  const rawPurchase = findKeyVal(member, [
    "PURCHASE/ASSET FINANCE",
    "Purchase/Asset Finance",
    "Purchase / Asset Finance",
    "PURCHASE / ASSET FINANCE",
    "PURCHASE",
    "purchase",
    "Asset Finance",
    "commodity",
    "Commodity Loan",
    "Purchase Loan",
    "Commodity"
  ]);

  const savings = parseNumber(rawSavings);
  const loan = parseNumber(rawLoan);
  const purchase = parseNumber(rawPurchase);

  const gross = findKeyVal(member, ["gross", "Gross Monthly Salary", "Gross Salary"]);
  const coopDed = findKeyVal(member, ["coopDed", "Coop Deduction", "Current Coop Deduction"]);
  const monthlySavings = findKeyVal(member, ["monthlySavings", "Monthly Savings"]);
  const totalBank = findKeyVal(member, ["totalBank", "Total Bank Deductions", "Total Monthly Deductions"]);

  setFieldValue("inp_staff", staff);
  if (name) setFieldValue("inp_name", name);
  if (rawSavings !== undefined) setFieldValue("inp_savings", savings);
  if (rawLoan !== undefined) setFieldValue("inp_existingLoan", loan);
  if (gross !== undefined) setFieldValue("inp_gross", gross);
  if (coopDed !== undefined) setFieldValue("inp_coopDed", coopDed);
  const parsedMonthlySavings = monthlySavings !== undefined ? parseNumber(monthlySavings) : 0;
  setFieldValue("inp_monthlySavings", parsedMonthlySavings > 0 ? monthlySavings : "10,000");
  if (totalBank !== undefined) setFieldValue("inp_totalBank", totalBank);

  if (currentFacility === "cash") {
    isDurationOverridden = false;
    updateTieredDuration();
  }

  const formattedSavings = formatMoney(savings || 0);
  const formattedLoan = formatMoney(loan || 0);
  const purchaseNote = purchase > 0 ? ` · Purchase: ${formatMoney(purchase)}` : "";
  showLookupStatus(`✓ Found: ${name || staff} · Savings: ${formattedSavings} · Loan: ${formattedLoan}${purchaseNote}`, "success");

  // Profile customer on lookup in the display box
  currentMemberProfile = extractMemberProfile(member);
  lastResult = null;
  renderMemberProfile(currentMemberProfile);
}

// --------------------------------------------------------------------------
// LIVE LEDGER LOOKUP (Google Apps Script + Instant Local Fallback)
// --------------------------------------------------------------------------
async function fetchMember() {
  const staffInput = document.getElementById("inp_staff");
  const staffId = staffInput ? staffInput.value.trim() : "";
  const dropdown = document.getElementById("staffSuggestions");
  if (dropdown) dropdown.style.display = "none";

  if (!staffId) {
    showLookupStatus("Please enter a Staff ID or number", "error");
    if (staffInput) staffInput.focus();
    return;
  }

  // 1. Check local cache first for 0ms instant response
  const localMatches = findMatchingMembers(staffId, 1);
  if (localMatches.length > 0) {
    applyMemberRecord(localMatches[0]);
    return;
  }

  // 2. Query Google Sheet endpoint
  showLookupStatus(`Checking ledger for "${staffId}"…`, "loading");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const params = new URLSearchParams({
      staffId: staffId,
      query: staffId,
      pin: EXPECTED_PIN
    });

    const url = `${SHEET_API_URL}?${params.toString()}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result && result.status === "success") {
      let record = null;
      if (result.encrypted && result.payload) {
        // Decrypt payload in-memory with 2026
        const dec = AlphaCrypto.decrypt(result.payload, EXPECTED_PIN);
        record = JSON.parse(dec);
      } else if (result.data) {
        record = result.data;
      }

      if (record) {
        applyMemberRecord(record);
        // Cache this member into local list if not present
        if (!localLedgerCache.some(m => m.staff === record.staffId)) {
          localLedgerCache.push(record);
        }
      } else {
        showLookupStatus(`Member "${staffId}" not found`, "error");
      }
    } else {
      showLookupStatus(`Member "${staffId}" not found`, "error");
    }
  } catch (err) {
    clearTimeout(timeoutId);
    showLookupStatus(`Member "${staffId}" not found`, "error");
  }
}

async function fetchMemberByName() {
  const nameInput = document.getElementById("inp_name");
  const query = nameInput ? nameInput.value.trim() : "";
  const dropdown = document.getElementById("nameSuggestions");
  if (dropdown) dropdown.style.display = "none";

  if (!query) {
    showLookupStatus("Please enter a member name to search", "error");
    if (nameInput) nameInput.focus();
    return;
  }

  showLookupStatus(`Searching ledger for "${query}"…`, "loading");
  const matches = findMatchingMembers(query, 1);
  if (matches.length > 0) {
    applyMemberRecord(matches[0]);
    return;
  }

  // Fallback to fetchMember with query
  const staffInput = document.getElementById("inp_staff");
  if (staffInput) staffInput.value = query;
  return fetchMember();
}

function showLookupStatus(msg, type) {
  const statusEl = document.getElementById("lookupStatus");
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = `lookup-status ${type}`;
  statusEl.style.display = "block";
}

function hideLookupStatus() {
  const statusEl = document.getElementById("lookupStatus");
  if (!statusEl) return;
  statusEl.style.display = "none";
}

// --------------------------------------------------------------------------
// UNDERWRITING ENGINE
// --------------------------------------------------------------------------
function calculateEligibility() {
  const name = getFieldValue("inp_name").trim() || "Member";
  const staff = getFieldValue("inp_staff").trim() || "No ID";
  const gross = getFieldNum("inp_gross");
  const savings = getFieldNum("inp_savings");
  const existingLoan = getFieldNum("inp_existingLoan");
  const totalBank = getFieldNum("inp_totalBank");
  const requested = getFieldNum("inp_requested");
  const rawDur = getFieldNum("inp_duration");
  const duration = currentFacility === "purchase"
    ? (rawDur > 0 ? Math.min(9, Math.max(1, rawDur)) : 9)
    : (rawDur > 0 ? Math.min(24, Math.max(1, rawDur)) : 3);
  const isInquiry = document.getElementById("chk_inquiry").checked;

  const savingsLimit = savings * 2;
  const maxDeduction = gross * deductionRate;

  let res = null;

  if (currentFacility === "cash") {
    const coopDed = getFieldNum("inp_coopDed");
    const monthlySavingsRaw = getFieldValue("inp_monthlySavings").trim();
    const monthlySavings = monthlySavingsRaw === "" ? 10000 : parseNumber(monthlySavingsRaw);
    const otherDed = getFieldNum("inp_otherDed");

    const nonCoop = Math.max(0, totalBank - coopDed);
    const allowance = Math.max(0, maxDeduction - nonCoop - monthlySavings - otherDed);
    const maximum = Math.max(0, Math.min(savingsLimit, allowance * duration));
    const amount = isInquiry || requested === 0 ? maximum : requested;
    const monthly = duration > 0 ? amount / duration : 0;
    const totalCoopMonthly = monthly + monthlySavings + otherDed;
    const newDeduction = nonCoop + totalCoopMonthly;

    const savingsPass = amount <= savingsLimit;
    const payrollPass = newDeduction <= maxDeduction;
    // Both checks passing is what makes the request eligible — the existing loan is
    // netted off at disbursement, not folded into the eligibility test itself.
    const eligible = isInquiry ? maximum > 0 : (savingsPass && payrollPass);
    const net = Math.max(0, amount * 0.90 - existingLoan);
    // A request can pass both checks and still pay out nothing once the existing
    // loan is netted off — flag that separately rather than calling it ineligible.
    const zeroPayout = !isInquiry && eligible && (amount * 0.90 - existingLoan) <= 0;
    const needsProposal = !eligible || zeroPayout;
    const counterNet = Math.max(0, maximum * 0.90 - existingLoan);
    const counter = needsProposal && counterNet > 0 && maximum > 0 ? maximum : 0;
    const counterMonthly = duration > 0 ? counter / duration : 0;
    const counterTotalMonthly = counterMonthly > 0 ? (counterMonthly + monthlySavings + otherDed) : 0;

    res = {
      facility: "cash",
      name,
      staff,
      duration,
      deductionRate,
      isInquiry,
      amount,
      monthly,
      totalCoopMonthly,
      eligible,
      zeroPayout,
      needsProposal,
      savingsLimit,
      maxDeduction,
      allowance,
      savingsPass,
      payrollPass,
      net,
      maximum,
      counter,
      counterNet,
      counterMonthly,
      counterTotalMonthly,
      down: 0,
      financed: amount,
      nonCoop,
      monthlySavings,
      otherDed,
      newDeduction,
      existingLoan,
      savings
    };
  } else {
    // Purchase Facility
    const coopDed = getFieldNum("inp_coopDed");
    const monthlySavingsRaw = getFieldValue("inp_monthlySavings").trim();
    const monthlySavings = monthlySavingsRaw === "" ? 10000 : parseNumber(monthlySavingsRaw);
    const otherDed = getFieldNum("inp_otherDed");
    const nonCoop = Math.max(0, totalBank - coopDed);
    const existingDeductions = coopDed + monthlySavings + otherDed + nonCoop;
    const allowance = Math.max(0, maxDeduction - existingDeductions);
    const maxFinanced = Math.max(0, Math.min(savingsLimit, (allowance * duration) / 1.1));
    const maximum = purchaseDownPayment ? maxFinanced / 0.7 : maxFinanced;
    const amount = isInquiry || requested === 0 ? maximum : requested;
    const down = purchaseDownPayment ? amount * 0.3 : 0;
    const financed = purchaseDownPayment ? amount * 0.7 : amount;
    const interest = financed * 0.10;
    const totalRepayment = financed + interest;
    const monthly = duration > 0 ? totalRepayment / duration : 0;
    const totalCoopMonthly = monthly + monthlySavings + otherDed + (coopDed || 0);
    const newDeduction = existingDeductions + monthly;

    const savingsPass = financed <= savingsLimit;
    const payrollPass = newDeduction <= maxDeduction;
    const eligible = isInquiry ? maximum > 0 : (savingsPass && payrollPass);
    const needsProposal = !eligible;
    const counter = needsProposal && maximum > 0 ? maximum : 0;
    const counterDown = purchaseDownPayment ? counter * 0.3 : 0;
    const counterFinanced = purchaseDownPayment ? counter * 0.7 : counter;
    const counterMonthly = duration > 0 ? (counterFinanced * 1.1) / duration : 0;
    const counterTotalMonthly = counterMonthly > 0 ? (counterMonthly + monthlySavings + otherDed + (coopDed || 0)) : 0;

    res = {
      facility: "purchase",
      name,
      staff,
      duration,
      deductionRate,
      isInquiry,
      amount,
      interest,
      totalRepayment,
      monthly,
      totalCoopMonthly,
      eligible,
      needsProposal,
      savingsLimit,
      maxDeduction,
      allowance,
      savingsPass,
      payrollPass,
      net: 0,
      maximum,
      counter,
      counterNet: counter,
      counterDown,
      counterFinanced,
      counterMonthly,
      counterTotalMonthly,
      down,
      financed,
      totalBank,
      coopDed,
      monthlySavings,
      otherDed,
      nonCoop,
      newDeduction,
      existingLoan,
      savings
    };
  }

  lastResult = res;
  renderResult(res);

  // Auto-scroll to result panel on mobile viewports
  if (window.innerWidth < 960) {
    const panel = resolveElement("resultPanel");
    if (panel) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

// Aliases for backward compatibility
function calculate() {
  return calculateEligibility();
}

function resetAll() {
  return resetForm();
}

// --------------------------------------------------------------------------
// CUSTOMER PROFILE & RESULTS RENDERING
// --------------------------------------------------------------------------
function extractMemberProfile(member) {
  if (!member) return null;
  const staff = String(findKeyVal(member, ["Empl. No", "Empl No", "staff", "staffId", "Staff ID"]) || "").trim();
  const name = String(findKeyVal(member, ["Name", "name", "Member Name"]) || "").trim();

  const rawSavings = findKeyVal(member, ["Thrift Savings", "savings", "Savings", "Thrift"]);
  const savings = parseNumber(rawSavings);

  const rawLoan = findKeyVal(member, ["Normal Loan", "loan", "Loan", "existingLoan", "Normal"]);
  const loan = parseNumber(rawLoan);

  const rawPurchase = findKeyVal(member, [
    "PURCHASE/ASSET FINANCE",
    "Purchase/Asset Finance",
    "Purchase / Asset Finance",
    "PURCHASE / ASSET FINANCE",
    "PURCHASE",
    "purchase",
    "Asset Finance",
    "commodity",
    "Commodity Loan",
    "Purchase Loan",
    "Commodity"
  ]);
  const purchase = parseNumber(rawPurchase);

  const rawForm = findKeyVal(member, ["FormNo", "formNo", "Form No", "form", "Form"]);
  const formNo = formatFormNumber(rawForm);

  const rawDate = findKeyVal(member, ["Date", "date", "asAt"]);
  const asAt = formatLedgerDate(rawDate);

  return {
    name,
    staff,
    savings,
    loan,
    purchase,
    formNo,
    asAt
  };
}

function getProfileShareText(p) {
  if (!p) return "";
  const lines = [];
  const header = p.staff ? `${p.name} (${p.staff})` : (p.name || "Member Profile");
  lines.push(header);
  lines.push("");
  lines.push(`As at ${p.asAt || getLastMonthEndDate()}`);
  lines.push("");
  lines.push(`Savings: ${formatAppraisalMoney(p.savings)}`);
  if (p.loan > 0) {
    lines.push(`Loan: ${formatAppraisalMoney(p.loan, true)}`);
  }
  if (p.purchase > 0) {
    lines.push(`Purchase: ${formatAppraisalMoney(p.purchase, true)}`);
  }
  lines.push("");
  lines.push("www.tacmsl.com ( pls type in your browser)");
  lines.push("");
  if (p.formNo) {
    lines.push(`Username: ${p.formNo}`);
  }
  if (p.staff) {
    lines.push(`Password: ${p.staff}`);
  }
  return lines.join("\n");
}

function renderMemberProfile(profile) {
  const panel = resolveElement("resultPanel");
  if (!panel || !profile) return;
  panel.className = "glass-panel result-panel has-result";

  const dateStr = profile.asAt || getLastMonthEndDate();
  const formattedSavings = formatMoney(profile.savings);
  const hasLoan = profile.loan > 0;
  const hasPurchase = profile.purchase > 0;

  let tilesHtml = `
    <div class="result-tile">
      <span>Current Savings</span>
      <strong class="accent">${formattedSavings}</strong>
    </div>
  `;

  if (hasLoan) {
    tilesHtml += `
      <div class="result-tile">
        <span>Loan Outstanding</span>
        <strong>${formatMoney(profile.loan)}</strong>
      </div>
    `;
  }

  if (hasPurchase) {
    tilesHtml += `
      <div class="result-tile">
        <span>Purchase Balance</span>
        <strong>${formatMoney(profile.purchase)}</strong>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="result-head">
      <div>
        <span class="eyebrow">Customer Profile</span>
        <h3>
          ${profile.name || "Member Record"}
          <small>${profile.staff ? `${profile.staff} · ` : ""}As at ${dateStr}</small>
        </h3>
      </div>
      <span class="status-badge neutral">Active</span>
    </div>

    <!-- Profile Overview Tiles -->
    <div class="result-tile-grid">
      ${tilesHtml}
    </div>

    <!-- Member Portal Login Details -->
    <div class="profile-credential-box">
      <div class="profile-credential-head">
        <span>Online Member Portal</span>
        <a href="https://www.tacmsl.com" target="_blank" rel="noopener noreferrer">www.tacmsl.com ↗</a>
      </div>
      <div class="profile-credential-body">
        <div class="credential-item">
          <span class="cred-label">Username</span>
          <span class="cred-val">${profile.formNo || "—"}<small>(Form No)</small></span>
        </div>
        <div class="credential-item">
          <span class="cred-label">Password</span>
          <span class="cred-val">${profile.staff || "—"}<small>(Staff ID)</small></span>
        </div>
      </div>
    </div>

    <div class="result-action-row">
      <button class="share-button" onclick="shareWhatsApp()" type="button">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        Share on WhatsApp
      </button>
      <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy profile details to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>
  `;
}
function renderEmptyResult() {
  const panel = resolveElement("resultPanel");
  if (!panel) return;
  panel.className = "glass-panel result-panel";
  panel.innerHTML = `
    <div class="empty-result">
      <div class="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
      <span class="eyebrow">Ready to assess</span>
      <h3>Your result will appear here.</h3>
      <p>Enter member details or choose a quick scenario to run an eligibility check.</p>
    </div>
  `;
}

function renderResult(res) {
  const panel = resolveElement("resultPanel");
  if (!panel) return;
  panel.className = "glass-panel result-panel has-result";

  const statusClass = res.eligible ? "pass" : "fail";
  const statusLabel = res.eligible
    ? res.isInquiry
      ? "Capacity ready"
      : "Eligible"
    : "Not eligible";

  const statusIcon = res.eligible
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const facilityLabel = res.facility === "cash" ? "Cash Loan" : "Purchase";
  const capPct = Math.round((res.deductionRate || 0.40) * 100);

  // 1. Savings Check Content
  const savingsExcess = Math.max(0, (res.facility === "cash" ? res.amount : res.financed) - res.savingsLimit);
  const savingsNote = res.savingsPass
    ? `Amount requested fits within the Savings Limit (x2) of ${formatMoney(res.savingsLimit)}.`
    : `Amount requested exceeds Savings Limit (x2) of ${formatMoney(res.savingsLimit)}${savingsExcess > 0 ? ` by ${formatMoney(savingsExcess)}` : ""}.`;

  // 2. Payslip Deduction Check Content
  const payrollRows = res.facility === "cash"
    ? `
      <div class="audit-row">
        <span class="audit-label">Non-Coop Bank Deductions</span>
        <span class="audit-value">${formatMoney(res.nonCoop)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">Monthly Loan Repayment</span>
        <span class="audit-value">${formatMoney(res.monthly)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">Monthly Savings Contribution</span>
        <span class="audit-value">${formatMoney(res.monthlySavings)}</span>
      </div>
      <div class="audit-row">
        <span class="audit-label">Other Monthly Deductions</span>
        <span class="audit-value">${formatMoney(res.otherDed)}</span>
      </div>
      <div class="audit-row highlight">
        <span class="audit-label">New Total Monthly Deduction</span>
        <span class="audit-value">${formatMoney(res.newDeduction)}</span>
      </div>
      <div class="audit-row highlight">
        <span class="audit-label">Maximum Allowed Deduction (${capPct}% of Salary)</span>
        <span class="audit-value">${formatMoney(res.maxDeduction)}</span>
      </div>
    `
    : `
      <div class="audit-row">
        <span class="audit-label">Monthly Purchase Repayment</span>
        <span class="audit-value">${formatMoney(res.monthly)}</span>
      </div>
      ${res.monthlySavings > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Savings Deduction</span>
        <span class="audit-value">${formatMoney(res.monthlySavings)}</span>
      </div>` : ''}
      ${res.coopDed > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Loan Deduction</span>
        <span class="audit-value">${formatMoney(res.coopDed)}</span>
      </div>` : ''}
      ${res.nonCoop > 0 ? `
      <div class="audit-row">
        <span class="audit-label">Other Bank Deductions</span>
        <span class="audit-value">${formatMoney(res.nonCoop)}</span>
      </div>` : ''}
      <div class="audit-row highlight">
        <span class="audit-label">Total Monthly Deduction</span>
        <span class="audit-value">${formatMoney(res.newDeduction)}</span>
      </div>
      <div class="audit-row highlight">
        <span class="audit-label">Maximum Allowed Deduction (${capPct}% of Salary)</span>
        <span class="audit-value">${formatMoney(res.maxDeduction)}</span>
      </div>
    `;

  const payrollNote = res.payrollPass
    ? `New monthly deduction (${formatMoney(res.newDeduction)}) fits within the allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`
    : `New monthly deduction (${formatMoney(res.newDeduction)}) exceeds allowable ${capPct}% deduction limit of ${formatMoney(res.maxDeduction)}.`;

  // 3. What You Can Get? (Contractible Bar - Hidden/Closed by default)
  let proposalAccordionHtml = "";
  if (res.needsProposal && res.counter > 0 && res.counterNet > 0) {
    proposalAccordionHtml = `
      <details class="proposal-accordion">
        <summary class="proposal-summary">
          <div class="proposal-title-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>${res.zeroPayout ? "Proposable amount (with a real payout)" : "What You Can Get?"}</span>
          </div>
          <div class="proposal-meta">
            <span class="proposal-badge">${formatMoney(res.counter)}</span>
            <svg class="proposal-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </summary>
        <div class="proposal-body">
          <p class="proposal-note">Proposable alternative calculated to satisfy both 2× savings limit and ${capPct}% deduction ceiling:</p>
          <div class="proposal-grid">
            <div class="proposal-card">
              <span>Proposable Amount</span>
              <strong>${formatMoney(res.counter)}</strong>
            </div>
            <div class="proposal-card">
              <span>Net Disbursed</span>
              <strong>${formatMoney(res.counterNet)}</strong>
            </div>
            <div class="proposal-card">
              <span>Monthly Deduction</span>
              <strong>${formatMoney(res.counterTotalMonthly || res.counterMonthly)}</strong>
            </div>
            <div class="proposal-card">
              <span>Duration</span>
              <strong>${res.duration} Mos</strong>
            </div>
          </div>
          <button type="button" class="apply-proposal-btn" onclick="applyCounterOffer(${res.counter})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Apply Proposable Amount (${formatMoney(res.counter)})
          </button>
        </div>
      </details>
    `;
  } else if (res.needsProposal) {
    proposalAccordionHtml = `
      <div class="advisory-box">
        <strong>Notice:</strong> ${res.zeroPayout
        ? "Even the maximum amount this member could support under the savings limit and payroll margin would still net ₦0.00 after clearing the existing loan."
        : "Member currently has no allowable borrowing capacity under current debt and savings balances."}
      </div>
    `;
  }

  // Zero payout notice if net <= 0
  let netAdvisoryHtml = "";
  if (res.facility === "cash" && res.net <= 0 && res.amount > 0) {
    netAdvisoryHtml = `
      <div class="advisory-box">
        <strong>Zero Payout Warning:</strong> Outstanding loan balance (${formatMoney(res.existingLoan)}) exceeds 90% net loan proceeds (${formatMoney(res.amount * 0.90)}).
      </div>
    `;
  }

  const breakdownNote = res.facility === "cash"
    ? `${formatMoney(res.monthly)} loan + ${formatMoney(res.monthlySavings)} sav${res.otherDed > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""}`
    : `${formatMoney(res.monthly)} item + ${formatMoney(res.monthlySavings)} sav${res.coopDed > 0 ? ` + ${formatMoney(res.coopDed)} loan` : ""}${res.otherDed > 0 ? ` + ${formatMoney(res.otherDed)} oth` : ""}`;

  panel.innerHTML = `
    <div class="result-head">
      <div>
        <span class="eyebrow">Eligibility appraisal</span>
        <h3>
          ${res.name}
          <small>${res.staff} · ${facilityLabel}</small>
        </h3>
      </div>
      <span class="status-badge ${statusClass}">
        ${statusIcon}
        ${statusLabel}
      </span>
    </div>

    <!-- Requested Facility Overview Tiles -->
    <div class="result-tile-grid">
      <div class="result-tile">
        <span>${res.facility === "cash" ? "Amount Requested" : "Purchase Amount"}</span>
        <strong class="accent">${formatMoney(res.amount)}</strong>
      </div>
      <div class="result-tile">
        <span>${res.facility === "cash" ? "Net Disbursed" : "Total Repayment (10% Int)"}</span>
        <strong>${formatMoney(res.facility === "cash" ? res.net : (res.totalRepayment || res.financed * 1.1))}</strong>
      </div>
      <div class="result-tile">
        <span>Monthly Deduction</span>
        <strong>${formatMoney(res.totalCoopMonthly || res.monthly)}</strong>
        <span class="tile-breakdown">${breakdownNote}</span>
      </div>
      <div class="result-tile">
        <span>Duration</span>
        <strong>${res.duration} Mos</strong>
      </div>
    </div>

    ${netAdvisoryHtml}

    <!-- Audit Checks (Policy 1 & Policy 2) -->
    <div class="audit-checks">
      <!-- Check 1: Savings Limit -->
      <div class="audit-card ${res.savingsPass ? "pass-border" : "fail-border"}">
        <div class="audit-head">
          <span class="audit-title">1. Savings Limit (x2)</span>
          <span class="status-badge ${res.savingsPass ? "pass" : "fail"}">
            ${res.savingsPass ? "PASS" : "FAIL"}
          </span>
        </div>
        <div class="audit-table">
          <div class="audit-row">
            <span class="audit-label">Savings Limit (x2)</span>
            <span class="audit-value">${formatMoney(res.savingsLimit)}</span>
          </div>
          <div class="audit-row">
            <span class="audit-label">${res.facility === "cash" ? "Amount Requested" : "Amount Financed"}</span>
            <span class="audit-value">${formatMoney(res.facility === "cash" ? res.amount : res.financed)}</span>
          </div>
        </div>
        <div class="audit-note ${res.savingsPass ? "pass" : "fail"}">
          ${savingsNote}
        </div>
      </div>

      <!-- Check 2: Payslip Deduction Check -->
      <div class="audit-card ${res.payrollPass ? "pass-border" : "fail-border"}">
        <div class="audit-head">
          <span class="audit-title">2. Payslip Deduction Check</span>
          <span class="status-badge ${res.payrollPass ? "pass" : "fail"}">
            ${res.payrollPass ? "PASS" : "FAIL"}
          </span>
        </div>
        <div class="audit-table">
          ${payrollRows}
        </div>
        <div class="audit-note ${res.payrollPass ? "pass" : "fail"}">
          ${payrollNote}
        </div>
      </div>
    </div>

    ${proposalAccordionHtml}

    <div class="result-action-row">
      <button class="share-button" onclick="shareWhatsApp()" type="button">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        Share on WhatsApp
      </button>
      <button class="copy-report-button" id="btnCopyReport" onclick="copyAppraisalText()" type="button" title="Copy appraisal details to clipboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>
  `;
}

function formatAppraisalMoney(val, forceDecimals = false) {
  const num = Math.max(0, Number(val) || 0);
  const hasDecimals = Math.abs(num - Math.round(num)) > 0.001;
  const showDec = forceDecimals || hasDecimals;
  return "₦" + num.toLocaleString("en-NG", {
    minimumFractionDigits: showDec ? 2 : 0,
    maximumFractionDigits: 2
  });
}

function getAppraisalText() {
  if (!lastResult) return "";
  const res = lastResult;
  const facilityTitle = res.facility === "cash"
    ? "Cash Loan"
    : (purchaseDownPayment ? "Purchase (30% Down)" : "Phone / Commodity Purchase");

  const statusTitle = res.eligible
    ? (res.isInquiry ? "CAPACITY READY ✅" : "ELIGIBLE ✅")
    : "NOT ELIGIBLE ❌";

  const currentSavings = res.savings !== undefined ? res.savings : getFieldNum("inp_savings");
  const loanOutstanding = res.existingLoan !== undefined ? res.existingLoan : getFieldNum("inp_existingLoan");

  if (res.facility === "purchase") {
    const targetAmount = (res.needsProposal && res.counter > 0) ? res.counter : res.amount;
    const financed = purchaseDownPayment ? targetAmount * 0.7 : targetAmount;
    const interest = res.interest !== undefined ? res.interest : financed * 0.10;
    const totalRepayment = res.totalRepayment !== undefined ? res.totalRepayment : financed + interest;
    const monthly = res.duration > 0 ? totalRepayment / res.duration : 0;
    const totalMonthlyDed = res.newDeduction !== undefined
      ? res.newDeduction
      : ((res.coopDed || 0) + (res.monthlySavings || 0) + (res.otherDed || 0) + (res.nonCoop || 0) + monthly);

    const maxAccessible = res.maximum || targetAmount;
    let accessLine = "";
    if (res.needsProposal || targetAmount >= maxAccessible) {
      accessLine = `He can only access phone purchase of ${formatAppraisalMoney(maxAccessible)}`;
    } else {
      accessLine = `He can access phone purchase of ${formatAppraisalMoney(targetAmount)}`;
    }

    const memberHeader = res.staff ? `${res.name || "Member"}(${res.staff})` : (res.name || "Member");

    const lines = [
      memberHeader,
      ``,
      accessLine,
      ``,
      `Purchase amount = *${formatAppraisalMoney(targetAmount)}*`,
      `Interest = ${formatAppraisalMoney(interest)}`,
      `Total Repayment = ${formatAppraisalMoney(totalRepayment)}`,
      ``,
      `Repayment duration: ${res.duration}mth`,
      `Monthly purchase repayment: ${formatAppraisalMoney(monthly)}`,
      ...(res.monthlySavings > 0 ? [`Monthly savings contribution: ${formatAppraisalMoney(res.monthlySavings)}`] : []),
      ...(res.coopDed > 0 ? [`Existing loan deduction: ${formatAppraisalMoney(res.coopDed, true)}`] : []),
      ...(res.otherDed > 0 ? [`Other deductions: ${formatAppraisalMoney(res.otherDed)}`] : []),
      ``,
      `Monthly Cooperative deduction: ${formatAppraisalMoney(res.totalCoopMonthly || (monthly + (res.monthlySavings || 0) + (res.coopDed || 0) + (res.otherDed || 0)))}`,
      `Total Payslip deduction: ${formatAppraisalMoney(res.newDeduction)}`
    ];

    return lines.join("\n");
  }

  const lines = [
    `Member: ${res.name || "Member"}${res.staff ? ` (${res.staff})` : ""}`,
    `Facility: Cash Loan`,
    `Duration: ${res.duration} Months`,
    ``,
    `FINANCIAL STANDING`,
    `Current Savings: ${formatMoney(currentSavings)}`,
    `Loan Outstanding: ${formatMoney(loanOutstanding)}`,
    ``,
    `APPRAISAL DETAILS`,
    `Amount Requested: ${formatMoney(res.amount)}`,
    `Net Disbursed: ${formatMoney(res.net)}`,
    `Loan Repayment: ${formatMoney(res.monthly)}/mo`,
    `Monthly Savings: ${formatMoney(res.monthlySavings)}/mo`,
    ...(res.otherDed > 0 ? [`Other Deductions: ${formatMoney(res.otherDed)}/mo`] : []),
    `Monthly Deduction: ${formatMoney(res.totalCoopMonthly || res.monthly)}/mo`,
    `New Total Payslip Deduction: ${formatMoney(res.newDeduction)}/mo (Cap: ${formatMoney(res.maxDeduction)})`,
    ``,
    `Status: ${statusTitle}`
  ];

  if (res.zeroPayout) {
    lines.push(
      ``,
      `Notice: Outstanding loan balance offsets net loan proceeds (Net Payout: ₦0.00).`
    );
  }

  if (res.needsProposal && res.counter > 0 && res.counterNet > 0) {
    lines.push(
      ``,
      `PROPOSABLE OFFER`,
      `Amount Proposable: ${formatMoney(res.counter)}`,
      `Net Disbursed: ${formatMoney(res.counterNet)}`,
      `Loan Repayment: ${formatMoney(res.counterMonthly)}/mo`,
      `Monthly Savings: ${formatMoney(res.monthlySavings)}/mo`,
      ...(res.otherDed > 0 ? [`Other Deductions: ${formatMoney(res.otherDed)}/mo`] : []),
      `Monthly Deduction: ${formatMoney(res.counterTotalMonthly || res.counterMonthly)}/mo`
    );
  }

  return lines.join("\n");
}

function shareWhatsApp() {
  const text = lastResult ? getAppraisalText() : (currentMemberProfile ? getProfileShareText(currentMemberProfile) : "");
  if (!text) return;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
}

async function copyAppraisalText() {
  const text = lastResult ? getAppraisalText() : (currentMemberProfile ? getProfileShareText(currentMemberProfile) : "");
  if (!text) return;
  const btn = document.getElementById("btnCopyReport");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    if (btn) {
      const origHtml = btn.innerHTML;
      btn.classList.add("copied");
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = origHtml;
      }, 2000);
    }
  } catch (err) {
    console.error("Failed to copy appraisal text:", err);
  }
}

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initMoneyInputs();
  renderScenarios();
  renderEmptyResult();
  initLedgerCache();

  // Check if session already authenticated
  try {
    if (sessionStorage.getItem("alpha_coop_unlocked") === "true") {
      unlockDesk();
    }
  } catch (_) { }

  const authPin = document.getElementById("authPin");
  const authError = document.getElementById("authError");
  if (authPin) {
    authPin.focus();
    // Live input validation & auto-unlock on 2026
    authPin.addEventListener("input", (e) => {
      if (authError) {
        authError.classList.remove("visible");
        authError.style.display = "none";
      }
      const val = e.target.value.trim();
      if (val === EXPECTED_PIN) {
        unlockDesk();
      }
    });
  }

  // Helper for Member Search Autocomplete (both Staff ID and Name)
  function attachMemberAutocomplete({ inputEl, dropdownId, onFetch }) {
    if (!inputEl) return;
    const dropdown = document.getElementById(dropdownId);

    inputEl.addEventListener("input", (e) => {
      const q = e.target.value.trim();
      hideLookupStatus();

      // If user edits text away from the loaded profile, auto-reset downstream fields
      if (currentMemberProfile) {
        const staffVal = (currentMemberProfile.staff || "").toLowerCase();
        const nameVal = (currentMemberProfile.name || "").toLowerCase();
        const qLow = q.toLowerCase();
        if (qLow !== staffVal && qLow !== nameVal) {
          resetFinancialFields();
        }
      }

      if (q.length >= 1) {
        const matches = findMatchingMembers(q, 5);
        renderSuggestions(matches, dropdownId);
      } else if (dropdown) {
        dropdown.style.display = "none";
      }
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (dropdown) dropdown.style.display = "none";
        onFetch();
      } else if (e.key === "Escape") {
        if (dropdown) dropdown.style.display = "none";
      }
    });
  }

  // Setup staff typeahead & auto-suggest
  attachMemberAutocomplete({
    inputEl: document.getElementById("inp_staff"),
    dropdownId: "staffSuggestions",
    onFetch: fetchMember
  });

  // Setup name typeahead & auto-suggest (functions identically to Staff ID)
  attachMemberAutocomplete({
    inputEl: document.getElementById("inp_name"),
    dropdownId: "nameSuggestions",
    onFetch: fetchMemberByName
  });

  // Close dropdowns & popovers when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-field-wrap")) {
      const staffDrop = document.getElementById("staffSuggestions");
      const nameDrop = document.getElementById("nameSuggestions");
      if (staffDrop) staffDrop.style.display = "none";
      if (nameDrop) nameDrop.style.display = "none";
    }
    if (!e.target.closest(".custom-cap-wrap")) {
      const capPopover = document.getElementById("customCapPopover");
      if (capPopover) capPopover.style.display = "none";
    }
  });

  // Custom Cap input Enter key listener
  const customCapInput = document.getElementById("inp_customCap");
  if (customCapInput) {
    customCapInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomCap();
      } else if (e.key === "Escape") {
        toggleCustomCapInput(false);
      }
    });
  }

  // Requested Amount & Duration tiered duration listeners
  const requestedInput = document.getElementById("inp_requested");
  if (requestedInput) {
    requestedInput.addEventListener("input", () => {
      if (currentFacility === "cash" && !isDurationOverridden) {
        updateTieredDuration();
      }
    });
  }

  const durationInput = document.getElementById("inp_duration");
  if (durationInput) {
    durationInput.addEventListener("input", () => {
      if (currentFacility === "cash") {
        isDurationOverridden = true;
        updateTieredDuration();
      }
    });
    durationInput.addEventListener("change", () => {
      const isPurchase = currentFacility === "purchase";
      const val = Number(durationInput.value);
      if (isPurchase) {
        if (!val || val <= 0 || val > 9) {
          durationInput.value = val > 9 ? "9" : (val < 1 && val > 0 ? "1" : "9");
        }
      } else {
        if (!val || val <= 0 || val > 24) {
          durationInput.value = val > 24 ? "24" : (val < 1 && val > 0 ? "1" : "3");
        }
      }
    });
  }

  // Set initial tiered duration
  updateTieredDuration();

  // Initialize theme button icon
  initTheme();

  // Sticky masthead elevation on scroll
  window.addEventListener("scroll", () => {
    const masthead = document.getElementById("masthead");
    if (masthead) {
      if (window.scrollY > 15) {
        masthead.classList.add("is-scrolled");
      } else {
        masthead.classList.remove("is-scrolled");
      }
    }
  }, { passive: true });
});

// Theme Management (Light / Dark Mode with System Detection & Persistence)
function initTheme() {
  const saved = localStorage.getItem("alpha_theme");
  const theme = saved || "dark";
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.innerHTML = theme === "dark"
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    btn.setAttribute("title", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("alpha_theme", next);
  applyTheme(next);
}

// Run immediately for zero-flicker theme restoration
initTheme();