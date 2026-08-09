"use client";

import { useMemo } from "react";
import { useLocalWeather } from "@/lib/weather";
import { useNow } from "@/lib/useClock";
import { skylineOfTheDay } from "@/components/LoginSkylines";

// Full-screen living scene behind the auth card: sky follows the local time
// of day, colours shift with the real weather (Open-Meteo, no key, falls back
// to clear sky offline), clouds drift, rain falls when it actually rains,
// windows light up at night. Pure SVG + CSS keyframes -- no images, nothing
// to load.
//
// What stands on the ground changes daily -- see LoginSkylines. This file owns
// everything the four drawings have in common (sky, sun, moon, stars, clouds,
// precipitation) so a skyline only has to supply its own silhouette.

type Phase = "dawn" | "day" | "dusk" | "night";

function phaseOfDay(at: Date): Phase {
  const h = at.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

// Sky gradients per phase, muted when the weather is grey.
const SKIES: Record<Phase, Record<"bright" | "grey", [string, string, string]>> = {
  dawn: {
    bright: ["#2b2a5e", "#b85c8a", "#f2a65a"],
    grey: ["#3a3f55", "#6d6a80", "#a58a76"],
  },
  day: {
    bright: ["#2563ab", "#5ba3d9", "#bfe0f5"],
    grey: ["#4a5a6d", "#7d8fa1", "#b3bfc9"],
  },
  dusk: {
    bright: ["#1c1a3a", "#5b3468", "#e3a73b"],
    grey: ["#23243a", "#4a4258", "#8a6a52"],
  },
  night: {
    bright: ["#0b1026", "#1c1a3a", "#2d2a55"],
    grey: ["#0d1120", "#20222f", "#333047"],
  },
};

const SCENE_CSS = `
@keyframes crane-sway { 0%, 100% { transform: rotate(-1.1deg); } 50% { transform: rotate(1.1deg); } }
@keyframes hook-swing { 0%, 100% { transform: translateX(-6px); } 50% { transform: translateX(6px); } }
@keyframes cloud-drift-a { from { transform: translateX(-260px); } to { transform: translateX(1700px); } }
@keyframes cloud-drift-b { from { transform: translateX(1700px); } to { transform: translateX(-320px); } }
@keyframes rain-fall { from { transform: translateY(-140px); } to { transform: translateY(900px); } }
@keyframes snow-fall { from { transform: translateY(-40px) translateX(0); } to { transform: translateY(900px) translateX(60px); } }
@keyframes beacon { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
@keyframes lamp-glow { 0%, 100% { opacity: 0.16; } 50% { opacity: 0.30; } }
@keyframes star-twinkle { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.25; } }
@keyframes skyline-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .scene-anim { animation: none !important; } }
`;

export function LoginScene() {
  // Once a minute, not once a second -- the scene is a large SVG and the sky
  // only ever changes on the hour boundaries. Daytime is the pre-hydration
  // guess: the scene is decoration, so a neutral sky is better than a blank one.
  const now = useNow(60_000);
  const phase: Phase = now ? phaseOfDay(now) : "day";
  const { kind: weather } = useLocalWeather();

  // The silhouette waits for the browser. Which day it is depends on the
  // viewer's timezone, and this page is prerendered at build time -- picking
  // on the server would freeze one drawing into the HTML until the next
  // deploy, then swap it the moment React took over. Holding it back one
  // frame and fading it in is honest and reads as intentional.
  const skyline = now ? skylineOfTheDay(now) : null;

  const grey = weather === "rain" || weather === "cloudy";
  const [top, mid, bottom] = SKIES[phase][grey ? "grey" : "bright"];
  const night = phase === "night" || phase === "dusk";
  const dark = grey ? "#171a26" : phase === "day" ? "#2e4057" : "#12142a";
  const darker = grey ? "#10121b" : phase === "day" ? "#22303f" : "#0b0c1c";

  const raindrops = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ x: (i * 137) % 1440, d: (i * 53) % 100 })),
    []
  );
  const snowflakes = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ x: (i * 197) % 1440, d: (i * 71) % 100 })),
    []
  );
  const stars = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ x: (i * 241) % 1440, y: (i * 97) % 320 })),
    []
  );

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <style>{SCENE_CSS}</style>

      <svg viewBox="0 0 1440 810" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id="login-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} style={{ transition: "stop-color 1.5s" }} />
            <stop offset="55%" stopColor={mid} style={{ transition: "stop-color 1.5s" }} />
            <stop offset="100%" stopColor={bottom} style={{ transition: "stop-color 1.5s" }} />
          </linearGradient>
        </defs>
        <rect width="1440" height="810" fill="url(#login-sky)" />

        {phase === "night" && weather !== "rain" && (
          <g fill="#ffffff">
            {stars.map((s, i) => (
              <circle
                key={i}
                cx={s.x}
                cy={s.y}
                r={i % 3 === 0 ? 1.6 : 1}
                className="scene-anim"
                style={{
                  animation: `star-twinkle ${2 + (i % 5)}s ease-in-out infinite`,
                  animationDelay: `${(i % 7) * 0.4}s`,
                }}
              />
            ))}
          </g>
        )}

        {phase !== "night" && !grey && (
          <circle
            cx={phase === "day" ? 1120 : 260}
            cy={phase === "day" ? 130 : 200}
            r="52"
            fill={phase === "day" ? "#fff3c4" : "#ffce7a"}
            opacity="0.9"
          />
        )}
        {phase === "night" && (
          <g>
            <circle cx="1150" cy="140" r="42" fill="#e8e6f5" opacity="0.95" />
            <circle cx="1136" cy="132" r="9" fill={top} opacity="0.35" />
            <circle cx="1162" cy="152" r="6" fill={top} opacity="0.3" />
          </g>
        )}

        <g
          className="scene-anim"
          style={{ animation: "cloud-drift-a 90s linear infinite" }}
          fill="#ffffff"
          opacity={grey ? 0.28 : 0.18}
        >
          <ellipse cx="0" cy="110" rx="120" ry="30" />
          <ellipse cx="90" cy="95" rx="80" ry="24" />
        </g>
        <g
          className="scene-anim"
          style={{ animation: "cloud-drift-b 120s linear infinite" }}
          fill="#ffffff"
          opacity={grey ? 0.24 : 0.14}
        >
          <ellipse cx="0" cy="210" rx="150" ry="34" />
          <ellipse cx="110" cy="195" rx="90" ry="26" />
        </g>

        {skyline && (
          <g
            key={skyline.id}
            className="scene-anim"
            style={{ animation: "skyline-rise 0.9s ease-out" }}
          >
            <skyline.Silhouette dark={dark} darker={darker} bottom={bottom} night={night} />
          </g>
        )}

        {weather === "rain" && (
          <g stroke="#cfe0ee" strokeWidth="1.6" opacity="0.5">
            {raindrops.map((d, i) => (
              <line
                key={i}
                x1={d.x}
                y1={-40}
                x2={d.x - 14}
                y2={10}
                className="scene-anim"
                style={{
                  animation: `rain-fall ${0.9 + (i % 5) * 0.15}s linear infinite`,
                  animationDelay: `-${d.d / 40}s`,
                }}
              />
            ))}
          </g>
        )}
        {weather === "snow" && (
          <g fill="#ffffff" opacity="0.85">
            {snowflakes.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={-10}
                r={i % 3 === 0 ? 3 : 2}
                className="scene-anim"
                style={{
                  animation: `snow-fall ${6 + (i % 6)}s linear infinite`,
                  animationDelay: `-${d.d / 12}s`,
                }}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Scrim. The panel text is white and the drawing behind it changes
          every day -- a midday sky bottoms out at #bfe0f5, which white type
          disappears into. This keeps the left column readable whatever is
          drawn there, without darkening the picture as a whole. */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-slate-950/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/45 to-transparent" />
    </div>
  );
}
