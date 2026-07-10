"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/lib/auth/useRole";

type StaffUser = {
  id: string;
  email: string | null;
  role: "admin" | "manager";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "manager">("manager");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { headers: await authHeaders() });
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
    } else {
      setError(data.error);
    }
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

  const handleRoleChange = async (userId: string, role: "admin" | "manager") => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: await authHeaders(),
      body: JSON.stringify({ userId, role }),
    });
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
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/settings" className="w-fit text-sm text-slate-500 hover:text-slate-900">
        {t.users.backToSettings}
      </Link>
      <h1 className="text-2xl font-semibold">{t.users.title}</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.users.email}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{t.users.password}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <p className="text-xs text-slate-400">{t.users.passwordHint}</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.users.role}</span>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "admin" | "manager")}
            className="w-fit rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="manager">{t.users.roleManager}</option>
            <option value="admin">{t.users.roleAdmin}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !email || !password}
          className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? t.users.creating : t.users.create}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {loading ? (
        <p className="text-slate-400">{t.common.loading}</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 font-medium">{t.users.email}</th>
              <th className="py-2 font-medium">{t.users.role}</th>
              <th className="py-2 font-medium">{t.users.createdAt}</th>
              <th className="py-2 font-medium">{t.users.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2">{u.email}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      handleRoleChange(u.id, e.target.value as "admin" | "manager")
                    }
                    className="rounded-md border border-slate-300 px-2 py-1"
                  >
                    <option value="manager">{t.users.roleManager}</option>
                    <option value="admin">{t.users.roleAdmin}</option>
                  </select>
                </td>
                <td className="py-2 text-slate-500">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(u.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    {t.users.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
