import type { GameRendererModule } from '@guide/sdk';
import { manifest } from '../manifest';
import type { Ror2State } from '../state';
import { BuildsView } from './BuildsView';
import { BuildSummaryPanel } from './BuildSummaryPanel';
import { CombosView } from './CombosView';
import { CreditsView } from './CreditsView';
import { ItemsView } from './ItemsView';
import { ror2Search } from './search';

export const ror2Renderer: GameRendererModule<Ror2State> = {
  manifest,
  appViews: [
    { id: 'builds', title: { ko: '빌드', en: 'Builds' }, component: BuildsView },
    { id: 'combos', title: { ko: '테마 빌드', en: 'Theme builds' }, component: CombosView },
    { id: 'items', title: { ko: '아이템 도감', en: 'Items' }, component: ItemsView },
  ],
  creditsView: CreditsView,
  search: ror2Search,
  overlayPanels: [
    {
      id: 'build-summary',
      title: { ko: '빌드 요약', en: 'Build summary' },
      component: BuildSummaryPanel,
      // Small on purpose: the full tree lives in the main window.
      defaultAnchor: { edge: 'right', offset: { x: 24, y: 120 }, size: { width: 300 } },
      visibility: 'pinned',
    },
  ],
};
