"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useRole } from "@/lib/auth/useRole";

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

async function authHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

// A short human label for a deleted row, pulled from whatever field the
// snapshot happens to have (name for clients, number for contracts, ...) --
// so the log reads as "deleted client Иванов" instead of a bare UUID.
function summarize(entry: AuditEntry): string | null {
  const d = entry.details;
  if (!d) return null;
  if (typeof d.name === "string") return d.name;
  if (typeof d.number === "string" && d.number) return `№${d.number}`;
  if (typeof d.amount === "number") return String(d.amount);
  return null;
}

export default function AuditLogPage() {
  const { t } = useLocale();
  const { role, loading: roleLoading } = useRole();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .schema("crm")
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries((data ?? []) as AuditEntry[]);

    try {
      const res = await fetch("/api/admin/users", { headers: await authHeaders() });
      if (res.ok) {
        const { users } = (await res.json()) as { users: StaffUser[] };
        setActors(new Map(users.map((u) => [u.id, u.email ?? t.auditLog.unknownActor])));
      }
    } catch {
      // Non-fatal -- entries still show with a raw id if this fails.
    }
    setLoading(false);
  }, [t.auditLog.unknownActor]);

  useEffect(() => {
    if (role === "admin") load();
  }, [role, load]);

  if (roleLoading) return <p className="text-slate-400">{t.common.loading}</p>;
  if (role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <Link href="/settings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
          {t.auditLog.backToSettings}
        </Link>
        <p className="text-slate-500">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/settings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        {t.auditLog.backToSettings}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t.auditLog.title}</h1>
        <p className="text-sm text-slate-500">{t.auditLog.subtitle}</p>
      </div>

      {loading && <p className="text-slate-400">{t.common.loading}</p>}
      {!loading && entries.length === 0 && (
        <p className="text-slate-400">{t.auditLog.empty}</p>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t.auditLog.date}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.actor}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.action}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.entityType}</th>
                <th className="px-4 py-3 font-medium">{t.auditLog.details}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const entityLabel =
                  t.auditLog.entityTypes[
                    entry.entity_type as keyof typeof t.auditLog.entityTypes
                  ] ?? entry.entity_type;
                const summary = summarize(entry);
                return (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {new Date(entry.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.actor_id
                        ? (actors.get(entry.actor_id) ?? entry.actor_id.slice(0, 8))
                        : t.auditLog.unknownActor}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
                        {t.auditLog.actionDelete}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{entityLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{summary ?? "—"}</td>
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
