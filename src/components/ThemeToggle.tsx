"use client";

import { useEffect, useState } from "react";

// Reads/writes the SAME localStorage key and data-theme attribute the
// blocking script in layout.tsx already reads on first paint (see there for
// why it's a plain script tag and not a React effect). This component just
// keeps them in sync after mount and lets the user flip it.
//
// Deliberately a manual choice, not prefers-color-scheme: the accent dark
// mode uses (a fixed yellow, see globals.css's --accent-dark) is a chosen
// look, not "whatever the OS happens to be set to" -- so it starts light for
// everyone and stays that way until someone actually clicks this.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Runs once on mount to read what the blocking script already applied --
  // not before, so this never disagrees with what's already on screen.
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("theme", "dark");
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-c)] text-[var(--ink-4)] transition-colors hover:bg-[var(--hover-c)] hover:text-[var(--ink-2)]"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
