import type { GameUi, SearchEntry } from '@guide/sdk';
import { equipmentKey, type Hd2Content, type LocalizedText } from '../content/schema';
import { ARSENAL_VIEW } from './ArsenalView';
import { COMBOS_VIEW } from './CombosView';
import { MESSAGES } from './i18n';
import { LOADOUTS_VIEW } from './LoadoutsView';
import { WARBONDS_VIEW } from './WarbondsView';

/** Everything in Helldivers 2 worth jumping to from the global search. */
export function hd2Search(ui: GameUi<Hd2Content>): SearchEntry[] {
  const content = ui.content;
  if (!content) return [];
  const t = MESSAGES[ui.locale];
  const tr = (text: LocalizedText | undefined) => (text ? (text[ui.locale] ?? text.en) : '');
  // The other language's name still matches, e.g. typing "Quasar" in the Korean UI.
  const keywords = (text: LocalizedText) => Object.values(text).filter((value): value is string => !!value);
  const asset = (kind: string, id: string, has: unknown) => (has ? ui.assetUrl(kind, id) : undefined);

  return [
    ...content.loadouts.map((l) => ({
      key: `loadout:${l.id}`,
      title: tr(l.title),
      subtitle: tr(content.factions.find((f) => f.id === l.faction)?.name),
      group: t.search.loadouts,
      keywords: keywords(l.title),
      viewId: LOADOUTS_VIEW,
      entryId: l.id,
    })),
    ...content.combos.map((c) => ({
      key: `combo:${c.id}`,
      title: tr(c.title),
      subtitle: t.combos.focus[c.focus],
      group: t.combos.title,
      keywords: [...keywords(c.title), ...keywords(c.tagline)],
      viewId: COMBOS_VIEW,
      entryId: c.id,
    })),
    ...content.warbonds.map((w) => ({
      key: `warbond:${w.id}`,
      title: tr(w.name),
      subtitle: t.warbonds.price(w.superCredits),
      group: t.search.warbonds,
      icon: asset('warbond', w.id, w.icon),
      keywords: keywords(w.name),
      viewId: WARBONDS_VIEW,
      entryId: w.id,
    })),
    ...Object.values(content.stratagems).map((s) => ({
      key: `stratagem:${s.id}`,
      title: tr(s.name),
      subtitle: t.categories[s.category],
      group: t.arsenal.stratagems,
      icon: asset('stratagem', s.id, s.icon),
      keywords: keywords(s.name),
      viewId: ARSENAL_VIEW,
      entryId: equipmentKey('stratagem', s.id),
    })),
    ...Object.values(content.weapons).map((w) => ({
      key: `weapon:${w.id}`,
      title: tr(w.name),
      subtitle: t.weaponSlots[w.slot],
      group: t.arsenal.weapons,
      icon: asset('weapon', w.id, w.icon),
      keywords: keywords(w.name),
      viewId: ARSENAL_VIEW,
      entryId: equipmentKey('weapon', w.id),
    })),
    ...Object.values(content.armorPassives).map((p) => ({
      key: `armor:${p.id}`,
      title: tr(p.name),
      subtitle: t.slots.armorPassive,
      group: t.arsenal.perks,
      icon: asset('armor', p.id, p.icon),
      keywords: keywords(p.name),
      viewId: ARSENAL_VIEW,
      entryId: equipmentKey('armor', p.id),
    })),
    ...Object.values(content.boosters).map((p) => ({
      key: `booster:${p.id}`,
      title: tr(p.name),
      subtitle: t.slots.booster,
      group: t.arsenal.perks,
      icon: asset('booster', p.id, p.icon),
      keywords: keywords(p.name),
      viewId: ARSENAL_VIEW,
      entryId: equipmentKey('booster', p.id),
    })),
  ];
}
