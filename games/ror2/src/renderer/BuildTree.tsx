import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Build, BuildNode, Phase } from '../content/schema';
import { ItemTile } from './ItemChip';
import { useT, type Ror2Messages } from './i18n';
import { edges, layoutColumns } from './layout';
import { useRor2 } from './useRor2';

const PHASE_ORDER: Phase[] = ['early', 'mid', 'late', 'loop'];

/** A column is labelled by the phases of the groups in it, e.g. "Mid" or "Mid · Late". */
function columnLabel(nodes: BuildNode[], t: Ror2Messages): { label: string; phase: Phase } {
  const phases = PHASE_ORDER.filter((phase) => nodes.some((node) => node.phase === phase));
  return { label: phases.map((phase) => t.phases[phase]).join(' · '), phase: phases[0] ?? 'early' };
}

/**
 * The build as columns of item groups, left to right. Links are drawn as right-angle connectors
 * measured from the rendered groups, so they stay correct whatever the content height.
 */
export function BuildTree({ build }: { build: Build }) {
  const { content, tr } = useRor2();
  const t = useT();
  const columns = useMemo(() => layoutColumns(build), [build]);
  const links = useMemo(() => edges(build), [build]);
  const nodes = useMemo(() => new Map(build.nodes.map((node) => [node.id, node])), [build]);

  const containerRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<{ key: string; d: string; x: number; y: number }[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const origin = container.getBoundingClientRect();
      const next = [];
      for (const [from, to] of links) {
        const a = groupRefs.current.get(from)?.getBoundingClientRect();
        const b = groupRefs.current.get(to)?.getBoundingClientRect();
        if (!a || !b) continue;
        const x1 = a.right - origin.left + container.scrollLeft;
        const y1 = a.top + Math.min(a.height / 2, 40) - origin.top;
        const x2 = b.left - origin.left + container.scrollLeft;
        const y2 = b.top + Math.min(b.height / 2, 40) - origin.top;
        const xm = Math.round(x1 + (x2 - x1) / 2);
        next.push({ key: `${from}-${to}`, d: `M ${x1} ${y1} H ${xm} V ${y2} H ${x2}`, x: x2, y: y2 });
      }
      setPaths(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const group of groupRefs.current.values()) observer.observe(group);
    return () => observer.disconnect();
  }, [links, columns, content]);

  return (
    <div className="ror2-tree" ref={containerRef}>
      <svg className="ror2-tree-links" aria-hidden>
        {paths.map((path) => (
          <g key={path.key}>
            <path d={path.d} />
            <circle cx={path.x} cy={path.y} r={2.5} />
          </g>
        ))}
      </svg>
      {columns.map((column, index) => {
        const columnNodes = column.map((id) => nodes.get(id)!);
        const { label, phase } = columnLabel(columnNodes, t);
        return (
          <div key={index} className="ror2-tree-column">
            <div className={`ror2-tree-phase phase-${phase}`}>{label}</div>
            <div className="ror2-tree-groups">
              {columnNodes.map((node) => (
                <section
                  key={node.id}
                  className={`ror2-group phase-${node.phase}`}
                  ref={(element) => {
                    if (element) groupRefs.current.set(node.id, element);
                    else groupRefs.current.delete(node.id);
                  }}
                >
                  <h4 className="ror2-group-label">{tr(node.label) || t.phases[node.phase]}</h4>
                  {node.when && <p className="ror2-group-when">{tr(node.when)}</p>}
                  <div className="ror2-tiles">
                    {node.items.map((item) => (
                      <ItemTile
                        key={item.id}
                        id={item.id}
                        priority={item.priority}
                        stacks={item.stacks}
                        stacksReason={item.stacksReason}
                        note={item.note}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
