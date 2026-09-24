export type AlgorithmId = 'dijkstra' | 'astar' | 'kruskal' | 'prim'

/**
 * The problem each algorithm solves. Only algorithms in the same family produce
 * a meaningful head-to-head comparison — Dijkstra vs A* (both shortest-path) is
 * a fair race, but Dijkstra vs Kruskal (shortest-path vs MST) compares answers
 * to two different questions and isn't a meaningful comparison.
 */
export type AlgorithmFamily = 'shortest-path' | 'mst'

export const ALGORITHM_FAMILY: Record<AlgorithmId, AlgorithmFamily> = {
  dijkstra: 'shortest-path',
  astar: 'shortest-path',
  kruskal: 'mst',
  prim: 'mst',
}

export function algorithmsInSameFamily(a: AlgorithmId, b: AlgorithmId): boolean {
  return ALGORITHM_FAMILY[a] === ALGORITHM_FAMILY[b]
}

export function algorithmIdsInFamily(family: AlgorithmFamily): AlgorithmId[] {
  return (Object.keys(ALGORITHM_FAMILY) as AlgorithmId[]).filter((id) => ALGORITHM_FAMILY[id] === family)
}

export interface ComplexityInfo {
  id: AlgorithmId
  name: string
  bigO: string
  /** Theoretical operation-count estimate for a graph with v nodes and e edges. */
  estimate: (v: number, e: number) => number
}

const log2 = (x: number) => (x > 1 ? Math.log2(x) : 0)

export const COMPLEXITY: Record<AlgorithmId, ComplexityInfo> = {
  dijkstra: {
    id: 'dijkstra',
    name: "Dijkstra's Algorithm",
    bigO: 'O((V + E) log V)',
    estimate: (v, e) => (v + e) * log2(Math.max(v, 2)),
  },
  astar: {
    id: 'astar',
    name: 'A* Search',
    bigO: 'O((V + E) log V) worst case',
    estimate: (v, e) => (v + e) * log2(Math.max(v, 2)),
  },
  kruskal: {
    id: 'kruskal',
    name: "Kruskal's Algorithm",
    bigO: 'O(E log E)',
    estimate: (_v, e) => e * log2(Math.max(e, 2)),
  },
  prim: {
    id: 'prim',
    name: "Prim's Algorithm",
    bigO: 'O(E log V)',
    estimate: (v, e) => e * log2(Math.max(v, 2)),
  },
}
