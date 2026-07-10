"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager";

// Defaults to the least-privileged role until proven otherwise — if a user
// has no crm.profiles row (or the fetch fails), they're treated as a manager.
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
      setRole(profile?.role === "admin" ? "admin" : "manager");
      setLoading(false);
    });
  }, []);

  return { role, loading };
}
