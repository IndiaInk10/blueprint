import { useState } from 'react';
import { Chips, MasterDetail, Row, SearchBox, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import type { ComboFocus } from '../content/schema';
import { Icon } from './EquipTile';
import { useT } from './i18n';
import { KitDetail } from './KitDetail';
import { useHd2, useSelection as useOverlaySelection } from './useHd2';
import './hd2.css';

const FOCUSES: ComboFocus[] = ['weapon', 'warbond', 'stratagem', 'role'];
export const COMBOS_VIEW = 'combos';

/** Themed kits for fun: filter and pick on the left, the full kit on the right. */
export function CombosView() {
  const { content, tr, icon } = useHd2();
  const t = useT();
  const { selection, select } = useOverlaySelection();
  const [selected, setSelected] = useSelection(COMBOS_VIEW);
  const [focus, setFocus] = usePersistentState<ComboFocus | 'all'>('combos:focus', 'all');
  const [query, setQuery] = useState('');
  if (!content) return <p className="hd2-muted">{t.loading}</p>;

  const needle = query.trim().toLowerCase();
  const matches = content.combos.filter(
    (c) =>
      (focus === 'all' || c.focus === focus) &&
      (!needle || [c.title, c.tagline].some((text) => Object.values(text).some((s) => s?.toLowerCase().includes(needle)))),
  );
  const groups = FOCUSES.map((option) => ({
    key: option,
    title: focus === 'all' ? t.combos.focus[option] : undefined,
    items: matches.filter((c) => c.focus === option),
  }));
  // A search jump may point outside the current filter; show it anyway.
  const combo = content.combos.find((c) => c.id === selected) ?? matches[0];
  const warbond = combo?.warbond ? content.warbonds.find((w) => w.id === combo.warbond) : undefined;
  const factionName = (id: string) => tr(content.factions.find((f) => f.id === id)?.name) || id;

  return (
    <MasterDetail
      listWidth={340}
      list={
        <>
          <Chips
            options={[
              { id: 'all' as const, label: t.combos.all, count: content.combos.length },
              ...FOCUSES.map((option) => ({ id: option, label: t.combos.focus[option], count: content.combos.filter((c) => c.focus === option).length })),
            ]}
            value={focus}
            onChange={setFocus}
          />
          <SearchBox value={query} onChange={setQuery} placeholder={t.combos.search} />
          <SelectList
            groups={groups}
            getKey={(c) => c.id}
            selected={combo?.id ?? null}
            onSelect={setSelected}
            empty={t.arsenal.noResults}
            renderItem={(c) => (
              <Row
                icon={
                  c.warbond ? (
                    <Icon src={icon('warbond', c.warbond)} className="hd2-row-cover" />
                  ) : (
                    <Icon src={icon('stratagem', c.stratagems[0]!)} className="hd2-row-icon" kind="stratagem" />
                  )
                }
                title={tr(c.title)}
                subtitle={tr(c.tagline)}
                trailing={c.id === selection?.loadoutId ? <span className="hd2-overlay-tag">{t.inOverlay}</span> : undefined}
              />
            )}
          />
        </>
      }
      detail={
        combo && (
          <KitDetail
            kit={combo}
            faction={combo.bestAgainst.length === 1 ? combo.bestAgainst[0]! : null}
            followed={combo.id === selection?.loadoutId}
            onFollow={(on) => void select(on ? { loadoutId: combo.id } : null)}
            badges={[
              t.combos.focus[combo.focus],
              ...combo.tags.map((option) => t.combos.tags[option]),
              combo.bestAgainst.length > 0 ? combo.bestAgainst.map(factionName).join(' · ') : t.combos.anyEnemy,
            ]}
            intro={
              <p className="hd2-combo-intro">
                <strong>{tr(combo.tagline)}</strong>
                {combo.armorSet && <span className="hd2-muted">{t.combos.armorSet(tr(combo.armorSet))}</span>}
                {warbond && (
                  <span className="hd2-combo-warbond">
                    <Icon src={icon('warbond', warbond.id)} className="hd2-combo-warbond-cover" />
                    {t.combos.fromWarbond(tr(warbond.name))}
                  </span>
                )}
              </p>
            }
            extraReasons={combo.whyFun ? [{ label: t.combos.whyFun, text: tr(combo.whyFun) }] : []}
          />
        )
      }
    />
  );
}
