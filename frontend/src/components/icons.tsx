type IconProps = { className?: string };

const INK = '#183B4A';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* ---- Navegación (trazo, heredan currentColor) ---- */

export function PersonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 13c0-6 16-6 16 0" {...stroke} />
      <path d="M4 13.5h24" {...stroke} />
      <circle cx="16" cy="16.5" r="4.5" {...stroke} />
      <path d="M6 29c0-5 4.5-8 10-8s10 3 10 8" {...stroke} />
    </svg>
  );
}

export function TempleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 28h26M5 28v-5h22v5M8 23v-5h16v5M11 18v-5h10v5M13 13V7h6v6" {...stroke} />
      <path d="M16 28v-5" {...stroke} />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 28h26M7 28V18h5v10M14 28V9h5v19M21 28V14h5v14" {...stroke} />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 9l14 14M23 9L9 23" {...stroke} strokeWidth={3.6} />
    </svg>
  );
}

export function ChevronIcon({ className, dir = 'right' }: IconProps & { dir?: 'left' | 'right' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d={dir === 'right' ? 'M12 7l9 9-9 9' : 'M20 7l-9 9 9 9'} {...stroke} strokeWidth={3.6} />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 17l6 6L25 10" {...stroke} strokeWidth={4} />
    </svg>
  );
}

export function CrossIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M10 10l12 12M22 10L10 22" {...stroke} strokeWidth={4} />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="14" width="18" height="14" rx="3.5" fill="currentColor" />
      <path d="M11 14v-3.5a5 5 0 0 1 10 0V14" {...stroke} strokeWidth={3.4} />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 7.5v17a1 1 0 0 0 1.5.9l13-8.5a1 1 0 0 0 0-1.7l-13-8.6a1 1 0 0 0-1.5.9z" fill="currentColor" />
    </svg>
  );
}

export function CloudOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M10 24h13a5 5 0 0 0 1-9.9A8 8 0 0 0 9 13a5.5 5.5 0 0 0 1 11z" {...stroke} />
      <path d="M5 5l22 22" {...stroke} />
    </svg>
  );
}

/* ---- Ilustrados (relleno + contorno de tinta) ---- */

export function FlameIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3c1 5 8 8 8 16a8 8 0 0 1-16 0c0-4 2-6 3-8 1 3 2 4 4 4-1-4-1-8 1-12z"
        fill="#F08A2E"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M16 18c2 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-3 4-6z" fill="#F5C451" />
    </svg>
  );
}

export function StarIcon({ className, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3l3.9 8 8.6 1.2-6.3 6 1.5 8.6L16 22.7l-7.7 4.1 1.5-8.6-6.3-6 8.6-1.2z"
        fill={filled ? '#F5C451' : '#D9DFE2'}
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9S3 16 3 16z" {...stroke} />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
    </svg>
  );
}

export function HangerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M13 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.3-1.5 2.4v1" {...stroke} />
      <path d="M16 15 4 23.5c-1 .8-.5 2.5.8 2.5h22.4c1.3 0 1.8-1.7.8-2.5L16 15z" {...stroke} />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 15 16 5l12 10" {...stroke} />
      <path d="M8 13v14h16V13" {...stroke} />
      <path d="M13 27v-7h6v7" {...stroke} />
    </svg>
  );
}

export function GroupIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="11" cy="11" r="4" {...stroke} />
      <circle cx="22" cy="12" r="3.2" {...stroke} />
      <path d="M3 26c0-4.5 3.6-7.5 8-7.5s8 3 8 7.5" {...stroke} />
      <path d="M19 19.5c4.4-.8 9 1.6 9 6" {...stroke} />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 8c-3-2-7-2.5-11-2v19c4-.5 8 0 11 2 3-2 7-2.5 11-2V6c-4-.5-8 0-11 2z" {...stroke} />
      <path d="M16 8v19" {...stroke} />
    </svg>
  );
}

export function DocIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 4h11l6 6v18H8z" {...stroke} />
      <path d="M19 4v6h6M12 16h9M12 21h9" {...stroke} />
    </svg>
  );
}

export function SchoolIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 13 16 6l13 7" {...stroke} />
      <path d="M6 13v14h20V13M3 27h26" {...stroke} />
      <path d="M13 27v-6h6v6M11 16h2M19 16h2" {...stroke} />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 7v18M7 16h18" {...stroke} strokeWidth={3.4} />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 9h20M13 9V6h6v3M9 9l1.5 18h11L23 9M14 14v8M18 14v8" {...stroke} />
    </svg>
  );
}
