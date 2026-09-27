import { useState } from 'react';
import { Chips, MasterDetail, Row, SearchBox, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import type { ComboFocus } from '../content/schema';
import { useT } from './i18n';
import { ItemChip, ItemIcon, ItemTile } from './ItemChip';
import { SurvivorPortrait } from './SurvivorPortrait';
import { useRor2 } from './useRor2';
import './ror2.css';

const FOCUSES: ComboFocus[] = ['survivor', 'items', 'equipment', 'challenge'];
export const COMBOS_VIEW = 'combos';

/** Theme builds for fun: filter and pick on the left, what to chase on the right. */
export function CombosView() {
  const { ui, content, tr, itemIcon, survivorName, survivorIcon } = useRor2();
  const t = useT();
  const [selected, setSelected] = useSelection(COMBOS_VIEW);
  const [focus, setFocus] = usePersistentState<ComboFocus | 'all'>('combos:focus', 'all');
  const [query, setQuery] = useState('');
  if (!content) return <p className="ror2-muted">{t.loading}</p>;

  const needle = query.trim().toLowerCase();
  const matches = content.combos.filter(
    (c) =>
      (focus === 'all' || c.focus === focus) &&
      (!needle ||
        [c.title, c.tagline].some((text) => Object.values(text).some((s) => s?.toLowerCase().includes(needle))) ||
        c.survivors.some((id) => survivorName(id).toLowerCase().includes(needle))),
  );
  const groups = FOCUSES.map((option) => ({
    key: option,
    title: focus === 'all' ? t.combos.focus[option] : undefined,
    items: matches.filter((c) => c.focus === option),
  }));
  const combo = content.combos.find((c) => c.id === selected) ?? groups.find((g) => g.items.length)?.items[0];

  return (
    <MasterDetail
      listWidth={340}
      list={
        <>
          <Chips
            options={[
              { id: 'all' as const, label: t.combos.all, count: content.combos.length },
              ...FOCUSES.filter((option) => content.combos.some((c) => c.focus === option)).map((option) => ({
                id: option,
                label: t.combos.focus[option] ?? option,
                count: content.combos.filter((c) => c.focus === option).length,
              })),
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
            empty={t.items.noResults}
            renderItem={(c) => (
              <Row
                icon={
                  c.focus === 'survivor' && c.survivors[0] ? (
                    <SurvivorPortrait src={survivorIcon(c.survivors[0])} fallback={survivorName(c.survivors[0]).slice(0, 1)} />
                  ) : (
                    <ItemIcon src={itemIcon(c.items[0]!.id)} className="ror2-row-icon" />
                  )
                }
                title={tr(c.title)}
                subtitle={tr(c.tagline)}
              />
            )}
          />
        </>
      }
      detail={
        combo && (
          <article className="ror2-combo-detail">
            <header>
              <h2 className="ror2-build-title">{tr(combo.title)}</h2>
              <div className="ror2-combo-badges">
                <span>{t.combos.focus[combo.focus]}</span>
                {combo.tags.map((tag) => (
                  <span key={tag}>{t.combos.tags[tag]}</span>
                ))}
              </div>
              <p className="ror2-combo-lead">{tr(combo.tagline)}</p>
            </header>
            <p className="ror2-build-summary">{tr(combo.summary)}</p>

            <section>
              <h3 className="ror2-section-title">{t.combos.fits}</h3>
              <div className="ror2-links">
                {combo.survivors.length === 0 ? (
                  <span className="ror2-muted">{t.combos.anyone}</span>
                ) : (
                  combo.survivors.map((id) => (
                    <button key={id} type="button" className="ror2-link-chip" onClick={() => ui.navigate('builds', id)}>
                      <SurvivorPortrait src={survivorIcon(id)} fallback={survivorName(id).slice(0, 1)} small />
                      {survivorName(id)}
                    </button>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="ror2-section-title">{t.combos.items}</h3>
              <div className="ror2-loved">
                {combo.items.map((item) => (
                  <ItemTile key={item.id} id={item.id} stacks={{ target: item.target }} note={item.note} />
                ))}
                {combo.equipment && <ItemTile id={combo.equipment} />}
              </div>
            </section>

            {combo.avoid.length > 0 && (
              <section>
                <h3 className="ror2-section-title">{t.combos.avoid}</h3>
                <div className="ror2-combo-avoid">
                  {combo.avoid.map((id) => (
                    <ItemChip key={id} id={id} compact struck />
                  ))}
                </div>
              </section>
            )}

            {combo.whyFun && (
              <p className="ror2-combo-why">
                <span className="ror2-muted">{t.combos.whyFun}</span> {tr(combo.whyFun)}
              </p>
            )}
          </article>
        )
      }
    />
  );
}
