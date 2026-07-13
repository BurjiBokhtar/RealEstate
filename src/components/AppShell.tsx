"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/lib/settings/SettingsProvider";
import { QuickSearch } from "@/components/QuickSearch";
import type { Locale } from "@/lib/i18n/dictionaries";

const navItems = [
  { href: "/", key: "dashboard" as const },
  { href: "/objects", key: "objects" as const },
  { href: "/clients", key: "clients" as const },
  { href: "/tasks", key: "tasks" as const },
  { href: "/contracts", key: "contracts" as const },
  { href: "/buildings", key: "buildings" as const },
  { href: "/settings", key: "settings" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useLocale();
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const brandName = settings.company_name || t.appName;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    // h-screen + overflow-hidden pins the shell to the viewport: the
    // sidebar and header never move, only <main> scrolls. Print must undo
    // all of it -- a fixed-height scroll container clips a printed
    // document to one viewport worth of content.
    <div className="flex h-screen w-full overflow-hidden print:block print:h-auto print:overflow-visible">
      <aside className="hero-gradient relative hidden h-full w-60 shrink-0 overflow-y-auto sm:flex sm:flex-col print:hidden">
        {/* Same faint skyline as the dashboard hero, so the two read as one
            visual system instead of a bright gradient page dropped into a
            plain white shell. */}
        <svg
          viewBox="0 0 240 400"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full text-white/[0.06]"
        >
          <path
            fill="currentColor"
            d="M0,320 L40,260 L80,300 L120,220 L160,280 L200,200 L240,250 L240,400 L0,400 Z"
          />
        </svg>

        <Link
          href="/"
          className="relative flex items-center gap-2.5 px-5 py-5 transition-opacity hover:opacity-90"
        >
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg bg-white/90 object-contain p-1"
            />
          )}
          <span className="line-clamp-2 text-base font-semibold leading-tight tracking-tight text-white">
            {brandName}
          </span>
        </Link>
        <nav className="relative flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-white/75 hover:translate-x-0.5 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto flex flex-col gap-2 border-t border-white/10 px-3 py-4">
          {userEmail && <span className="truncate px-3 text-xs text-white/40">{userEmail}</span>}
          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-white/75 transition-all hover:bg-white/10 hover:text-rose-200 active:scale-[0.97]"
          >
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              {t.login.logout}
            </span>
          </button>
        </div>
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col print:block print:h-auto">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:justify-end print:hidden">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2 transition-opacity hover:opacity-80 sm:hidden"
          >
            {settings.company_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.company_logo_url}
                alt=""
                className="h-7 w-7 shrink-0 rounded object-contain"
              />
            )}
            <span className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">
              {brandName}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <QuickSearch />
            <div className="flex items-center gap-1 rounded-full border border-slate-200 p-1 text-sm">
              {(["ru", "tj"] as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    locale === l
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {l === "ru" ? "RU" : "ТОҶ"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-5 print:overflow-visible print:bg-white print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
