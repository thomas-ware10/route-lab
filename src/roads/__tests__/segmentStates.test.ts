import { describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import { astar } from '../../algorithms/astar'
import { isDoneStep } from '../../algorithms/types'
import type { Graph, GraphEdge, GraphNode } from '../../types'
import { SegmentStateTracker, type SegmentVisualState } from '../segmentStates'

/** Grid of two-way streets: each street is one segment carried by two opposite directed edges. */
function gridRoad(size: number): { graph: Graph; edgeSegment: Map<string, string> } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeSegment = new Map<string, string>()
  const id = (r: number, c: number) => `${r}_${c}`
  let e = 0
  let s = 0
  const street = (a: string, b: string, w: number) => {
    const seg = `s${s++}`
    edges.push({ id: `e${e}`, source: a, target: b, weight: w })
    edgeSegment.set(`e${e++}`, seg)
    edges.push({ id: `e${e}`, source: b, target: a, weight: w })
    edgeSegment.set(`e${e++}`, seg)
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      nodes.push({ id: id(r, c), x: c * 100, y: r * 100, label: '' })
      if (c + 1 < size) street(id(r, c), id(r, c + 1), 100 + ((r * 7 + c * 3) % 5) * 10)
      if (r + 1 < size) street(id(r, c), id(r + 1, c), 100 + ((r * 3 + c * 7) % 5) * 10)
    }
  }
  return { graph: { mode: 'directed', nodes, edges }, edgeSegment }
}

function snapshot(tracker: SegmentStateTracker): Map<string, SegmentVisualState> {
  return new Map(tracker.entries())
}

describe('SegmentStateTracker', () => {
  const { graph, edgeSegment } = gridRoad(8)
  const trace = dijkstra(graph, { startNodeId: '0_0', endNodeId: '7_7' })
  const last = trace.steps.length - 1

  it('starts with every segment in the default state', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    expect(snapshot(t).size).toBe(0)
    expect(t.currentIndex).toBe(-1)
  })

  it('stepping forward one at a time matches jumping straight to each index', () => {
    const stepper = new SegmentStateTracker(trace, edgeSegment)
    for (let i = 0; i <= last; i += 7) {
      stepper.seek(i)
      const jumper = new SegmentStateTracker(trace, edgeSegment)
      jumper.seek(i)
      expect(snapshot(stepper)).toEqual(snapshot(jumper))
    }
  })

  it('rewinding matches a fresh tracker seeking to the same index', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    t.seek(last)
    const mid = Math.floor(last / 3)
    t.seek(mid)
    const fresh = new SegmentStateTracker(trace, edgeSegment)
    fresh.seek(mid)
    expect(snapshot(t)).toEqual(snapshot(fresh))
    expect(t.activeNodeId).toBe(fresh.activeNodeId)
  })

  it('reported changes are exactly what a renderer needs to mirror the tracker, forward and backward', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    const mirror = new Map<string, SegmentVisualState>()
    const apply = (changes: Map<string, SegmentVisualState>) => {
      for (const [id, state] of changes) {
        if (state === 'default') mirror.delete(id)
        else mirror.set(id, state)
      }
    }
    for (const target of [5, 40, 41, 200, 90, last, 3, -1, last]) {
      apply(t.seek(target))
      expect(mirror).toEqual(snapshot(t))
    }
  })

  it('paints the final route as "path" at the done step, and only those segments', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    t.seek(last)
    const done = trace.steps.find(isDoneStep)!
    const pathSegments = new Set(done.resultEdgeIds.map((e) => edgeSegment.get(e)!))
    for (const [seg, state] of t.entries()) {
      expect(state === 'path').toBe(pathSegments.has(seg))
    }
    expect(pathSegments.size).toBe(done.resultEdgeIds.length)
    expect(pathSegments.size).toBeGreaterThanOrEqual(14) // at least 7 right + 7 down on an 8x8 grid
  })

  it('never lets a rejected reverse direction paint over an accepted segment', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    t.seek(last - 1) // just before the path overlay
    const accepted = new Set<string>()
    for (let i = 0; i < last; i++) {
      const s = trace.steps[i]
      if (s.kind === 'relax-edge') accepted.add(edgeSegment.get(s.edgeId)!)
    }
    for (const seg of accepted) expect(t.stateOf(seg)).toBe('accepted')
  })

  it('tracks the node currently being explored', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    t.seek(0)
    expect(t.activeNodeId).toBe('0_0')
  })

  it('clamps out-of-range seeks', () => {
    const t = new SegmentStateTracker(trace, edgeSegment)
    t.seek(10_000)
    expect(t.currentIndex).toBe(last)
    t.seek(-50)
    expect(t.currentIndex).toBe(-1)
    expect(snapshot(t).size).toBe(0)
  })

  it('works for A* traces too', () => {
    const a = astar(graph, { startNodeId: '0_0', endNodeId: '7_7' })
    const t = new SegmentStateTracker(a, edgeSegment)
    t.seek(a.steps.length - 1)
    expect([...t.entries()].some(([, s]) => s === 'path')).toBe(true)
  })
})
