import type { SupabaseClient } from "@supabase/supabase-js";

// One account, one device. A device that signs in writes a random token of its
// own to the database (crm.claim_session); the app then asks now and again
// whether that token is still the account's current one (crm.check_session).
// Signing in somewhere else replaces the token, so the older device finds out
// on its next check and signs itself out. The token lives in localStorage so
// every tab of one browser counts as the same device.

const KEY = "crm-session-token";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// "Chrome · Android" -- enough for an administrator to tell devices apart.
export function deviceLabel(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\/|CriOS/.test(ua)
        ? "Chrome"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  // Android and iPhone user agents also say "Linux" / "Mac OS X": check them first.
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export function readSessionToken(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetSessionToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable -- nothing to forget
  }
}

// Called right after a successful sign-in. Never blocks the sign-in: if the
// database has not been updated yet, the RPC fails and everything carries on as
// before.
export async function claimSession(supabase: SupabaseClient): Promise<void> {
  const token = randomToken();
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Without storage this device cannot prove itself later; the check reads
    // "no token" and treats it as another device -- the safe direction.
  }
  const { error } = await supabase.schema("crm").rpc("claim_session", { p_token: token, p_device: deviceLabel() });
  if (error) return;
  // Also ask the server to revoke the other devices' refresh tokens, so a
  // device cannot keep working quietly behind the check. Best effort: it needs
  // the server's service key, and its absence must not matter here.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    void fetch("/api/auth/revoke-others", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
  }
}

export type SessionState = "ok" | "other" | "none" | "unknown";

// "unknown" (the database has no such function yet, the network is down) is
// never a reason to sign anybody out.
export async function checkSession(supabase: SupabaseClient): Promise<SessionState> {
  const { data, error } = await supabase.schema("crm").rpc("check_session", { p_token: readSessionToken() });
  if (error || typeof data !== "string") return "unknown";
  return data === "ok" || data === "other" || data === "none" ? data : "unknown";
}
