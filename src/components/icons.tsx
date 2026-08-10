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

export function DuplicateIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.8" />
      <path d="M15.5 5.5H6a1.5 1.5 0 0 0-1.5 1.5v9.5" />
    </Icon>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3.5 11V4.5a1 1 0 0 1 1-1H11l9 9-7.5 7.5-9-9z" />
      <circle cx="7.75" cy="7.75" r="1.15" />
    </Icon>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3.5v11M8 10.5l4 4 4-4" />
      <path d="M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </Icon>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" />
    </Icon>
  );
}

export function PdfIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 3.5h7.5L18.5 8.5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z" />
      <path d="M13.5 3.5v5h5" />
      <path d="M8.5 16.5v-4h1.2a1.2 1.2 0 0 1 0 2.4H8.5M13 16.5v-4h1.3a1.2 1.2 0 0 1 1.2 1.2v1.6a1.2 1.2 0 0 1-1.2 1.2H13z" />
    </Icon>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.8" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </Icon>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
  );
}

export function SortIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 6h13M3 12h9M3 18h5M17 8l3-3 3 3M20 5v14" />
    </Icon>
  );
}

export function BlueprintIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 12h6.5V4.5M10 12v7.5M14 19.5V15h6.5" />
    </Icon>
  );
}

// Sort options as icons. The four written-out choices ("Нав", "Кӯҳна",
// "А–Я", "Я–А") took more width than the date range they sat next to; the
// pair is distinguished by WHAT is sorted -- a calendar for the date a client
// was added, a letter for their name -- and the arrow gives the direction.
// Each button still names itself on hover, so the icon never has to carry the
// whole meaning on its own.
function SortArrow({ up }: { up: boolean }) {
  return up ? (
    <path d="M18 20V8m0 0-2.6 2.8M18 8l2.6 2.8" />
  ) : (
    <path d="M18 8v12m0 0 2.6-2.8M18 20l-2.6-2.8" />
  );
}

export function SortDateNewIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2.5" y="5" width="11" height="10.5" rx="1.5" />
      <path d="M2.5 8.5h11M5.5 3.5v3M10.5 3.5v3" />
      <SortArrow up={false} />
    </Icon>
  );
}

export function SortDateOldIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2.5" y="5" width="11" height="10.5" rx="1.5" />
      <path d="M2.5 8.5h11M5.5 3.5v3M10.5 3.5v3" />
      <SortArrow up />
    </Icon>
  );
}

// The "А" is drawn, not typed: a <text> glyph inside a stroke-only icon set
// picks up the font of whatever page it lands on and stops matching its
// neighbours.
function LetterA() {
  return <path d="M2.5 16.5 7 5l4.5 11.5M4.2 12.6h5.6" />;
}

export function SortNameAzIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <LetterA />
      <SortArrow up={false} />
    </Icon>
  );
}

export function SortNameZaIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <LetterA />
      <SortArrow up />
    </Icon>
  );
}
