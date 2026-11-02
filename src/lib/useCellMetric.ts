"use client";

import { useSyncExternalStore } from "react";

// What a shakhmatka cell shows next to the flat number: nothing (calm, just the
// numbers), the number of rooms, or the area. One value at a time keeps the cells
// readable; the rest is in the hover card. The choice is per device (a phone and a
// desk screen want different things) and is remembered.
export type CellMetric = "none" | "rooms" | "area";

const KEY = "shakhmatka-cell-metric";
const listeners = new Set<() => void>();
// Used only when localStorage is unavailable.
let memory: CellMetric | null = null;

function read(): CellMetric {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "rooms" || raw === "area" ? raw : "none";
  } catch {
    return "none";
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed it.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setCellMetric(next: CellMetric) {
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // storage blocked -- the choice lasts until the page is closed only
    memory = next;
  }
  listeners.forEach((l) => l());
}

export function useCellMetric(): CellMetric {
  return useSyncExternalStore(
    subscribe,
    () => memory ?? read(),
    () => "none"
  );
}
