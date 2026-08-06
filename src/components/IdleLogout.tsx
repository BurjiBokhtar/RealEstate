"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Sign the user out after 30 minutes without any interaction. A CRM that
// handles money is routinely left open on a front-desk machine; an
// unattended session is the easiest "hack" there is. Activity is anything
// the person actually does (mouse, keys, touch, scroll); the check runs
// every minute rather than resetting a timer on every mousemove.
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 1000;
// Shared across tabs so a shakhmatka tab being worked in keeps a client-card
// tab alive too, and one tab logging out doesn't strand the others.
const STORAGE_KEY = "crm-last-activity";
// localStorage.setItem is a SYNCHRONOUS, disk-backed write. Doing one per
// mousemove (which fires 60+ times a second, and again for every scroll frame)
// blocked the main thread continuously and made the whole app feel like it was
// dragging. Timing out after 30 minutes does not need second-level precision,
// so the shared write happens at most this often.
const WRITE_EVERY_MS = 15_000;

export function IdleLogout() {
  const router = useRouter();
  const lastActivity = useRef(0);
  const lastWrite = useRef(0);

  useEffect(() => {
    const mark = () => {
      const now = Date.now();
      lastActivity.current = now;
      // The in-memory timestamp is what this tab checks; the storage write is
      // only there so other tabs can see the activity, and can be throttled.
      if (now - lastWrite.current < WRITE_EVERY_MS) return;
      lastWrite.current = now;
      try {
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // Storage can be unavailable (private mode) -- per-tab still works.
      }
    };
    mark();

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });

    const interval = window.setInterval(async () => {
      let last = lastActivity.current;
      try {
        const stored = Number(localStorage.getItem(STORAGE_KEY));
        if (stored > last) last = stored;
      } catch {}
      if (Date.now() - last < IDLE_LIMIT_MS) return;

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // Not signed in (login page, expired already) -- nothing to do.
      if (!session) return;
      await supabase.auth.signOut();
      router.replace("/login");
    }, CHECK_EVERY_MS);

    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
