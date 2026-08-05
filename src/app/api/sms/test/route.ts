import { NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/supabase/serviceClient";
import { normalizeTjPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

// Lets an admin fire one real SMS through the configured Payom.tj gateway
// straight from the settings page, instead of saving the API key/sender/
// templates and only finding out days later (when the payment-reminder
// cron happens to run) whether any of it actually works.
export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const admin = await requireAdmin(supabase, request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings } = await supabase.from("settings").select("*").maybeSingle();
  if (!settings?.sms_api_key || !settings?.sms_sender_name) {
    return NextResponse.json(
      { error: "Сначала укажите API-ключ и имя отправителя, затем сохраните." },
      { status: 400 }
    );
  }

  const { phone: rawPhone } = (await request.json().catch(() => ({}))) as { phone?: string };
  const phone = normalizeTjPhone(rawPhone);
  if (!phone) {
    return NextResponse.json({ error: "Укажите номер телефона." }, { status: 400 });
  }

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
        text: "Тест: настройки SMS в ZAKI CRM работают.",
        senderName: settings.sms_sender_name,
        type: "SMS",
      }),
    });
    if (res.ok || [200, 201, 202].includes(res.status)) {
      return NextResponse.json({ ok: true });
    }
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Шлюз ответил ошибкой (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}` },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Сеть недоступна" },
      { status: 502 }
    );
  }
}
