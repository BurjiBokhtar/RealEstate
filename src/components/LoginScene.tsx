"use client";

import { useEffect, useMemo, useState } from "react";

// Full-screen living construction scene behind the auth card: sky follows
// the local time of day, colours shift with the real weather (Open-Meteo,
// no key, falls back to clear sky offline), a tower crane sways gently,
// clouds drift, rain falls when it actually rains, windows light up at
// night. Pure SVG + CSS keyframes -- no images, nothing to load.

type Weather = "clear" | "cloudy" | "rain" | "snow";
type Phase = "dawn" | "day" | "dusk" | "night";

function phaseOfDay(): Phase {
  const h = new Date().getHours();
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
@keyframes star-twinkle { 0%, 100% { opacity: 0.9; } 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .scene-anim { animation: none !important; } }
`;

export function LoginScene() {
  const [phase, setPhase] = useState<Phase>("day");
  const [weather, setWeather] = useState<Weather>("clear");

  useEffect(() => {
    setPhase(phaseOfDay());
    const id = setInterval(() => setPhase(phaseOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Weather where the VISITOR is: coarse IP geolocation first (silent, no
    // browser permission popup on a login page), Bokhtar as the fallback.
    // Weather-code buckets: 0-1 clear, 2-3 + fog cloudy, 51-67 + 80-99
    // rain/storm, 71-77 + 85-86 snow.
    const locate = fetch("https://get.geojs.io/v1/ip/geo.json")
      .then((r) => r.json())
      .then((g) => ({
        lat: Number(g?.latitude) || 37.84,
        lon: Number(g?.longitude) || 68.78,
      }))
      .catch(() => ({ lat: 37.84, lon: 68.78 }));
    locate
      .then(({ lat, lon }) =>
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code`
        )
      )
      .then((r) => r.json())
      .then((d) => {
        const code = Number(d?.current?.weather_code);
        if (Number.isNaN(code)) return;
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) setWeather("snow");
        else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99))
          setWeather("rain");
        else if (code >= 2) setWeather("cloudy");
        else setWeather("clear");
      })
      .catch(() => {});
  }, []);

  const grey = weather === "rain" || weather === "cloudy";
  const [top, mid, bottom] = SKIES[phase][grey ? "grey" : "bright"];
  const night = phase === "night" || phase === "dusk";
  const dark = grey ? "#171a26" : phase === "day" ? "#2e4057" : "#12142a";
  const darker = grey ? "#10121b" : phase === "day" ? "#22303f" : "#0b0c1c";

  // Deterministic layouts so server and client render identically.
  const windows = useMemo(() => {
    const out: Array<{ x: number; y: number; on: boolean }> = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const towers = [
      { x: 40, y: 300, w: 110, h: 300, cols: 4, rows: 9 },
      { x: 1120, y: 260, w: 130, h: 340, cols: 5, rows: 10 },
      { x: 1290, y: 350, w: 90, h: 250, cols: 3, rows: 8 },
    ];
    for (const t of towers) {
      const cw = t.w / (t.cols + 1);
      const rh = t.h / (t.rows + 1);
      for (let c = 1; c <= t.cols; c++)
        for (let r = 1; r <= t.rows; r++)
          out.push({ x: t.x + c * cw - 4, y: t.y + r * rh - 5, on: rnd() > 0.45 });
    }
    return out;
  }, []);

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

      <svg
        viewBox="0 0 1440 810"
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="login-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={top} style={{ transition: "stop-color 1.5s" }} />
            <stop offset="55%" stopColor={mid} style={{ transition: "stop-color 1.5s" }} />
            <stop
              offset="100%"
              stopColor={bottom}
              style={{ transition: "stop-color 1.5s" }}
            />
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

        {/* far skyline */}
        <g fill={darker} opacity="0.85">
          <rect x="240" y="420" width="90" height="390" />
          <rect x="360" y="470" width="70" height="340" />
          <rect x="620" y="440" width="80" height="370" />
          <rect x="880" y="480" width="100" height="330" />
          <rect x="1020" y="430" width="60" height="380" />
          <polygon points="700,440 740,400 740,810 700,810" />
        </g>

        {/* near towers with windows */}
        <g fill={dark}>
          <rect x="40" y="300" width="110" height="510" />
          <rect x="30" y="286" width="130" height="14" />
          <rect x="1120" y="260" width="130" height="550" />
          <rect x="1110" y="246" width="150" height="14" />
          <rect x="1290" y="350" width="90" height="460" />
        </g>
        <g>
          {windows.map((w, i) => (
            <rect
              key={i}
              x={w.x}
              y={w.y}
              width="9"
              height="11"
              rx="1"
              fill={night && w.on ? "#ffd782" : "#000000"}
              opacity={night && w.on ? 0.9 : 0.25}
            />
          ))}
        </g>

        {/* unfinished building under the crane: slab lines + rebar stubs */}
        <g fill={dark}>
          <rect x="470" y="560" width="180" height="250" />
          <rect x="470" y="600" width="180" height="6" fill={bottom} opacity="0.25" />
          <rect x="470" y="660" width="180" height="6" fill={bottom} opacity="0.25" />
          <rect x="470" y="720" width="180" height="6" fill={bottom} opacity="0.25" />
          <rect x="486" y="530" width="5" height="30" />
          <rect x="516" y="536" width="5" height="24" />
          <rect x="546" y="530" width="5" height="30" />
          <rect x="576" y="538" width="5" height="22" />
          <rect x="606" y="530" width="5" height="30" />
        </g>

        {/* tower crane: mast fixed, everything above the slew ring sways */}
        <g fill={darker} stroke={darker}>
          <rect x="770" y="330" width="16" height="480" />
          <g
            className="scene-anim"
            style={{
              animation: "crane-sway 9s ease-in-out infinite",
              transformOrigin: "778px 330px",
            }}
          >
            <rect x="640" y="318" width="140" height="10" />
            <rect x="640" y="328" width="26" height="26" />
            <rect x="778" y="318" width="330" height="10" />
            <line x1="778" y1="260" x2="1100" y2="322" strokeWidth="3" />
            <line x1="778" y1="260" x2="648" y2="322" strokeWidth="3" />
            <rect x="770" y="252" width="16" height="70" />
            <rect x="762" y="330" width="34" height="26" />
            <g
              className="scene-anim"
              style={{ animation: "hook-swing 7s ease-in-out infinite" }}
            >
              <rect x="1000" y="328" width="20" height="10" />
              <line x1="1010" y1="338" x2="1010" y2="470" strokeWidth="2.5" />
              <path d="M1002 470 h16 v12 h-6 a6 6 0 0 1 -10 -6 z" />
            </g>
            {night && (
              <circle
                cx="1104"
                cy="318"
                r="4.5"
                fill="#ff5a5a"
                stroke="none"
                className="scene-anim"
                style={{ animation: "beacon 2.2s ease-in-out infinite" }}
              />
            )}
          </g>
        </g>

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
    </div>
  );
}
