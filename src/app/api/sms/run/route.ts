import { NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/supabase/serviceClient";
import { sendPaymentReminders, recordRun } from "@/lib/sms/sendPaymentReminders";

export const dynamic = "force-dynamic";

// Run the reminder pass right now, on an admin's click, using the exact code
// the nightly cron runs. Waiting until 05:00 to learn whether the schedule,
// the templates and the gateway all line up is a terrible feedback loop --
// and it is how this feature stayed broken without anyone noticing.
//
// Safe to press repeatedly: each installment carries its own sent-marker, so
// a second run sends nothing to anyone who already got the message.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const admin = await requireAdmin(supabase, request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await sendPaymentReminders(supabase);
  await recordRun(supabase, run);
  return NextResponse.json(run);
}
