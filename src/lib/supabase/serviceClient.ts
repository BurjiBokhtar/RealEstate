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

// Verifies the caller is authenticated AND has role='admin' in crm.profiles.
// Always checked server-side against the profiles row, never trusting
// anything the client claims about its own role.
export async function requireAdmin(supabase: ServiceClient, request: Request) {
  const user = await requireUser(supabase, request);
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return null;
  return user;
}

// A client that acts AS THE CALLER: anon key + the caller's JWT, so every
// query runs under RLS with the caller's own role and building scope. Server
// routes must use this -- not the service client -- whenever they read CRM
// data on behalf of a user; the service client sees everything and would
// happily hand a manager another building's contracts by id.
export function getUserScopedClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearers+/i, "");
  if (!supabaseUrl || !anonKey || !token) return null;
  return createClient(supabaseUrl, anonKey, {
    db: { schema: "crm" },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}
