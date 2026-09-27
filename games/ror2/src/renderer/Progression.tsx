import type { Build, ItemTier } from '../content/schema';
import { ItemTile } from './ItemChip';
import { useT } from './i18n';
import { TIER_ORDER } from './labels';
import { useRor2 } from './useRor2';

/** Turning points for the rest of the run: condition and advice on the left, items on the right. */
export function Milestones({ build }: { build: Build }) {
  const { tr } = useRor2();
  if (build.milestones.length === 0) return null;
  return (
    <ol className="ror2-guide">
      {build.milestones.map((milestone, index) => (
        <li key={index} className="ror2-guide-row">
          <span className="ror2-guide-index">{index + 1}</span>
          <div className="ror2-guide-text">
            <div className="ror2-guide-when">{tr(milestone.when)}</div>
            <p className="ror2-guide-advice">{tr(milestone.advice)}</p>
          </div>
          <div className="ror2-guide-items">
            {milestone.take.map((id) => (
              <ItemTile key={`take-${id}`} id={id} mark="take" />
            ))}
            {milestone.stop.map((id) => (
              <ItemTile key={`stop-${id}`} id={id} mark="stop" />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Preferred order per tier, for printers, Artifact of Command and multishops. */
export function PickOrder({ build }: { build: Build }) {
  const t = useT();
  const tiers = TIER_ORDER.filter((tier): tier is ItemTier => (build.pickOrder[tier]?.length ?? 0) > 0);
  if (tiers.length === 0) return null;
  return (
    <div className="ror2-picks">
      {tiers.map((tier) => (
        <div key={tier} className={`ror2-picks-row tier-${tier}`}>
          <span className="ror2-picks-tier">{t.tiers[tier]}</span>
          <div className="ror2-picks-items">
            {build.pickOrder[tier]!.map((id, index) => (
              <ItemTile key={id} id={id} rank={index + 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
