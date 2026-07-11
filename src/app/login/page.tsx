"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(t.login.error);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900" />
        <h1 className="text-xl font-semibold text-slate-900">{t.login.title}</h1>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.login.email}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.login.password}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 h-11 rounded-lg bg-slate-900 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? t.common.loading : t.login.submit}
        </button>
      </form>
    </div>
  );
}
