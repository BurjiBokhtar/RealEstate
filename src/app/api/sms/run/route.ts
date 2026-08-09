import { NextResponse } from "next/server";
import { adminErrorMessage, checkAdmin, getServiceClient } from "@/lib/supabase/serviceClient";
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
  // Says WHICH of the four things failed. "Unauthorized" alone covered an
  // expired session, a service key from the wrong Supabase project, a missing
  // profile row and a non-admin role -- four problems fixed four different
  // ways, and no way to tell them apart from the screen.
  const admin = await checkAdmin(supabase, request);
  if (!admin.ok) return NextResponse.json({ error: adminErrorMessage(admin) }, { status: 403 });

  const run = await sendPaymentReminders(supabase);
  await recordRun(supabase, run);
  return NextResponse.json(run);
}
