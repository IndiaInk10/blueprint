import type { GameManifest } from '@guide/sdk';

export const manifest: GameManifest = {
  id: 'helldivers2',
  displayName: { ko: '헬다이버즈 2', en: 'Helldivers 2' },
  steamAppId: 553850,
  process: { exe: ['helldivers2.exe'] },
  window: [{ title: 'HELLDIVERS', mode: 'contains' }],
  // Kernel anti-cheat (nProtect GameGuard). The window overlay never touches the game process.
  antiCheat: 'gameguard',
  overlay: { backends: ['window', 'detached'] },
};
