"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { claimSession } from "@/lib/auth/deviceSession";
import { SetupNotice } from "@/components/SetupNotice";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LoginScene } from "@/components/LoginScene";
import { LoginAside } from "@/components/LoginAside";
import { quoteOfTheDay } from "@/lib/quotes";
import { applyHeroTheme } from "@/components/HeroThemeSwitcher";

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 px-3.5 text-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

// Why the person is back at the sign-in screen (?reason=...): they were signed
// out because the account was opened on another device, or because the PIN was
// entered wrong too many times. The page is prerendered, so the server never
// knows the query string: it renders nothing, and the browser reads it once the
// page is hydrated (no mismatch, no Suspense boundary needed).
const noopSubscribe = () => () => {};

function ReasonNotice() {
  const { t } = useLocale();
  const reason = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("reason"),
    () => null
  );
  const text = reason === "other-device" ? t.login.otherDevice : reason === "pin" ? t.login.pinLocked : "";
  if (!text) return null;
  return (
    <p role="status" className="rounded-lg bg-[var(--wash-amber)] px-3 py-2.5 text-sm text-[var(--wash-amber-ink)]">
      {text}
    </p>
  );
}

export default function LoginPage() {
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();
  // A build-time env check, constant for the whole session. Without the keys
  // the browser Supabase client throws the instant it is constructed, so this
  // screen used to render React's blank "This page couldn't load" -- with no
  // hint that the deployment is simply missing its environment variables,
  // which is exactly the state a freshly created project is in.
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // "Forgot password": the same card turns into a small recovery form. The login IS
  // the person's e-mail, so recovery is one field. `sentTo` is the address the last
  // link was requested for; `cooldown` is the seconds before asking again (Supabase
  // sends one recovery e-mail per address per minute).
  const [mode, setMode] = useState<"signin" | "recover">("signin");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Company branding for the header. The login page runs before auth, and
  // full settings are staff-only -- public_branding() (026) exposes exactly
  // the name and logo, nothing else. Falls back to the app name until the
  // RPC answers (or if the migration isn't applied yet).
  // One pick per render, shared by the desktop panel and the phone copy.
  const dailyQuote = quoteOfTheDay();
  const [brand, setBrand] = useState<{ name: string | null; logo: string | null }>({
    name: null,
    logo: null,
  });

  useEffect(() => {
    if (!configured) return;
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
          // Paint the login page in the company's chosen theme too (the
          // AppShell that normally applies it isn't mounted here).
          applyHeroTheme(row.hero_theme ?? null, row.hero_pattern ?? null);
        }
      });
  }, [configured]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const handleRecover = async () => {
    setError("");
    const address = email.trim();
    if (!address) {
      setError(t.login.resetEnterEmail);
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    // For an address that has no account Supabase answers "ok" as well, so the form
    // cannot be used to find out who works here. Only real failures come back as an
    // error: too many requests, or the project has no mail sending set up -- the
    // second one used to be swallowed and the person waited for a letter that was
    // never going to come.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      if (resetError.status === 429 || resetError.code === "over_email_send_rate_limit") {
        setCooldown(60);
        setError(t.login.recoverRateLimited);
      } else {
        console.error("resetPasswordForEmail failed:", resetError.message);
        setError(t.login.recoverFailed);
      }
      return;
    }
    setSentTo(address);
    setCooldown(60);
  };

  const backToSignIn = () => {
    setMode("signin");
    setError("");
    setSentTo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    if (mode === "recover") {
      void handleRecover();
      return;
    }
    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setSubmitting(false);
      setError(t.login.error);
      return;
    }
    // This device takes the account's one seat (any other device is signed out
    // on its next check). Never blocks: a database that is behind just skips it.
    await claimSession(supabase);
    setSubmitting(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <LoginScene />

      {/* Left column -- the living half: clock, real local weather, quote of
          the day. The logo, company name and "sign in" caption used to be
          repeated here as well as in the form, so on a desktop screen the
          same two lines were printed twice, side by side. Identity now lives
          in exactly one place: the form header, on every screen size. */}
      <div className="relative z-10 hidden flex-1 flex-col justify-between p-14 text-white lg:flex">
        <div />
        <LoginAside />
        <p className="text-xs tracking-wide text-white/60">
          developed by{" "}
          <a
            href="https://www.instagram.com/iammirzozoda"
            target="_blank"
            rel="noopener noreferrer"
            className="-mx-1.5 rounded px-1.5 font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            IMRON
          </a>
        </p>
      </div>

      {/* Form side. */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center p-4 lg:w-[480px] lg:shrink-0 lg:p-10">
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 overflow-hidden rounded-2xl border border-white/40 bg-white/90 p-7 shadow-2xl shadow-slate-900/30 backdrop-blur-md"
      >
        <div className="card-accent-bar absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--brand-strong)] via-[var(--brand)] to-[var(--hero-3)]" />
        {/* Language first: the person picking РУ/ТҶ hasn't logged in yet,
            so the login page itself must offer the choice. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {brand.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo}
                alt=""
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
              />
            )}
            <div>
              <h1 className="bg-gradient-to-r from-[var(--brand-strong)] to-[var(--brand)] bg-clip-text text-xl font-bold tracking-tight text-transparent">
                {brand.name || t.appName}
              </h1>
              <p className="text-sm text-slate-500">
                {mode === "recover" ? t.login.recoverTitle : t.login.title}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200">
            {(["ru", "tj"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={`px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
                  locale === l
                    ? "bg-brand text-white"
                    : "bg-white text-slate-500 hover:text-slate-800"
                }`}
              >
                {l === "ru" ? "Ру" : "Тҷ"}
              </button>
            ))}
          </div>
        </div>
        {/* A deployment whose environment variables were never set: say so
            here, where the person is already looking, instead of letting the
            Supabase client throw and replace the whole screen with a blank
            error. Signing in is impossible either way, but this way the
            reason is on screen. */}
        {!configured && <SetupNotice />}
        {mode === "signin" && <ReasonNotice />}

        {mode === "recover" && (
          <p className="text-sm leading-relaxed text-slate-600">{t.login.recoverHint}</p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">{t.login.email}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        {mode === "signin" && (
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
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {mode === "recover" && sentTo && (
          <p role="status" className="rounded-lg bg-[var(--wash-emerald)] px-3 py-2.5 text-sm text-[var(--wash-emerald-ink)]">
            {t.login.recoverSentTo.replace("{email}", sentTo)}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !configured || (mode === "recover" && cooldown > 0)}
          className="btn-brand mt-1 h-11 rounded-lg text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting
            ? t.common.loading
            : mode === "signin"
              ? t.login.submit
              : cooldown > 0
                ? t.login.recoverWait.replace("{s}", String(cooldown))
                : sentTo
                  ? t.login.recoverResend
                  : t.login.recoverSend}
        </button>
        <button
          type="button"
          disabled={!configured}
          onClick={() => {
            if (mode === "signin") {
              setMode("recover");
              setError("");
              setSentTo(null);
            } else {
              backToSignIn();
            }
          }}
          className="-mx-1.5 self-center rounded px-1.5 py-0.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
        >
          {mode === "signin" ? t.login.forgot : `← ${t.login.recoverBack}`}
        </button>
      </form>

      {/* The brand panel is desktop-only, so phones would lose the quote
          entirely. A compact copy, no clock or weather -- on a small screen
          those compete with the form instead of framing it. */}
      <figure className="mt-6 max-w-sm border-l-2 border-white/30 pl-3 lg:hidden">
        <blockquote className="text-[13px] italic leading-relaxed text-white/85">
          “{dailyQuote[locale === "tj" ? "tj" : "ru"]}”
        </blockquote>
        <figcaption className="mt-1 text-[11px] text-white/55">
          — {dailyQuote.author[locale === "tj" ? "tj" : "ru"]}
        </figcaption>
      </figure>

      {/* Credit -- shown under the form on phones (the desktop copy lives in
          the brand panel). */}
      <p className="mt-6 text-xs tracking-wide text-white/70 lg:hidden">
        developed by{" "}
        <a
          href="https://www.instagram.com/iammirzozoda"
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-1.5 rounded px-1.5 font-semibold text-white/90 transition-colors hover:bg-white/15"
        >
          IMRON
        </a>
      </p>
      </div>
    </div>
  );
}
