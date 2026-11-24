// ==========================================================================
//  ALPHA COOP — SCENARIOS CAROUSEL & FLUID DIRECT MANIPULATION SCROLL
// ==========================================================================

import { scenarios } from "../data/scenarios.js";

export function initFluidScenarioScroll() {
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

export function renderScenarios(facility, onSelectScenario) {
  const container = document.getElementById("scenarioScroll");
  if (!container) return;
  const list = scenarios[facility] || [];

  container.innerHTML = list
    .map(
      (item, idx) => `
      <button class="scenario" type="button" data-idx="${idx}">
        <span class="scenario-dot ${item.tone}"></span>
        <span>${item.label}</span>
      </button>
    `
    )
    .join("");

  container.querySelectorAll(".scenario").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      const selected = list[idx];
      if (selected && typeof onSelectScenario === "function") {
        onSelectScenario(selected.data);
      }
    });
  });

  initFluidScenarioScroll();
}
