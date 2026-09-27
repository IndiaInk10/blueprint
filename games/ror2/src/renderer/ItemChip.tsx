import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ItemRank, LocalizedText, Priority, StackTarget } from '../content/schema';
import { useT, type Ror2Messages } from './i18n';
import { RichText } from './RichText';
import { useRor2 } from './useRor2';

/** "10" when more stops helping, "10+" when it keeps helping. */
export function countLabel(stacks: StackTarget): string {
  return `${stacks.target}${stacks.max === undefined ? '+' : ''}`;
}

/** Longer form for the hover card. */
export function describeStacks(stacks: StackTarget, t: Ror2Messages): string {
  const parts = [t.stacks.target(stacks.target)];
  if (stacks.min !== undefined) parts.push(t.stacks.min(stacks.min));
  if (stacks.max === undefined) parts.push(t.stacks.moreIsFine);
  else parts.push(stacks.max === stacks.target ? t.stacks.noMore : t.stacks.max(stacks.max));
  return parts.join(' · ');
}

/** The S-D letter in a small square; colour carries the grade. */
export function RankBadge({ rank, size = 'normal' }: { rank: ItemRank | undefined; size?: 'normal' | 'small' }) {
  const t = useT();
  if (!rank) return null;
  return (
    <span className={`ror2-rank rank-${rank} ${size}`} title={t.rating.rank(rank)}>
      {rank}
    </span>
  );
}

export function ItemIcon({ src, className }: { src: string | undefined; className: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  return <img className={className} src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(src)} />;
}

interface HoverDetails {
  stacks?: StackTarget;
  stacksReason?: LocalizedText;
  note?: LocalizedText;
}

const CARD_WIDTH = 320;

/**
 * Shows an item card next to the pointer target. Rendered in a portal with fixed positioning
 * so scrolling containers (like the tree) never clip it.
 */
export function ItemHover({ id, details, children }: { id: string; details?: HoverDetails; children: ReactNode }) {
  const { ui, content, tr, itemName, itemIcon, survivorName } = useRor2();
  const t = useT();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const item = content?.items[id];
  const rating = content?.ratings[id];

  const card =
    anchor && item
      ? createPortal(
          <div
            className={`ror2-hovercard tier-${item.tier}`}
            role="tooltip"
            style={{
              top: Math.min(anchor.bottom + 8, window.innerHeight - 220),
              left: Math.max(8, Math.min(anchor.left, window.innerWidth - CARD_WIDTH - 8)),
              width: CARD_WIDTH,
            }}
          >
            <div className="ror2-hovercard-head">
              <ItemIcon src={itemIcon(id)} className="ror2-hovercard-icon" />
              <div>
                <div className="ror2-hovercard-name">{itemName(id)}</div>
                <div className="ror2-hovercard-tier">{t.tiers[item.tier]}</div>
              </div>
            </div>
            {item.desc ? (
              <p className="ror2-hovercard-desc">
                <RichText text={ui.text(item.desc, '')} />
              </p>
            ) : (
              item.pickup && <p className="ror2-hovercard-desc">{ui.text(item.pickup, '')}</p>
            )}
            {(details?.stacks || details?.stacksReason) && (
              <p className="ror2-hovercard-stacks">
                <strong>{details.stacks ? describeStacks(details.stacks, t) : t.stacks.heading}</strong>
                {details.stacksReason && <span> — {tr(details.stacksReason)}</span>}
              </p>
            )}
            {rating && (
              <div className="ror2-hovercard-rating">
                <div className="ror2-hovercard-rating-head">
                  <RankBadge rank={rating.rank} />
                  <span>{t.rating.rank(rating.rank)}</span>
                  {rating.popularity && <span className="ror2-muted">· {t.rating.popularity[rating.popularity]}</span>}
                </div>
                <p className="ror2-hovercard-verdict">{tr(rating.verdict)}</p>
                {rating.bestFor.length > 0 && (
                  <p className="ror2-hovercard-bestfor">
                    <span className="ror2-muted">{t.rating.bestFor}</span> {rating.bestFor.map(survivorName).join(', ')}
                  </p>
                )}
              </div>
            )}
            {details?.note && <p className="ror2-hovercard-note">{tr(details.note)}</p>}
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      className="ror2-hover-target"
      onMouseEnter={(event) => setAnchor(event.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      {card}
    </span>
  );
}

interface ItemChipProps extends HoverDetails {
  id: string;
  priority?: Priority;
  /** Compact chips drop the priority label (overlay, lists). */
  compact?: boolean;
  struck?: boolean;
}

/** Inline item reference used in lists (milestones, pick order, avoid, overlay). */
export function ItemChip({ id, priority, stacks, stacksReason, note, compact, struck }: ItemChipProps) {
  const { content, itemName, itemIcon } = useRor2();
  const t = useT();
  const tier = content?.items[id]?.tier ?? 'common';
  const classes = ['ror2-item', `tier-${tier}`, priority && `priority-${priority}`, compact && 'compact', struck && 'struck'];
  return (
    <ItemHover id={id} details={{ stacks, stacksReason, note }}>
      <span className={classes.filter(Boolean).join(' ')}>
        <ItemIcon src={itemIcon(id)} className="ror2-item-icon" />
        <span className="ror2-item-name">{itemName(id)}</span>
        {stacks && <span className="ror2-item-stacks">×{countLabel(stacks)}</span>}
        {priority && !compact && <span className="ror2-item-priority">{t.priority[priority]}</span>}
      </span>
    </ItemHover>
  );
}

interface ItemTileProps extends HoverDetails {
  id: string;
  priority?: Priority;
  /** Start taking (+) or stop taking (struck through), used by the progression guide. */
  mark?: 'take' | 'stop';
  /** Position in a pick order, shown in the corner. */
  rank?: number;
}

/**
 * Inventory-style tile: the icon on a tier-tinted square with the count in the corner, like the
 * in-game inventory. Priority reads as brightness, not as a label.
 */
export function ItemTile({ id, priority = 'core', mark, rank, stacks, stacksReason, note }: ItemTileProps) {
  const { content, itemName, itemIcon } = useRor2();
  const t = useT();
  const tier = content?.items[id]?.tier ?? 'common';
  const classes = ['ror2-tile', `tier-${tier}`, `priority-${priority}`, mark && `mark-${mark}`];
  return (
    <ItemHover id={id} details={{ stacks, stacksReason, note }}>
      <span className={classes.filter(Boolean).join(' ')}>
        <span className="ror2-tile-frame">
          <ItemIcon src={itemIcon(id)} className="ror2-tile-icon" />
          {stacks && <span className="ror2-tile-count">×{countLabel(stacks)}</span>}
          {rank !== undefined && <span className="ror2-tile-rank">{rank}</span>}
          {mark && (
            <span className="ror2-tile-mark" aria-label={mark === 'take' ? t.take : t.stop}>
              {mark === 'take' ? '+' : '−'}
            </span>
          )}
        </span>
        <span className="ror2-tile-name">{itemName(id)}</span>
      </span>
    </ItemHover>
  );
}
