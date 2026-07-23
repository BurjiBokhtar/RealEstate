// Table export in two formats the user picks from a menu.
//
// Excel: an HTML <table> saved with an .xls extension. Excel parses it into
// real columns -- one value per cell, no delimiter guessing, so nothing
// "spills" into the next cell the way a CSV can when Excel's locale disagrees
// about "," vs ";". Cyrillic is fine (UTF-8 meta + explicit charset).
//
// PDF: a styled print window; the browser's "Save as PDF" turns it into a
// clean tabular document. User-initiated (a click), so popup blockers allow it.

type Cell = string | number | null | undefined;

const esc = (v: Cell) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function trigger(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportExcel(
  filename: string,
  headers: string[],
  rows: Cell[][]
) {
  const thead = `<tr>${headers
    .map(
      (h) =>
        `<th style="background:#1c1a3a;color:#fff;border:1px solid #94a3b8;padding:6px 10px;text-align:left;font-weight:bold">${esc(
          h
        )}</th>`
    )
    .join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c) =>
              `<td style="border:1px solid #cbd5e1;padding:5px 10px">${esc(c)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Данные</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>${thead}${tbody}</table></body></html>`;
  trigger(
    filename.endsWith(".xls") ? filename : `${filename}.xls`,
    new Blob([`﻿${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" })
  );
}

export function exportPdf(title: string, headers: string[], rows: Cell[][]) {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    title
  )}</title><style>
    * { font-family: Arial, sans-serif; }
    h2 { color:#1c1a3a; margin:0 0 12px; }
    .date { color:#64748b; font-size:12px; margin:0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th { background:#1c1a3a; color:#fff; text-align:left; padding:6px 8px; }
    td { border-bottom:1px solid #e2e8f0; padding:5px 8px; }
    tr:nth-child(even) td { background:#f8fafc; }
    @page { size: A4 landscape; margin: 12mm; }
  </style></head><body>
    <h2>${esc(title)}</h2>
    <p class="date">${new Date().toLocaleDateString()}</p>
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return; // popup blocked
  w.document.write(doc);
  w.document.close();
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
