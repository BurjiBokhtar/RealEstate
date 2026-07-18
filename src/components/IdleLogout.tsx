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

export function IdleLogout() {
  const router = useRouter();
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, String(lastActivity.current));
      } catch {
        // Storage can be unavailable (private mode) -- per-tab still works.
      }
    };
    mark();

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;
    // Passive + no per-event work beyond a Date.now() write keeps this free.
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
