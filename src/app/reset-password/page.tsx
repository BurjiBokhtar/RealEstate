"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LoginScene } from "@/components/LoginScene";

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

// Lands here from the password-recovery e-mail. Supabase exchanges the
// token from the link for a temporary session automatically on page load;
// all this page does is take a new password twice and call updateUser.
// If there's no session (stale or reused link), it says so instead of
// failing silently.
export default function ResetPasswordPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The recovery token in the URL is processed asynchronously; poll a few
    // times before declaring the link dead.
    let tries = 0;
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }
      tries += 1;
      if (tries < 10) setTimeout(check, 400);
      else setReady(false);
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return;
    if (password !== password2) {
      setError(t.login.resetMismatch);
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <LoginScene />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 overflow-hidden rounded-2xl border border-white/40 bg-white/85 p-7 shadow-2xl shadow-slate-900/30 backdrop-blur-md"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900" />
        <h1 className="text-xl font-semibold text-slate-900">{t.login.resetTitle}</h1>

        {ready === null && <p className="text-sm text-slate-400">{t.common.loading}</p>}

        {ready === false && (
          <>
            <p className="text-sm text-red-600">{t.login.resetNoSession}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="h-11 rounded-lg bg-brand text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              ← {t.login.title}
            </button>
          </>
        )}

        {ready === true && (
          <>
            <p className="text-sm text-slate-500">{t.login.resetHint}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{t.login.password}</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{t.login.resetPassword2}</span>
              <input
                type="password"
                required
                minLength={6}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className={FIELD_CLASS}
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || password.length < 6}
              className="mt-1 h-11 rounded-lg bg-brand text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? t.login.resetDone : t.login.resetSubmit}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
