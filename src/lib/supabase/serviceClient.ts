import { createClient } from "@supabase/supabase-js";

function makeServiceClient(url: string, key: string) {
  return createClient(url, key, { db: { schema: "crm" } });
}

export type ServiceClient = ReturnType<typeof makeServiceClient>;

export function getServiceClient(): ServiceClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return makeServiceClient(supabaseUrl, serviceRoleKey);
}

// Names the variable that's actually missing. The old blanket "Supabase not
// configured" was indistinguishable from the app having no Supabase at all,
// which sent people looking at the URL/anon key -- while the real gap was
// almost always SUPABASE_SERVICE_ROLE_KEY, the one var no route can work
// without and the one that was never documented.
export function missingServiceEnv(): string {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return `Не задана переменная окружения ${missing.join(" и ")} на сервере (Vercel → Project Settings → Environment Variables). Без неё создание аккаунтов невозможно.`;
}

export async function requireUser(supabase: ServiceClient, request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Same check, but says WHY it failed. "Not admin" and "the service key can't
// even talk to this Supabase project" are opposite problems -- the first is
// fixed in SQL, the second in Vercel env vars -- and collapsing them into
// one 403 sent the user chasing the wrong one.
export async function checkAdmin(
  supabase: ServiceClient,
  request: Request
): Promise<
  | { ok: true; user: { id: string; email?: string } }
  | { ok: false; reason: "no-token" | "bad-token" | "no-profile" | "not-admin"; detail?: string }
> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, reason: "no-token" };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, reason: "bad-token", detail: error?.message };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, reason: "bad-token", detail: profileError.message };
  }
  if (!profile) return { ok: false, reason: "no-profile" };
  if (profile.role !== "admin") return { ok: false, reason: "not-admin" };
  return { ok: true, user: data.user };
}

// A client that acts AS THE CALLER: anon key + the caller's JWT, so every
// query runs under RLS with the caller's own role and building scope. Server
// routes must use this -- not the service client -- whenever they read CRM
// data on behalf of a user; the service client sees everything and would
// happily hand a manager another building's contracts by id.
export function getUserScopedClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !token) return null;
  return createClient(supabaseUrl, anonKey, {
    db: { schema: "crm" },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// Turns a failed admin check into a sentence that names the actual next step.
// Shared, so every admin-gated route explains itself the same way instead of
// answering a bare "Unauthorized" -- which is indistinguishable between "your
// session expired", "the server key is from the wrong project" and "you simply
// aren't an admin", three problems fixed in three different places.
export function adminErrorMessage(check: Awaited<ReturnType<typeof checkAdmin>>): string {
  if (check.ok) return "";
  switch (check.reason) {
    case "no-token":
      return "Сессия не передана. Выйдите из программы и войдите заново.";
    case "bad-token":
      return `Сервер не смог проверить вашу сессию (${check.detail ?? "нет деталей"}). Чаще всего это значит, что SUPABASE_SERVICE_ROLE_KEY на Vercel взят из ДРУГОГО проекта Supabase — он должен быть из того же проекта, что и NEXT_PUBLIC_SUPABASE_URL. Скопируйте service_role именно из этого проекта (Project Settings → API) и сделайте Redeploy.`;
    case "no-profile":
      return "У вашей учётной записи нет роли. Выполните в Supabase → SQL Editor: insert into crm.profiles (id, role) select id, 'admin' from auth.users where email = 'ВАШ_EMAIL' on conflict (id) do update set role = 'admin'; — затем выйдите и войдите заново.";
    case "not-admin":
      return "Ваша роль — не админ. Смените роль тем же SQL (set role = 'admin') и перезайдите.";
  }
}

/**
 * Does SUPABASE_SERVICE_ROLE_KEY belong to the same Supabase project as
 * NEXT_PUBLIC_SUPABASE_URL?
 *
 * This is the single most common way these routes break, and until now it
 * could only be diagnosed by a human comparing two opaque strings. The legacy
 * service key is a JWT carrying a `ref` claim -- the project ref -- and the URL
 * carries the same ref as its first hostname label, so the mismatch can simply
 * be reported.
 *
 * The payload is read WITHOUT verifying the signature, which is fine: nothing
 * is trusted from it, it is only compared against a value we already have. The
 * key never leaves the server.
 *
 * Returns null when it cannot tell -- the newer `sb_secret_...` keys are not
 * JWTs and carry no ref, and a wrong guess here would send someone chasing a
 * problem they don't have.
 */
export function serviceKeyProjectRef(): { urlRef: string; keyRef: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null; // not a legacy JWT key -- can't tell
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as { ref?: string };
    const keyRef = payload.ref;
    const urlRef = new URL(url).hostname.split(".")[0];
    if (!keyRef || !urlRef) return null;
    return { urlRef, keyRef };
  } catch {
    return null;
  }
}
