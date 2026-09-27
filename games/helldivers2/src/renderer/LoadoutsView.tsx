import { Chips, MasterDetail, Row, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import { KitDetail } from './KitDetail';
import { useT } from './i18n';
import { useHd2, useSelection as useOverlaySelection } from './useHd2';
import './hd2.css';

export const LOADOUTS_VIEW = 'loadouts';
const ANY = '';

/** Enemy and mission on the left narrow the list; the chosen loadout fills the right. */
export function LoadoutsView() {
  const { content, tr } = useHd2();
  const t = useT();
  const { selection, select } = useOverlaySelection();
  const [selected, setSelected] = useSelection(LOADOUTS_VIEW);
  const [factionId, setFactionId] = usePersistentState<string | null>('loadouts:faction', null);
  const [missionId, setMissionId] = usePersistentState<string>('loadouts:mission', ANY);
  if (!content) return <p className="hd2-muted">{t.loading}</p>;

  // A jump from search picks the loadout's own faction.
  const jumped = content.loadouts.find((l) => l.id === selected);
  const faction =
    content.factions.find((f) => f.id === (jumped && jumped.faction !== factionId ? jumped.faction : factionId)) ?? content.factions[0];
  if (!faction) return null;
  const mission = content.missionTypes.find((m) => m.id === missionId && m.factions.includes(faction.id));
  const ofFaction = content.loadouts.filter((l) => l.faction === faction.id);
  const exact = mission ? ofFaction.filter((l) => l.missionTypes.includes(mission.id)) : ofFaction;
  // A mission without its own loadout still gets an answer: the faction's all-rounders.
  const fallback = exact.length === 0 ? ofFaction.filter((l) => l.roles.includes('generalist')) : [];
  const matches = exact.length > 0 ? exact : fallback;
  const loadout = matches.find((l) => l.id === selected) ?? matches[0];

  const categories = content.missionCategories
    .map((category) => ({
      category,
      missions: content.missionTypes.filter((m) => m.category === category.id && m.factions.includes(faction.id)),
    }))
    .filter((group) => group.missions.length > 0);

  return (
    <div className={`hd2-fill faction-${faction.id}`}>
      <MasterDetail
        listWidth={320}
        list={
          <>
            <Chips
              options={content.factions.map((f) => ({ id: f.id, label: tr(f.name) }))}
              value={faction.id}
              onChange={(next) => {
                setFactionId(next);
                setMissionId(ANY);
                setSelected(null);
              }}
            />
            <select
              className="hd2-select"
              aria-label={t.mission}
              value={mission?.id ?? ANY}
              onChange={(event) => {
                setMissionId(event.target.value);
                setSelected(null);
              }}
            >
              <option value={ANY}>{t.allMissions}</option>
              {categories.map(({ category, missions }) => (
                <optgroup key={category.id} label={tr(category.name)}>
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {tr(m.name)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {mission && <p className="hd2-demands small">{tr(mission.demands)}</p>}
            {fallback.length > 0 && <p className="hd2-demands small">{t.fallback}</p>}
            <SelectList
              groups={[{ key: 'loadouts', items: matches }]}
              getKey={(l) => l.id}
              selected={loadout?.id ?? null}
              onSelect={setSelected}
              empty={t.noLoadouts}
              renderItem={(l) => (
                <Row
                  title={tr(l.title)}
                  subtitle={`${t.difficulty(l.difficulty.min, l.difficulty.max)}${l.roles.length ? ` · ${l.roles.map((r) => t.roles[r]).join(', ')}` : ''}`}
                  trailing={l.id === selection?.loadoutId ? <span className="hd2-overlay-tag">{t.inOverlay}</span> : undefined}
                />
              )}
            />
          </>
        }
        detail={
          <div className="hd2-loadout-detail">
            {faction.summary && (
              <details className="hd2-brief">
                <summary>
                  {tr(faction.name)} · {t.priorities}
                </summary>
                <p className="hd2-brief-summary">{tr(faction.summary)}</p>
                {faction.priorities.length > 0 && (
                  <ul>
                    {faction.priorities.map((priority, index) => (
                      <li key={index}>{tr(priority)}</li>
                    ))}
                  </ul>
                )}
              </details>
            )}
            {loadout && (
              <KitDetail
                kit={loadout}
                faction={loadout.faction}
                followed={loadout.id === selection?.loadoutId}
                onFollow={(on) => void select(on ? { loadoutId: loadout.id } : null)}
                badges={loadout.roles.map((role) => t.roles[role])}
              />
            )}
          </div>
        }
      />
    </div>
  );
}
