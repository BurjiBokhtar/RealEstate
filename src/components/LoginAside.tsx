"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useClock";
import { quoteOfTheDay } from "@/lib/quotes";
import { WEATHER_LABELS, useLocalWeather, type WeatherKind } from "@/lib/weather";

// The living half of the login screen: a running clock, today's date, the real
// local weather, and a quote that changes once a day.
//
// The scene behind it already knew the weather -- it used it to tint the sky
// and never said so. Showing the figure costs no extra request (both read the
// same hook) and turns an effect nobody could name into information.

function WeatherGlyph({ kind, className = "h-7 w-7" }: { kind: WeatherKind; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      {kind === "clear" && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4" />
        </>
      )}
      {kind !== "clear" && (
        <path d="M7 18.5h9.2a3.6 3.6 0 0 0 .4-7.2 5.2 5.2 0 0 0-9.9-1.4A3.8 3.8 0 0 0 7 18.5z" />
      )}
      {kind === "rain" && <path d="M9 20.5l-.8 1.8M13 20.5l-.8 1.8M17 20.5l-.8 1.8" />}
      {kind === "snow" && (
        <path d="M9 21h.01M13 21.6h.01M17 21h.01" strokeWidth={2.2} />
      )}
    </svg>
  );
}

// Written out rather than handed to Intl on purpose: there is no "tg-TJ" date
// data in browsers, so toLocaleDateString silently falls back to the browser's
// own locale -- a Tajik user on an English-configured machine got "Monday,
// 10 August" on a screen where everything else was Tajik. These tables always
// print the language the person actually chose.
const WEEKDAYS = {
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  tj: ["Якшанбе", "Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе"],
} as const;

const MONTHS = {
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
  tj: ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"],
} as const;

function longDate(d: Date, lang: "ru" | "tj") {
  return `${WEEKDAYS[lang][d.getDay()]}, ${d.getDate()} ${MONTHS[lang][d.getMonth()]}`;
}

// The clock is 24-hour in both languages; toLocaleTimeString would have taken
// the hour format from the same missing locale data.
const pad = (n: number) => String(n).padStart(2, "0");

export function LoginAside() {
  const { t, locale } = useLocale();
  const weather = useLocalWeather();
  const quote = quoteOfTheDay();
  const lang = locale === "tj" ? "tj" : "ru";

  // null until the browser takes over: a clock printed on the server shows the
  // server's second, in the server's timezone. See useNow.
  const now = useNow(1000);

  return (
    <div className="flex flex-col gap-6">
      {/* Clock + date + weather on one line: the three things worth knowing
          before you've even signed in. */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-5xl font-bold leading-none tabular-nums tracking-tight drop-shadow">
            {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--"}
          </p>
          <p className="mt-1.5 text-sm text-white/70">{now ? longDate(now, lang) : ""}</p>
        </div>

        {weather.loaded && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
            <WeatherGlyph kind={weather.kind} />
            <div className="leading-tight">
              <p className="text-xl font-semibold tabular-nums">
                {weather.tempC != null ? `${weather.tempC}°` : "—"}
              </p>
              <p className="text-[11px] text-white/70">
                {WEATHER_LABELS[weather.kind][lang]}
                {weather.city ? ` · ${weather.city}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quote of the day. The vertical rule reads as a pull quote rather than
          a slogan floating in space. */}
      <figure className="max-w-md border-l-2 border-white/30 pl-4">
        <blockquote className="text-[15px] italic leading-relaxed text-white/90">
          “{quote[lang]}”
        </blockquote>
        <figcaption className="mt-1.5 text-xs text-white/55">— {quote.author[lang]}</figcaption>
      </figure>

      <p className="text-xs text-white/50">{t.login.title}</p>
    </div>
  );
}
