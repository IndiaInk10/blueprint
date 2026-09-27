import { describe, expect, it } from 'vitest';
import { parseVdf } from './vdf';

describe('parseVdf', () => {
  it('parses nested objects with tab-separated pairs', () => {
    const text = [
      '"libraryfolders"',
      '{',
      '\t"0"',
      '\t{',
      '\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"',
      '\t\t"apps"',
      '\t\t{',
      '\t\t\t"632360"\t\t"3208983811"',
      '\t\t}',
      '\t}',
      '}',
    ].join('\n');

    expect(parseVdf(text)).toEqual({
      libraryfolders: { '0': { path: 'C:\\Program Files (x86)\\Steam', apps: { '632360': '3208983811' } } },
    });
  });

  it('handles escapes, comments, unquoted tokens and platform conditionals', () => {
    const text = '// header\n"root" { "q" "say \\"hi\\"" key value "win" "1" [$WIN32] }';
    expect(parseVdf(text)).toEqual({ root: { q: 'say "hi"', key: 'value', win: '1' } });
  });

  it('rejects unbalanced input', () => {
    expect(() => parseVdf('"a" {')).toThrow();
    expect(() => parseVdf('}')).toThrow();
  });
});
