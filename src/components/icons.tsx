// Small shared line icons (currentColor, one weight -- same language as the
// FIELD_ICONS set on the client profile page), used wherever a button used
// to carry an emoji (🖨, 📄) instead of a real icon.

export function PrintIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6.5 8.5V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v4" />
      <rect x="3.5" y="8.5" width="17" height="7.5" rx="1.5" />
      <path d="M7 13.5h10V19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5.5z" />
      <circle cx="16.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DocumentIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3.5h8l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M8 13h8M8 16.5h5" />
    </svg>
  );
}
