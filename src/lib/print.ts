// One print pipeline for every generated document (contract, receipt),
// wherever it's rendered from -- a page or a modal. The print area's HTML
// is cloned into a hidden same-origin iframe together with the page's
// compiled stylesheets, and printing happens from that iframe.
//
// Why not window.print() on the host page: the booking modal renders the
// contract inside a fixed-position, max-height, overflow-scrolling panel.
// Ancestor clipping applies to print output too, so printing from there
// produced one clipped slice of the document (or nothing past the fold).
// An iframe has none of the host page's layout around it -- the document
// always prints the same, pixel for pixel, from every entry point.
export function printDocument(areaId = "contract-print-area") {
  const el = document.getElementById(areaId);
  if (!el) {
    window.print();
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    window.print();
    return;
  }

  // The compiled Tailwind CSS arrives via <link> tags, which load
  // asynchronously inside the fresh iframe -- printing before the frame's
  // load event fires would render the document completely unstyled.
  // (Verified: computed font-weight of a `font-bold` node is 400 right
  // after document.close(), 700 once this event has fired.)
  const frameLoaded = new Promise<void>((resolve) => {
    iframe.addEventListener("load", () => resolve(), { once: true });
  });

  // Tailwind's compiled CSS lives in the host page's <style>/<link> tags --
  // copy them so the clone keeps its exact styling (including print:
  // variants and @page rules).
  const styles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  )
    .map((n) => n.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}
<style>
  @page { size: A4; margin: 12mm 14mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
</style>
</head><body>${el.outerHTML}</body></html>`);
  doc.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    // Chrome blocks inside print(); Safari/Firefox return immediately --
    // keep the frame around long enough for either, then drop it.
    setTimeout(() => iframe.remove(), 60_000);
  };

  // Wait for the logo (and any other images) to decode before opening the
  // dialog, otherwise the preview renders with an empty logo box. Capped
  // so a broken image URL can't block printing entirely.
  const images = Array.from(doc.images);
  const allLoaded = Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
  Promise.race([Promise.all([frameLoaded, allLoaded]).then(() => undefined), timeout]).then(
    () => {
      // Give the iframe one more frame to finish font layout.
      setTimeout(doPrint, 50);
    }
  );
}
