import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { renderContractTemplate } from "@/lib/contracts/renderTemplate";
import { normalizeTjPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const DEFAULT_PAYMENT_TEMPLATE =
  "{{client_name}}, напоминаем: оплата {{amount}} {{currency}} по договору №{{contract_number}} до {{due_date}}.";

type DuePayment = {
  id: string;
  due_date: string;
  amount: number;
  contract: {
    number: string | null;
    currency: string;
    client: { name: string; phone: string | null } | null;
  } | null;
};

export async function GET(request: Request) {
  // Fail closed: if CRON_SECRET isn't configured, reject every request
  // instead of skipping the check. This endpoint holds the service-role key
  // and sends SMS through a paid gateway -- leaving it reachable with no
  // secret set at all would let anyone on the internet trigger it.
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
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: "crm" },
  });

  const { data: settings } = await supabase.from("settings").select("*").maybeSingle();
  if (!settings?.sms_api_key || !settings?.sms_sender_name) {
    return NextResponse.json({ message: "SMS not configured, skipping" });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (settings.sms_reminder_days ?? 3));
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const { data: payments, error } = await supabase
    .from("contract_payments")
    .select(
      "id, due_date, amount, contract:contracts(number, currency, client:clients(name, phone))"
    )
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
    const phone = normalizeTjPhone(payment.contract?.client?.phone);
    if (!phone) continue;

    const text = renderContractTemplate(
      settings.sms_payment_template || DEFAULT_PAYMENT_TEMPLATE,
      {
        client_name: payment.contract?.client?.name ?? "",
        amount: new Intl.NumberFormat("ru-RU").format(payment.amount),
        currency: payment.contract?.currency ?? "TJS",
        contract_number: payment.contract?.number ?? "",
        due_date: payment.due_date,
      }
    );

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
          senderName: settings.sms_sender_name,
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
