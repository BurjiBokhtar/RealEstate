"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Modal } from "@/components/Modal";
import { extractFields, type ExtractedFields } from "@/lib/passportOcr";

type Side = "front" | "back";
type SideState = { file: File; url: string } | null;

// Scans a photographed ID (front, and optionally the back) and hands back a
// best-guess at the client fields it might fill. Runs entirely in the
// browser (tesseract.js, loaded on demand so it never costs anyone who
// never clicks this a single byte) -- the photo itself is never uploaded
// anywhere. The recognised TEXT is always shown next to the guesses,
// because the guesses are exactly that: there's no confirmed layout for
// the back of the card yet (address, reportedly a taxpayer number), so
// this is label-keyword matching against whichever side was scanned, not a
// real template. See lib/passportOcr.ts for the reasoning and where to
// tighten it once a real back-of-card sample is known.
//
// Two ways to get a photo in per side: pick an existing file, or shoot one
// live via getUserMedia -- the desk scenario is a PC or tablet with a
// webcam and no "camera app" to hand off to the way a phone's file picker
// does. facingMode is requested as a preference ({ ideal }), not a hard
// constraint, so a laptop with only a front camera still gets a stream
// instead of an OverconstrainedError.
export function PassportScanner({
  onExtract,
}: {
  onExtract: (fields: ExtractedFields) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<Side>("front");
  const [images, setImages] = useState<Record<Side, SideState>>({ front: null, back: null });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [guess, setGuess] = useState<ExtractedFields | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  // Stop the camera the moment this unmounts, however that happens -- a
  // left-open stream is a lit camera light and a dangling permission grant.
  useEffect(() => () => stopCamera(), []);

  const reset = () => {
    setImages({ front: null, back: null });
    setSide("front");
    setRawText("");
    setGuess(null);
    setProgress(0);
  };

  const startCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // The <video> only mounts once cameraOn flips, so the stream is
      // attached a tick later, once the ref actually exists.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError(true);
    }
  };

  const setSideImage = (file: File) => {
    setImages((prev) => ({ ...prev, [side]: { file, url: URL.createObjectURL(file) } }));
    setRawText("");
    setGuess(null);
  };

  // A manual fallback next to recognize()'s own rotateAuto: OSD detection
  // is good at "which way is up" but a photo taken at an angle across a
  // desk isn't always a clean multiple of 90 degrees, and there's no
  // reason to make someone re-take a photo that's simply sideways when
  // turning it is one tap.
  const rotateCurrent = async () => {
    const file = images[side]?.file;
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    canvas.toBlob((blob) => {
      if (blob) setSideImage(new File([blob], file.name, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) setSideImage(new File([blob], `id-scan-${side}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  const runOcr = async () => {
    const sides = (["front", "back"] as Side[]).filter((s) => images[s]);
    if (sides.length === 0) return;
    setRunning(true);
    setProgress(0);
    setRawText("");
    setGuess(null);
    try {
      const { createWorker } = await import("tesseract.js");
      // The real card (confirmed against an actual sample) prints every
      // field bilingually in TAJIK/ENGLISH -- "Насаб/Surname", "Ном/Name" --
      // not Tajik/Russian, which was the original guess before anyone had
      // seen one. Loading rus for the second language left every Latin
      // line with no matching model at all, so tesseract forced it through
      // the Cyrillic one and produced noise ("Republic of Tajikistan" came
      // back as "Кериьbc oг TaiiKisian") -- the Tajik lines actually came
      // through fine even then (a plain surname read correctly), which is
      // what pointed at the language pack rather than the image itself.
      // Progress across N sides recognised in sequence on the one worker --
      // each recognize() call reports its own 0..1 independently, so the
      // overall percentage has to fold in which side is currently running.
      let sideIndex = 0;
      const onLog = (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          setProgress(Math.round(((sideIndex + m.progress) / sides.length) * 100));
        }
      };
      let worker;
      try {
        worker = await createWorker("tgk+eng", 1, { logger: onLog });
      } catch {
        try {
          worker = await createWorker("tgk", 1, { logger: onLog });
        } catch {
          worker = await createWorker("eng", 1, { logger: onLog });
        }
      }
      const texts: string[] = [];
      for (sideIndex = 0; sideIndex < sides.length; sideIndex++) {
        const file = images[sides[sideIndex]]?.file;
        if (!file) continue;
        // A phone photo taken across a desk is rarely dead straight -- a
        // few degrees off is normal, and OCR accuracy falls off a cliff
        // once text isn't close to horizontal. rotateAuto asks tesseract
        // to detect and correct that itself before reading the page.
        const { data } = await worker.recognize(file, { rotateAuto: true });
        texts.push(data.text);
      }
      await worker.terminate();
      const combined = texts.join("\n\n");
      setRawText(combined);
      setGuess(extractFields(combined));
    } catch (err) {
      setRawText(err instanceof Error ? `⚠ ${err.message}` : "⚠ error");
    }
    setRunning(false);
    setProgress(100);
  };

  const apply = () => {
    if (guess) onExtract(guess);
    setOpen(false);
    stopCamera();
    reset();
  };

  const guessCount = guess ? Object.values(guess).filter(Boolean).length : 0;
  const current = images[side];

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
        <Modal
          title={t.clients.form.scanTitle}
          onClose={() => {
            setOpen(false);
            stopCamera();
            reset();
          }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[var(--ink-4)]">{t.clients.form.scanHint}</p>

            {/* Front/back tabs -- each remembers its own photo, so
                switching over to shoot the back never loses the front. */}
            <div className="flex gap-1 rounded-lg border border-[var(--field-border)] p-1">
              {(["front", "back"] as Side[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setSide(s);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    side === s
                      ? "bg-brand text-white"
                      : "text-[var(--ink-3)] hover:bg-[var(--hover-c)]"
                  }`}
                >
                  {images[s] && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${side === s ? "bg-white" : "bg-[var(--wash-emerald-ink)]"}`}
                    />
                  )}
                  {s === "front" ? t.clients.form.scanSideFront : t.clients.form.scanSideBack}
                </button>
              ))}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSideImage(file);
              }}
            />

            {cameraOn ? (
              <div className="flex flex-col gap-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-64 w-full rounded-lg border border-[var(--border-c)] bg-black object-contain"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    {t.clients.form.scanCapture}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-lg border border-[var(--field-border)] px-3.5 py-2 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)]"
                  >
                    {t.clients.form.scanClose}
                  </button>
                </div>
              </div>
            ) : current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt=""
                className="max-h-64 w-full rounded-lg border border-[var(--border-c)] object-contain"
              />
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex h-24 flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--field-border)] text-xs text-[var(--ink-4)] transition-colors hover:border-[var(--field-focus-border)] hover:text-[var(--ink-2)]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <rect x="3" y="5" width="18" height="15" rx="2" />
                    <path d="m3 16 5-5 4 4 3-3 6 6" />
                    <circle cx="8" cy="9" r="1.5" />
                  </svg>
                  {t.clients.form.scanPick}
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex h-24 flex-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--field-border)] text-xs text-[var(--ink-4)] transition-colors hover:border-[var(--field-focus-border)] hover:text-[var(--ink-2)]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                    <circle cx="12" cy="13" r="3.2" />
                  </svg>
                  {t.clients.form.scanCamera}
                </button>
              </div>
            )}

            {cameraError && (
              <p className="text-xs text-[var(--wash-rose-ink)]">{t.clients.form.scanCameraError}</p>
            )}

            {current && !cameraOn && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-fit rounded-lg border border-[var(--field-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)]"
                >
                  {t.clients.form.scanRetake}
                </button>
                <button
                  type="button"
                  onClick={rotateCurrent}
                  className="flex w-fit items-center gap-1.5 rounded-lg border border-[var(--field-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--hover-c)]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                    <path d="M4 12a8 8 0 1 1 2.34 5.66" />
                    <path d="M4 17v-5h5" />
                  </svg>
                  {t.clients.form.scanRotate}
                </button>
              </div>
            )}

            {(images.front || images.back) && !cameraOn && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={runOcr}
                  disabled={running}
                  className="w-fit rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {running ? `${t.clients.form.scanRunning} ${progress}%` : t.clients.form.scanRecognize}
                </button>
                {/* One button, one recognize() call -- whichever sides have a
                    photo right now get read together in that single pass and
                    their text is combined before fields are guessed, not
                    scanned as two separate guesses. Spelling that out here
                    since it isn't obvious from the tabs alone. */}
                {!running && (
                  <p className="text-[11px] text-[var(--ink-4)]">
                    {images.front && images.back
                      ? t.clients.form.scanRecognizeBothSides
                      : t.clients.form.scanRecognizeOneSide.replace(
                          "{side}",
                          images.back ? t.clients.form.scanSideBack : t.clients.form.scanSideFront,
                        )}
                  </p>
                )}
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
