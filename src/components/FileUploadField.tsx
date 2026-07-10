"use client";

import { useState } from "react";
import { uploadMedia } from "@/lib/supabase/upload";

export function FileUploadField({
  label,
  value,
  onChange,
  folder,
  uploadingLabel,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  uploadingLabel: string;
}) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadMedia(file, folder);
    if (url) onChange(url);
    setUploading(false);
  };

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-24 w-auto rounded-md border border-slate-200 object-cover"
        />
      )}
      <span className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleChange}
          className="text-xs"
        />
        {uploading && <span className="text-xs text-slate-400">{uploadingLabel}</span>}
      </span>
    </label>
  );
}
