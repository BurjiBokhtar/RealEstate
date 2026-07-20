"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager" | "director";

// The user's role, kept LIVE: re-read on every sign-in/sign-out and token
// refresh, not just once on first mount. The old version fetched once, so
// granting someone admin in SQL changed nothing on screen until a full
// reload -- which read as "the program is broken" every single time.
// RLS enforces the real limits server-side either way; this hook only
// decides what UI to show.
export function useRole(): { role: Role; loading: boolean } {
  const [role, setRole] = useState<Role>("manager");
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
      setRole(
        profile?.role === "admin" || profile?.role === "director"
          ? (profile.role as Role)
          : "manager"
      );
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
