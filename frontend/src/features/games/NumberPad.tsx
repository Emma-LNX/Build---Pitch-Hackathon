import { fmt } from '../../lib/random';

const MAX_DIGITS = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'limpiar'] as const;

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

/** Teclado numérico para responder sin opciones (no se puede adivinar). */
export function NumberPad({ value, onChange, disabled }: Props) {
  function press(key: (typeof KEYS)[number]) {
    if (key === 'borrar') onChange(value.slice(0, -1));
    else if (key === 'limpiar') onChange('');
    else if (value.length < MAX_DIGITS) onChange(value === '0' ? key : value + key);
  }

  return (
    <div className="number-pad">
      <output className="number-display" aria-live="polite">
        {value ? fmt(Number(value)) : <span className="number-placeholder">?</span>}
      </output>
      <div className="number-keys">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`number-key${key.length > 1 ? ' number-key-action' : ''}`}
            onClick={() => press(key)}
            disabled={disabled}
            aria-label={key === 'borrar' ? 'Borrar último número' : key === 'limpiar' ? 'Borrar todo' : key}
          >
            {key === 'borrar' ? '⌫' : key === 'limpiar' ? 'C' : key}
          </button>
        ))}
      </div>
    </div>
  );
}
