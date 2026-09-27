import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayApp } from './OverlayApp';
import './overlay.css';

const gameId = new URLSearchParams(location.search).get('game');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{gameId && <OverlayApp gameId={gameId} />}</StrictMode>,
);
