"use client";

import { Modal } from "@/components/Modal";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Shows an uploaded plan full size.
//
// Both buildings and units have had a plan_url column since migration 003 and
// an upload field in their forms, and neither was ever rendered anywhere: the
// file went to storage and stayed there. This is the screen that was missing.
//
// "Open the original" matters more than it looks. A floor plan is a drawing
// with room dimensions on it; scaled into a dialog on a laptop those numbers
// stop being readable, and the answer a manager needs -- how wide is the
// kitchen -- is exactly what gets lost. The link opens the stored file at its
// own resolution, where it can be zoomed and printed.

export function PlanViewerModal({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  const { t } = useLocale();

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-[var(--border-c)] bg-[var(--surface-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={title} className="max-h-[70vh] w-full object-contain" />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          {t.buildings.planOpenOriginal} ↗
        </a>
      </div>
    </Modal>
  );
}
