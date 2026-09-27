import type { GameManifest } from '@guide/sdk';

export const manifest: GameManifest = {
  id: 'ror2',
  displayName: { ko: '리스크 오브 레인 2', en: 'Risk of Rain 2' },
  steamAppId: 632360,
  process: { exe: ['Risk of Rain 2.exe'] },
  window: [{ title: 'Risk of Rain 2', mode: 'exact' }],
  antiCheat: 'none',
  overlay: { backends: ['window', 'detached'] },
};
