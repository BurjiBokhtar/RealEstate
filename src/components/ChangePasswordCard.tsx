"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Lets the signed-in user change their own password from inside the app --
// so after logging in with the seeded default (Admin12345) they can set a
// real one without touching Supabase. Just calls auth.updateUser.
export function ChangePasswordCard() {
  const { t } = useLocale();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (pw1.length < 6) {
      setMsg({ text: t.password.tooShort, ok: false });
      return;
    }
    if (pw1 !== pw2) {
      setMsg({ text: t.password.mismatch, ok: false });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
      return;
    }
    setPw1("");
    setPw2("");
    setMsg({ text: t.password.done, ok: true });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[15px] font-semibold text-slate-800">{t.password.title}</p>
      <p className="mt-0.5 text-sm text-slate-500">{t.password.hint}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
          <span className="font-semibold text-slate-600">{t.password.new}</span>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="••••••"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
          <span className="font-semibold text-slate-600">{t.password.repeat}</span>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="••••••"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={saving || pw1.length < 6}
          className="h-10 rounded-lg bg-gradient-to-r from-[#1c1a3a] to-[#5b3468] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "…" : t.password.save}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
