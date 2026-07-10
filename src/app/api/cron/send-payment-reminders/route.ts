import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DuePayment = {
  id: string;
  due_date: string;
  amount: number;
  contract: {
    number: string | null;
    client: { name: string; phone: string | null } | null;
  } | null;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: "crm" },
  });

  const { data: settings } = await supabase.from("settings").select("*").maybeSingle();
  if (!settings?.sms_api_key) {
    return NextResponse.json({ message: "SMS not configured, skipping" });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (settings.sms_reminder_days ?? 3));
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const { data: payments, error } = await supabase
    .from("contract_payments")
    .select("id, due_date, amount, contract:contracts(number, client:clients(name, phone))")
    .eq("paid", false)
    .is("reminder_sent_at", null)
    .lte("due_date", targetDateStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dueList = (payments ?? []) as unknown as DuePayment[];
  let sent = 0;
  let failed = 0;

  for (const payment of dueList) {
    const phone = payment.contract?.client?.phone;
    if (!phone) continue;

    const text = `Уважаемый(ая) ${payment.contract?.client?.name ?? ""}, напоминаем: оплата ${payment.amount} TJS по договору №${payment.contract?.number ?? ""} до ${payment.due_date}.`;

    try {
      const res = await fetch("https://gateway.payom.tj/api/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${settings.sms_api_key}`,
        },
        body: JSON.stringify({
          telephone: phone,
          text,
          senderName: settings.sms_sender_name || "BurjiBohtar",
          type: "SMS",
        }),
      });
      if (res.ok || [200, 201, 202].includes(res.status)) {
        await supabase
          .from("contract_payments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", payment.id);
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ checked: dueList.length, sent, failed });
}
