// Parses the game's Unity rich text (<style=cIsDamage>, <color=#hex>) into styled segments.
// Output is plain data rendered as text nodes, never HTML, so game strings cannot inject markup.

export interface RichSegment {
  text: string;
  /** Innermost <style=...> name, e.g. "cIsDamage". */
  style?: string;
  /** Innermost <color=#...>, validated as a hex colour. */
  color?: string;
}

const TAG = /<(\/?)(style|color)(?:=([^>]*))?>/gi;
const HEX = /^#[0-9a-f]{3,8}$/i;

export function parseRichText(input: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const styles: string[] = [];
  const colors: string[] = [];
  let last = 0;

  const push = (text: string) => {
    if (!text) return;
    segments.push({ text, style: styles.at(-1), color: colors.at(-1) });
  };

  for (const match of input.matchAll(TAG)) {
    push(input.slice(last, match.index));
    last = match.index + match[0].length;
    const [, closing, tag, value = ''] = match;
    const stack = tag!.toLowerCase() === 'style' ? styles : colors;
    if (closing) stack.pop();
    else if (stack === colors) stack.push(HEX.test(value) ? value : (colors.at(-1) ?? ''));
    else stack.push(value);
  }
  push(input.slice(last));
  // Any other Unity tags (e.g. <sprite>) are dropped from the visible text.
  return segments
    .map((segment) => ({ ...segment, text: segment.text.replace(/<[^>]*>/g, '') }))
    .filter((segment) => segment.text.length > 0);
}
