import { isDoneStep, isEdgeStep, isNodeStep, type Trace } from '../algorithms/types'

export type NodeVisualState = 'unvisited' | 'visited' | 'finalized' | 'path'
export type EdgeVisualState = 'default' | 'considering' | 'rejected' | 'accepted' | 'path'

export interface VisualState {
  nodes: Record<string, NodeVisualState>
  edges: Record<string, EdgeVisualState>
  /** The node/edge touched by the step exactly at the current index, for a transient highlight. */
  currentNodeId?: string
  currentEdgeId?: string
}

export const EMPTY_VISUAL_STATE: VisualState = { nodes: {}, edges: {} }

/**
 * Folds trace steps [0, uptoIndex] into a per-node/per-edge visual
 * classification. Last-write-wins per id, which is correct across all four
 * algorithms: a node/edge's most recent event is always its most current
 * state (e.g. a Prim frontier edge that gets pushed then later rejected).
 * The terminal 'done' step's result set overrides with the final answer.
 */
export function deriveVisualState(trace: Trace | null, uptoIndex: number): VisualState {
  if (!trace) return EMPTY_VISUAL_STATE

  const nodes: Record<string, NodeVisualState> = {}
  const edges: Record<string, EdgeVisualState> = {}
  const clampedIndex = Math.max(-1, Math.min(uptoIndex, trace.steps.length - 1))

  for (let i = 0; i <= clampedIndex; i++) {
    const step = trace.steps[i]
    if (isNodeStep(step)) {
      nodes[step.nodeId] = step.kind === 'finalize-node' ? 'finalized' : 'visited'
    } else if (isEdgeStep(step)) {
      edges[step.edgeId] =
        step.kind === 'accept-edge'
          ? 'accepted'
          : step.kind === 'reject-edge'
            ? 'rejected'
            : step.kind === 'relax-edge'
              ? 'accepted'
              : 'considering'
    } else if (isDoneStep(step)) {
      for (const edgeId of step.resultEdgeIds) edges[edgeId] = 'path'
      for (const nodeId of step.resultPathNodeIds ?? []) nodes[nodeId] = 'path'
    }
  }

  const currentStep = clampedIndex >= 0 ? trace.steps[clampedIndex] : undefined
  const currentNodeId = currentStep && isNodeStep(currentStep) ? currentStep.nodeId : undefined
  const currentEdgeId = currentStep && isEdgeStep(currentStep) ? currentStep.edgeId : undefined

  return { nodes, edges, currentNodeId, currentEdgeId }
}
