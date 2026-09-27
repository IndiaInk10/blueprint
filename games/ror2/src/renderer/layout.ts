import type { Build } from '../content/schema';

/**
 * Splits a build graph into columns for a left-to-right tree: a node sits one column right of its
 * deepest parent, so shared follow-ups (e.g. a common late game) line up after every branch.
 * Within a column, nodes keep the order in which they were first reached.
 */
export function layoutColumns(build: Build): string[][] {
  const nodes = new Map(build.nodes.map((node) => [node.id, node]));
  if (!nodes.has(build.root)) return [];

  // Reachable nodes and their in-degree from reachable parents.
  const reachable: string[] = [];
  const seen = new Set<string>();
  const stack = [build.root];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id) || !nodes.has(id)) continue;
    seen.add(id);
    reachable.push(id);
    for (const next of [...(nodes.get(id)?.next ?? [])].reverse()) stack.push(next);
  }
  const inDegree = new Map(reachable.map((id) => [id, 0]));
  for (const id of reachable) {
    for (const next of nodes.get(id)!.next) if (inDegree.has(next)) inDegree.set(next, inDegree.get(next)! + 1);
  }

  // Kahn's algorithm, tracking the longest distance from the root.
  const depth = new Map([[build.root, 0]]);
  const queue = [build.root];
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of nodes.get(id)!.next) {
      if (!inDegree.has(next)) continue;
      depth.set(next, Math.max(depth.get(next) ?? 0, depth.get(id)! + 1));
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  const columns: string[][] = [];
  for (const id of order) (columns[depth.get(id)!] ??= []).push(id);
  return columns;
}

/** Every parent -> child link between laid-out nodes. */
export function edges(build: Build): [string, string][] {
  const ids = new Set(build.nodes.map((node) => node.id));
  return build.nodes.flatMap((node) => node.next.filter((next) => ids.has(next)).map((next): [string, string] => [node.id, next]));
}
