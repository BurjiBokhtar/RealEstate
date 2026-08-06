import type { ServiceClient } from "@/lib/supabase/serviceClient";
import { renderContractTemplate } from "@/lib/contracts/renderTemplate";
import { normalizeTjPhone } from "@/lib/phone";

// The reminder run, in one place, so the nightly cron and the "Отправить
// сейчас" button in Settings do exactly the same thing -- an admin can prove
// the whole chain works right now instead of waiting until 05:00 to find out.

const DEFAULT_PAYMENT_TEMPLATE =
  "{{client_name}}, напоминаем: оплата {{amount}} {{currency}} по договору №{{contract_number}} до {{due_date}}.";

const GATEWAY_URL = "https://gateway.payom.tj/api/message";

type DuePayment = {
  id: string;
  due_date: string;
  amount: number;
  contract: {
    number: string | null;
    currency: string;
    status: string;
    client: { name: string; phone: string | null; phone2: string | null } | null;
  } | null;
};

export type ReminderRun = {
  ok: boolean;
  /** Human-readable one-liner, stored on settings.sms_last_result. */
  summary: string;
  advanceSent: number;
  dueSent: number;
  failed: number;
  skipped: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function sendOne(
  apiKey: string,
  senderName: string,
  phone: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ telephone: phone, text, senderName, type: "SMS" }),
    });
    return res.ok || [200, 201, 202].includes(res.status);
  } catch {
    return false;
  }
}

/**
 * Two reminders per installment:
 *   - "advance": N days before the due date (settings.sms_reminder_days),
 *   - "due":     on the due date itself.
 *
 * Each has its own sent-marker column, so neither can fire twice and turning
 * the feature on does not re-send anything already sent.
 *
 * Deliberately NEVER looks at due_date in the past. The previous version
 * selected everything up to today+N, which included every overdue installment
 * ever recorded -- switching the feature on would have dumped hundreds of
 * messages onto clients in one go. Missing a run is recoverable; a mass-send
 * to real phone numbers is not.
 */
export async function sendPaymentReminders(
  // Must be a service-role client bound to the crm schema.
  supabase: ServiceClient
): Promise<ReminderRun> {
  const { data: settings } = await supabase.from("settings").select("*").maybeSingle();

  if (!settings?.sms_enabled) {
    return { ok: true, summary: "Рассылка выключена", advanceSent: 0, dueSent: 0, failed: 0, skipped: 0 };
  }
  if (!settings.sms_api_key || !settings.sms_sender_name) {
    return {
      ok: false,
      summary: "Не заданы API-ключ или имя отправителя",
      advanceSent: 0,
      dueSent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const apiKey = settings.sms_api_key as string;
  const senderName = settings.sms_sender_name as string;
  const template = (settings.sms_payment_template as string) || DEFAULT_PAYMENT_TEMPLATE;
  const days = (settings.sms_reminder_days as number) ?? 3;
  const todayStr = today();

  const select =
    "id, due_date, amount, contract:contracts(number, currency, status, client:clients(name, phone, phone2))";

  // Advance reminder: strictly AFTER today, up to N days out. Strictly after,
  // so a payment due today gets the day-of message below and not both at once.
  const advanceQuery = supabase
    .from("contract_payments")
    .select(select)
    .eq("paid", false)
    .is("reminder_sent_at", null)
    .gt("due_date", todayStr)
    .lte("due_date", plusDays(days));

  // Day-of reminder: due exactly today.
  const dueQuery = supabase
    .from("contract_payments")
    .select(select)
    .eq("paid", false)
    .is("due_reminder_sent_at", null)
    .eq("due_date", todayStr);

  const [advanceRes, dueRes] = await Promise.all([advanceQuery, dueQuery]);
  if (advanceRes.error || dueRes.error) {
    return {
      ok: false,
      summary: `Ошибка чтения графика: ${(advanceRes.error ?? dueRes.error)!.message}`,
      advanceSent: 0,
      dueSent: 0,
      failed: 0,
      skipped: 0,
    };
  }

  let advanceSent = 0;
  let dueSent = 0;
  let failed = 0;
  let skipped = 0;

  const stages: Array<{ rows: DuePayment[]; marker: "reminder_sent_at" | "due_reminder_sent_at" }> = [
    { rows: (advanceRes.data ?? []) as unknown as DuePayment[], marker: "reminder_sent_at" },
    { rows: (dueRes.data ?? []) as unknown as DuePayment[], marker: "due_reminder_sent_at" },
  ];

  for (const stage of stages) {
    for (const payment of stage.rows) {
      // A cancelled contract's leftover schedule is not a debt, and its client
      // must not be chased for it.
      if (!payment.contract || payment.contract.status === "cancelled") {
        skipped++;
        continue;
      }
      // Fall back to the second number: a client whose main line is blank
      // (or was only ever recorded as the spare) should still be reminded.
      const phone =
        normalizeTjPhone(payment.contract.client?.phone) ||
        normalizeTjPhone(payment.contract.client?.phone2);
      if (!phone) {
        skipped++;
        continue;
      }

      const text = renderContractTemplate(template, {
        client_name: payment.contract.client?.name ?? "",
        amount: new Intl.NumberFormat("ru-RU").format(payment.amount),
        currency: payment.contract.currency ?? "TJS",
        contract_number: payment.contract.number ?? "",
        due_date: payment.due_date,
      });

      const delivered = await sendOne(apiKey, senderName, phone, text);
      if (!delivered) {
        failed++;
        continue;
      }
      await supabase
        .from("contract_payments")
        .update({ [stage.marker]: new Date().toISOString() })
        .eq("id", payment.id);
      if (stage.marker === "reminder_sent_at") advanceSent++;
      else dueSent++;
    }
  }

  const summary =
    `Отправлено: ${advanceSent} за ${days} дн. + ${dueSent} в день платежа` +
    (failed ? `, не доставлено: ${failed}` : "") +
    (skipped ? `, пропущено: ${skipped}` : "");

  return { ok: failed === 0, summary, advanceSent, dueSent, failed, skipped };
}

/** Stamps the run onto settings so the UI can show that it is alive. */
export async function recordRun(supabase: ServiceClient, run: ReminderRun) {
  await supabase
    .from("settings")
    .update({ sms_last_run_at: new Date().toISOString(), sms_last_result: run.summary })
    .eq("id", true);
}
