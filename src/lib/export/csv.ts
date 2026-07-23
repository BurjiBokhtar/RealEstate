// Download tabular data as a CSV that opens cleanly in Excel.
//
// Two details that make it "just work" for the accountants who'll use it:
//  - a UTF-8 BOM (﻿) so Cyrillic (клиент names, сомонӣ) isn't mojibake
//    when Excel opens it;
//  - ";" as the separator, because Excel in Russian/Tajik locales treats ";"
//    as the column delimiter (a "," splits numbers like 1,50 into columns).
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers, ...rows]
    .map((r) => r.map(esc).join(";"))
    .join("\r\n");
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Today as YYYY-MM-DD for filenames like "clients-2026-07-22.csv".
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
