import { useState, type ReactNode } from 'react';
import { Chips, MasterDetail, Row, SelectList, usePersistentState, useSelection } from '@guide/sdk/ui';
import type { ItemRank, SkillSlot } from '../content/schema';
import { BuildTree } from './BuildTree';
import { useT } from './i18n';
import { ItemChip, ItemTile, RankBadge } from './ItemChip';
import { Milestones, PickOrder } from './Progression';
import { SurvivorPortrait } from './SurvivorPortrait';
import { useRor2, useSelection as useOverlaySelection } from './useRor2';
import './ror2.css';

const SLOTS: SkillSlot[] = ['primary', 'secondary', 'utility', 'special'];
const RANK_ORDER: Record<ItemRank, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
/** Enough to scan at a glance; the item catalog has the rest. */
const LOVED_LIMIT = 14;
export const BUILDS_VIEW = 'builds';

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="ror2-section">
      <header className="ror2-section-head">
        <h3 className="ror2-section-title">{title}</h3>
        {hint && <span className="ror2-section-hint">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

export function BuildsView() {
  const { ui, content, tr, survivorName, survivorIcon } = useRor2();
  const t = useT();
  const { selection, select } = useOverlaySelection();
  const [survivorId, setSurvivorId] = useSelection(BUILDS_VIEW);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [order, setOrder] = usePersistentState<'default' | 'rank'>('builds:order', 'default');

  if (!content) return <p className="ror2-muted">{t.loading}</p>;

  const survivor = survivorId ?? selection?.survivor ?? content.survivors[0]?.id ?? null;
  const file = survivor ? content.builds[survivor] : undefined;
  const builds = file?.builds ?? [];
  const build = builds.find((b) => b.id === buildId) ?? builds.find((b) => b.id === selection?.buildId) ?? builds[0];
  const followed = !!build && selection?.survivor === survivor && selection.buildId === build.id;
  const loved = survivor
    ? Object.values(content.ratings)
        .filter((rating) => rating.bestFor.includes(survivor) && (rating.rank === 'S' || rating.rank === 'A' || rating.rank === 'B'))
        .sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank])
        .slice(0, LOVED_LIMIT)
        .map((rating) => rating.id)
    : [];

  const rankOf = (id: string) => {
    const rank = content.survivorRatings[id]?.rank;
    return rank ? RANK_ORDER[rank] : Object.keys(RANK_ORDER).length;
  };
  const survivors = order === 'rank' ? [...content.survivors].sort((a, b) => rankOf(a.id) - rankOf(b.id)) : content.survivors;
  const survivorRating = survivor ? content.survivorRatings[survivor] : undefined;

  return (
    <MasterDetail
      listWidth={250}
      list={
        <>
          {Object.keys(content.survivorRatings).length > 0 && (
            <Chips
              options={(['default', 'rank'] as const).map((option) => ({ id: option, label: t.survivorRating.order[option] }))}
              value={order}
              onChange={setOrder}
            />
          )}
          <SelectList
            groups={[{ key: 'survivors', items: survivors }]}
            getKey={(s) => s.id}
            selected={survivor}
            onSelect={(id) => {
              setSurvivorId(id);
              setBuildId(null);
            }}
            renderItem={(s) => (
              <Row
                icon={<SurvivorPortrait src={survivorIcon(s.id)} fallback={survivorName(s.id).slice(0, 1)} />}
                title={survivorName(s.id)}
                subtitle={selection?.survivor === s.id ? t.followingDot : undefined}
                trailing={<RankBadge rank={content.survivorRatings[s.id]?.rank} size="small" />}
              />
            )}
          />
        </>
      }
      detail={
        <>
      {build && survivor && file && (
        <article className="ror2-build">
          <header className="ror2-build-hero">
            <SurvivorPortrait src={survivorIcon(survivor)} fallback={survivorName(survivor).slice(0, 1)} large />
            <div className="ror2-build-heading">
              <div className="ror2-build-meta">
                <span className="ror2-muted">{survivorName(survivor)}</span>
                <span className={`ror2-difficulty ${build.difficulty}`}>{t.difficulty[build.difficulty]}</span>
              </div>
              <h2 className="ror2-build-title">{tr(build.title)}</h2>
              <p className="ror2-build-summary">{tr(build.summary)}</p>
            </div>
            <div className="ror2-build-actions">
              {followed ? (
                <button type="button" className="ror2-follow following" onClick={() => void select(null)}>
                  {t.following}
                </button>
              ) : (
                <button type="button" className="ror2-follow" onClick={() => void select({ survivor, buildId: build.id })}>
                  {t.follow}
                </button>
              )}
            </div>
          </header>

          {survivorRating && (
            <div className="ror2-survivor-rating">
              <div className="ror2-survivor-rating-head">
                <RankBadge rank={survivorRating.rank} />
                <strong>{t.survivorRating.rank(survivorRating.rank)}</strong>
                <span className="ror2-muted">{t.survivorRating.difficulty[survivorRating.difficulty]}</span>
                <span className="ror2-survivor-rating-verdict">{tr(survivorRating.verdict)}</span>
              </div>
              <dl className="ror2-survivor-rating-traits">
                <div>
                  <dt>{t.survivorRating.strengths}</dt>
                  <dd>{tr(survivorRating.strengths)}</dd>
                </div>
                <div>
                  <dt>{t.survivorRating.weaknesses}</dt>
                  <dd>{tr(survivorRating.weaknesses)}</dd>
                </div>
              </dl>
            </div>
          )}

          {builds.length > 1 && (
            <div className="ror2-build-tabs" role="tablist">
              {builds.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={b === build}
                  className={b === build ? 'ror2-build-tab active' : 'ror2-build-tab'}
                  onClick={() => setBuildId(b.id)}
                >
                  <span className="ror2-build-tab-title">{tr(b.title)}</span>
                  <span className="ror2-build-tab-difficulty">{t.difficulty[b.difficulty]}</span>
                </button>
              ))}
            </div>
          )}

          <div className="ror2-loadout">
            {SLOTS.map((slot) => {
              const token = build.loadout[slot];
              return (
                <div key={slot} className="ror2-skill">
                  <span className="ror2-skill-slot">{t.slots[slot]}</span>
                  <span className="ror2-skill-name">{token ? ui.text(token) : t.anySkill}</span>
                </div>
              );
            })}
          </div>

          <Section
            title={t.sections.tree}
            hint={
              <span className="ror2-legend">
                <span>{t.legend.core}</span>
                <span className="optional">{t.legend.optional}</span>
                <span className="situational">{t.legend.situational}</span>
              </span>
            }
          >
            <BuildTree build={build} />
          </Section>

          {build.milestones.length > 0 && (
            <Section title={t.sections.guide} hint={t.sections.guideHint}>
              <Milestones build={build} />
            </Section>
          )}

          {Object.keys(build.pickOrder).length > 0 && (
            <Section title={t.sections.picks} hint={t.sections.picksHint}>
              <PickOrder build={build} />
            </Section>
          )}

          {loved.length > 0 && (
            <Section title={t.recommended.title} hint={t.recommended.hint}>
              <div className="ror2-loved">
                {loved.map((id) => (
                  <span key={id} className="ror2-loved-item">
                    <ItemTile id={id} priority="core" />
                    <RankBadge rank={content?.ratings[id]?.rank} size="small" />
                  </span>
                ))}
              </div>
            </Section>
          )}

          {build.avoid.length > 0 && (
            <Section title={t.sections.avoid}>
              <ul className="ror2-avoid">
                {build.avoid.map((entry) => (
                  <li key={entry.id}>
                    <ItemChip id={entry.id} compact />
                    <span className="ror2-muted">{tr(entry.reason)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </article>
      )}
        </>
      }
    />
  );
}
