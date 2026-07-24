"use client";

import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
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

// A short human label for the affected row, pulled from whatever field the
// snapshot happens to have (name for clients, number for contracts, ...) --
// so the log reads as "клиент Иванов" instead of a bare UUID. For updates,
// the trigger also stores the map of changed fields; listing their names
// answers "what exactly was edited" without opening anything.
function summarize(entry: AuditEntry): string | null {
  const d = entry.details;
  if (!d) return null;
  const parts: string[] = [];
  if (typeof d.name === "string" && d.name) parts.push(d.name);
  else if (typeof d.number === "string" && d.number) parts.push(`№${d.number}`);
  else if (typeof d.amount === "number") parts.push(String(d.amount));
  if (d.changed && typeof d.changed === "object") {
    const keys = Object.keys(d.changed as Record<string, unknown>);
    if (keys.length > 0) parts.push(`(${keys.join(", ")})`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

// The DB trigger writes 'insert'; keep 'create' too so older rows (or a
// future rename) render the same.
const ACTION_STYLES: Record<string, string> = {
  insert: "bg-emerald-50 text-emerald-600",
  create: "bg-emerald-50 text-emerald-600",
  update: "bg-sky-50 text-sky-600",
  delete: "bg-rose-50 text-rose-600",
};

export default function AuditLogPage() {
  const { t } = useLocale();
  const { role, loading: roleLoading } = useRole();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        <BackLink href="/settings">{t.auditLog.backToSettings}</BackLink>
        <p className="text-slate-500">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/settings">{t.auditLog.backToSettings}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">{t.auditLog.title}</h1>
        <p className="text-sm text-slate-500">{t.auditLog.subtitle}</p>
      </div>

      {loading && <p className="text-slate-400">{t.common.loading}</p>}
      {!loading && loadError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </p>
      )}
      {!loading && !loadError && entries.length === 0 && (
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
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${ACTION_STYLES[entry.action] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {entry.action === "create" || entry.action === "insert"
                          ? t.auditLog.actionCreate
                          : entry.action === "update"
                            ? t.auditLog.actionUpdate
                            : t.auditLog.actionDelete}
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
