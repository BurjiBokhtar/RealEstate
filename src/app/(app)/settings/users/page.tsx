"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useRole, type Role } from "@/lib/auth/useRole";
import type { Building } from "@/lib/buildings/types";

type StaffUser = {
  id: string;
  email: string | null;
  role: Role;
  created_at: string;
};

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

export default function UsersPage() {
  const { t } = useLocale();
  const { role, loading: roleLoading } = useRole();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  // userId -> set of building ids the manager is allowed to see
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("manager");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [res, buildingsRes, assignmentsRes] = await Promise.all([
      fetch("/api/admin/users", { headers: await authHeaders() }),
      supabase.schema("crm").from("buildings").select("*").order("name"),
      supabase.schema("crm").from("manager_buildings").select("user_id, building_id"),
    ]);
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
    } else {
      setError(data.error);
    }
    setBuildings((buildingsRes.data ?? []) as Building[]);
    const map: Record<string, Set<string>> = {};
    for (const row of (assignmentsRes.data ?? []) as Array<{
      user_id: string;
      building_id: string;
    }>) {
      (map[row.user_id] ??= new Set()).add(row.building_id);
    }
    setAssignments(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === "admin") load();
  }, [role, load]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ email, password, role: newRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setEmail("");
      setPassword("");
      setNewRole("manager");
      await load();
    } else {
      setError(data.error);
    }
    setCreating(false);
  };

  const handleRoleChange = async (userId: string, newUserRole: Role) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newUserRole } : u)));
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ userId, role: newUserRole }),
    });
  };

  // Assignments write straight to crm.manager_buildings -- RLS lets only
  // admins insert/delete there, and this page is already admin-gated.
  const toggleAssignment = async (userId: string, buildingId: string) => {
    const supabase = createClient();
    const has = assignments[userId]?.has(buildingId) ?? false;
    // Optimistic flip; reload on error.
    setAssignments((prev) => {
      const next = { ...prev, [userId]: new Set(prev[userId] ?? []) };
      if (has) next[userId].delete(buildingId);
      else next[userId].add(buildingId);
      return next;
    });
    const { error: writeError } = has
      ? await supabase
          .schema("crm")
          .from("manager_buildings")
          .delete()
          .eq("user_id", userId)
          .eq("building_id", buildingId)
      : await supabase
          .schema("crm")
          .from("manager_buildings")
          .insert({ user_id: userId, building_id: buildingId });
    if (writeError) {
      setError(writeError.message);
      await load();
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm(t.users.confirmDelete)) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  if (roleLoading) return <p className="text-slate-400">{t.common.loading}</p>;
  if (role !== "admin") {
    return (
      <div className="flex flex-col gap-3">
        <Link href="/settings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
          {t.users.backToSettings}
        </Link>
        <p className="text-slate-500">{t.users.accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/settings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        {t.users.backToSettings}
      </Link>
      <h1 className="text-2xl font-semibold">{t.users.title}</h1>

      {/* Create form: one row -- email, password, role, button. The hints
          live in placeholders/tooltips instead of paragraphs so the card
          stays two lines tall. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-600">{t.users.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mail.com"
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-600">{t.users.password}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              title={t.users.passwordHint}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-600">{t.users.role}</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              title={t.users.rolesHint}
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="manager">{t.users.roleManager}</option>
              <option value="admin">{t.users.roleAdmin}</option>
              <option value="director">{t.users.roleDirector}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !email || password.length < 6}
            className="h-10 rounded-lg bg-gradient-to-r from-[#1c1a3a] to-[#5b3468] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
          >
            {creating ? t.users.creating : t.users.create}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">{t.users.rolesHint}</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      {loading ? (
        <p className="text-slate-400">{t.common.loading}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t.users.email}</th>
                <th className="px-4 py-3 font-medium">{t.users.role}</th>
                <th className="px-4 py-3 font-medium">{t.users.createdAt}</th>
                <th className="px-4 py-3 font-medium">{t.users.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <>
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        className="rounded-md border border-slate-300 px-2 py-1"
                      >
                        <option value="manager">{t.users.roleManager}</option>
                        <option value="admin">{t.users.roleAdmin}</option>
                        <option value="director">{t.users.roleDirector}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {u.role === "manager" && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedUser((prev) => (prev === u.id ? null : u.id))
                            }
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                          >
                            {t.users.assignBuildings} ({assignments[u.id]?.size ?? 0})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          {t.users.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === u.id && u.role === "manager" && (
                    <tr key={`${u.id}-buildings`} className="border-b border-slate-100">
                      <td colSpan={4} className="bg-slate-50 px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-slate-500">
                          {t.users.assignHint}
                        </p>
                        {buildings.length === 0 ? (
                          <p className="text-xs text-slate-400">{t.buildings.empty}</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {buildings.map((b) => {
                              const checked = assignments[u.id]?.has(b.id) ?? false;
                              return (
                                <label
                                  key={b.id}
                                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                    checked
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAssignment(u.id, b.id)}
                                    className="sr-only"
                                  />
                                  {b.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
