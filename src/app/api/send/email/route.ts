import { NextResponse } from "next/server";
import {
  fetchContract,
  fetchPayment,
  fetchSettings,
  getServiceClient,
  requireUser,
} from "@/lib/send/contractData";

export const dynamic = "force-dynamic";

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ${currency}`;
}

function emailShell(companyName: string, logoUrl: string | null, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a,#334155);padding:28px 32px;text-align:center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="" width="48" height="48" style="border-radius:8px;background:#fff;padding:4px;margin-bottom:8px;" />` : ""}
          <div style="color:#ffffff;font-size:18px;font-weight:600;">${companyName}</div>
        </td>
      </tr>
      <tr><td style="padding:28px 32px;">${bodyHtml}</td></tr>
      <tr>
        <td style="height:6px;background:linear-gradient(90deg,#fbbf24,#fde68a,#fbbf24);"></td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: Request) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const user = await requireUser(supabase, request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured on the server" },
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
  if (!contract.client?.email) {
    return NextResponse.json({ error: "Client has no email on file" }, { status: 400 });
  }

  const settings = await fetchSettings(supabase);
  const companyName = settings.company_name || "RealEstate CRM";
  const remaining = contract.amount - contract.paid_amount;

  let subject: string;
  let bodyHtml: string;

  if (kind === "receipt" && paymentId) {
    const payment = await fetchPayment(supabase, paymentId);
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    subject = `Чек об оплате — договор №${contract.number ?? ""}`;
    bodyHtml = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Оплачено</div>
        <div style="font-size:32px;font-weight:700;color:#0f172a;">${formatMoney(payment.amount, contract.currency)}</div>
      </div>
      <table role="presentation" width="100%" style="font-size:14px;color:#334155;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Договор №</td><td style="padding:6px 0;text-align:right;font-weight:600;">${contract.number ?? "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Объект</td><td style="padding:6px 0;text-align:right;font-weight:600;">${contract.object?.name ?? "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Дата платежа</td><td style="padding:6px 0;text-align:right;font-weight:600;">${payment.due_date}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Оплачено всего</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;">${formatMoney(contract.paid_amount, contract.currency)}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Остаток</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#d97706;">${formatMoney(remaining, contract.currency)}</td></tr>
      </table>`;
  } else {
    subject = `Договор №${contract.number ?? ""} — ${companyName}`;
    bodyHtml = `
      <p style="font-size:14px;color:#334155;margin:0 0 16px;">Здравствуйте, ${contract.client.name}!</p>
      <p style="font-size:14px;color:#334155;margin:0 0 20px;">Направляем данные по вашему договору. Полный текст и печатную версию можно получить у вашего менеджера.</p>
      <table role="presentation" width="100%" style="font-size:14px;color:#334155;">
        <tr><td style="padding:6px 0;color:#94a3b8;">Договор №</td><td style="padding:6px 0;text-align:right;font-weight:600;">${contract.number ?? "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Объект</td><td style="padding:6px 0;text-align:right;font-weight:600;">${contract.object?.name ?? "—"}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Сумма договора</td><td style="padding:6px 0;text-align:right;font-weight:600;">${formatMoney(contract.amount, contract.currency)}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Оплачено</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#059669;">${formatMoney(contract.paid_amount, contract.currency)}</td></tr>
        <tr><td style="padding:6px 0;color:#94a3b8;">Остаток</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#d97706;">${formatMoney(remaining, contract.currency)}</td></tr>
      </table>`;
  }

  const html = emailShell(companyName, settings.company_logo_url, bodyHtml);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `${companyName} <${fromAddress}>`,
      to: contract.client.email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Resend error: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
