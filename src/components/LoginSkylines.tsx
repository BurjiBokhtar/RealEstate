"use client";

import type { ReactNode } from "react";

// The four silhouettes that can stand behind the login form.
//
// There used to be exactly one drawing -- a tower crane -- so anyone opening
// the program every morning saw the same picture forever. These rotate by the
// calendar day, so the screen is recognisably the same product but not the
// same image twice in a row.
//
// All four share the sky, sun/moon, stars, clouds and precipitation drawn by
// LoginScene; a skyline supplies only the ground-level shapes. They are drawn
// against the same 1440x810 viewBox with the horizon at y=810, so they are
// interchangeable. Pure SVG -- nothing to download, and no photo to go stale
// or look like stock.

export type SkylineProps = {
  /** Fill for the near buildings. */
  dark: string;
  /** Fill for far buildings and structural metal -- one step deeper. */
  darker: string;
  /** The bottom sky colour, reused for slab lines and glass so the drawing
      stays inside the palette of whatever sky happens to be behind it. */
  bottom: string;
  /** Dusk or night: windows light up, beacons blink, lamps glow. */
  night: boolean;
};

type Block = { x: number; y: number; w: number; h: number; cols: number; rows: number };

// Deterministic pseudo-random window layout. Seeded rather than Math.random()
// so the same building is lit the same way on every render.
function windowsFor(blocks: Block[], seed: number) {
  const out: Array<{ x: number; y: number; on: boolean }> = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (const b of blocks) {
    const cw = b.w / (b.cols + 1);
    const rh = b.h / (b.rows + 1);
    for (let c = 1; c <= b.cols; c++) {
      for (let r = 1; r <= b.rows; r++) {
        out.push({ x: b.x + c * cw - 4, y: b.y + r * rh - 5, on: rnd() > 0.45 });
      }
    }
  }
  return out;
}

// The geometry never changes, so the grids are built once at module load
// instead of on every render.
type WindowList = ReturnType<typeof windowsFor>;

function Windows({ list, night }: { list: WindowList; night: boolean }): ReactNode {
  return (
    <g>
      {list.map((w, i) => (
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
  );
}

/* ------------------------------------------------------------------ 1/4 */
/* Сохтмон — the construction site: the original drawing, kept as one of
   the four. A tower crane above a building that is still going up. */

const CRANE_WINDOWS = windowsFor(
  [
    { x: 40, y: 300, w: 110, h: 300, cols: 4, rows: 9 },
    { x: 1120, y: 260, w: 130, h: 340, cols: 5, rows: 10 },
    { x: 1290, y: 350, w: 90, h: 250, cols: 3, rows: 8 },
  ],
  7
);

function Construction({ dark, darker, bottom, night }: SkylineProps): ReactNode {
  return (
    <>
      <g fill={darker} opacity="0.85">
        <rect x="240" y="420" width="90" height="390" />
        <rect x="360" y="470" width="70" height="340" />
        <rect x="620" y="440" width="80" height="370" />
        <rect x="880" y="480" width="100" height="330" />
        <rect x="1020" y="430" width="60" height="380" />
        <polygon points="700,440 740,400 740,810 700,810" />
      </g>

      <g fill={dark}>
        <rect x="40" y="300" width="110" height="510" />
        <rect x="30" y="286" width="130" height="14" />
        <rect x="1120" y="260" width="130" height="550" />
        <rect x="1110" y="246" width="150" height="14" />
        <rect x="1290" y="350" width="90" height="460" />
      </g>
      <Windows list={CRANE_WINDOWS} night={night} />

      {/* The building under the crane: floor slabs and rebar stubs. */}
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

      {/* Mast fixed, everything above the slew ring sways. */}
      <g fill={darker} stroke={darker}>
        <rect x="770" y="330" width="16" height="480" />
        <g
          className="scene-anim"
          style={{ animation: "crane-sway 9s ease-in-out infinite", transformOrigin: "778px 330px" }}
        >
          <rect x="640" y="318" width="140" height="10" />
          <rect x="640" y="328" width="26" height="26" />
          <rect x="778" y="318" width="330" height="10" />
          <line x1="778" y1="260" x2="1100" y2="322" strokeWidth="3" />
          <line x1="778" y1="260" x2="648" y2="322" strokeWidth="3" />
          <rect x="770" y="252" width="16" height="70" />
          <rect x="762" y="330" width="34" height="26" />
          <g className="scene-anim" style={{ animation: "hook-swing 7s ease-in-out infinite" }}>
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
    </>
  );
}

/* ------------------------------------------------------------------ 2/4 */
/* Маркази шаҳр — downtown: a dense run of towers, stepped tops, a spire.
   No crane; the silhouette itself is the subject. */

const DOWNTOWN_WINDOWS = windowsFor(
  [
    { x: 120, y: 250, w: 120, h: 480, cols: 4, rows: 13 },
    { x: 520, y: 180, w: 140, h: 560, cols: 5, rows: 15 },
    { x: 860, y: 260, w: 130, h: 470, cols: 5, rows: 13 },
    { x: 1160, y: 300, w: 150, h: 430, cols: 5, rows: 12 },
  ],
  23
);

function Downtown({ dark, darker, bottom, night }: SkylineProps): ReactNode {
  return (
    <>
      <g fill={darker} opacity="0.8">
        <rect x="0" y="520" width="110" height="290" />
        <rect x="250" y="480" width="90" height="330" />
        <rect x="420" y="540" width="70" height="270" />
        <rect x="670" y="500" width="120" height="310" />
        <rect x="1010" y="470" width="90" height="340" />
        <rect x="1330" y="510" width="110" height="300" />
      </g>

      <g fill={dark}>
        {/* stepped tower */}
        <rect x="120" y="250" width="120" height="560" />
        <rect x="145" y="210" width="70" height="40" />
        {/* slab block */}
        <rect x="300" y="380" width="90" height="430" />
        {/* spire tower -- the tallest thing on the skyline */}
        <rect x="520" y="180" width="140" height="630" />
        <polygon points="520,180 590,120 660,180" />
        <rect x="586" y="60" width="8" height="62" fill={darker} />
        {/* mid block */}
        <rect x="700" y="330" width="100" height="480" />
        {/* slanted-top tower */}
        <polygon points="860,300 990,260 990,810 860,810" />
        {/* narrow */}
        <rect x="1040" y="400" width="70" height="410" />
        {/* wide tower */}
        <rect x="1160" y="300" width="150" height="510" />
        <rect x="1180" y="286" width="110" height="14" />
      </g>
      <Windows list={DOWNTOWN_WINDOWS} night={night} />

      {/* Glass line down the spire tower -- reads as a lit atrium at night. */}
      <rect x="583" y="200" width="14" height="610" fill={bottom} opacity={night ? 0.35 : 0.18} />

      {night && (
        <circle
          cx="590"
          cy="56"
          r="4.5"
          fill="#ff5a5a"
          className="scene-anim"
          style={{ animation: "beacon 2.6s ease-in-out infinite" }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ 3/4 */
/* Маҳаллаи нав — a finished residential quarter: balconies, trees, street
   lamps. The warm one: this is what the company sells, not what it builds. */

const QUARTER_WINDOWS = windowsFor(
  [
    { x: 80, y: 420, w: 260, h: 250, cols: 7, rows: 6 },
    { x: 980, y: 440, w: 280, h: 240, cols: 7, rows: 6 },
  ],
  41
);

const BALCONY_ROWS = [470, 530, 590, 650, 710];
const TREES = [370, 470, 610, 760, 900, 1300, 1390];
const LAMPS = [230, 560, 850, 1180];

function Quarter({ dark, darker, bottom, night }: SkylineProps): ReactNode {
  return (
    <>
      <g fill={darker} opacity="0.8">
        <rect x="0" y="500" width="70" height="310" />
        <rect x="620" y="520" width="140" height="290" />
        <rect x="800" y="490" width="110" height="320" />
      </g>

      <g fill={dark}>
        <rect x="80" y="420" width="260" height="390" />
        <rect x="380" y="470" width="200" height="340" />
        <rect x="980" y="440" width="280" height="370" />
        <rect x="1290" y="500" width="150" height="310" />
      </g>

      {/* Balcony bands -- the detail that tells a finished block from a shell. */}
      <g fill={bottom} opacity="0.22">
        {BALCONY_ROWS.map((y) => (
          <g key={y}>
            <rect x="80" y={y} width="260" height="7" />
            <rect x="380" y={y} width="200" height="7" />
            <rect x="980" y={y} width="280" height="7" />
          </g>
        ))}
      </g>
      <Windows list={QUARTER_WINDOWS} night={night} />

      {/* Street lamps: pole plus a warm pool of light after dark. */}
      {LAMPS.map((x) => (
        <g key={x}>
          <rect x={x} y="700" width="4" height="110" fill={darker} />
          <circle cx={x + 2} cy="698" r="6" fill={night ? "#ffd782" : darker} />
          {night && (
            <circle
              cx={x + 2}
              cy="698"
              r="26"
              fill="#ffd782"
              opacity="0.16"
              className="scene-anim"
              style={{ animation: "lamp-glow 5s ease-in-out infinite", animationDelay: `${x % 3}s` }}
            />
          )}
        </g>
      ))}

      {/* Tree line along the pavement. */}
      <g fill={darker}>
        {TREES.map((x, i) => (
          <g key={x}>
            <rect x={x + 8} y="740" width="6" height="70" />
            <ellipse cx={x + 11} cy={732 - (i % 3) * 6} rx={22 + (i % 3) * 4} ry={26 + (i % 2) * 5} />
          </g>
        ))}
      </g>
    </>
  );
}

/* ------------------------------------------------------------------ 4/4 */
/* Доманаи кӯҳ — the foothills. Tajikistan is mountains before it is
   anything else, and a ridge is a completely different shape language from
   three drawings made of rectangles. */

const FOOTHILL_WINDOWS = windowsFor(
  [
    { x: 180, y: 690, w: 120, h: 120, cols: 4, rows: 4 },
    { x: 1050, y: 670, w: 140, h: 140, cols: 4, rows: 4 },
  ],
  59
);

function Foothills({ dark, darker, bottom, night }: SkylineProps): ReactNode {
  return (
    <>
      <path
        d="M0,560 L120,470 L200,520 L320,380 L430,480 L520,430 L640,300 L760,420 L860,360 L980,450 L1100,340 L1220,440 L1330,390 L1440,460 L1440,810 L0,810 Z"
        fill={darker}
        opacity="0.55"
      />
      {/* Snow on the two highest peaks. */}
      <g fill="#ffffff" opacity={night ? 0.22 : 0.4}>
        <polygon points="640,300 668,333 652,327 640,338 626,327 612,333" />
        <polygon points="1100,340 1126,371 1112,365 1100,375 1087,365 1074,371" />
      </g>

      <path
        d="M0,650 L160,580 L280,620 L400,540 L520,600 L660,510 L800,590 L920,540 L1060,610 L1200,545 L1320,600 L1440,560 L1440,810 L0,810 Z"
        fill={darker}
      />

      {/* A small development at the foot of the ridge. */}
      <g fill={dark}>
        <rect x="180" y="690" width="120" height="120" />
        <rect x="330" y="655" width="90" height="155" />
        <rect x="430" y="700" width="70" height="110" />
        <rect x="1050" y="670" width="140" height="140" />
        <rect x="1220" y="705" width="100" height="105" />
        <polygon points="330,655 375,625 420,655" />
      </g>
      <Windows list={FOOTHILL_WINDOWS} night={night} />

      {/* Road: a thin bright line running out of the valley. */}
      <path
        d="M0,790 Q400,760 720,772 T1440,752"
        stroke={bottom}
        strokeWidth="4"
        fill="none"
        opacity="0.2"
      />

      {night && (
        <circle
          cx="375"
          cy="621"
          r="4"
          fill="#ff5a5a"
          className="scene-anim"
          style={{ animation: "beacon 3s ease-in-out infinite" }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export const SKYLINES = [
  { id: "construction", Silhouette: Construction },
  { id: "downtown", Silhouette: Downtown },
  { id: "quarter", Silhouette: Quarter },
  { id: "foothills", Silhouette: Foothills },
] as const;

/**
 * One skyline per calendar day, in order, wrapping round.
 *
 * Keyed on the day rather than picked at random for the same reason the quote
 * is: random would redraw the background on every re-render, and would draw
 * something different on the server than in the browser.
 */
export function skylineOfTheDay(date: Date) {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
  return SKYLINES[((dayNumber % SKYLINES.length) + SKYLINES.length) % SKYLINES.length];
}
