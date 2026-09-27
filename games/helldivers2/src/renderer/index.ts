import type { GameRendererModule } from '@guide/sdk';
import { manifest } from '../manifest';
import type { Hd2State } from '../state';
import { ArsenalView } from './ArsenalView';
import { CombosView } from './CombosView';
import { CreditsView } from './CreditsView';
import { LoadoutsView } from './LoadoutsView';
import { LoadoutPanel } from './LoadoutPanel';
import { hd2Search } from './search';
import { WarbondsView } from './WarbondsView';

export const hd2Renderer: GameRendererModule<Hd2State> = {
  manifest,
  appViews: [
    { id: 'loadouts', title: { ko: '로드아웃', en: 'Loadouts' }, component: LoadoutsView },
    { id: 'combos', title: { ko: '테마 조합', en: 'Theme combos' }, component: CombosView },
    { id: 'warbonds', title: { ko: '전쟁 채권', en: 'Warbonds' }, component: WarbondsView },
    { id: 'arsenal', title: { ko: '무기고', en: 'Armory' }, component: ArsenalView },
  ],
  creditsView: CreditsView,
  search: hd2Search,
  overlayPanels: [
    {
      id: 'loadout',
      title: { ko: '로드아웃', en: 'Loadout' },
      component: LoadoutPanel,
      // Only on the ship while picking equipment; missions keep the HUD clear.
      showWhen: (state) => state.phase === 'lobby',
      defaultAnchor: { edge: 'right', offset: { x: 24, y: 160 }, size: { width: 280 } },
      visibility: 'pinned',
    },
  ],
};
