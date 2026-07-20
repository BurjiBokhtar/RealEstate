"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// A password-recovery link signs the user in wherever it lands (Supabase
// redirects to the Site URL when the intended /reset-password isn't
// whitelisted) -- which means "clicked reset, just got logged in, never
// asked for a new password". Supabase announces that situation with a
// PASSWORD_RECOVERY auth event; whenever we see it, force the app onto the
// new-password form regardless of where the redirect dropped us.
export function RecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && pathname !== "/reset-password") {
        router.replace("/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
