import { useState } from 'react';
import type { Kit } from '../content/schema';
import { useT } from './i18n';
import { useHd2, useSelection } from './useHd2';

const COMBOS = 'combos';

/**
 * Shown in the ship overlay while the game's menu is open: step through or pick another loadout
 * without leaving the game. A pick is pinned like "Show in overlay" in the app.
 */
export function LoadoutPicker({ kit, pinned }: { kit: Kit; pinned: boolean }) {
  const { content, tr } = useHd2();
  const t = useT();
  const { select } = useSelection();
  const isCombo = !!content?.combos.some((c) => c.id === kit.id);
  const kitFaction = content?.loadouts.find((l) => l.id === kit.id)?.faction;
  const [group, setGroup] = useState<string>(isCombo ? COMBOS : (kitFaction ?? content?.factions[0]?.id ?? COMBOS));
  if (!content) return null;

  const options: Kit[] = group === COMBOS ? content.combos : content.loadouts.filter((l) => l.faction === group);
  const index = options.findIndex((o) => o.id === kit.id);
  const pick = (next: Kit | undefined) => next && void select({ loadoutId: next.id });
  const step = (delta: number) => pick(options[(Math.max(index, 0) + delta + options.length) % options.length]);

  return (
    <div className="hd2-picker">
      <div className="hd2-picker-nav">
        <button type="button" className="hd2-picker-arrow" aria-label={t.overlay.previous} onClick={() => step(-1)}>
          ‹
        </button>
        <span className="hd2-picker-count">{index >= 0 ? `${index + 1} / ${options.length}` : `– / ${options.length}`}</span>
        <button type="button" className="hd2-picker-arrow" aria-label={t.overlay.next} onClick={() => step(1)}>
          ›
        </button>
        {pinned && (
          <button type="button" className="hd2-picker-reset" onClick={() => void select(null)}>
            {t.overlay.backToSuggested}
          </button>
        )}
      </div>
      <div className="hd2-picker-groups">
        {[...content.factions.map((f) => ({ id: f.id, label: tr(f.name) })), { id: COMBOS, label: t.combos.title }].map((g) => (
          <button key={g.id} type="button" className={g.id === group ? 'hd2-picker-group active' : 'hd2-picker-group'} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <ul className="hd2-picker-list">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className={option.id === kit.id ? 'hd2-picker-item active' : 'hd2-picker-item'}
              onClick={() => pick(option)}
            >
              {tr(option.title)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
