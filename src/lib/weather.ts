"use client";

import { useSyncExternalStore } from "react";

// Live local weather for the login screen.
//
// Open-Meteo: free, no API key, no account, CORS-enabled. Location comes from
// coarse IP lookup rather than the browser's geolocation API on purpose -- a
// permission popup on a login page, before anyone has even signed in, is both
// intrusive and usually denied. Bokhtar is the fallback whenever either call
// fails, so the screen never waits on the network to render.
//
// The result was previously fetched inside LoginScene and used ONLY to tint
// the sky, so the app knew the weather and never told anyone.
//
// A module-level store, not per-component state: two components read this (the
// scene tints its sky, the readout prints the number). Written as a plain hook
// with useState + useEffect, each of them would run its own effect and the page
// would fetch the same two endpoints twice. Here the request fires on the first
// subscription and every later reader gets the same answer.

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow";

export type LocalWeather = {
  kind: WeatherKind;
  /** Celsius, rounded. null until the request lands (or if it fails). */
  tempC: number | null;
  city: string | null;
  /** True once a real answer arrived -- lets the UI avoid showing a guess. */
  loaded: boolean;
};

const FALLBACK = { lat: 37.84, lon: 68.78 }; // Bokhtar

// WMO weather codes, bucketed: 0-1 clear, 2-3 + fog cloudy, 51-67 + 80-99
// rain/storm, 71-77 + 85-86 snow.
export function kindFromCode(code: number): WeatherKind {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) return "rain";
  if (code >= 2) return "cloudy";
  return "clear";
}

export const WEATHER_LABELS: Record<WeatherKind, { ru: string; tj: string }> = {
  clear: { ru: "Ясно", tj: "Соф" },
  cloudy: { ru: "Облачно", tj: "Абрнок" },
  rain: { ru: "Дождь", tj: "Борон" },
  snow: { ru: "Снег", tj: "Барф" },
};

// Referentially stable: getSnapshot must return the same object between
// updates or React re-renders in a loop. Also the server snapshot -- nothing
// is known before the browser asks.
const IDLE: LocalWeather = { kind: "clear", tempC: null, city: null, loaded: false };

let snapshot: LocalWeather = IDLE;
let started = false;
const listeners = new Set<() => void>();

function publish(next: LocalWeather) {
  snapshot = next;
  for (const l of listeners) l();
}

async function load() {
  let lat = FALLBACK.lat;
  let lon = FALLBACK.lon;
  let city: string | null = null;
  try {
    const geo = await fetch("https://get.geojs.io/v1/ip/geo.json").then((r) => r.json());
    if (Number(geo?.latitude) && Number(geo?.longitude)) {
      lat = Number(geo.latitude);
      lon = Number(geo.longitude);
      city = typeof geo?.city === "string" ? geo.city : null;
    }
  } catch {
    // Offline or blocked -- fall through with Bokhtar.
  }

  try {
    const d = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m`
    ).then((r) => r.json());
    const code = Number(d?.current?.weather_code);
    const temp = Number(d?.current?.temperature_2m);
    publish({
      kind: Number.isNaN(code) ? "clear" : kindFromCode(code),
      tempC: Number.isNaN(temp) ? null : Math.round(temp),
      city,
      loaded: !Number.isNaN(code),
    });
  } catch {
    publish({ ...snapshot, city, loaded: false });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void load();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useLocalWeather(): LocalWeather {
  return useSyncExternalStore(subscribe, () => snapshot, () => IDLE);
}
