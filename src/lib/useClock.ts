"use client";

import { useSyncExternalStore } from "react";

// A ticking clock, as an external store.
//
// The obvious version -- useState plus setInterval plus a setState in the
// effect body to fill in the first value -- is what React now warns about
// (react-hooks/set-state-in-effect), and the warning is fair: the clock is not
// React state, it is an outside system React subscribes to. useSyncExternalStore
// is the primitive for exactly that.
//
// The server snapshot is null on purpose. A time rendered on the server is the
// server's second, in the server's timezone; hydrating over it makes React
// report a mismatch and the visitor sees a wrong time flash. Returning null
// means the markup says "--:--" until the browser takes over, which is honest
// and stable.
//
// One interval per distinct period, shared by every subscriber, started on the
// first subscription and cleared on the last -- a scene that repaints once a
// minute must not be dragged into a once-a-second re-render.

type Clock = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
};

function makeClock(intervalMs: number): Clock {
  let snapshot = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (timer === null) {
        snapshot = Date.now();
        timer = setInterval(() => {
          snapshot = Date.now();
          for (const l of listeners) l();
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    // A number, not a Date: getSnapshot must return the same value between
    // ticks or React re-renders forever. A fresh Date object never equals the
    // previous one.
    getSnapshot: () => snapshot,
  };
}

const clocks = new Map<number, Clock>();

function clockFor(intervalMs: number): Clock {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    clock = makeClock(intervalMs);
    clocks.set(intervalMs, clock);
  }
  return clock;
}

/**
 * Current time, refreshed every `intervalMs`. `null` on the server and during
 * hydration -- render a placeholder for that case.
 */
export function useNow(intervalMs = 1000): Date | null {
  const clock = clockFor(intervalMs);
  const ms = useSyncExternalStore(clock.subscribe, clock.getSnapshot, () => null);
  return ms === null ? null : new Date(ms);
}
