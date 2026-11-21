import type { ReactNode } from 'react';

const INK = '#183B4A';

/** Plataforma de césped flotante, igual que las estaciones del mapa. */
export function Platform({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 44" aria-hidden="true">
      <path d="M6 18 C6 34 154 34 154 18 L154 24 C154 42 6 42 6 24 Z" fill="#398647" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={80} cy={18} rx={74} ry={14} fill="#70BE46" stroke={INK} strokeWidth={4} />
      <path d="M30 14 C40 10 56 9 66 10" fill="none" stroke="#9BD872" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

/** Insignia tipo escudo con un ícono y un valor grande. */
export function GameBadge({
  color,
  icon,
  value,
  label,
}: {
  color: string;
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="game-badge">
      <div className="game-badge-shield">
        <svg viewBox="0 0 100 112" aria-hidden="true">
          <path d="M50 108 C20 96 8 76 8 50 V20 L50 6 L92 20 V50 C92 76 80 96 50 108 Z" fill="#17628E" transform="translate(0 2)" />
          <path d="M50 104 C20 92 8 72 8 46 V18 L50 4 L92 18 V46 C92 72 80 92 50 104 Z" fill={color} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M50 92 C28 82 20 66 20 46 V26 L50 16 L80 26 V46 C80 66 72 82 50 92 Z" fill="#FFF8E8" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </svg>
        <div className="game-badge-content">
          <span className="game-badge-icon">{icon}</span>
          <strong className="game-badge-value">{value}</strong>
        </div>
      </div>
      <span className="game-badge-label">{label}</span>
    </div>
  );
}
