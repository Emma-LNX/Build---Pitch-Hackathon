import { MayaNumeral } from './MayaNumeral';

const PLACE_LABELS = ['× 1', '× 20', '× 400'];

/** Valor de los niveles (de arriba hacia abajo) en base 20. */
export function mayaDigitsValue(digits: number[]): number {
  return digits.reduce((total, d) => total * 20 + d, 0);
}

interface Props {
  digits: number[];
  onChange: (digits: number[]) => void;
  disabled: boolean;
}

/** Arma un número maya nivel por nivel con puntos, barras y concha. */
export function MayaBuilder({ digits, onChange, disabled }: Props) {
  function update(level: number, next: number) {
    onChange(digits.map((d, i) => (i === level ? Math.max(0, Math.min(19, next)) : d)));
  }

  return (
    <div className="maya-builder">
      {digits.map((digit, level) => {
        const place = PLACE_LABELS[digits.length - 1 - level];
        return (
          <div key={level} className="maya-level">
            <span className="maya-place">{place}</span>
            <div className="maya-slot" aria-label={`Nivel ${place}: ${digit}`}>
              <MayaNumeral digits={[digit]} className="maya-slot-art" />
            </div>
            <div className="maya-actions">
              <button
                type="button"
                className="maya-btn"
                onClick={() => update(level, digit + 1)}
                disabled={disabled || digit >= 19}
                aria-label="Agregar punto (vale 1)"
              >
                <span className="maya-dot" />
              </button>
              <button
                type="button"
                className="maya-btn"
                onClick={() => update(level, digit + 5)}
                disabled={disabled || digit > 14}
                aria-label="Agregar barra (vale 5)"
              >
                <span className="maya-bar" />
              </button>
              <button
                type="button"
                className="maya-btn maya-btn-clear"
                onClick={() => update(level, 0)}
                disabled={disabled || digit === 0}
                aria-label="Dejar en cero (concha)"
              >
                0
              </button>
            </div>
          </div>
        );
      })}
      <p className="hint maya-hint">Punto = 1 · Barra = 5 · Concha = 0. Cada nivel de arriba vale 20 veces más.</p>
    </div>
  );
}
