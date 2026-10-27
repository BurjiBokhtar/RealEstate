"use client";

import { useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";

// "Back" returns you to the exact place you left.
//
// The app scrolls INSIDE <main> (the sidebar and header stay put), so the
// browser's own scroll restoration -- which only knows the document -- does
// nothing here: going back from a contract landed at the top of the list or the
// shakhmatka every time. This remembers, per address (path + query), how far
// <main> was scrolled, and gives it back when the person comes back with the
// browser's Back/Forward. A new page reached by a link or a click starts at the
// top, as before.
//
// The page's content usually arrives AFTER the route changes (it is fetched),
// so right after "back" the page is still too short to scroll that far. The
// position is therefore re-applied on every frame until it can be reached (at
// most three seconds), and given up the moment the person scrolls themselves.

const PREFIX = "scrollpos:";
const GIVE_UP_MS = 3000;
// "Back" is recognised by the popstate that precedes the route change; it only
// counts for this long, so a later ordinary click is never mistaken for it.
const BACK_WINDOW_MS = 1500;

// Module state, not component state: the effect that sees the route change is a
// different run of the effect than the one that saw the popstate before it.
let lastBackAt = 0;
let restoring = false;
let restoreFrame = 0;

const addressKey = () => window.location.pathname + window.location.search;
/** True for a moment after the browser's Back/Forward -- lets other scrollers restore themselves too. */
export const justWentBack = () => Date.now() - lastBackAt < BACK_WINDOW_MS;

function readPosition(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writePosition(key: string, top: number) {
  try {
    window.sessionStorage.setItem(PREFIX + key, String(Math.round(top)));
  } catch {
    // storage full or blocked -- the position is simply not remembered
  }
}

function stopRestoring() {
  restoring = false;
  if (restoreFrame) cancelAnimationFrame(restoreFrame);
  restoreFrame = 0;
}

// Apply the saved position until the page is tall enough to reach it.
function restore(el: HTMLElement, key: string) {
  stopRestoring();
  const target = readPosition(key);
  if (target === null) {
    el.scrollTop = 0;
    return;
  }
  restoring = true;
  const startedAt = performance.now();
  const tick = () => {
    restoreFrame = 0;
    if (!restoring) return;
    el.scrollTop = target;
    const reached = Math.abs(el.scrollTop - target) <= 2;
    if (reached || performance.now() - startedAt > GIVE_UP_MS) {
      restoring = false;
      return;
    }
    restoreFrame = requestAnimationFrame(tick);
  };
  tick();
}

export function useScrollMemory(ref: RefObject<HTMLElement | null>) {
  const pathname = usePathname();

  // Back / Forward in the browser. Registered once.
  useEffect(() => {
    const onPopState = () => {
      lastBackAt = Date.now();
      // Same page, different query (a filter, a page number): no route change
      // follows, so restore straight away.
      window.setTimeout(() => {
        const el = ref.current;
        if (el && justWentBack()) restore(el, addressKey());
      }, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [ref]);

  // Remember where this address is scrolled to; and on every route change decide
  // between "back: give the position back" and "new page: start at the top".
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let saveFrame = 0;
    // Once per frame at most. Not while a restore is running: the half-built
    // page would overwrite the very position being restored.
    const onScroll = () => {
      if (restoring || saveFrame) return;
      saveFrame = requestAnimationFrame(() => {
        saveFrame = 0;
        if (!restoring) writePosition(addressKey(), el.scrollTop);
      });
    };
    // The person took over: stop fighting them.
    const onUserInput = () => stopRestoring();

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onUserInput, { passive: true });
    el.addEventListener("touchstart", onUserInput, { passive: true });
    el.addEventListener("keydown", onUserInput);

    if (justWentBack()) restore(el, addressKey());
    else {
      stopRestoring();
      el.scrollTop = 0;
    }

    return () => {
      if (saveFrame) cancelAnimationFrame(saveFrame);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onUserInput);
      el.removeEventListener("touchstart", onUserInput);
      el.removeEventListener("keydown", onUserInput);
    };
  }, [ref, pathname]);
}
