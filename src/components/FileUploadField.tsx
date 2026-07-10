"use client";

import { useRef, useState } from "react";
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
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    const url = await uploadMedia(file, folder);
    if (url) onChange(url);
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-24 w-auto rounded-md border border-slate-200 object-cover"
        />
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? uploadingLabel : uploadLabel}
        </button>
        <span className="truncate text-xs text-slate-400">{fileName || value || ""}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
