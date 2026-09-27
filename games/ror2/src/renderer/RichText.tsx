import { useMemo } from 'react';
import { parseRichText } from './richTextParser';

/** Game description text with the game's own highlight colours. */
export function RichText({ text }: { text: string }) {
  const segments = useMemo(() => parseRichText(text), [text]);
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={index}
          className={segment.style ? `rt-${segment.style}` : undefined}
          style={segment.color ? { color: segment.color } : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  );
}
