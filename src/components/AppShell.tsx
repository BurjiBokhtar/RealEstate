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
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white sm:flex sm:flex-col print:hidden">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-5 transition-opacity hover:opacity-80"
        >
          {settings.company_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.company_logo_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded object-contain"
            />
          )}
          <span className="line-clamp-2 text-base font-semibold leading-tight tracking-tight text-slate-900">
            {brandName}
          </span>
        </Link>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-100"
                }`}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 px-3 py-4">
          {userEmail && <span className="truncate px-3 text-xs text-slate-400">{userEmail}</span>}
          <button
            onClick={handleLogout}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.97]"
          >
            <span className="transition-transform duration-200 group-hover:translate-x-0.5">
              {t.login.logout}
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:justify-end print:hidden">
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

        <main className="flex-1 bg-slate-50 p-5 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}
