"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager" | "director";

// Defaults to the least-privileged writing role until proven otherwise — if
// a user has no crm.profiles row (or the fetch fails), they're treated as a
// manager. (RLS enforces the real limits server-side either way; this hook
// only decides what UI to show.)
export function useRole(): { role: Role; loading: boolean } {
  const [role, setRole] = useState<Role>("manager");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .schema("crm")
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      setRole(
        profile?.role === "admin" || profile?.role === "director"
          ? (profile.role as Role)
          : "manager"
      );
      setLoading(false);
    });
  }, []);

  return { role, loading };
}
