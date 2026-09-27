import { tierFor } from '../content/recommend';
import { equipmentKey, type EquipmentKind, type Obtain, type Tier } from '../content/schema';
import { useT } from './i18n';
import { useHd2 } from './useHd2';

/** The S-D letter in a small square; colour carries the grade. */
export function TierBadge({ tier, size = 'normal' }: { tier: Tier | null | undefined; size?: 'normal' | 'small' }) {
  const t = useT();
  if (!tier) return null;
  return (
    <span className={`hd2-tier tier-${tier} ${size}`} title={`${t.rating.tier} ${tier}`}>
      {tier}
    </span>
  );
}

/** Tier for a catalog entry, per faction when one is given. */
export function useTier(kind: EquipmentKind, id: string, faction: string | null = null): Tier | null {
  const { content } = useHd2();
  return content ? tierFor(content, equipmentKey(kind, id), faction) : null;
}

/** One line per way to get the equipment. */
export function useObtainLines(kind: EquipmentKind, id: string): string[] {
  const { content, tr } = useHd2();
  const t = useT();
  if (!content) return [];
  const sources = content.obtain[equipmentKey(kind, id)];
  if (!sources || sources.length === 0) return [t.obtain.start];
  const describe = (source: Obtain): string => {
    switch (source.via) {
      case 'warbond': {
        const warbond = content.warbonds.find((w) => w.id === source.warbond);
        return t.obtain.warbond(tr(warbond?.name) || source.warbond, source.page, source.medals);
      }
      case 'requisition':
        return t.obtain.requisition(source.level, source.requisition);
      case 'superstore':
        return t.obtain.superstore(source.superCredits);
      case 'reward':
        return tr(source.how);
    }
  };
  return [...new Set(sources.map(describe))];
}

/** Tier, popularity, per-enemy tiers and our verdict, for hover cards. */
export function RatingDetails({ kind, id }: { kind: EquipmentKind; id: string }) {
  const { content, tr } = useHd2();
  const t = useT();
  const rating = content?.ratings[equipmentKey(kind, id)];
  if (!content || !rating) return null;
  const factions = content.factions.filter((f) => rating.factions[f.id]);
  return (
    <div className="hd2-rating">
      <div className="hd2-rating-head">
        <TierBadge tier={rating.overall} />
        {rating.popularity && <span className="hd2-rating-popularity">{t.rating.popularity[rating.popularity]}</span>}
        {factions.length > 0 && (
          <span className="hd2-rating-factions">
            {factions.map((f) => (
              <span key={f.id}>
                {tr(f.name)} <TierBadge tier={rating.factions[f.id]} size="small" />
              </span>
            ))}
          </span>
        )}
      </div>
      <p className="hd2-card-text">{tr(rating.verdict)}</p>
    </div>
  );
}

export function ObtainDetails({ kind, id }: { kind: EquipmentKind; id: string }) {
  const t = useT();
  const lines = useObtainLines(kind, id);
  if (lines.length === 0) return null;
  return (
    <div className="hd2-card-section">
      <div className="hd2-card-label">{t.obtain.title}</div>
      {lines.map((line) => (
        <div key={line} className="hd2-card-line">
          {line}
        </div>
      ))}
    </div>
  );
}

/** The recommended attachment per slot, with what each unlock costs on this weapon. */
export function AttachmentDetails({ weaponId }: { weaponId: string }) {
  const { content, tr, icon } = useHd2();
  const t = useT();
  const build = content?.customization.builds[weaponId];
  if (!content || !build) return null;
  const slots = content.customization.slots.filter((slot) => build.recommended[slot.id]);
  if (slots.length === 0) return null;
  return (
    <div className="hd2-card-section">
      <div className="hd2-card-label">{t.attachments.title}</div>
      <ul className="hd2-attachments">
        {slots.map((slot) => {
          const attachmentId = build.recommended[slot.id]!;
          const attachment = content.customization.attachments[attachmentId];
          const unlock = build.unlocks[attachmentId];
          const src = attachment?.icon ? icon('attachment', attachmentId) : undefined;
          return (
            <li key={slot.id} className="hd2-attachment">
              {src ? <img className="hd2-attachment-icon" src={src} alt="" /> : <span className="hd2-attachment-icon" />}
              <span className="hd2-attachment-slot">{tr(slot.name)}</span>
              <span className="hd2-attachment-name">{tr(attachment?.name) || attachmentId}</span>
              {unlock && <span className="hd2-attachment-unlock">{t.attachments.unlock(unlock.level, unlock.requisition)}</span>}
            </li>
          );
        })}
      </ul>
      {build.why && <p className="hd2-card-text muted">{tr(build.why)}</p>}
    </div>
  );
}
