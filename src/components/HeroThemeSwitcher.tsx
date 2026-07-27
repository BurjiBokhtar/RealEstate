"use client";

import { useEffect, useState } from "react";

// Hero themes: each just re-points the --hero-* gradient stops (see
// globals.css). "atlas" is the default indigo→plum→saffron; the rest give the
// dashboard a different mood without touching the quiet slate rest of the app.
export const HERO_THEMES = [
  { id: "atlas", label: "Атлас", swatch: ["#1c1a3a", "#5b3468", "#e3a73b"] },
  { id: "emerald", label: "Зумуррад", swatch: ["#06302b", "#0f766e", "#6ee7b7"] },
  { id: "sunset", label: "Шафақ", swatch: ["#3b0764", "#be185d", "#f59e0b"] },
  { id: "ocean", label: "Уқёнус", swatch: ["#0c1e4a", "#1d4ed8", "#38bdf8"] },
] as const;

export type HeroThemeId = (typeof HERO_THEMES)[number]["id"];

// Ornament patterns laid over the gradient (see globals.css). `css` is a tiny
// inline preview used on the switcher buttons; the real overlay is applied via
// data-hero-pattern on <html>.
export const HERO_PATTERNS = [
  { id: "none", label: "Ҳамвор", css: "" },
  {
    id: "ikat",
    label: "Атлас нақш",
    css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='23' height='23'%3E%3Cpath d='M11.5 1 L22 11.5 L11.5 22 L1 11.5 Z' fill='none' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E\")",
  },
  {
    id: "trellis",
    label: "Панҷара",
    css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1'%3E%3Cpath d='M0 10 L10 0 L20 10 L10 20 Z'/%3E%3Cpath d='M10 0 V20 M0 10 H20'/%3E%3C/g%3E%3C/svg%3E\")",
  },
  {
    id: "star",
    label: "Ситора",
    css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1'%3E%3Crect x='6' y='6' width='12' height='12'/%3E%3Crect x='6' y='6' width='12' height='12' transform='rotate(45 12 12)'/%3E%3C/g%3E%3C/svg%3E\")",
  },
  {
    id: "dots",
    label: "Нуқтаҳо",
    css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11'%3E%3Ccircle cx='2' cy='2' r='1.4' fill='%23fff'/%3E%3C/svg%3E\")",
  },
  {
    id: "waves",
    label: "Мавҷ",
    css: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='10'%3E%3Cpath d='M0 5 Q7.5 0 15 5 T30 5' fill='none' stroke='%23fff' stroke-width='1.2'/%3E%3C/svg%3E\")",
  },
] as const;

export type HeroPatternId = (typeof HERO_PATTERNS)[number]["id"];

const THEME_KEY = "heroTheme";
const PATTERN_KEY = "heroPattern";

// Apply the effective theme + pattern app-wide. A per-user local choice wins;
// otherwise the company-wide value (from admin Settings) is used. Called from
// AppShell so it survives reloads and reaches every page.
export function applyHeroTheme(companyTheme?: string | null, companyPattern?: string | null) {
  if (typeof window === "undefined") return;
  const theme = window.localStorage.getItem(THEME_KEY) || companyTheme || "atlas";
  if (theme && theme !== "atlas") document.documentElement.dataset.heroTheme = theme;
  else delete document.documentElement.dataset.heroTheme;

  const pattern = window.localStorage.getItem(PATTERN_KEY) || companyPattern || "none";
  if (pattern && pattern !== "none") document.documentElement.dataset.heroPattern = pattern;
  else delete document.documentElement.dataset.heroPattern;
}

export function HeroThemeSwitcher() {
  const [theme, setTheme] = useState<HeroThemeId>("atlas");
  const [pattern, setPattern] = useState<HeroPatternId>("none");

  useEffect(() => {
    setTheme((window.localStorage.getItem(THEME_KEY) as HeroThemeId) || "atlas");
    setPattern((window.localStorage.getItem(PATTERN_KEY) as HeroPatternId) || "none");
  }, []);

  const chooseTheme = (id: HeroThemeId) => {
    setTheme(id);
    window.localStorage.setItem(THEME_KEY, id);
    if (id === "atlas") delete document.documentElement.dataset.heroTheme;
    else document.documentElement.dataset.heroTheme = id;
  };

  const choosePattern = (id: HeroPatternId) => {
    setPattern(id);
    window.localStorage.setItem(PATTERN_KEY, id);
    if (id === "none") delete document.documentElement.dataset.heroPattern;
    else document.documentElement.dataset.heroPattern = id;
  };

  return (
    <div className="flex items-center gap-2.5">
      {/* Colour themes */}
      <div className="flex items-center gap-1.5">
        {HERO_THEMES.map((th) => {
          const isActive = theme === th.id;
          return (
            <button
              key={th.id}
              type="button"
              onClick={() => chooseTheme(th.id)}
              title={th.label}
              aria-label={th.label}
              aria-pressed={isActive}
              className={`h-6 w-6 shrink-0 rounded-full ring-offset-1 ring-offset-transparent transition-all ${
                isActive
                  ? "scale-110 ring-2 ring-white"
                  : "opacity-80 ring-1 ring-white/40 hover:opacity-100"
              }`}
              style={{
                background: `linear-gradient(120deg, ${th.swatch[0]}, ${th.swatch[1]} 55%, ${th.swatch[2]})`,
              }}
            />
          );
        })}
      </div>

      <span className="h-4 w-px bg-white/25" />

      {/* Ornament patterns */}
      <div className="flex items-center gap-1.5">
        {HERO_PATTERNS.map((pt) => {
          const isActive = pattern === pt.id;
          return (
            <button
              key={pt.id}
              type="button"
              onClick={() => choosePattern(pt.id)}
              title={pt.label}
              aria-label={pt.label}
              aria-pressed={isActive}
              className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white/10 transition-all ${
                isActive
                  ? "scale-110 border-white"
                  : "border-white/30 opacity-80 hover:opacity-100"
              }`}
              style={
                pt.css
                  ? { backgroundImage: pt.css, backgroundColor: "rgba(255,255,255,0.12)" }
                  : undefined
              }
            >
              {pt.id === "none" && <span className="text-[9px] font-semibold text-white/70">—</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
