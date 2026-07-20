"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LoginScene } from "@/components/LoginScene";

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Company branding for the header. The login page runs before auth, and
  // full settings are staff-only -- public_branding() (026) exposes exactly
  // the name and logo, nothing else. Falls back to the app name until the
  // RPC answers (or if the migration isn't applied yet).
  const [brand, setBrand] = useState<{ name: string | null; logo: string | null }>({
    name: null,
    logo: null,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .schema("crm")
      .rpc("public_branding")
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setBrand({
            name: row.company_name ?? null,
            logo: row.company_logo_url ?? null,
          });
        }
      });
  }, []);

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
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <LoginScene />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 overflow-hidden rounded-2xl border border-white/40 bg-white/85 p-7 shadow-2xl shadow-slate-900/30 backdrop-blur-md"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900" />
        <div className="flex items-center gap-3">
          {brand.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo}
              alt=""
              className="h-11 w-11 rounded-xl border border-slate-200 object-contain p-1"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {brand.name || t.appName}
            </h1>
            <p className="text-sm text-slate-500">{t.login.title}</p>
          </div>
        </div>
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
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 h-11 rounded-lg bg-slate-900 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? t.common.loading : t.login.submit}
        </button>
        <button
          type="button"
          disabled={resetting}
          onClick={async () => {
            setError("");
            setNotice("");
            if (!email.trim()) {
              setError(t.login.resetEnterEmail);
              return;
            }
            setResetting(true);
            const supabase = createClient();
            // Sends only to addresses that exist in Supabase Auth; the
            // wording never confirms whether an account exists, so the
            // form can't be used to probe for staff e-mails.
            await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setResetting(false);
            setNotice(t.login.resetSent);
          }}
          className="self-center text-sm text-slate-500 underline-offset-2 transition-colors hover:text-slate-800 hover:underline disabled:opacity-50"
        >
          {t.login.forgot}
        </button>
      </form>
    </div>
  );
}
