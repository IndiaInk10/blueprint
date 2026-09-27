import { useMemo, useState } from 'react';
import { Chips, MasterDetail, Row, SearchBox, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import type { Item, ItemRank, ItemTier, Popularity } from '../content/schema';
import { ItemIcon, RankBadge } from './ItemChip';
import { useT } from './i18n';
import { TIER_ORDER } from './labels';
import { RichText } from './RichText';
import { SurvivorPortrait } from './SurvivorPortrait';
import { useRor2 } from './useRor2';
import './ror2.css';

type Sort = 'rank' | 'popularity' | 'name';
const RANK_ORDER: Record<ItemRank, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
const POPULARITY_ORDER: Record<Popularity, number> = { 'very-high': 0, high: 1, medium: 2, low: 3, rare: 4 };
const UNRATED = 9;
export const ITEMS_VIEW = 'items';

/** Every item and equipment: filter and pick on the left, everything about it on the right. */
export function ItemsView() {
  const { ui, content, tr, itemName, itemIcon, survivorName, survivorIcon } = useRor2();
  const t = useT();
  const [selected, setSelected] = useSelection(ITEMS_VIEW);
  const [tier, setTier] = usePersistentState<ItemTier | 'all'>('items:tier', 'all');
  const [sort, setSort] = usePersistentState<Sort>('items:sort', 'rank');
  const [topOnly, setTopOnly] = usePersistentState('items:top', false);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    if (!content) return [];
    const needle = query.trim().toLowerCase();
    const matches = (item: Item) =>
      !needle ||
      itemName(item.id).toLowerCase().includes(needle) ||
      item.en.toLowerCase().includes(needle) ||
      (item.pickup ? ui.text(item.pickup, '').toLowerCase().includes(needle) : false);
    const rank = (item: Item) => {
      const r = content.ratings[item.id]?.rank;
      return r ? RANK_ORDER[r] : UNRATED;
    };
    const popular = (item: Item) => {
      const p = content.ratings[item.id]?.popularity;
      return p ? POPULARITY_ORDER[p] : UNRATED;
    };
    const byName = (a: Item, b: Item) => itemName(a.id).localeCompare(itemName(b.id), ui.locale);
    const compare = (a: Item, b: Item) =>
      sort === 'rank'
        ? rank(a) - rank(b) || popular(a) - popular(b) || byName(a, b)
        : sort === 'popularity'
          ? popular(a) - popular(b) || rank(a) - rank(b) || byName(a, b)
          : byName(a, b);
    const items = Object.values(content.items).filter(
      (item) => (tier === 'all' || item.tier === tier) && (!topOnly || rank(item) <= RANK_ORDER.A) && matches(item),
    );
    return TIER_ORDER.map((option) => ({
      key: option,
      title: t.tiers[option],
      items: items.filter((item) => item.tier === option).sort(compare),
    }));
  }, [content, query, tier, sort, topOnly, itemName, ui, t]);

  if (!content) return <p className="ror2-muted">{t.loading}</p>;

  const total = Object.keys(content.items).length;
  const item = (selected ? content.items[selected] : undefined) ?? groups.find((g) => g.items.length)?.items[0];
  const rating = item ? content.ratings[item.id] : undefined;
  // Where the item shows up: our survivor builds and theme builds.
  const inBuilds = item
    ? content.survivors.filter((s) => content.builds[s.id]?.builds.some((b) => b.nodes.some((n) => n.items.some((i) => i.id === item.id))))
    : [];
  const inCombos = item ? content.combos.filter((c) => c.items.some((i) => i.id === item.id) || c.equipment === item.id) : [];

  return (
    <MasterDetail
      listWidth={340}
      list={
        <>
          <SearchBox value={query} onChange={setQuery} placeholder={t.items.search(total)} />
          <select
            className="ror2-select"
            aria-label={t.items.tiers}
            value={tier}
            onChange={(event) => setTier(event.target.value as ItemTier | 'all')}
          >
            <option value="all">
              {t.items.tiers}: {t.items.all}
            </option>
            {TIER_ORDER.map((option) => (
              <option key={option} value={option}>
                {t.tiers[option]}
              </option>
            ))}
          </select>
          <div className="ror2-list-tools">
            <Chips options={(['rank', 'popularity', 'name'] as const).map((id) => ({ id, label: t.items.sort[id] }))} value={sort} onChange={setSort} />
            <button type="button" className={topOnly ? 'ui-chip active' : 'ui-chip'} onClick={() => setTopOnly(!topOnly)}>
              {t.items.topOnly}
            </button>
          </div>
          <SelectList
            groups={groups}
            getKey={(i) => i.id}
            selected={item?.id ?? null}
            onSelect={setSelected}
            empty={t.items.noResults}
            renderItem={(i) => (
              <Row
                icon={<ItemIcon src={itemIcon(i.id)} className="ror2-row-icon" />}
                title={itemName(i.id)}
                trailing={<RankBadge rank={content.ratings[i.id]?.rank} size="small" />}
              />
            )}
          />
        </>
      }
      detail={
        item && (
          <article className={`ror2-item-detail tier-${item.tier}`}>
            <header className="ror2-item-detail-head">
              <ItemIcon src={itemIcon(item.id)} className="ror2-item-detail-icon" />
              <div>
                <h2 className="ror2-build-title">{itemName(item.id)}</h2>
                <div className="ror2-item-detail-tier">
                  {t.tiers[item.tier]}
                  {item.dlc && item.dlc !== 'base' && <span className="ror2-muted"> · {t.dlc[item.dlc]}</span>}
                </div>
              </div>
            </header>
            {item.desc ? (
              <p className="ror2-item-detail-desc">
                <RichText text={ui.text(item.desc, '')} />
              </p>
            ) : (
              item.pickup && <p className="ror2-item-detail-desc">{ui.text(item.pickup, '')}</p>
            )}
            {rating && (
              <section className="ror2-hovercard-rating">
                <div className="ror2-hovercard-rating-head">
                  <RankBadge rank={rating.rank} />
                  <span>{t.rating.rank(rating.rank)}</span>
                  {rating.popularity && <span className="ror2-muted">· {t.rating.popularity[rating.popularity]}</span>}
                </div>
                <p className="ror2-hovercard-verdict">{tr(rating.verdict)}</p>
              </section>
            )}
            {rating && rating.bestFor.length > 0 && (
              <section>
                <h3 className="ror2-section-title">{t.rating.bestFor}</h3>
                <div className="ror2-links">
                  {rating.bestFor.map((id) => (
                    <button key={id} type="button" className="ror2-link-chip" onClick={() => ui.navigate('builds', id)}>
                      <SurvivorPortrait src={survivorIcon(id)} fallback={survivorName(id).slice(0, 1)} small />
                      {survivorName(id)}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {inBuilds.length > 0 && (
              <section>
                <h3 className="ror2-section-title">{t.items.inBuilds}</h3>
                <div className="ror2-links">
                  {inBuilds.map((s) => (
                    <button key={s.id} type="button" className="ror2-link-chip" onClick={() => ui.navigate('builds', s.id)}>
                      <SurvivorPortrait src={survivorIcon(s.id)} fallback={survivorName(s.id).slice(0, 1)} small />
                      {survivorName(s.id)}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {inCombos.length > 0 && (
              <section>
                <h3 className="ror2-section-title">{t.items.inCombos}</h3>
                <div className="ror2-links">
                  {inCombos.map((c) => (
                    <button key={c.id} type="button" className="ror2-link-chip" onClick={() => ui.navigate('combos', c.id)}>
                      {tr(c.title)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </article>
        )
      }
    />
  );
}
