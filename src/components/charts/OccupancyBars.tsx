"use client";

import { useState } from "react";
import { STATUS_HUES } from "./palette";

// Заполненность по ЖК: одна сложенная полоса на дом.
//
// Раньше это было пять колец рядом. Кольца плохи здесь по трём причинам, и
// все три видно на прошлом дашборде:
//
//   * ранжирование. 80 % и 41 % на двух кольцах различить можно, а 5 % и 2 %
//     -- уже нет: это две почти одинаковые нитки у края. Длина против длины
//     читается точно, дуга против дуги -- нет;
//   * доля 355-квартирного дома и доля 64-квартирного выглядели одинаково
//     весомо, потому что кольца одного размера. Здесь под каждой полосой
//     стоит "35/355", и масштаб дома виден сразу;
//   * место. Пять колец занимают всю ширину; шестой ЖК ломает ряд, а не
//     добавляет строку. Список растёт вниз.
//
// Цвета -- те же, что в шахматке: зелёный свободно, жёлтый забронировано,
// красный продано. Ряд подсвечивается целиком при наведении, остальные
// притухают -- так же, как на остальных графиках этой страницы.

export type OccupancyBarRow = {
  id: string;
  name: string;
  total: number;
  sold: number;
  reserved: number;
  available: number;
};

const SEGMENTS = [
  { key: "sold", hue: STATUS_HUES.sold },
  { key: "reserved", hue: STATUS_HUES.reserved },
  { key: "available", hue: STATUS_HUES.available },
] as const;

export function OccupancyBars({
  rows,
  labels,
}: {
  rows: OccupancyBarRow[];
  /** Подписи статусов из словаря — компонент не знает про язык. */
  labels: { sold: string; reserved: string; available: string };
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (rows.length === 0) return null;

  // Занятость = всё, что уже не продаётся свободно. Ровно то число, которое
  // кольца печатали в центре, поэтому сортировка по нему сохраняет привычный
  // порядок: самый распроданный дом сверху.
  const filled = (r: OccupancyBarRow) => r.sold + r.reserved;
  const pct = (r: OccupancyBarRow) => (r.total > 0 ? (filled(r) / r.total) * 100 : 0);
  const sorted = [...rows].sort((a, b) => pct(b) - pct(a));

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.hue.solid }}
            />
            {labels[s.key]}
          </li>
        ))}
      </ul>

      <ul className="flex flex-col gap-3.5">
        {sorted.map((r, i) => (
          <li
            key={r.id}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
            className="flex flex-col gap-1.5 transition-opacity"
            style={{ opacity: hover && hover !== r.id ? 0.45 : 1 }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-700">{r.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                {filled(r)}/{r.total}
                <span className="ml-2 font-semibold text-slate-900">{Math.round(pct(r))}%</span>
              </span>
            </div>

            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
              {SEGMENTS.map((s) => {
                const value = r[s.key];
                if (value <= 0) return null;
                return (
                  <div
                    key={s.key}
                    title={`${labels[s.key]}: ${value}`}
                    // Задержка по индексу строки, а не по сегменту: полосы
                    // проявляются сверху вниз, как читается список.
                    className="animate-chart-grow-x h-full first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${r.total > 0 ? (value / r.total) * 100 : 0}%`,
                      background: `linear-gradient(90deg, ${s.hue.from}, ${s.hue.to})`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
