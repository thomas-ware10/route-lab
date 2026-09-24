import { describe, expect, it } from 'vitest'
import { dijkstra } from '../dijkstra'
import { kruskal } from '../kruskal'
import { prim } from '../prim'
import { getQuizDecisionIndices, quizAnswerId, quizExplanation, quizQuestionKind, quizQuestionText } from '../quizDecisions'
import { isDoneStep } from '../types'
import type { Graph } from '../../types'

function diamond(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 1, label: 'C' },
      { id: 'D', x: 1, y: 1, label: 'D' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 2 },
      { id: 'e2', source: 'A', target: 'C', weight: 1 },
      { id: 'e3', source: 'B', target: 'D', weight: 1 },
      { id: 'e4', source: 'C', target: 'D', weight: 5 },
    ],
  }
}

describe('quizQuestionKind / quizQuestionText', () => {
  it('asks about nodes for dijkstra and astar', () => {
    expect(quizQuestionKind('dijkstra')).toBe('node')
    expect(quizQuestionKind('astar')).toBe('node')
  })
  it('asks about edges for kruskal and prim', () => {
    expect(quizQuestionKind('kruskal')).toBe('edge')
    expect(quizQuestionKind('prim')).toBe('edge')
  })
  it('produces non-empty, algorithm-specific question text for all four', () => {
    for (const id of ['dijkstra', 'astar', 'kruskal', 'prim'] as const) {
      expect(quizQuestionText(id).length).toBeGreaterThan(0)
    }
  })
})

describe('getQuizDecisionIndices for shortest-path algorithms', () => {
  it('excludes the trivial first visit (the start node itself)', () => {
    const trace = dijkstra(diamond(), { startNodeId: 'A', endNodeId: 'D' })
    const indices = getQuizDecisionIndices(trace)
    const firstVisitIndex = trace.steps.findIndex((s) => s.kind === 'visit-node')
    expect(indices).not.toContain(firstVisitIndex)
  })

  it('every remaining decision index really is a visit-node step', () => {
    const trace = dijkstra(diamond(), { startNodeId: 'A', endNodeId: 'D' })
    const indices = getQuizDecisionIndices(trace)
    expect(indices.length).toBeGreaterThan(0)
    for (const i of indices) expect(trace.steps[i].kind).toBe('visit-node')
  })

  it('the answer for a visit-node decision is that step\'s nodeId', () => {
    const trace = dijkstra(diamond(), { startNodeId: 'A', endNodeId: 'D' })
    const [first] = getQuizDecisionIndices(trace)
    const step = trace.steps[first]
    expect(step.kind).toBe('visit-node')
    expect(quizAnswerId(trace, first)).toBe((step as { nodeId: string }).nodeId)
  })
})

describe('getQuizDecisionIndices for MST algorithms', () => {
  it('includes the FIRST accept-edge step (unlike the shortest-path case)', () => {
    const trace = kruskal(diamond())
    const indices = getQuizDecisionIndices(trace)
    const firstAcceptIndex = trace.steps.findIndex((s) => s.kind === 'accept-edge')
    expect(indices[0]).toBe(firstAcceptIndex)
  })

  it('every decision index is an accept-edge step, and skips rejected edges', () => {
    const trace = kruskal(diamond())
    const indices = getQuizDecisionIndices(trace)
    for (const i of indices) expect(trace.steps[i].kind).toBe('accept-edge')
    const rejectedIndices = trace.steps.reduce<number[]>((acc, s, i) => {
      if (s.kind === 'reject-edge') acc.push(i)
      return acc
    }, [])
    for (const r of rejectedIndices) expect(indices).not.toContain(r)
  })

  it('works the same way for prim', () => {
    const trace = prim(diamond(), { startNodeId: 'A' })
    const indices = getQuizDecisionIndices(trace)
    expect(indices.length).toBeGreaterThan(0)
    for (const i of indices) expect(trace.steps[i].kind).toBe('accept-edge')
  })

  it('the answer for an accept-edge decision is that step\'s edgeId', () => {
    const trace = kruskal(diamond())
    const [first] = getQuizDecisionIndices(trace)
    const step = trace.steps[first]
    expect(quizAnswerId(trace, first)).toBe((step as { edgeId: string }).edgeId)
  })
})

describe('quizExplanation', () => {
  it('returns the underlying step description', () => {
    const trace = kruskal(diamond())
    const [first] = getQuizDecisionIndices(trace)
    expect(quizExplanation(trace, first)).toBe(trace.steps[first].description)
  })
})

describe('quizAnswerId error handling', () => {
  it('throws for a step index that is not a valid decision point (e.g. the done step)', () => {
    const trace = kruskal(diamond())
    const doneIndex = trace.steps.findIndex(isDoneStep)
    expect(() => quizAnswerId(trace, doneIndex)).toThrow()
  })
})
