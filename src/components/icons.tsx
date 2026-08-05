// Small shared line icons, used wherever a button or empty state used to
// carry an emoji (🖨, 📄, 💵, 🏠, 🧾, ✎, ⚙, ✂, ⚠) instead of a real icon.
//
// All of them are stroke-only on `currentColor` at one weight, so they take
// the colour of whatever they sit in -- brand button, muted empty state,
// danger row -- and follow the company theme automatically. An emoji can't:
// it's a fixed full-colour glyph that renders differently on every OS and
// ignores the theme entirely.

type IconProps = { className?: string };

function Icon({
  className = "h-4 w-4",
  children,
}: IconProps & { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

export function PrintIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6.5 8.5V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v4" />
      <rect x="3.5" y="8.5" width="17" height="7.5" rx="1.5" />
      <path d="M7 13.5h10V19a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-5.5z" />
      <circle cx="16.5" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 3.5h8l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M8 13h8M8 16.5h5" />
    </Icon>
  );
}

// Banknote -- the "record a payment" action.
export function MoneyIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </Icon>
  );
}

// House -- "no apartments yet" empty state.
export function HomeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  );
}

// Torn-off receipt slip -- "no receipts yet" empty state.
export function ReceiptIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5.5 3.5h13v17l-2.2-1.5-2.15 1.5L12 19l-2.15 1.5L7.7 19 5.5 20.5z" />
      <path d="M9 8h6M9 11.5h6" />
    </Icon>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 20h4L19.5 8.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </Icon>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </Icon>
  );
}

// Cut line marker on the printed two-copy receipt sheet.
export function ScissorsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.1 7.5 20 18M8.1 16.5 20 6" />
    </Icon>
  );
}

export function WarningIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3.5 21.5 20H2.5z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" />
    </Icon>
  );
}
