import { fmt } from '../../lib/random';
import type { GameSpec } from '../../types';

interface GameProps<G extends GameSpec['kind']> {
  game: Extract<GameSpec, { kind: G }>;
  picks: number[];
  onChange: (picks: number[]) => void;
  disabled?: boolean;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function initialPicks(game?: GameSpec): number[] {
  return game?.kind === 'blocks' ? game.places.map(() => 0) : [];
}

/** Respuesta armada por el niño, en el mismo formato que `Question.answer`. */
export function gameAnswer(game: GameSpec, picks: number[]): string | null {
  switch (game.kind) {
    case 'coins':
      return picks.length ? `Q${sum(picks)}` : null;
    case 'slices':
      return picks.length ? `${picks.length}/${game.parts}` : null;
    case 'blocks': {
      const total = sum(picks.map((count, i) => count * game.places[i]));
      return total > 0 ? fmt(total) : null;
    }
    case 'order':
      return picks.length === game.items.length ? picks.map((i) => game.items[i]).join(` ${game.sep} `) : null;
  }
}

/* ---------------- Mercado: pagar con billetes y monedas ---------------- */

const MAX_MONEY = 30;

function Money({ value, small }: { value: number; small?: boolean }) {
  return (
    <span className={`money money-${value}${value === 1 ? ' money-coin' : ''}${small ? ' money-small' : ''}`}>
      Q{value}
    </span>
  );
}

export function CoinsGame({ game, picks, onChange, disabled }: GameProps<'coins'>) {
  return (
    <div className="game">
      <div className="coins-tray" aria-live="polite">
        {picks.length === 0 ? (
          <span className="hint">Toca el dinero de abajo para ponerlo aquí</span>
        ) : (
          picks.map((v, i) => (
            <button
              key={i}
              className="money-btn"
              disabled={disabled}
              aria-label={`Quitar Q${v}`}
              onClick={() => onChange(picks.filter((_, j) => j !== i))}
            >
              <Money value={v} small />
            </button>
          ))
        )}
      </div>
      <p className="game-total">
        Llevas <strong>Q{sum(picks)}</strong>
      </p>
      <div className="coins-bank">
        {game.values.map((v) => (
          <button
            key={v}
            className="money-btn"
            disabled={disabled || picks.length >= MAX_MONEY}
            aria-label={`Agregar Q${v}`}
            onClick={() => onChange([...picks, v].sort((a, b) => b - a))}
          >
            <Money value={v} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Tortilla: pintar fracciones ---------------- */

function wedge(i: number, parts: number, r = 88, c = 100): string {
  if (parts === 1) return `M${c - r} ${c} A${r} ${r} 0 1 1 ${c + r} ${c} A${r} ${r} 0 1 1 ${c - r} ${c} Z`;
  const a0 = ((i / parts) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / parts) * 360 - 90) * (Math.PI / 180);
  const large = 360 / parts > 180 ? 1 : 0;
  return `M${c} ${c} L${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
}

export function SlicesGame({ game, picks, onChange, disabled }: GameProps<'slices'>) {
  const toggle = (i: number) => {
    if (disabled) return;
    onChange(picks.includes(i) ? picks.filter((p) => p !== i) : [...picks, i]);
  };
  return (
    <div className="game">
      <svg className="tortilla" viewBox="0 0 200 200" role="group" aria-label="Tortilla para pintar">
        {Array.from({ length: game.parts }, (_, i) => (
          <path
            key={i}
            d={wedge(i, game.parts)}
            className={picks.includes(i) ? 'slice slice-on' : 'slice'}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={picks.includes(i)}
            aria-label={`Pedazo ${i + 1}`}
            onClick={() => toggle(i)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(i)}
          />
        ))}
      </svg>
      <p className="game-total">
        Pintaste{' '}
        <strong>
          {picks.length} de {game.parts}
        </strong>{' '}
        pedazos
      </p>
    </div>
  );
}

/* ---------------- Bloques de valor posicional ---------------- */

const PLACE: Record<number, { name: string; cls: string }> = {
  1000: { name: 'Millares', cls: 'block-1000' },
  100: { name: 'Centenas', cls: 'block-100' },
  10: { name: 'Decenas', cls: 'block-10' },
  1: { name: 'Unidades', cls: 'block-1' },
};

export function BlocksGame({ game, picks, onChange, disabled }: GameProps<'blocks'>) {
  const set = (i: number, delta: number) => onChange(picks.map((c, j) => (j === i ? Math.min(9, Math.max(0, c + delta)) : c)));
  const total = sum(picks.map((count, i) => count * game.places[i]));
  return (
    <div className="game">
      <div className="blocks-board" style={{ gridTemplateColumns: `repeat(${game.places.length}, 1fr)` }}>
        {game.places.map((place, i) => (
          <div key={place} className="blocks-col">
            <span className="blocks-name">{PLACE[place].name}</span>
            <div className="blocks-stack" aria-label={`${picks[i]} ${PLACE[place].name.toLowerCase()}`}>
              {Array.from({ length: picks[i] }, (_, k) => (
                <span key={k} className={`block ${PLACE[place].cls}`} />
              ))}
            </div>
            <strong className="blocks-count">{picks[i]}</strong>
            <div className="blocks-btns">
              <button className="maya-btn" disabled={disabled || picks[i] === 0} onClick={() => set(i, -1)} aria-label={`Quitar ${place}`}>
                −
              </button>
              <button className="maya-btn" disabled={disabled || picks[i] === 9} onClick={() => set(i, 1)} aria-label={`Agregar ${place}`}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="game-total">
        Formaste <strong>{fmt(total)}</strong>
      </p>
      <p className="hint game-hint">Máximo 9 por columna: 10 unidades se cambian por 1 decena.</p>
    </div>
  );
}

/* ---------------- Ordenar tarjetas ---------------- */

export function OrderGame({ game, picks, onChange, disabled }: GameProps<'order'>) {
  return (
    <div className="game">
      <div className="order-slots">
        {game.items.map((_, slot) => {
          const item = picks[slot];
          return (
            <span key={slot} className="order-slot-wrap">
              {slot > 0 && <span className="order-sep">{game.sep}</span>}
              <button
                className={item === undefined ? 'order-slot' : 'order-slot order-slot-full'}
                disabled={disabled || item === undefined}
                onClick={() => onChange(picks.slice(0, slot))}
                aria-label={item === undefined ? `Lugar ${slot + 1} vacío` : `Quitar ${game.items[item]}`}
              >
                {item === undefined ? '?' : game.items[item]}
              </button>
            </span>
          );
        })}
      </div>
      <div className="order-cards">
        {game.items.map((text, i) =>
          picks.includes(i) ? null : (
            <button key={i} className="order-card" disabled={disabled} onClick={() => onChange([...picks, i])}>
              {text}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function MiniGame(props: { game: GameSpec; picks: number[]; onChange: (p: number[]) => void; disabled?: boolean }) {
  const { game, ...rest } = props;
  switch (game.kind) {
    case 'coins':
      return <CoinsGame game={game} {...rest} />;
    case 'slices':
      return <SlicesGame game={game} {...rest} />;
    case 'blocks':
      return <BlocksGame game={game} {...rest} />;
    case 'order':
      return <OrderGame game={game} {...rest} />;
  }
}
