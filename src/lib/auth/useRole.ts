"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager" | "director";
// A signed-in user who has NOT been given a role yet (no profiles row) is
// "none": they can authenticate but must not see or touch anything until an
// admin assigns them a role. Distinct from the assignable staff roles.
export type RoleOrNone = Role | "none";

// The user's role, kept LIVE: re-read on every sign-in/sign-out and token
// refresh, not just once on first mount. The old version fetched once, so
// granting someone admin in SQL changed nothing on screen until a full
// reload -- which read as "the program is broken" every single time.
// RLS enforces the real limits server-side either way; this hook only
// decides what UI to show.
export function useRole(): { role: RoleOrNone; loading: boolean } {
  const [role, setRole] = useState<RoleOrNone>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .schema("crm")
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // Only an explicit, recognised role grants access. No profile row (or an
      // unknown value) means "none" -- the app is blocked for them until an
      // admin assigns a role. Never silently fall back to "manager".
      const r = profile?.role;
      setRole(r === "admin" || r === "director" || r === "manager" ? r : "none");
      setLoading(false);
    };

    load();
    // Token refreshes fire every ~hour; each one re-reads the role, so a
    // role granted in SQL shows up without anyone logging out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { role, loading };
}
