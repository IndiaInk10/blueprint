import { describe, expect, it } from 'vitest';
import { applyTweaks, isApplied, readTweaks } from './graphics';

// Excerpt of a real user_settings.config: tab-indented lines inside render_settings.
const SETTINGS = [
  'render_settings = {',
  '\tlighting_and_material_quality = 1',
  '\tscreen_brightness = 0.76999998092651367',
  '\tlight_falloff_end_target = 10',
  '\tlight_falloff_end_target_bias = 1',
  '}',
].join('\n');

describe('lighting fix', () => {
  it('reads the current values', () => {
    expect(readTweaks(SETTINGS)).toEqual({ light_falloff_end_target: 10, lighting_and_material_quality: 1 });
  });

  it('sets only the two values and leaves similar keys alone', () => {
    const fixed = applyTweaks(SETTINGS);
    expect(readTweaks(fixed)).toEqual({ light_falloff_end_target: 3, lighting_and_material_quality: 2 });
    expect(fixed).toContain('\tlight_falloff_end_target_bias = 1');
    expect(fixed).toContain('\tscreen_brightness = 0.76999998092651367');
    expect(isApplied(SETTINGS)).toBe(false);
    expect(isApplied(fixed)).toBe(true);
  });

  it('does not invent keys the file lacks', () => {
    const text = 'render_settings = {\n\tscreen_brightness = 1\n}';
    expect(applyTweaks(text)).toBe(text);
    expect(readTweaks(text)).toEqual({ light_falloff_end_target: null, lighting_and_material_quality: null });
  });
});
