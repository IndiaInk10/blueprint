import type { Ror2State } from '../state';
import { useT } from './i18n';
import { ItemChip } from './ItemChip';
import { SurvivorPortrait } from './SurvivorPortrait';
import { useRor2 } from './useRor2';
import './ror2.css';

const MAX_CHIPS = 5;

/**
 * Compact in-game summary: what to grab now and where the build can go next.
 * The full tree lives in the main window.
 */
export function BuildSummaryPanel({ state }: { state: Ror2State }) {
  const { content, tr, survivorName, survivorIcon } = useRor2();
  const t = useT();
  if (!content) return null;

  const build = state.survivor
    ? content.builds[state.survivor]?.builds.find((b) => b.id === state.buildId)
    : undefined;
  if (!state.survivor || !build) {
    return <p className="ror2-summary-empty">{t.summary.empty}</p>;
  }

  const root = build.nodes.find((node) => node.id === build.root);
  const branches = (root?.next ?? [])
    .map((id) => build.nodes.find((node) => node.id === id))
    .filter((node) => node !== undefined);

  return (
    <div className="ror2-summary">
      <div className="ror2-summary-title">
        <SurvivorPortrait src={survivorIcon(state.survivor)} fallback={survivorName(state.survivor).slice(0, 1)} small />
        <strong>{survivorName(state.survivor)}</strong>
        <span>{tr(build.title)}</span>
      </div>

      {root && (
        <>
          <div className="ror2-summary-label">{tr(root.label) || t.summary.earlyCore}</div>
          <div className="ror2-summary-items">
            {root.items.slice(0, MAX_CHIPS).map((item) => (
              <ItemChip key={item.id} id={item.id} priority={item.priority} stacks={item.stacks} compact />
            ))}
          </div>
        </>
      )}

      {branches.length > 0 && (
        <>
          <div className="ror2-summary-label">{t.summary.nextBranches}</div>
          <ul className="ror2-summary-branches">
            {branches.map((node) => (
              <li key={node.id}>
                <span className="ror2-summary-branch">{tr(node.label) || node.id}</span>
                {node.when && <span className="ror2-summary-when">{tr(node.when)}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
