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
