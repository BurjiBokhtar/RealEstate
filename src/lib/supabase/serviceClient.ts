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
