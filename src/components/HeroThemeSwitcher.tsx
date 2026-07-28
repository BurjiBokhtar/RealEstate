"use client";

// Hero themes: each just re-points the --hero-* gradient stops (see
// globals.css). "atlas" is the default indigo→plum→saffron; the rest give the
// dashboard a different mood. The choice is company-wide, set by an admin in
// Settings -- there is no per-user override.
export const HERO_THEMES = [
  { id: "atlas", label: "Атлас", swatch: ["#1c1a3a", "#5b3468", "#e3a73b"] },
  { id: "emerald", label: "Зумуррад", swatch: ["#06302b", "#0f766e", "#6ee7b7"] },
  { id: "sunset", label: "Шафақ", swatch: ["#3b0764", "#be185d", "#f59e0b"] },
  { id: "ocean", label: "Уқёнус", swatch: ["#0c1e4a", "#1d4ed8", "#38bdf8"] },
] as const;

export type HeroThemeId = (typeof HERO_THEMES)[number]["id"];

// Ornament patterns laid over the gradient (see globals.css). `css` is a tiny
// inline preview used on the Settings buttons; the real overlay is applied via
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

// Apply the company-wide theme + pattern app-wide. Called from AppShell with
// the values loaded from Settings, so an admin change reaches every page
// (accent-color too). No local storage / per-user override anymore.
export function applyHeroTheme(theme?: string | null, pattern?: string | null) {
  if (typeof document === "undefined") return;
  if (theme && theme !== "atlas") document.documentElement.dataset.heroTheme = theme;
  else delete document.documentElement.dataset.heroTheme;

  if (pattern && pattern !== "none") document.documentElement.dataset.heroPattern = pattern;
  else delete document.documentElement.dataset.heroPattern;
}
