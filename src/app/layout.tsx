import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { RecoveryRedirect } from "@/components/RecoveryRedirect";
import { getBranding } from "@/lib/branding";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Dynamic so the browser tab, the iOS home-screen icon and the app title all
// follow the company the admin configured. iOS ignores the manifest, so its
// icon has to come from this apple-touch-icon.
export async function generateMetadata(): Promise<Metadata> {
  const { name, logo } = await getBranding();
  const appName = name || "RealEstate CRM";
  return {
    title: appName,
    description: "CRM для риэлторских и строительных компаний",
    appleWebApp: { capable: true, title: name || "CRM", statusBarStyle: "black-translucent" },
    icons: { apple: logo || "/apple-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#1c1a3a",
  // The app is a fixed-height shell with its own scroll areas; let it use
  // the full screen on phones, notch included.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Same lookup generateMetadata() already does (cached, so this doesn't cost
  // a second DB round trip in practice) -- but here it decides the hero theme
  // BEFORE the first byte goes out, so the page never paints the default
  // "atlas" indigo before swapping to the company's real theme. AppShell and
  // the login page still call applyHeroTheme() client-side, but only once
  // settings have actually loaded, so they confirm this value rather than
  // momentarily resetting it.
  // No Supabase keys: stop here with instructions instead of letting the app
  // mount. The pieces that run on the server already return empty in this
  // case, but createBrowserClient() throws outright, and it throws during the
  // first render of a provider -- so React unmounts the whole tree and the
  // visitor gets a bare "This page couldn't load" with the real reason only
  // in the browser console. There IS a SetupNotice component for exactly this
  // situation and it never got the chance to render.
  //
  // Deliberately plain markup: no providers are mounted at this point, so the
  // usual translated components are unavailable, hence both languages inline.
  if (!isSupabaseConfigured()) {
    return (
      <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-slate-900">
          <main className="max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm leading-relaxed text-amber-900 shadow-sm">
            <h1 className="text-base font-semibold">Supabase не настроен</h1>
            <p className="mt-2">
              Не заданы переменные <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
              <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Добавьте их в
              настройках проекта (Vercel → Settings → Environment Variables) и{" "}
              <strong>обязательно пересоберите проект</strong> — Redeploy. Эти переменные
              вшиваются в сборку, поэтому без пересборки ничего не изменится.
            </p>
            <p className="mt-3 text-amber-800">
              Supabase танзим нашудааст: <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              ва <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> холӣ мебошанд.
              Онҳоро илова кунед ва лоиҳаро аз нав созед (Redeploy).
            </p>
          </main>
        </body>
      </html>
    );
  }

  const { heroTheme, heroPattern } = await getBranding();
  const htmlDataAttrs: Record<string, string> = {};
  if (heroTheme && heroTheme !== "atlas") htmlDataAttrs["data-hero-theme"] = heroTheme;
  if (heroPattern && heroPattern !== "none") htmlDataAttrs["data-hero-pattern"] = heroPattern;

  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      {...htmlDataAttrs}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <LocaleProvider>
          <SettingsProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </SettingsProvider>
        </LocaleProvider>
        <ServiceWorkerRegistrar />
        <RecoveryRedirect />
      </body>
    </html>
  );
}
