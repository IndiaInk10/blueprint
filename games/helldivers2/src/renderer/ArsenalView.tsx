import { useState } from 'react';
import { Chips, MasterDetail, Row, SearchBox, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import { loadoutKeys } from '../content/recommend';
import { equipmentKey, type EquipmentKind, type LocalizedText, type Popularity, type StratagemCategory, type Tier } from '../content/schema';
import { EquipDetails, Icon } from './EquipTile';
import { useT } from './i18n';
import { TierBadge } from './Rating';
import { StratagemCode } from './StratagemCode';
import { useHd2 } from './useHd2';
import './hd2.css';

type Tab = 'stratagems' | 'weapons' | 'perks';
type Sort = 'tier' | 'popularity' | 'name';
const CATEGORY_ORDER: StratagemCategory[] = ['support-weapon', 'backpack', 'orbital', 'eagle', 'sentry', 'emplacement', 'vehicle', 'mission'];
const TIER_ORDER: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
const POPULARITY_ORDER: Record<Popularity, number> = { 'very-high': 0, high: 1, medium: 2, low: 3, rare: 4 };
const UNRATED = 9;
export const ARSENAL_VIEW = 'arsenal';

interface Entry {
  key: string;
  kind: EquipmentKind;
  id: string;
  name: string;
  names: LocalizedText;
  tier: Tier | null;
  popularity: Popularity | null;
  group: string;
  groupTitle: string;
  trailing?: 'code' | string;
}

/** Everything in the armory: pick from the list, read everything about it on the right. */
export function ArsenalView() {
  const { ui, content, tr, icon } = useHd2();
  const t = useT();
  const [selected, setSelected] = useSelection(ARSENAL_VIEW);
  const [tab, setTab] = usePersistentState<Tab>('arsenal:tab', 'stratagems');
  const [sort, setSort] = usePersistentState<Sort>('arsenal:sort', 'tier');
  const [topOnly, setTopOnly] = usePersistentState('arsenal:top', false);
  const [query, setQuery] = useState('');
  if (!content) return <p className="hd2-muted">{t.loading}</p>;

  // A search jump can land on another tab's entry; follow it.
  const selectedKind = selected?.split(':')[0] as EquipmentKind | undefined;
  const tabOf = (kind: EquipmentKind): Tab => (kind === 'stratagem' ? 'stratagems' : kind === 'weapon' ? 'weapons' : 'perks');
  const activeTab = selectedKind && tabOf(selectedKind) !== tab && selected ? tabOf(selectedKind) : tab;

  const entry = (kind: EquipmentKind, id: string, names: LocalizedText, group: string, groupTitle: string, trailing?: string): Entry => {
    const rating = content.ratings[equipmentKey(kind, id)];
    return { key: equipmentKey(kind, id), kind, id, name: tr(names), names, tier: rating?.overall ?? null, popularity: rating?.popularity ?? null, group, groupTitle, trailing };
  };
  const all: Entry[] =
    activeTab === 'stratagems'
      ? CATEGORY_ORDER.flatMap((category) =>
          Object.values(content.stratagems)
            .filter((s) => s.category === category)
            .map((s) => entry('stratagem', s.id, s.name, category, t.categories[category], 'code')),
        )
      : activeTab === 'weapons'
        ? (['primary', 'secondary', 'throwable'] as const).flatMap((slot) =>
            Object.values(content.weapons)
              .filter((w) => w.slot === slot)
              .map((w) => entry('weapon', w.id, w.name, slot, t.weaponSlots[slot], w.armorPen ? t.armorPen[w.armorPen] : t.weaponCategories[w.category])),
          )
        : [
            ...Object.values(content.armorPassives).map((p) => entry('armor', p.id, p.name, 'armor', t.arsenal.armorPassives)),
            ...Object.values(content.boosters).map((p) => entry('booster', p.id, p.name, 'booster', t.arsenal.boosters)),
          ];

  const needle = query.trim().toLowerCase();
  const visible = all
    .filter((e) => !topOnly || e.tier === 'S' || e.tier === 'A')
    .filter((e) => !needle || Object.values(e.names).some((n) => n?.toLowerCase().includes(needle)))
    .sort((a, b) => {
      const byTier = (a.tier ? TIER_ORDER[a.tier] : UNRATED) - (b.tier ? TIER_ORDER[b.tier] : UNRATED);
      const byPopularity = (a.popularity ? POPULARITY_ORDER[a.popularity] : UNRATED) - (b.popularity ? POPULARITY_ORDER[b.popularity] : UNRATED);
      if (sort === 'tier') return byTier || byPopularity || a.name.localeCompare(b.name);
      if (sort === 'popularity') return byPopularity || byTier || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  const groups = [...new Map(all.map((e) => [e.group, e.groupTitle])).entries()].map(([key, title]) => ({
    key,
    title,
    items: visible.filter((e) => e.group === key),
  }));
  const current = all.find((e) => e.key === selected) ?? visible[0];

  // Kits that use the selected entry, as links.
  const users = current
    ? [
        ...content.loadouts.map((kit) => ({ kit, view: 'loadouts' })),
        ...content.combos.map((kit) => ({ kit, view: 'combos' })),
      ].filter(({ kit }) => loadoutKeys(kit).includes(current.key as never))
    : [];

  return (
    <MasterDetail
      listWidth={360}
      list={
        <>
          <Chips
            options={(['stratagems', 'weapons', 'perks'] as const).map((id) => ({ id, label: t.arsenal[id] }))}
            value={activeTab}
            onChange={(next) => {
              setTab(next);
              setSelected(null);
            }}
          />
          <SearchBox value={query} onChange={setQuery} placeholder={t.arsenal.search} />
          <div className="hd2-list-tools">
            <Chips options={(['tier', 'popularity', 'name'] as const).map((id) => ({ id, label: t.sort[id] }))} value={sort} onChange={setSort} />
            <button type="button" className={topOnly ? 'ui-chip active' : 'ui-chip'} onClick={() => setTopOnly(!topOnly)}>
              {t.topOnly}
            </button>
          </div>
          <SelectList
            groups={groups}
            getKey={(e) => e.key}
            selected={current?.key ?? null}
            onSelect={setSelected}
            empty={t.arsenal.noResults}
            renderItem={(e) => (
              <Row
                icon={
                  <>
                    <TierBadge tier={e.tier} size="small" />
                    <Icon src={icon(e.kind, e.id)} className={e.kind === 'weapon' ? 'hd2-row-icon wide' : 'hd2-row-icon'} kind={e.kind} />
                  </>
                }
                title={e.name}
                subtitle={e.trailing && e.trailing !== 'code' ? e.trailing : undefined}
                trailing={
                  e.trailing === 'code' ? (
                    <StratagemCode code={content.stratagems[e.id]!.code} size="small" />
                  ) : e.popularity === 'very-high' || e.popularity === 'high' ? (
                    <span className="hd2-popular">{t.rating.popularTag}</span>
                  ) : undefined
                }
              />
            )}
          />
        </>
      }
      detail={
        current ? (
          <article className="hd2-detail hd2-equip-detail">
            <EquipDetails kind={current.kind} id={current.id} />
            {users.length > 0 && (
              <section className="hd2-card-section">
                <div className="hd2-card-label">{t.arsenal.usedIn}</div>
                <div className="hd2-links">
                  {users.map(({ kit, view }) => (
                    <button key={kit.id} type="button" className="hd2-link-chip" onClick={() => ui.navigate(view, kit.id)}>
                      {tr(kit.title)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : null
      }
    />
  );
}
