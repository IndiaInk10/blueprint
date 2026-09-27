import { describe, expect, it } from 'vitest';
import { BundledUiSource } from './UiSource';

describe('BundledUiSource.isTrustedUrl', () => {
  it('trusts only the dev server origin in development', () => {
    const ui = new BundledUiSource('C:\\app\\out\\renderer', 'http://localhost:5173');
    expect(ui.isTrustedUrl('http://localhost:5173/index.html?x=1')).toBe(true);
    expect(ui.isTrustedUrl('http://localhost:5174/index.html')).toBe(false);
    expect(ui.isTrustedUrl('https://example.com/')).toBe(false);
    expect(ui.isTrustedUrl('file:///C:/app/out/renderer/index.html')).toBe(false);
  });

  it('trusts only files inside the renderer directory when packaged', () => {
    const ui = new BundledUiSource('C:\\app\\out\\renderer', null);
    expect(ui.isTrustedUrl('file:///C:/app/out/renderer/overlay.html?game=ror2')).toBe(true);
    expect(ui.isTrustedUrl('file:///c:/APP/out/renderer/index.html')).toBe(true);
    expect(ui.isTrustedUrl('file:///C:/app/out/renderer-evil/index.html')).toBe(false);
    expect(ui.isTrustedUrl('file:///C:/Users/me/Downloads/page.html')).toBe(false);
    expect(ui.isTrustedUrl('http://localhost:5173/index.html')).toBe(false);
    expect(ui.isTrustedUrl('not a url')).toBe(false);
  });
});
