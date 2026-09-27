import type { Hd2State } from '../state';
import { Icon } from './EquipTile';
import { useT } from './i18n';
import { useHd2, useProfile } from './useHd2';
import './hd2.css';

/**
 * Lobby panel: the chosen kit at a glance while picking equipment on the ship. In missions the
 * panel stays hidden (see showWhen in the module), so it never covers the HUD.
 */
export function LoadoutPanel({ state }: { state: Hd2State }) {
  const { content, tr, icon } = useHd2();
  const t = useT();
  const { profile } = useProfile();
  if (!content) return null;
  // A kit the player pinned (loadout or theme combo) wins; otherwise pick one without asking:
  // the all-rounder for the enemy they usually fight, or the first all-rounder.
  const pinned = [...content.loadouts, ...content.combos].find((l) => l.id === state.loadoutId);
  const generalists = content.loadouts.filter((l) => l.roles.includes('generalist'));
  const kit = pinned ?? generalists.find((l) => l.faction === profile?.faction) ?? generalists[0] ?? content.loadouts[0];
  if (!kit) return <p className="hd2-panel-empty">{t.overlay.empty}</p>;

  const gear = [
    { label: t.slots.primary, kind: 'weapon' as const, id: kit.primary, name: content.weapons[kit.primary]?.name },
    { label: t.slots.secondary, kind: 'weapon' as const, id: kit.secondary, name: content.weapons[kit.secondary]?.name },
    { label: t.slots.throwable, kind: 'weapon' as const, id: kit.throwable, name: content.weapons[kit.throwable]?.name },
    { label: t.slots.armorPassive, kind: 'armor' as const, id: kit.armorPassive, name: content.armorPassives[kit.armorPassive]?.name },
    ...(kit.booster ? [{ label: t.slots.booster, kind: 'booster' as const, id: kit.booster, name: content.boosters[kit.booster]?.name }] : []),
  ];

  return (
    <div className="hd2-panel">
      <div className="hd2-panel-title">
        {tr(kit.title)}
        {!pinned && <span className="hd2-panel-auto">{t.overlay.auto}</span>}
      </div>
      <div className="hd2-panel-label">{t.slots.stratagems}</div>
      <ul className="hd2-panel-list">
        {kit.stratagems.map((id) => (
          <li key={id} className="hd2-panel-row">
            <Icon src={icon('stratagem', id)} className="hd2-panel-icon" kind="stratagem" />
            <span className="hd2-panel-name">{tr(content.stratagems[id]?.name)}</span>
          </li>
        ))}
      </ul>
      <ul className="hd2-panel-list hd2-panel-gear">
        {gear.map((item) => (
          <li key={item.label} className="hd2-panel-row">
            <span className="hd2-panel-slot">{item.label}</span>
            <span className="hd2-panel-name">{tr(item.name) || item.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
