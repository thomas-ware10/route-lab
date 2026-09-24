export interface StepStats {
  /** Weight/priority comparisons performed so far. */
  comparisons: number
  /** Number of edges examined (consider-edge events) so far. */
  edgesConsidered: number
  /** Number of distinct nodes visited/popped so far. */
  nodesVisited: number
  /** Priority-queue push+pop operations so far (Dijkstra, A-star, Prim only). */
  priorityQueueOps: number
  /** Union-find find/union operations so far (Kruskal only). */
  unionFindOps: number
  /** Sum of the above — the number plotted against the theoretical curve. */
  totalOperations: number
}

export const ZERO_STATS: StepStats = {
  comparisons: 0,
  edgesConsidered: 0,
  nodesVisited: 0,
  priorityQueueOps: 0,
  unionFindOps: 0,
  totalOperations: 0,
}

export type StepKind =
  | 'visit-node'
  | 'finalize-node'
  | 'consider-edge'
  | 'relax-edge'
  | 'reject-edge'
  | 'accept-edge'
  | 'done'

interface StepBase {
  kind: StepKind
  /** Human-readable explanation shown alongside playback, e.g. "Relaxed edge B→D: 7 < 9". */
  description: string
  /** Cumulative stats snapshot AFTER this step is applied. */
  stats: StepStats
}

export interface NodeStep extends StepBase {
  kind: 'visit-node' | 'finalize-node'
  nodeId: string
}

export interface EdgeStep extends StepBase {
  kind: 'consider-edge' | 'relax-edge' | 'reject-edge' | 'accept-edge'
  edgeId: string
}

export interface DoneStep extends StepBase {
  kind: 'done'
  success: boolean
  /** Shortest-path algorithms: nodes on the final path, in order. */
  resultPathNodeIds?: string[]
  /** Edges in the final result (shortest path tree edges, or MST edges). */
  resultEdgeIds: string[]
  totalCost?: number
}

export type Step = NodeStep | EdgeStep | DoneStep

export interface Trace {
  algorithm: 'dijkstra' | 'astar' | 'kruskal' | 'prim'
  steps: Step[]
  /** Non-fatal correctness warnings surfaced before/while running (e.g. inadmissible heuristic). */
  warnings: string[]
}

export function isNodeStep(step: Step): step is NodeStep {
  return step.kind === 'visit-node' || step.kind === 'finalize-node'
}

export function isEdgeStep(step: Step): step is EdgeStep {
  return (
    step.kind === 'consider-edge' ||
    step.kind === 'relax-edge' ||
    step.kind === 'reject-edge' ||
    step.kind === 'accept-edge'
  )
}

export function isDoneStep(step: Step): step is DoneStep {
  return step.kind === 'done'
}
