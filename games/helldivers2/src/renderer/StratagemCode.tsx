import type { Direction } from '../content/schema';

const ROTATION: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 };
const LABEL: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' };

/** A stratagem input sequence drawn as arrow keys, like the in-game call-in prompt. */
export function StratagemCode({ code, size = 'normal' }: { code: Direction[]; size?: 'normal' | 'small' }) {
  return (
    <span className={`hd2-code ${size}`} aria-label={code.map((d) => LABEL[d]).join(' ')}>
      {code.map((direction, index) => (
        <svg key={index} className="hd2-key" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 3L13 9H9.8V13H6.2V9H3Z" transform={`rotate(${ROTATION[direction]} 8 8)`} />
        </svg>
      ))}
    </span>
  );
}
