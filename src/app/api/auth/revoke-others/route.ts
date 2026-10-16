import { NextResponse } from "next/server";
import { getServiceClient, requireUser } from "@/lib/supabase/serviceClient";

export const dynamic = "force-dynamic";

// "One account, one device", the server half. Right after a sign-in the new
// device calls this with its own access token; every OTHER session of that
// account then loses its refresh token, so an old device cannot quietly keep
// working. (The database also records the current device, and the older one
// signs itself out on its next check -- this makes that binding, not just
// polite.) Needs the server's service key; without it, or with the switch off in
// Settings, it does nothing and says so -- signing in never depends on it.
export async function POST(request: Request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ ok: false, reason: "no-service-key" });

  const user = await requireUser(service, request);
  if (!user) return NextResponse.json({ ok: false, reason: "not-signed-in" }, { status: 401 });

  const { data: settings, error: settingsError } = await service
    .from("settings")
    .select("single_session")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) return NextResponse.json({ ok: false, reason: "database-not-updated" });
  if (settings && settings.single_session === false) return NextResponse.json({ ok: false, reason: "switched-off" });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { error } = await service.auth.admin.signOut(token, "others");
  if (error) return NextResponse.json({ ok: false, reason: "revoke-failed" });
  return NextResponse.json({ ok: true });
}
