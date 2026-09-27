// Parser for Valve's text KeyValues format (libraryfolders.vdf, appmanifest_*.acf).

export type VdfValue = string | VdfObject;
export interface VdfObject {
  [key: string]: VdfValue;
}

type Token = { kind: 'string'; value: string } | { kind: 'open' } | { kind: 'close' };

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', '"': '"' };

function* tokenize(text: string): Generator<Token> {
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '{') {
      i++;
      yield { kind: 'open' };
    } else if (ch === '}') {
      i++;
      yield { kind: 'close' };
    } else if (ch === '[') {
      // Platform conditionals such as [$WIN32] are ignored.
      while (i < text.length && text[i] !== ']') i++;
      i++;
    } else if (ch === '"') {
      i++;
      let value = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const next = text[i + 1]!;
          value += ESCAPES[next] ?? next;
          i += 2;
        } else {
          value += text[i];
          i++;
        }
      }
      i++;
      yield { kind: 'string', value };
    } else {
      let value = '';
      while (i < text.length && !/[\s{}"]/.test(text[i]!)) value += text[i++];
      yield { kind: 'string', value };
    }
  }
}

export function parseVdf(text: string): VdfObject {
  const root: VdfObject = {};
  const stack: VdfObject[] = [root];
  let pendingKey: string | null = null;

  for (const token of tokenize(text)) {
    const current = stack[stack.length - 1]!;
    if (token.kind === 'string') {
      if (pendingKey === null) {
        pendingKey = token.value;
      } else {
        current[pendingKey] = token.value;
        pendingKey = null;
      }
    } else if (token.kind === 'open') {
      if (pendingKey === null) throw new Error('VDF: "{" without a key');
      const child: VdfObject = {};
      current[pendingKey] = child;
      stack.push(child);
      pendingKey = null;
    } else {
      if (stack.length === 1) throw new Error('VDF: unbalanced "}"');
      stack.pop();
    }
  }

  if (stack.length !== 1) throw new Error('VDF: unexpected end of input');
  return root;
}

export function vdfObject(value: VdfValue | undefined): VdfObject | undefined {
  return typeof value === 'object' ? value : undefined;
}

export function vdfString(value: VdfValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
