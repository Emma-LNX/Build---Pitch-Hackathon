const TONES = {
  blue: '#278FC7',
  green: '#4FA82E',
  yellow: '#F5C451',
} as const;

export function ProgressBar({
  value,
  tone = 'blue',
  label,
}: {
  value: number;
  tone?: keyof typeof TONES;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: TONES[tone] }} />
    </div>
  );
}
