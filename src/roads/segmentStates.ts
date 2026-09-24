import type { Step, Trace } from '../algorithms/types'
import type { EdgeVisualState } from '../playback/deriveVisualState'

export type SegmentVisualState = EdgeVisualState

/**
 * When both directions of a two-way street have been touched, the segment shows
 * whichever state matters most, so a "rejected" reverse direction can never
 * paint over the "accepted" direction the search actually used.
 */
const PRIORITY: Record<SegmentVisualState, number> = {
  default: 0,
  rejected: 1,
  considering: 2,
  accepted: 3,
  path: 4,
}

function edgeStateFor(step: Step): EdgeVisualState | null {
  switch (step.kind) {
    case 'consider-edge':
      return 'considering'
    case 'reject-edge':
      return 'rejected'
    case 'relax-edge':
    case 'accept-edge':
      return 'accepted'
    default:
      return null
  }
}

/**
 * Tracks per-road-segment colors as playback moves through a trace. Moving
 * forward only applies the newly passed steps (so each animation frame costs
 * O(steps advanced), not O(steps so far) — the basic model's fold-from-zero
 * approach is fine for 50 steps but not for 50,000). Moving backward replays
 * from the start, which only happens on an explicit scrub or step-back.
 *
 * seek() returns only the segments whose visible state changed, so the map
 * redraws just those instead of every road.
 */
export class SegmentStateTracker {
  private edgeStates = new Map<string, EdgeVisualState>()
  private segmentStates = new Map<string, SegmentVisualState>()
  private readonly segmentEdges = new Map<string, string[]>()
  private index = -1
  private readonly trace: Trace
  private readonly edgeSegment: Map<string, string>
  activeNodeId: string | null = null

  constructor(trace: Trace, edgeSegment: Map<string, string>) {
    this.trace = trace
    this.edgeSegment = edgeSegment
    for (const [edgeId, segmentId] of edgeSegment) {
      const list = this.segmentEdges.get(segmentId)
      if (list) list.push(edgeId)
      else this.segmentEdges.set(segmentId, [edgeId])
    }
  }

  get currentIndex(): number {
    return this.index
  }

  stateOf(segmentId: string): SegmentVisualState {
    return this.segmentStates.get(segmentId) ?? 'default'
  }

  /** All segments currently in a non-default state. */
  entries(): IterableIterator<[string, SegmentVisualState]> {
    return this.segmentStates.entries()
  }

  seek(targetIndex: number): Map<string, SegmentVisualState> {
    const target = Math.max(-1, Math.min(targetIndex, this.trace.steps.length - 1))
    const changes = new Map<string, SegmentVisualState>()

    if (target < this.index) {
      const before = new Map(this.segmentStates)
      this.edgeStates.clear()
      this.segmentStates.clear()
      this.activeNodeId = null
      this.index = -1
      this.applyThrough(target, null)
      for (const id of new Set([...before.keys(), ...this.segmentStates.keys()])) {
        const now = this.stateOf(id)
        if ((before.get(id) ?? 'default') !== now) changes.set(id, now)
      }
      return changes
    }

    this.applyThrough(target, changes)
    return changes
  }

  private applyThrough(target: number, changes: Map<string, SegmentVisualState> | null): void {
    for (let i = this.index + 1; i <= target; i++) {
      const step = this.trace.steps[i]
      if (step.kind === 'visit-node') {
        this.activeNodeId = step.nodeId
      } else if (step.kind === 'done') {
        for (const edgeId of step.resultEdgeIds) this.setEdge(edgeId, 'path', changes)
      } else {
        const state = edgeStateFor(step)
        if (state && 'edgeId' in step) this.setEdge(step.edgeId, state, changes)
      }
    }
    this.index = Math.max(this.index, target)
  }

  private setEdge(edgeId: string, state: EdgeVisualState, changes: Map<string, SegmentVisualState> | null): void {
    this.edgeStates.set(edgeId, state)
    const segmentId = this.edgeSegment.get(edgeId)
    if (!segmentId) return
    let best: SegmentVisualState = 'default'
    for (const e of this.segmentEdges.get(segmentId) ?? []) {
      const s = this.edgeStates.get(e) ?? 'default'
      if (PRIORITY[s] > PRIORITY[best]) best = s
    }
    if (best === this.stateOf(segmentId)) return
    if (best === 'default') this.segmentStates.delete(segmentId)
    else this.segmentStates.set(segmentId, best)
    changes?.set(segmentId, best)
  }
}
