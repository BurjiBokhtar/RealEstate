import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPaymentReminders, recordRun } from "@/lib/sms/sendPaymentReminders";

export const dynamic = "force-dynamic";

// The nightly run. All the actual work lives in lib/sms/sendPaymentReminders
// so the "Отправить сейчас" button in Settings executes the identical code
// path -- if it works there, it works here.
export async function GET(request: Request) {
  // Fail closed: if CRON_SECRET isn't configured, reject every request
  // instead of skipping the check. This endpoint holds the service-role key
  // and sends SMS through a paid gateway -- leaving it reachable with no
  // secret set at all would let anyone on the internet trigger it.
  //
  // NOTE: this is also the single most common reason the whole feature looks
  // dead. Vercel only attaches `Authorization: Bearer <CRON_SECRET>` to cron
  // invocations when that variable exists in the project, so with it unset
  // every nightly run got a 401 and nothing was ever sent. /api/sms/status
  // now reports this state so it is visible in Settings instead of silent.
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: "crm" } });

  const run = await sendPaymentReminders(supabase);
  await recordRun(supabase, run);
  return NextResponse.json(run);
}
