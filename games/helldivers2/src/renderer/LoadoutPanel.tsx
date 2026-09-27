import type { Hd2State } from '../state';
import { Icon } from './EquipTile';
import { useT } from './i18n';
import { LoadoutPicker } from './LoadoutPicker';
import { useHd2, useProfile } from './useHd2';
import './hd2.css';

/**
 * Lobby panel: the chosen kit at a glance while picking equipment on the ship. In missions the
 * panel stays hidden (see showWhen in the module), so it never covers the HUD.
 */
export function LoadoutPanel({ state, interactive = false }: { state: Hd2State; interactive?: boolean }) {
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

  const weapons = [
    { label: t.slots.primary, id: kit.primary, tall: false },
    { label: t.slots.secondary, id: kit.secondary, tall: false },
    { label: t.slots.throwable, id: kit.throwable, tall: true },
  ];
  const perks = [
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
      {/* Weapons as pictures: names alone are hard to match to what the armory shows. */}
      <div className="hd2-panel-weapons">
        {weapons.map((weapon) => (
          <div key={weapon.label} className="hd2-panel-weapon">
            <span className="hd2-panel-weapon-frame">
              <Icon
                src={icon('weapon', weapon.id)}
                className={weapon.tall ? 'hd2-panel-weapon-image tall' : 'hd2-panel-weapon-image'}
                kind="weapon"
              />
            </span>
            <span className="hd2-panel-weapon-slot">{weapon.label}</span>
            <span className="hd2-panel-weapon-name">{tr(content.weapons[weapon.id]?.name) || weapon.id}</span>
          </div>
        ))}
      </div>
      <ul className="hd2-panel-list">
        {perks.map((perk) => (
          <li key={perk.label} className="hd2-panel-row">
            <Icon src={icon(perk.kind, perk.id)} className="hd2-panel-icon" kind={perk.kind} />
            <span className="hd2-panel-slot">{perk.label}</span>
            <span className="hd2-panel-name">{tr(perk.name) || perk.id}</span>
          </li>
        ))}
      </ul>
      {interactive ? <LoadoutPicker kit={kit} pinned={!!pinned} /> : <p className="hd2-panel-hint">{t.overlay.escHint}</p>}
    </div>
  );
}
