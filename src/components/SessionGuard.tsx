"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useAuth } from "@/lib/auth/useRole";
import { checkSession, claimSession, forgetSessionToken } from "@/lib/auth/deviceSession";

// "One account, one device" (see lib/auth/deviceSession.ts): while someone is
// signed in, keep asking whether this device is still the account's current one.
// Asked at once, every half minute, and the moment the tab comes back to the
// front -- so a device that was replaced finds out when its owner next looks at
// it, not an hour later.
const CHECK_EVERY_MS = 30_000;

export function SessionGuard() {
  const router = useRouter();
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    let stopped = false;
    let running = false;
    const supabase = createClient();

    const run = async () => {
      if (stopped || running) return;
      running = true;
      try {
        const state = await checkSession(supabase);
        if (stopped) return;
        if (state === "other") {
          forgetSessionToken();
          await supabase.auth.signOut();
          router.replace("/login?reason=other-device");
          router.refresh();
        } else if (state === "none") {
          // No record yet (the first run after the update): this device takes it.
          await claimSession(supabase);
        }
      } finally {
        running = false;
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, router]);

  return null;
}
