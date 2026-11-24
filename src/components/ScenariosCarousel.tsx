import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { scenarios } from "../data/scenarios.ts";
import type { FacilityType, ScenarioData } from "../types/coop.ts";

interface ScenariosCarouselProps {
  facility: FacilityType;
  onSelectScenario: (data: ScenarioData) => void;
}

export const ScenariosCarousel: React.FC<ScenariosCarouselProps> = ({
  facility,
  onSelectScenario
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    let isPointerDown = false;
    let startX = 0;
    let scrollStart = 0;
    let history: Array<{ x: number; t: number }> = [];
    let animId: number | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (animId) cancelAnimationFrame(animId);

      isPointerDown = true;
      draggedRef.current = false;
      startX = e.clientX;
      scrollStart = scroller.scrollLeft;
      history = [{ x: e.clientX, t: performance.now() }];
      scroller.style.scrollBehavior = "auto";
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) {
        draggedRef.current = true;
      }
      scroller.scrollLeft = scrollStart - dx;

      const now = performance.now();
      history.push({ x: e.clientX, t: now });
      while (history.length > 1 && now - history[0].t > 100) {
        history.shift();
      }
    };

    const endDrag = () => {
      if (!isPointerDown) return;
      isPointerDown = false;

      if (draggedRef.current) {
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

        const stepMomentum = () => {
          if (Math.abs(currentVelocity) < 15) return;
          scroller.scrollLeft += currentVelocity * (16 / 1000);
          currentVelocity *= decelerationRate;
          animId = requestAnimationFrame(stepMomentum);
        };

        if (Math.abs(velocity) > 60) {
          animId = requestAnimationFrame(stepMomentum);
        }
      }
    };

    const handleCaptureClick = (e: MouseEvent) => {
      if (draggedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        draggedRef.current = false;
      }
    };

    scroller.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    scroller.addEventListener("click", handleCaptureClick, true);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      scroller.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      scroller.removeEventListener("click", handleCaptureClick, true);
    };
  }, []);

  const scrollByStep = (direction: -1 | 1) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * 240, behavior: "smooth" });
  };

  const list = scenarios[facility] || [];

  return (
    <section className="scenario-section my-4 sm:my-5 w-full min-w-0" id="scenarioSection">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Quick Test Scenarios
        </span>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            aria-label="Scroll scenarios left"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            aria-label="Scroll scenarios right"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        className="no-scrollbar flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 snap-x snap-mandatory cursor-grab active:cursor-grabbing"
        id="scenarioScroll"
        ref={scrollRef}
      >
        {list.map((item, idx) => {
          const toneLabel =
            item.tone === "good" ? "Pass" : item.tone === "bad" ? "Fail" : "Case";
          const toneClass =
            item.tone === "good"
              ? "text-emerald-700 dark:text-emerald-400"
              : item.tone === "bad"
                ? "text-red-600 dark:text-red-400"
                : "text-slate-500 dark:text-slate-400";

          return (
            <button
              key={`${facility}-${idx}`}
              className="snap-start inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              type="button"
              onClick={() => onSelectScenario(item.data)}
            >
              <span className={`text-[11px] font-semibold ${toneClass}`}>{toneLabel}</span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
