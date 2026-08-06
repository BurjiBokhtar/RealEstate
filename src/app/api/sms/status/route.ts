import { NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/supabase/serviceClient";

export const dynamic = "force-dynamic";

// Why the mailout is or isn't running, in one answer.
//
// The whole feature used to fail in complete silence: with CRON_SECRET unset
// the nightly job got a 401 and there was nowhere in the app that said so. An
// admin saw a filled-in API key, a working test button, and no messages ever
// arriving. This endpoint surfaces the parts an admin cannot see from the
// browser -- which server-side variables exist -- so Settings can name the
// missing piece instead of leaving it to guesswork.
//
// Only booleans are returned. The secrets themselves never leave the server.
export async function GET(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    // Name the variable. A bare "Supabase not configured" here is the same
    // silent dead end this endpoint exists to remove -- and a missing
    // SUPABASE_SERVICE_ROLE_KEY is itself one of the reasons the mailout
    // never ran.
    return NextResponse.json(
      {
        error:
          "На сервере не задана переменная SUPABASE_SERVICE_ROLE_KEY (Vercel → Project Settings → Environment Variables). Без неё рассылка не сможет прочитать график платежей.",
      },
      { status: 500 }
    );
  }
  const admin = await requireAdmin(supabase, request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("settings")
    .select("sms_enabled, sms_sender_name, sms_api_key, sms_last_run_at, sms_last_result")
    .maybeSingle();

  return NextResponse.json({
    enabled: !!settings?.sms_enabled,
    hasApiKey: !!settings?.sms_api_key,
    hasSenderName: !!settings?.sms_sender_name,
    // Without this, Vercel's scheduler cannot authenticate to the cron route
    // and every nightly run is rejected.
    hasCronSecret: !!process.env.CRON_SECRET,
    lastRunAt: settings?.sms_last_run_at ?? null,
    lastResult: settings?.sms_last_result ?? null,
  });
}
