import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { EquipmentKind, LocalizedText } from '../content/schema';
import { useT } from './i18n';
import { AttachmentDetails, ObtainDetails, RatingDetails, TierBadge, useTier } from './Rating';
import { StratagemCode } from './StratagemCode';
import { useHd2 } from './useHd2';

/**
 * Stand-in for a stratagem the wiki has no icon for (e.g. objective stratagems like Data Jack):
 * a call-in beacon in the icon frame, deliberately plain so it never passes for the game's art.
 */
function StratagemPlaceholder({ className }: { className: string }) {
  return (
    <svg className={`${className} hd2-placeholder`} viewBox="0 0 32 32" aria-hidden>
      <rect x="2.5" y="2.5" width="27" height="27" rx="2" />
      <path d="M16 7V20M12 16L16 20L20 16M10 25H22" />
    </svg>
  );
}

export function Icon({ src, className, kind }: { src: string | undefined; className: string; kind?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return kind === 'stratagem' ? <StratagemPlaceholder className={className} /> : <span className={`${className} empty`} aria-hidden />;
  }
  // Weapon renders are dark and padded; the is-weapon class lifts and crops them (hd2.css).
  const classes = kind === 'weapon' ? `${className} is-weapon` : className;
  return <img className={classes} src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(src)} />;
}

const CARD_WIDTH = 320;
/** Keeps the card on screen; cards for low anchors open upwards. */
const CARD_MAX_HEIGHT = 440;

/** Name, kind-specific facts, rating, how to get it and our note. Used in hover cards and the Armory detail. */
export function EquipDetails({ kind, id, note }: { kind: EquipmentKind; id: string; note?: LocalizedText }) {
  const { content, tr, icon } = useHd2();
  const t = useT();
  if (!content) return null;

  let name = '';
  let facts: (string | false | undefined)[] = [];
  let body: ReactNode = null;
  if (kind === 'stratagem') {
    const s = content.stratagems[id];
    if (!s) return null;
    name = tr(s.name);
    facts = [
      t.categories[s.category],
      s.armorPen && t.armorPen[s.armorPen],
      s.cooldown !== undefined && t.arsenal.cooldown(s.cooldown),
      s.uses === null ? t.arsenal.unlimited : s.uses !== undefined && t.arsenal.uses(s.uses),
    ];
    body = (
      <>
        <StratagemCode code={s.code} />
        {s.notes && <p className="hd2-card-text">{tr(s.notes)}</p>}
      </>
    );
  } else if (kind === 'weapon') {
    const w = content.weapons[id];
    if (!w) return null;
    name = tr(w.name);
    facts = [t.weaponCategories[w.category], w.armorPen && t.armorPen[w.armorPen], ...w.traits.map((trait) => t.traits[trait])];
    body = w.notes && <p className="hd2-card-text">{tr(w.notes)}</p>;
  } else {
    const perk = kind === 'armor' ? content.armorPassives[id] : content.boosters[id];
    if (!perk) return null;
    name = tr(perk.name);
    facts = [kind === 'armor' ? t.slots.armorPassive : t.slots.booster];
    body = <p className="hd2-card-text">{tr(perk.effect)}</p>;
  }

  return (
    <>
      <div className="hd2-card-head">
        <Icon src={icon(kind, id)} className="hd2-card-icon" kind={kind} />
        <div>
          <div className="hd2-card-name">{name}</div>
          <div className="hd2-card-facts">{facts.filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      {body}
      <RatingDetails kind={kind} id={id} />
      {kind === 'weapon' && <AttachmentDetails weaponId={id} />}
      <ObtainDetails kind={kind} id={id} />
      {note && <p className="hd2-card-note">{tr(note)}</p>}
    </>
  );
}

export function Hover({ kind, id, note, children }: { kind: EquipmentKind; id: string; note?: LocalizedText; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const below = !anchor || window.innerHeight - anchor.bottom > CARD_MAX_HEIGHT || anchor.top < CARD_MAX_HEIGHT;
  return (
    <span
      className="hd2-hover"
      onMouseEnter={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      {anchor &&
        createPortal(
          <div
            className="hd2-card"
            role="tooltip"
            style={{
              ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }),
              left: Math.max(8, Math.min(anchor.left, window.innerWidth - CARD_WIDTH - 8)),
              width: CARD_WIDTH,
              maxHeight: CARD_MAX_HEIGHT,
            }}
          >
            <EquipDetails kind={kind} id={id} note={note} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Square equipment tile with the name underneath, the same visual language as the other games. */
export function EquipTile({
  kind,
  id,
  note,
  showCode,
  faction = null,
  missing = false,
}: {
  kind: EquipmentKind;
  id: string;
  note?: LocalizedText;
  showCode?: boolean;
  /** Rate against this enemy when the rating differs by faction. */
  faction?: string | null;
  /** The player does not own it yet. */
  missing?: boolean;
}) {
  const { content, tr, icon } = useHd2();
  const t = useT();
  const tier = useTier(kind, id, faction);
  const entry =
    kind === 'weapon'
      ? content?.weapons[id]
      : kind === 'stratagem'
        ? content?.stratagems[id]
        : kind === 'armor'
          ? content?.armorPassives[id]
          : content?.boosters[id];
  const code = kind === 'stratagem' ? content?.stratagems[id]?.code : undefined;
  return (
    <Hover kind={kind} id={id} note={note}>
      <span className={`hd2-tile kind-${kind}${missing ? ' missing' : ''}`}>
        <span className="hd2-tile-frame">
          {missing && <span className="hd2-tile-missing">{t.missing.tag}</span>}
          <Icon src={icon(kind, id)} className="hd2-tile-icon" kind={kind} />
          {tier && (
            <span className="hd2-tile-tier">
              <TierBadge tier={tier} size="small" />
            </span>
          )}
        </span>
        <span className="hd2-tile-name">{entry ? tr(entry.name) : id}</span>
        {showCode && code && <StratagemCode code={code} size="small" />}
      </span>
    </Hover>
  );
}
