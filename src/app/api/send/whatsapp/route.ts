import { NextResponse } from "next/server";
import {
  fetchContract,
  fetchPayment,
  fetchSettings,
  getServiceClient,
  normalizePhone,
  requireUser,
} from "@/lib/send/contractData";

export const dynamic = "force-dynamic";

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ${currency}`;
}

export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const user = await requireUser(supabase, request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN are not configured" },
      { status: 500 }
    );
  }

  const { contractId, kind, paymentId } = (await request.json()) as {
    contractId: string;
    kind: "contract" | "receipt";
    paymentId?: string;
  };

  const contract = await fetchContract(supabase, contractId);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (!contract.client?.phone) {
    return NextResponse.json({ error: "Client has no phone on file" }, { status: 400 });
  }

  const settings = await fetchSettings(supabase);
  const companyName = settings.company_name || "RealEstate CRM";
  const remaining = contract.amount - contract.paid_amount;

  let message: string;

  if (kind === "receipt" && paymentId) {
    const payment = await fetchPayment(supabase, paymentId);
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    message =
      `*${companyName}*\n` +
      `Квитанция об оплате по договору №${contract.number ?? "—"}\n\n` +
      `Оплачено: *${formatMoney(payment.amount, contract.currency)}*\n` +
      `Дата: ${payment.due_date}\n` +
      `Объект: ${contract.object?.name ?? "—"}\n\n` +
      `Всего оплачено: ${formatMoney(contract.paid_amount, contract.currency)}\n` +
      `Остаток: ${formatMoney(remaining, contract.currency)}`;
  } else {
    message =
      `*${companyName}*\n` +
      `Договор №${contract.number ?? "—"}\n\n` +
      `Здравствуйте, ${contract.client.name}! Направляем данные по вашему договору.\n\n` +
      `Объект: ${contract.object?.name ?? "—"}\n` +
      `Сумма договора: ${formatMoney(contract.amount, contract.currency)}\n` +
      `Оплачено: ${formatMoney(contract.paid_amount, contract.currency)}\n` +
      `Остаток: ${formatMoney(remaining, contract.currency)}`;
  }

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(contract.client.phone),
        type: "text",
        text: { body: message },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `WhatsApp API error: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
