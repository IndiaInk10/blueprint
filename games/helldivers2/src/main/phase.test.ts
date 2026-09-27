import { describe, expect, it } from 'vitest';
import { PhaseTracker, phaseFromCorner } from './phase';

describe('phaseFromCorner', () => {
  it('reads the ship name as the lobby, in any language', () => {
    expect(phaseFromCorner(['SES 자유의', '운용사: 김철민'])).toBe('lobby');
    expect(phaseFromCorner(['SES Citizen of Freedom', 'Operator: Kim'])).toBe('lobby');
    expect(phaseFromCorner(['5ES 자유의'])).toBe('lobby');
  });

  it('reads anything else in the corner as a mission', () => {
    // The mission HUD's stratagem list, as OCR actually read it.
    expect(phaseFromCorner(['@ 스트리다생'])).toBe('mission');
    expect(phaseFromCorner(['STRATAGEMS'])).toBe('mission');
  });

  it('keeps the current phase when the corner is empty', () => {
    expect(phaseFromCorner([])).toBeNull();
    expect(phaseFromCorner(['  '])).toBeNull();
  });
});

describe('PhaseTracker', () => {
  it('switches only after the same reading repeats', () => {
    const tracker = new PhaseTracker(2);
    expect(tracker.observe('lobby')).toBeNull();
    expect(tracker.observe('lobby')).toBe('lobby');
    expect(tracker.observe('lobby')).toBeNull();
  });

  it('ignores a single odd read in between', () => {
    const tracker = new PhaseTracker(2);
    tracker.observe('mission');
    tracker.observe('mission');
    expect(tracker.observe('lobby')).toBeNull();
    expect(tracker.observe('mission')).toBeNull();
    expect(tracker.observe('lobby')).toBeNull();
    expect(tracker.observe('lobby')).toBe('lobby');
  });

  it('treats empty reads (loading screens) as no evidence', () => {
    const tracker = new PhaseTracker(2);
    tracker.observe('mission');
    expect(tracker.observe(null)).toBeNull();
    expect(tracker.observe('mission')).toBeNull();
    expect(tracker.observe('mission')).toBe('mission');
  });
});
