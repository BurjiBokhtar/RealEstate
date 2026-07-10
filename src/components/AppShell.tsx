"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
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
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white sm:flex sm:flex-col">
        <div className="px-5 py-5 text-lg font-semibold tracking-tight text-slate-900">
          {t.appName}
        </div>
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
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:justify-end">
          <span className="text-lg font-semibold sm:hidden">{t.appName}</span>
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
        </header>

        <main className="flex-1 bg-slate-50 p-5">{children}</main>
      </div>
    </div>
  );
}
