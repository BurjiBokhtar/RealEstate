import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { RecoveryRedirect } from "@/components/RecoveryRedirect";
import { getBranding } from "@/lib/branding";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <LocaleProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </LocaleProvider>
        <ServiceWorkerRegistrar />
        <RecoveryRedirect />
      </body>
    </html>
  );
}
