import type { ReactNode } from 'react';
import { missingFor, ownedSet } from '../content/recommend';
import { equipmentKey, type EquipmentKey, type Kit } from '../content/schema';
import { EquipTile } from './EquipTile';
import { useT } from './i18n';
import { useHd2, useProfile } from './useHd2';

/**
 * A full kit: stratagems with codes, weapons, armor and booster, why each is there, and what the
 * player still lacks. Shared by mission loadouts and theme combos.
 */
export function KitDetail({
  kit,
  faction,
  followed,
  onFollow,
  badges,
  intro,
  extraReasons = [],
}: {
  kit: Kit;
  /** Rate tiles against this enemy; null for any. */
  faction: string | null;
  followed: boolean;
  onFollow: (on: boolean) => void;
  /** Short labels under the title (roles, tags). */
  badges: string[];
  /** Shown above the summary, e.g. a combo's tagline. */
  intro?: ReactNode;
  extraReasons?: { label: string; text: string }[];
}) {
  const { content, tr } = useHd2();
  const t = useT();
  const { profile } = useProfile();
  if (!content) return null;
  // Ownership is only marked once the player has ticked their warbonds.
  const missing = new Set<EquipmentKey>(
    profile?.ownedWarbonds ? missingFor(content, ownedSet(content, profile.ownedWarbonds), kit) : [],
  );
  const neededWarbonds = [
    ...new Set(
      [...missing].flatMap((key) => (content.obtain[key] ?? []).flatMap((source) => (source.via === 'warbond' ? [source.warbond] : []))),
    ),
  ].map((id) => tr(content.warbonds.find((w) => w.id === id)?.name) || id);
  const onlyElsewhere = [...missing].some((key) => !(content.obtain[key] ?? []).some((source) => source.via === 'warbond'));
  const notes = kit.slotNotes;
  const equipment = [
    { label: t.slots.primary, kind: 'weapon' as const, id: kit.primary, note: notes.primary },
    { label: t.slots.secondary, kind: 'weapon' as const, id: kit.secondary, note: notes.secondary },
    { label: t.slots.throwable, kind: 'weapon' as const, id: kit.throwable, note: notes.throwable },
    { label: t.slots.armorPassive, kind: 'armor' as const, id: kit.armorPassive, note: notes.armorPassive },
    ...(kit.booster ? [{ label: t.slots.booster, kind: 'booster' as const, id: kit.booster, note: notes.booster }] : []),
  ];
  const reasons = [
    ...extraReasons,
    ...(notes.stratagems ? [{ label: t.slots.stratagems, text: tr(notes.stratagems) }] : []),
    ...equipment.filter((e) => e.note).map((e) => ({ label: e.label, text: tr(e.note) })),
  ];

  return (
    <article className="hd2-detail">
      <header className="hd2-detail-head">
        <div>
          <h2 className="hd2-detail-title">{tr(kit.title)}</h2>
          <div className="hd2-detail-meta">
            <span>{t.difficulty(kit.difficulty.min, kit.difficulty.max)}</span>
            {badges.map((badge) => (
              <span key={badge} className="hd2-role">
                {badge}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className={followed ? 'hd2-follow following' : 'hd2-follow'} onClick={() => onFollow(!followed)}>
          {followed ? t.following : t.follow}
        </button>
      </header>
      {intro}
      <p className="hd2-detail-summary">{tr(kit.summary)}</p>
      {missing.size > 0 && (
        <p className="hd2-missing">
          <span className="hd2-missing-label">{t.missing.title}</span>
          {neededWarbonds.length > 0 && t.missing.needs(neededWarbonds.join(', '))}
          {onlyElsewhere && <span className="hd2-muted"> · {t.missing.other}</span>}
        </p>
      )}

      <section>
        <h3 className="hd2-section-title">{t.slots.stratagems}</h3>
        <div className="hd2-stratagem-row">
          {kit.stratagems.map((id) => (
            <EquipTile key={id} kind="stratagem" id={id} showCode faction={faction} missing={missing.has(equipmentKey('stratagem', id))} />
          ))}
        </div>
      </section>

      <section>
        <div className="hd2-equipment-row">
          {equipment.map((e) => (
            <div key={e.label} className="hd2-slot">
              <span className="hd2-slot-label">{e.label}</span>
              <EquipTile kind={e.kind} id={e.id} note={e.note} faction={faction} missing={missing.has(equipmentKey(e.kind, e.id))} />
            </div>
          ))}
        </div>
      </section>

      {reasons.length > 0 && (
        <section className="hd2-reasons">
          <h3 className="hd2-section-title">{t.why}</h3>
          <dl>
            {reasons.map((reason) => (
              <div key={reason.label} className="hd2-reason">
                <dt>{reason.label}</dt>
                <dd>{reason.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </article>
  );
}
