import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RealEstate CRM",
  description: "CRM для риэлторских и строительных компаний",
  // Installable app: manifest.ts serves the manifest; these cover the
  // iOS/Safari side, which ignores it.
  appleWebApp: { capable: true, title: "CRM", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-icon.png" },
};

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
      </body>
    </html>
  );
}
