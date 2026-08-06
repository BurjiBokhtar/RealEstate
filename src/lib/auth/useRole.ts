"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "manager" | "director";
// A signed-in user who has NOT been given a role yet (no profiles row) is
// "none": they can authenticate but must not see or touch anything until an
// admin assigns them a role. Distinct from the assignable staff roles.
export type RoleOrNone = Role | "none";

export type AuthSnapshot = {
  userId: string | null;
  email: string | null;
  role: RoleOrNone;
  loading: boolean;
};

// ---------------------------------------------------------------------------
// ONE shared auth store for the whole app.
//
// This used to be a plain useState/useEffect hook, so every component that
// asked "what's my role?" paid for its own round trips -- and a typical screen
// asks three or four times (AppShell + the page + ContractPayments +
// ManagerSales). Worse, each instance called auth.getUser(), which is a real
// network request to the auth server, AND subscribed to onAuthStateChange,
// whose INITIAL_SESSION event fires immediately on subscribe and ran the whole
// load a second time. Opening one page cost roughly eight sequential requests
// before any data query even started -- which is what made the app feel like
// it barely opens.
//
// Now: one load, one listener, one snapshot, shared by every consumer through
// useSyncExternalStore. The session comes from getSession() (reads the cookie
// that is already there, no network) instead of getUser(); this only decides
// which UI to render, and RLS remains the real lock on the data. The proxy
// still verifies the token server-side on every request.
// ---------------------------------------------------------------------------

const INITIAL: AuthSnapshot = { userId: null, email: null, role: "none", loading: true };

let snapshot: AuthSnapshot = INITIAL;
const listeners = new Set<() => void>();
let started = false;
let inflight: Promise<void> | null = null;

function publish(next: AuthSnapshot) {
  if (
    snapshot.userId === next.userId &&
    snapshot.email === next.email &&
    snapshot.role === next.role &&
    snapshot.loading === next.loading
  ) {
    // Identical snapshot -- don't hand consumers a new object, or
    // useSyncExternalStore re-renders every screen for nothing.
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

async function load() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) {
    publish({ userId: null, email: null, role: "none", loading: false });
    return;
  }
  const { data: profile } = await supabase
    .schema("crm")
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  // Only an explicit, recognised role grants access. No profile row (or an
  // unknown value) means "none" -- the app is blocked for them until an
  // admin assigns a role. Never silently fall back to "manager".
  const r = (profile as { role?: string } | null)?.role;
  publish({
    userId: user.id,
    email: user.email ?? null,
    role: r === "admin" || r === "director" || r === "manager" ? r : "none",
    loading: false,
  });
}

// Concurrent callers share one in-flight request instead of each firing their
// own copy of the same two queries.
export function refreshAuth(): Promise<void> {
  if (inflight) return inflight;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void refreshAuth();
    const supabase = createClient();
    // Token refreshes fire every ~hour; each one re-reads the role, so a role
    // granted in SQL shows up without anyone logging out. INITIAL_SESSION is
    // skipped: it fires synchronously on subscribe and describes the very
    // session the refreshAuth() above is already reading.
    supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      void refreshAuth();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => INITIAL;

// Everything the app knows about the signed-in user, from the shared store.
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// The user's role, kept LIVE: re-read on every sign-in/sign-out and token
// refresh, not just once on first mount. RLS enforces the real limits
// server-side either way; this hook only decides what UI to show.
export function useRole(): { role: RoleOrNone; loading: boolean } {
  const { role, loading } = useAuth();
  return { role, loading };
}
