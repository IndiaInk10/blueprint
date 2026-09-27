import { describe, expect, it } from 'vitest';
import { parseRichText } from './richTextParser';

describe('parseRichText', () => {
  it('splits nested styles the way the game nests them', () => {
    const input = '<style=cIsDamage>공격 속도</style>가 <style=cIsDamage>15%<style=cStack>(중첩당 +15%)</style></style> 증가합니다.';
    expect(parseRichText(input)).toEqual([
      { text: '공격 속도', style: 'cIsDamage', color: undefined },
      { text: '가 ', style: undefined, color: undefined },
      { text: '15%', style: 'cIsDamage', color: undefined },
      { text: '(중첩당 +15%)', style: 'cStack', color: undefined },
      { text: ' 증가합니다.', style: undefined, color: undefined },
    ]);
  });

  it('keeps only valid hex colours and drops unknown tags', () => {
    expect(parseRichText('<color=#ff0000>red</color> <color=javascript:x>no</color> <sprite=1>x')).toEqual([
      { text: 'red', style: undefined, color: '#ff0000' },
      { text: ' ', style: undefined, color: undefined },
      { text: 'no', style: undefined, color: '' },
      { text: ' x', style: undefined, color: undefined },
    ]);
  });
});
