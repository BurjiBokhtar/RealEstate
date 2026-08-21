"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Modal } from "@/components/Modal";
import { extractFields, type ExtractedFields } from "@/lib/passportOcr";

// Scans a photographed ID and hands back a best-guess at the client fields
// it might fill. Runs entirely in the browser (tesseract.js, loaded on
// demand so it never costs anyone who never clicks this a single byte) --
// the photo itself is never uploaded anywhere. The recognised TEXT is
// always shown next to the guesses, because the guesses are exactly that:
// there's no confirmed layout for the new biometric ID to match field
// positions against, so this is label-keyword matching, not a real
// template. See lib/passportOcr.ts for the reasoning and where to tighten
// it once a real document's layout is known.
export function PassportScanner({
  onExtract,
}: {
  onExtract: (fields: ExtractedFields) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [guess, setGuess] = useState<ExtractedFields | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setImageUrl(null);
    setImageFile(null);
    setRawText("");
    setGuess(null);
    setProgress(0);
  };

  const pickFile = (file: File) => {
    reset();
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const runOcr = async () => {
    if (!imageFile) return;
    setRunning(true);
    setProgress(0);
    setRawText("");
    setGuess(null);
    try {
      const { createWorker } = await import("tesseract.js");
      // rus+tgk covers the bilingual Tajik/Russian printing most ID
      // documents here carry. Some CDN mirrors of the language data don't
      // (yet) carry tgk -- if the combined load fails, fall back to
      // Russian alone rather than leaving the button dead.
      let worker;
      try {
        worker = await createWorker("rus+tgk", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
          },
        });
      } catch {
        worker = await createWorker("rus", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
          },
        });
      }
      const { data } = await worker.recognize(imageFile);
      await worker.terminate();
      setRawText(data.text);
      setGuess(extractFields(data.text));
    } catch (err) {
      setRawText(err instanceof Error ? `⚠ ${err.message}` : "⚠ error");
    }
    setRunning(false);
  };

  const apply = () => {
    if (guess) onExtract(guess);
    setOpen(false);
    reset();
  };

  const guessCount = guess ? Object.values(guess).filter(Boolean).length : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-1.5 rounded-lg border border-[var(--field-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
        {t.clients.form.scanButton}
      </button>

      {open && (
        <Modal title={t.clients.form.scanTitle} onClose={() => { setOpen(false); reset(); }}>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--ink-4)]">{t.clients.form.scanHint}</p>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
              }}
            />

            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="max-h-64 w-full rounded-lg border border-[var(--border-c)] object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--field-border)] text-sm text-[var(--ink-4)] transition-colors hover:border-[var(--field-focus-border)] hover:text-[var(--ink-2)]"
              >
                {t.clients.form.scanPick}
              </button>
            )}

            {imageUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-lg border border-[var(--field-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)]"
                >
                  {t.clients.form.scanRetake}
                </button>
                <button
                  type="button"
                  onClick={runOcr}
                  disabled={running}
                  className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {running ? `${t.clients.form.scanRunning} ${progress}%` : t.clients.form.scanRecognize}
                </button>
              </div>
            )}

            {rawText && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-[var(--ink-3)]">
                  {t.clients.form.scanRawLabel}
                </p>
                <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border-c)] bg-[var(--surface-2)] p-2.5 font-mono text-[11px] text-[var(--ink-2)]">
                  {rawText.trim() || t.clients.form.scanEmpty}
                </pre>
              </div>
            )}

            {guess && guessCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wash-emerald-border)] bg-[var(--wash-emerald)] px-3 py-2.5">
                <p className="text-xs text-[var(--wash-emerald-ink)]">
                  {guessCount} {t.clients.form.scanFieldsFound}
                </p>
                <button
                  type="button"
                  onClick={apply}
                  className="shrink-0 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  {t.clients.form.scanApply}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
