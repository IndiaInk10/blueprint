import type { GameUi, SearchEntry } from '@guide/sdk';
import type { LocalizedText, Ror2Content } from '../content/schema';
import { BUILDS_VIEW } from './BuildsView';
import { COMBOS_VIEW } from './CombosView';
import { MESSAGES } from './i18n';
import { ITEMS_VIEW } from './ItemsView';

/** Everything in Risk of Rain 2 worth jumping to from the global search. */
export function ror2Search(ui: GameUi<Ror2Content>): SearchEntry[] {
  const content = ui.content;
  if (!content) return [];
  const t = MESSAGES[ui.locale];
  const tr = (text: LocalizedText) => text[ui.locale] ?? text.en;

  return [
    ...content.survivors.map((s) => ({
      key: `survivor:${s.id}`,
      title: ui.text(s.token, s.en),
      subtitle: t.search.builds,
      group: t.search.survivors,
      icon: s.icon ? ui.assetUrl('survivor', s.id) : undefined,
      // The English name still matches in the Korean UI.
      keywords: [s.en],
      viewId: BUILDS_VIEW,
      entryId: s.id,
    })),
    ...Object.values(content.items).map((item) => ({
      key: `item:${item.id}`,
      title: ui.text(item.token, item.en),
      subtitle: t.tiers[item.tier],
      group: t.search.items,
      icon: item.icon ? ui.assetUrl('item', item.id) : undefined,
      keywords: [item.en],
      viewId: ITEMS_VIEW,
      entryId: item.id,
    })),
    ...content.combos.map((c) => ({
      key: `combo:${c.id}`,
      title: tr(c.title),
      subtitle: t.combos.focus[c.focus],
      group: t.combos.title,
      keywords: [...Object.values(c.title), ...Object.values(c.tagline)].filter((v): v is string => !!v),
      viewId: COMBOS_VIEW,
      entryId: c.id,
    })),
  ];
}
