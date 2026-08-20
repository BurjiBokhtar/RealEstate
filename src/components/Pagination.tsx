"use client";

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-1 text-sm">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-[var(--field-border)] px-3 py-1.5 text-[var(--ink-3)] hover:bg-[var(--hover-c)] disabled:opacity-40"
      >
        ‹
      </button>
      <span className="text-[var(--ink-4)]">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className="rounded-md border border-[var(--field-border)] px-3 py-1.5 text-[var(--ink-3)] hover:bg-[var(--hover-c)] disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
