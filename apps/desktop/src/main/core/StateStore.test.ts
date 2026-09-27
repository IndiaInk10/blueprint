import { describe, expect, it } from 'vitest';
import { StateStore } from './StateStore';

interface TestState {
  phase: string;
  survivor?: string;
}

describe('StateStore', () => {
  it('lets a higher-priority provider own a field', () => {
    const changes: TestState[] = [];
    const store = new StateStore<TestState>({ phase: 'unknown' }, (s) => changes.push(s));

    store.apply(10, { survivor: 'MageBody' });
    store.apply(100, { survivor: 'HuntressBody' });
    store.apply(10, { survivor: 'MageBody', phase: 'menu' });

    expect(store.state).toEqual({ phase: 'menu', survivor: 'HuntressBody' });
    expect(changes).toHaveLength(3);
  });

  it('does not notify when nothing changed', () => {
    const changes: TestState[] = [];
    const store = new StateStore<TestState>({ phase: 'menu' }, (s) => changes.push(s));
    store.apply(1, { phase: 'menu' });
    expect(changes).toEqual([]);
  });
});
