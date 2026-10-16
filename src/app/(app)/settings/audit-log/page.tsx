"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";
import { formatCurrency, type Currency } from "@/lib/currency";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type AuditEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type StaffUser = { id: string; email: string | null };

// Written by crm.audit_context() (migration 053) into every entry under
// details._context -- which client, which contract, which apartment/building
// this row belongs to. A payment or a contract has no readable name of its
// own, only foreign-key ids, so without this a row read as "Пардохт ·
// 16516.66" with no way to tell whose payment it was.
type AuditContext = {
  client_name?: string;
  contract_number?: string;
  object_name?: string;
  building_name?: string;
  currency?: Currency;
};

function isAuditContext(v: unknown): v is AuditContext {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// "Каюмов Муродчон · №15 · Кайҳонавадон 36 Б, №101" -- the answer to "in
// which object/apartment, which contract" that a bare entity_id can't give.
function contextLine(details: Record<string, unknown> | null): string | null {
  const ctx = details?._context;
  if (!isAuditContext(ctx)) return null;
  const place = [ctx.building_name, ctx.object_name].filter(Boolean).join(", ");
  const parts = [ctx.client_name, ctx.contract_number ? `№${ctx.contract_number}` : null, place || null].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Fields that are foreign keys or internal bookkeeping, not something an
// admin reading "what changed" needs to see as a raw UUID or file path --
// the readable side of a relationship (client/contract/apartment name) is
// already carried by _context above.
const HIDDEN_FIELDS = new Set([
  "id",
  "client_id",
  "object_id",
  "contract_id",
  "building_id",
  "interested_object_id",
  "created_by",
  "created_at",
  "updated_at",
  "plan_url",
  "amount_words",
  "_context",
  // Rendered as the dedicated reason line below instead (see reasonLine),
  // not as an ordinary "field: value" row -- "reason: no_phone" read like
  // database internals leaking through, not an explanation.
  "reason",
  "detail",
]);

// "Не отправлено: нет номера телефона" / "Ошибка отправки: 401: ..." --
// the one line that actually answers "why didn't this reminder go out",
// for the two synthetic actions the SMS cron writes when it decides not
// to send (see sendPaymentReminders.ts / send-task-reminders route).
function reasonLine(entry: AuditEntry, t: Dictionary): string | null {
  const reason = entry.details?.reason;
  if (reason !== "no_phone" && reason !== "gateway_error") return null;
  const why = reason === "no_phone" ? t.auditLog.reasonNoPhone : t.auditLog.reasonGatewayError;
  const detail = entry.details?.detail;
  return typeof detail === "string" && detail ? `${why} (${detail})` : why;
}

function isDiffPair(v: unknown): v is { old: unknown; new: unknown } {
  return !!v && typeof v === "object" && !Array.isArray(v) && "old" in v && "new" in v;
}

function formatFieldValue(
  key: string,
  value: unknown,
  currency: Currency | undefined,
  t: Dictionary
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t.auditLog.yes : t.auditLog.no;
  if ((key === "sales_level" || key === "finance_level") && typeof value === "string") {
    return value === "role"
      ? t.users.byRole
      : (t.users.levels[value as keyof typeof t.users.levels] ?? value);
  }
  if (/(_date|_at)$/.test(key)) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("ru-RU");
  }
  if ((key === "amount" || key === "paid_amount" || key === "price" || key === "schedule_remaining") && typeof value === "number") {
    return currency ? formatCurrency(value, currency) : String(value);
  }
  return String(value);
}

// The changed-fields line. For an update, details is {field: {old, new}} and
// each row becomes "Сумма: 340 000 TJS → 349 999,78 TJS". For a create or a
// delete, details is the row itself (to_jsonb of the whole thing), and each
// populated field becomes "Сумма: 349 999,78 TJS" -- the same renderer
// either way, since a {old, new} pair and a plain value are told apart by
// shape, not by which action produced them.
function fieldLines(
  details: Record<string, unknown> | null,
  t: Dictionary
): Array<{ label: string; text: string }> {
  if (!details) return [];
  const currency = isAuditContext(details._context) ? details._context.currency : undefined;
  const lines: Array<{ label: string; text: string }> = [];
  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const label = t.auditLog.fields[key as keyof typeof t.auditLog.fields] ?? key;
    if (isDiffPair(value)) {
      const oldText = formatFieldValue(key, value.old, currency, t);
      const newText = formatFieldValue(key, value.new, currency, t);
      lines.push({ label, text: `${oldText} → ${newText}` });
    } else {
      // A freshly created row's untouched optional fields (passport, notes,
      // ...) are empty on purpose -- listing every blank one would bury the
      // fields actually worth reading under a wall of dashes.
      if (value === null || value === "" || value === false) continue;
      lines.push({ label, text: formatFieldValue(key, value, currency, t) });
    }
  }
  return lines;
}

// The DB trigger writes 'insert'; keep 'create' too so older rows (or a
// future rename) render the same. sms_skipped/sms_failed are written
// straight from app code (not the trigger) for a reminder the SMS cron
// decided not to send -- see sendPaymentReminders.ts.
const ACTION_STYLES: Record<string, string> = {
  insert: "bg-[var(--wash-emerald)] text-[var(--wash-emerald-ink)]",
  create: "bg-[var(--wash-emerald)] text-[var(--wash-emerald-ink)]",
  update: "bg-[var(--wash-sky)] text-[var(--wash-sky-ink)]",
  delete: "bg-[var(--wash-rose)] text-[var(--wash-rose-ink)]",
  sms_skipped: "bg-[var(--wash-amber)] text-[var(--wash-amber-ink)]",
  sms_failed: "bg-[var(--wash-rose)] text-[var(--wash-rose-ink)]",
  sms_broadcast: "bg-[var(--wash-sky)] text-[var(--wash-sky-ink)]",
};

// Was a create/update/else ternary -- "else" silently meant "delete",
// which was fine while those were the only three actions but would have
// mislabelled sms_skipped/sms_failed as "Удаление" the moment they
// showed up. Explicit per-action lookup instead of a chain that assumes
// what's left over.
function actionLabel(action: string, t: Dictionary): string {
  switch (action) {
    case "create":
    case "insert":
      return t.auditLog.actionCreate;
    case "update":
      return t.auditLog.actionUpdate;
    case "sms_skipped":
      return t.auditLog.actionSmsSkipped;
    case "sms_failed":
      return t.auditLog.actionSmsFailed;
    case "sms_broadcast":
      return t.auditLog.actionSmsBroadcast;
    default:
      return t.auditLog.actionDelete;
  }
}

// One action in the program often writes many rows at once -- generating or
// recalculating a payment schedule is 24 "Платёж created" rows in the same
// second. Rows of the SAME kind (create / delete), by the same person, about the
// same contract and within a few seconds of each other are shown as ONE line;
// the individual rows stay one click away. Edits (update) are never merged: two
// edits are two different changes.
type AuditGroup = { key: string; entries: AuditEntry[] };
const GROUPABLE = new Set(["create", "insert", "delete"]);
const GROUP_WINDOW_MS = 10_000;

function groupEntries(list: AuditEntry[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  for (const e of list) {
    const last = groups[groups.length - 1];
    const first = last?.entries[0];
    if (
      last &&
      first &&
      GROUPABLE.has(e.action) &&
      e.action === first.action &&
      e.entity_type === first.entity_type &&
      e.actor_id === first.actor_id &&
      contextLine(e.details) === contextLine(first.details) &&
      Math.abs(new Date(first.created_at).getTime() - new Date(e.created_at).getTime()) <= GROUP_WINDOW_MS
    ) {
      last.entries.push(e);
    } else {
      groups.push({ key: e.id, entries: [e] });
    }
  }
  return groups;
}

// "Платежей: 24 по 6 500 TJS" / "Сроки: 16.07.2026 — 16.12.2027" for a merged
// run of payment rows; other kinds just say how many rows there are.
function groupSummary(entries: AuditEntry[], t: Dictionary): string[] {
  if (entries[0].entity_type !== "contract_payment") {
    return [t.auditLog.groupRecords.replace("{n}", String(entries.length))];
  }
  const ctx = entries[0].details?._context;
  const currency = isAuditContext(ctx) ? ctx.currency : undefined;
  const money = (n: number) => (currency ? formatCurrency(n, currency) : String(n));
  const amounts = entries
    .map((e) => Number(e.details?.amount))
    .filter((n) => Number.isFinite(n));
  const lines: string[] = [];
  if (amounts.length > 0) {
    const same = amounts.every((a) => a === amounts[0]);
    lines.push(
      same
        ? t.auditLog.groupPaymentsSame.replace("{n}", String(entries.length)).replace("{amount}", money(amounts[0]))
        : t.auditLog.groupPaymentsSum
            .replace("{n}", String(entries.length))
            .replace("{sum}", money(amounts.reduce((a, b) => a + b, 0)))
    );
  } else {
    lines.push(t.auditLog.groupRecords.replace("{n}", String(entries.length)));
  }
  const dates = entries
    .map((e) => e.details?.due_date)
    .filter((d): d is string => typeof d === "string" && d !== "")
    .sort();
  if (dates.length > 0) {
    const show = (d: string) => new Date(d).toLocaleDateString("ru-RU");
    lines.push(t.auditLog.groupTerms.replace("{from}", show(dates[0])).replace("{to}", show(dates[dates.length - 1])));
  }
  return lines;
}

export default function AuditLogPage() {
  const { t } = useLocale();
  const { role, loading: roleLoading } = useRole();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const groups = useMemo(() => groupEntries(entries), [entries]);
  // Merged lines the administrator opened to see every row.
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .schema("crm")
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      // The most common cause is the audit migration never having been run
      // on this database -- an empty page with no explanation made that
      // look like the journal itself was broken.
      setLoadError(error.message);
    }
    setEntries((data ?? []) as AuditEntry[]);

    // Resolve actor ids to e-mails via the list_staff RPC. It's a SECURITY
    // DEFINER function (no service key needed), so this works even when the
    // admin API route / service key isn't configured -- which was why every
    // row showed a raw id instead of who did it.
    try {
      const { data: staff } = await supabase.schema("crm").rpc("list_staff");
      const users = (staff ?? []) as StaffUser[];
      setActors(new Map(users.map((u) => [u.id, u.email ?? t.auditLog.unknownActor])));
    } catch {
      // Non-fatal -- entries still show with a raw id if this fails.
    }
    setLoading(false);
  }, [t.auditLog.unknownActor]);

  useEffect(() => {
    if (role === "admin") load();
  }, [role, load]);

  if (roleLoading) return <p className="text-[var(--ink-5)]">{t.common.loading}</p>;
  if (role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <BackLink href="/settings">{t.auditLog.backToSettings}</BackLink>
        <p className="text-[var(--ink-4)]">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/settings">{t.auditLog.backToSettings}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">{t.auditLog.title}</h1>
        <p className="text-sm text-[var(--ink-4)]">{t.auditLog.subtitle}</p>
      </div>

      {loading && <p className="text-[var(--ink-5)]">{t.common.loading}</p>}
      {!loading && loadError && (
        <p className="rounded-lg border border-[var(--wash-rose-border)] bg-[var(--wash-rose)] px-4 py-3 text-sm text-[var(--wash-rose-ink)]">
          {loadError}
        </p>
      )}
      {!loading && !loadError && entries.length === 0 && (
        <p className="text-[var(--ink-5)]">{t.auditLog.empty}</p>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-c)] bg-[var(--surface-1)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--border-c)] text-[var(--ink-4)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t.auditLog.date}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.actor}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.action}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.entityType}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.details}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const entry = group.entries[0];
                const merged = group.entries.length > 1;
                const isOpen = opened.has(group.key);
                const entityLabel =
                  t.auditLog.entityTypes[
                    entry.entity_type as keyof typeof t.auditLog.entityTypes
                  ] ?? entry.entity_type;
                // Where it happened (client/contract/apartment/building) and
                // what actually changed are two different questions -- the
                // first answers "чей это платёж", the second "что именно
                // поменяли" -- so they render as two lines instead of being
                // squeezed into one.
                const where = contextLine(entry.details);
                const lines = fieldLines(entry.details, t);
                const reason = reasonLine(entry, t);
                return (
                  <tr key={group.key} className="border-b border-[var(--border-c2)] last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--ink-3)]">
                      {new Date(entry.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-3)]">
                      {entry.actor_id
                        ? (actors.get(entry.actor_id) ?? entry.actor_id.slice(0, 8))
                        : t.auditLog.unknownActor}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${ACTION_STYLES[entry.action] ?? "bg-[var(--wash-slate)] text-[var(--wash-slate-ink)]"}`}
                      >
                        {actionLabel(entry.action, t)}
                      </span>
                      {merged && (
                        <span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold text-[var(--ink-3)]">
                          ×{group.entries.length}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-2)]">{entityLabel}</td>
                    <td className="px-4 py-3">
                      {where || lines.length > 0 || reason ? (
                        <div className="flex flex-col gap-1">
                          {where && <p className="font-medium text-[var(--ink-2)]">{where}</p>}
                          {reason && (
                            <p
                              className={`text-xs font-medium ${entry.action === "sms_skipped" ? "text-[var(--wash-amber-ink)]" : "text-[var(--wash-rose-ink)]"}`}
                            >
                              {reason}
                            </p>
                          )}
                          {merged && (
                            <>
                              <ul className="flex flex-col gap-0.5">
                                {groupSummary(group.entries, t).map((l) => (
                                  <li key={l} className="text-xs text-[var(--ink-4)]">
                                    {l}
                                  </li>
                                ))}
                              </ul>
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() =>
                                  setOpened((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(group.key)) next.delete(group.key);
                                    else next.add(group.key);
                                    return next;
                                  })
                                }
                                className="self-start text-xs font-medium text-brand underline-offset-2 hover:underline"
                              >
                                {isOpen ? t.auditLog.hideAll : t.auditLog.showAll.replace("{n}", String(group.entries.length))}
                              </button>
                              {isOpen && (
                                <ul className="flex flex-col gap-0.5 border-l-2 border-[var(--border-c)] pl-3">
                                  {group.entries.map((e) => (
                                    <li key={e.id} className="text-xs text-[var(--ink-4)]">
                                      {fieldLines(e.details, t)
                                        .map((l) => `${l.label}: ${l.text}`)
                                        .join(" · ")}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                          {!merged && lines.length > 0 && (
                            <ul className="flex flex-col gap-0.5">
                              {lines.map((l) => (
                                <li key={l.label} className="text-xs text-[var(--ink-4)]">
                                  <span className="text-[var(--ink-5)]">{l.label}:</span> {l.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--ink-3)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
