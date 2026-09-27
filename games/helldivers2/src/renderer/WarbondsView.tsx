import { useMemo } from 'react';
import { Chips, MasterDetail, Row, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import { isFree, recommendWarbonds, type Preferences, type WarbondPick } from '../content/recommend';
import { loadoutRole, type EquipmentKind, type LoadoutRole, type Warbond } from '../content/schema';
import { EquipTile, Icon } from './EquipTile';
import { useT } from './i18n';
import { TierBadge } from './Rating';
import { useHd2, useProfile } from './useHd2';
import './hd2.css';

/** Playstyles offered for recommendations; the rest of the loadout roles are too narrow to plan purchases around. */
const PLAYSTYLES: LoadoutRole[] = ['generalist', 'anti-tank', 'crowd-control', 'solo', 'defense', 'team-support', 'stealth'];
const GAINS_SHOWN = 8;
export const WARBONDS_VIEW = 'warbonds';
type Mode = 'recommend' | 'owned';

/** Ranked picks (or the ownership checklist) on the left; the chosen warbond in full on the right. */
export function WarbondsView() {
  const { content, tr, icon } = useHd2();
  const t = useT();
  const { profile, update } = useProfile();
  const [mode, setMode] = usePersistentState<Mode>('warbonds:mode', 'recommend');
  const [selected, setSelected] = useSelection(WARBONDS_VIEW);

  const preferences: Preferences = {
    playstyle: loadoutRole.safeParse(profile?.playstyle).success ? (profile!.playstyle as LoadoutRole) : null,
    faction: profile?.faction ?? null,
  };
  const owned = profile?.ownedWarbonds ?? [];
  const picks = useMemo(
    () => (content ? recommendWarbonds(content, owned, preferences) : []),
    [content, owned.join(','), preferences.playstyle, preferences.faction],
  );
  if (!content || !profile) return <p className="hd2-muted">{t.loading}</p>;

  const toggleOwned = (id: string) =>
    update((current) => {
      const set = new Set(current.ownedWarbonds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ownedWarbonds: content.warbonds.filter((w) => set.has(w.id)).map((w) => w.id) };
    });
  const isOwned = (warbond: Warbond) => isFree(warbond) || owned.includes(warbond.id);
  const paid = content.warbonds.filter((w) => !isFree(w));
  const warbond = content.warbonds.find((w) => w.id === selected) ?? picks[0]?.warbond ?? content.warbonds[0];
  const pick = picks.find((p) => p.warbond.id === warbond?.id);
  const rank = pick ? picks.indexOf(pick) + 1 : null;

  return (
    <MasterDetail
      listWidth={340}
      list={
        <>
          <Chips
            options={[
              { id: 'recommend' as const, label: t.warbonds.modes.recommend },
              { id: 'owned' as const, label: t.warbonds.modes.owned, count: owned.filter((id) => paid.some((w) => w.id === id)).length },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'recommend' ? (
            <>
              <div className="hd2-select-row">
                <select
                  className="hd2-select"
                  aria-label={t.warbonds.playstyle}
                  value={preferences.playstyle ?? ''}
                  onChange={(event) => update({ playstyle: event.target.value || null })}
                >
                  <option value="">
                    {t.warbonds.playstyle}: {t.warbonds.anyStyle}
                  </option>
                  {PLAYSTYLES.map((style) => (
                    <option key={style} value={style}>
                      {t.roles[style]}
                    </option>
                  ))}
                </select>
                <select
                  className="hd2-select"
                  aria-label={t.warbonds.enemy}
                  value={preferences.faction ?? ''}
                  onChange={(event) => update({ faction: event.target.value || null })}
                >
                  <option value="">
                    {t.warbonds.enemy}: {t.warbonds.anyEnemy}
                  </option>
                  {content.factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {tr(f.name)}
                    </option>
                  ))}
                </select>
              </div>
              {profile.ownedWarbonds === null && <p className="hd2-demands small">{t.warbonds.askOwned}</p>}
              <SelectList
                groups={[{ key: 'picks', items: picks }]}
                getKey={(p) => p.warbond.id}
                selected={warbond?.id ?? null}
                onSelect={setSelected}
                renderItem={(p) => (
                  <Row
                    icon={
                      <>
                        <span className="hd2-rank-number">{picks.indexOf(p) + 1}</span>
                        <Icon src={icon('warbond', p.warbond.id)} className="hd2-row-cover" />
                      </>
                    }
                    title={tr(p.warbond.name)}
                    subtitle={
                      <span className="hd2-gain-badges">
                        {p.gains.slice(0, 4).map((gain) => (
                          <TierBadge key={`${gain.kind}:${gain.id}`} tier={gain.tier} size="small" />
                        ))}
                        {t.warbonds.price(p.warbond.superCredits)}
                      </span>
                    }
                  />
                )}
              />
            </>
          ) : (
            <>
              <p className="hd2-demands small">{t.warbonds.ownedHint}</p>
              <SelectList
                groups={[{ key: 'all', items: content.warbonds }]}
                getKey={(w) => w.id}
                selected={warbond?.id ?? null}
                onSelect={setSelected}
                renderItem={(w) => (
                  <Row
                    icon={
                      <>
                        <span
                          className={isOwned(w) ? 'hd2-check checked' : 'hd2-check'}
                          role="checkbox"
                          aria-checked={isOwned(w)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!isFree(w)) toggleOwned(w.id);
                          }}
                        >
                          {isOwned(w) && (
                            <svg viewBox="0 0 16 16">
                              <path d="M3 8.5L6.5 12L13 4.5" />
                            </svg>
                          )}
                        </span>
                        <Icon src={icon('warbond', w.id)} className="hd2-row-cover" />
                      </>
                    }
                    title={tr(w.name)}
                    subtitle={t.warbonds.types[w.type] ?? w.type}
                  />
                )}
              />
            </>
          )}
        </>
      }
      detail={warbond && <WarbondDetail warbond={warbond} pick={pick} rank={rank} faction={preferences.faction} owned={isOwned(warbond)} onToggle={() => toggleOwned(warbond.id)} />}
    />
  );
}

function WarbondDetail({
  warbond,
  pick,
  rank,
  faction,
  owned,
  onToggle,
}: {
  warbond: Warbond;
  pick: WarbondPick | undefined;
  rank: number | null;
  faction: string | null;
  owned: boolean;
  onToggle: () => void;
}) {
  const { ui, content, tr, icon } = useHd2();
  const t = useT();
  if (!content) return null;
  const combos = content.combos.filter((c) => c.warbond === warbond.id);

  return (
    <article className="hd2-detail">
      <header className="hd2-warbond-head">
        <Icon src={icon('warbond', warbond.id)} className="hd2-warbond-cover" />
        <div className="hd2-pick-title">
          {rank && <span className="hd2-pick-rank">{t.warbonds.rank(rank)}</span>}
          <h2 className="hd2-detail-title">{tr(warbond.name)}</h2>
          <span className="hd2-pick-meta">
            {t.warbonds.types[warbond.type] ?? warbond.type} · {t.warbonds.price(warbond.superCredits)}
          </span>
        </div>
        {!isFree(warbond) && (
          <button type="button" className={owned ? 'hd2-follow following' : 'hd2-follow'} onClick={onToggle}>
            {owned ? t.warbonds.ownedToggle.on : t.warbonds.ownedToggle.off}
          </button>
        )}
      </header>

      {pick && pick.gains.length > 0 && (
        <section>
          <h3 className="hd2-section-title">{t.warbonds.gains}</h3>
          <div className="hd2-pick-gains">
            {pick.gains.slice(0, GAINS_SHOWN).map((gain) => (
              <EquipTile key={`${gain.kind}:${gain.id}`} kind={gain.kind} id={gain.id} faction={faction} />
            ))}
          </div>
          <p className="hd2-pick-medals">{t.warbonds.medals(pick.medals.total, pick.medals.approximate)}</p>
          {pick.completes.length > 0 && (
            <p className="hd2-pick-completes">
              <span className="hd2-pref-label">{t.warbonds.completes}</span> {pick.completes.map((l) => tr(l.title)).join(', ')}
            </p>
          )}
        </section>
      )}

      {combos.length > 0 && (
        <section className="hd2-card-section">
          <div className="hd2-card-label">{t.combos.title}</div>
          <div className="hd2-links">
            {combos.map((c) => (
              <button key={c.id} type="button" className="hd2-link-chip" onClick={() => ui.navigate('combos', c.id)}>
                {tr(c.title)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="hd2-section-title">{t.warbonds.pages}</h3>
        {warbond.pages.map((page) => {
          const equipment = page.items.flatMap((item) => {
            if ((item.kind === 'weapon' || item.kind === 'stratagem' || item.kind === 'booster') && item.ref) {
              return [{ kind: item.kind as EquipmentKind, id: item.ref, medals: item.medals, label: null as string | null }];
            }
            if (item.kind === 'armor' && item.armorPassive) {
              return [{ kind: 'armor' as EquipmentKind, id: item.armorPassive, medals: item.medals, label: tr(item.name) }];
            }
            return [];
          });
          const cosmetics = page.items.length - equipment.length;
          return (
            <div key={page.page} className="hd2-warbond-page">
              <div className="hd2-warbond-page-head">
                <strong>{t.warbonds.page(page.page)}</strong>
                <span className="hd2-muted">{t.warbonds.opensAfter(page.medalsToUnlock)}</span>
              </div>
              <div className="hd2-warbond-items">
                {equipment.map((item, index) => (
                  <div key={`${item.kind}:${item.id}:${index}`} className="hd2-warbond-item">
                    <EquipTile kind={item.kind} id={item.id} faction={faction} />
                    {item.label && <span className="hd2-warbond-item-label">{item.label}</span>}
                    <span className="hd2-warbond-item-cost">{t.warbonds.medalCost(item.medals)}</span>
                  </div>
                ))}
              </div>
              {cosmetics > 0 && <p className="hd2-muted hd2-cosmetics">{t.warbonds.cosmetics(cosmetics)}</p>}
            </div>
          );
        })}
      </section>

      {content.currencies.length > 0 && (
        <details className="hd2-currencies-box">
          <summary>{t.warbonds.currencies}</summary>
          <dl className="hd2-currencies">
            {content.currencies.map((currency) => (
              <div key={currency.id}>
                <dt>{tr(currency.name)}</dt>
                <dd>{tr(currency.text)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}
