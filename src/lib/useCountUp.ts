"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Eased count-up from 0 to `target` over ~0.9s, re-run whenever the target
// changes (filters, fresh data). rAF-driven and cancelled on unmount. Honours
// the OS "reduce motion" setting by showing the final value outright.

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// The OS accessibility setting is another external fact, not React state, and
// it can be switched while the app is open -- reading it once inside an effect
// both cost a render and never noticed a change afterwards.
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false
  );
}

export function useCountUp(target: number, enabled = true): number {
  const reduce = useReducedMotion();
  const animating = enabled && !reduce;
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!animating) return;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, animating]);

  // Returned rather than written into state when there is no animation to run.
  // The old version pushed `target` into state from inside the effect, which
  // is a second render to reach a number that was known during the first --
  // and on a dashboard full of these, one per figure on screen.
  return animating ? value : target;
}
