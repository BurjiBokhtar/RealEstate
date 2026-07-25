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

const STORAGE_KEY = "heroTheme";

// Apply a saved theme as early as possible. Called from AppShell on mount so
// the choice survives a full reload and applies app-wide (accent-color too).
export function applyStoredHeroTheme() {
  if (typeof window === "undefined") return;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved && saved !== "atlas") {
    document.documentElement.dataset.heroTheme = saved;
  } else {
    delete document.documentElement.dataset.heroTheme;
  }
}

export function HeroThemeSwitcher() {
  const [active, setActive] = useState<HeroThemeId>("atlas");

  useEffect(() => {
    const saved = (window.localStorage.getItem(STORAGE_KEY) as HeroThemeId) || "atlas";
    setActive(saved);
  }, []);

  const choose = (id: HeroThemeId) => {
    setActive(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    if (id === "atlas") delete document.documentElement.dataset.heroTheme;
    else document.documentElement.dataset.heroTheme = id;
  };

  return (
    <div className="flex items-center gap-1.5">
      {HERO_THEMES.map((th) => {
        const isActive = active === th.id;
        return (
          <button
            key={th.id}
            type="button"
            onClick={() => choose(th.id)}
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
  );
}
