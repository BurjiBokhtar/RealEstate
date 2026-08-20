"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { uploadMedia } from "@/lib/supabase/upload";

export function FileUploadField({
  label,
  value,
  onChange,
  folder,
  uploadLabel,
  uploadingLabel,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  uploadLabel: string;
  uploadingLabel: string;
}) {
  const { t } = useLocale();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setUploading(true);
    const result = await uploadMedia(file, folder);
    setUploading(false);
    if (result.url === null) {
      setFileName("");
      if (result.error === "type") setError(t.common.uploadErrorType);
      else if (result.error === "size") setError(t.common.uploadErrorSize);
      else setError(result.error);
      return;
    }
    onChange(result.url);
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-[var(--ink-2)]">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-24 w-auto rounded-md border border-[var(--border-c)] object-cover"
        />
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-[var(--field-border)] bg-[var(--field-bg)] px-3 py-2 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--hover-c)] disabled:opacity-50"
        >
          {uploading ? uploadingLabel : uploadLabel}
        </button>
        <span className="truncate text-xs text-[var(--ink-5)]">{fileName || value || ""}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-[var(--wash-rose-ink)]">{error}</p>}
    </div>
  );
}
