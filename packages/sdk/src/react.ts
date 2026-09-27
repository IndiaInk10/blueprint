// React runtime helpers, kept out of the main entry so the main process never bundles React.
import { createContext, useContext } from 'react';
import type { GameUi } from './renderer';

export const GameUiContext = createContext<GameUi | null>(null);

export function useGameUi<C>(): GameUi<C> {
  const ui = useContext(GameUiContext);
  if (!ui) throw new Error('useGameUi must be used inside the host-provided GameUiContext');
  return ui as GameUi<C>;
}
