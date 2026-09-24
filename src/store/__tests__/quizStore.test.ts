import { beforeEach, describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import { kruskal } from '../../algorithms/kruskal'
import { getQuizDecisionIndices, quizAnswerId } from '../../algorithms/quizDecisions'
import type { Graph } from '../../types'
import { useQuizStore } from '../quizStore'

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

function tinyGraphWithNoRealDecisions(): Graph {
  // Two nodes, one edge: dijkstra's only visit-node steps are the start (trivial)
  // and immediately the end, giving zero genuine "predict the next visit" points
  // once the trivial first visit is excluded... actually it still has 1 (visiting
  // the end). Use a single-node graph instead to force truly zero decisions.
  return {
    mode: 'undirected',
    nodes: [{ id: 'A', x: 0, y: 0, label: 'A' }],
    edges: [],
  }
}

beforeEach(() => {
  useQuizStore.getState().reset()
})

describe('quizStore', () => {
  it('starts a quiz and computes decision indices from the trace', () => {
    const trace = kruskal(diamond())
    const ok = useQuizStore.getState().startQuiz(trace)
    expect(ok).toBe(true)
    expect(useQuizStore.getState().phase).toBe('guessing')
    expect(useQuizStore.getState().decisionIndices).toEqual(getQuizDecisionIndices(trace))
  })

  it('returns false and does not start when the trace has no real decision points', () => {
    const trace = dijkstra(tinyGraphWithNoRealDecisions(), { startNodeId: 'A', endNodeId: 'A' })
    const ok = useQuizStore.getState().startQuiz(trace)
    expect(ok).toBe(false)
    expect(useQuizStore.getState().phase).toBe('idle')
  })

  it('a correct guess is scored correctly and moves to revealed', () => {
    const trace = kruskal(diamond())
    useQuizStore.getState().startQuiz(trace)
    const stepIndex = useQuizStore.getState().currentStepIndex()!
    const correctId = quizAnswerId(trace, stepIndex)

    useQuizStore.getState().submitGuess(correctId)

    expect(useQuizStore.getState().phase).toBe('revealed')
    expect(useQuizStore.getState().wasCorrect).toBe(true)
    expect(useQuizStore.getState().score).toEqual({ correct: 1, total: 1 })
  })

  it('an incorrect guess is scored correctly', () => {
    const graph = diamond()
    const trace = kruskal(graph)
    useQuizStore.getState().startQuiz(trace)
    const stepIndex = useQuizStore.getState().currentStepIndex()!
    const correctId = quizAnswerId(trace, stepIndex)
    const wrongGuess = graph.edges.find((e) => e.id !== correctId)!.id

    useQuizStore.getState().submitGuess(wrongGuess)

    expect(useQuizStore.getState().wasCorrect).toBe(false)
    expect(useQuizStore.getState().score).toEqual({ correct: 0, total: 1 })
  })

  it('ignores a guess submitted outside the guessing phase', () => {
    const trace = kruskal(diamond())
    useQuizStore.getState().startQuiz(trace)
    const stepIndex = useQuizStore.getState().currentStepIndex()!
    useQuizStore.getState().submitGuess(quizAnswerId(trace, stepIndex))
    const scoreAfterFirst = useQuizStore.getState().score

    useQuizStore.getState().submitGuess('some-other-id') // already revealed, should be a no-op
    expect(useQuizStore.getState().score).toEqual(scoreAfterFirst)
  })

  it('nextQuestion advances the pointer and returns to guessing', () => {
    const trace = kruskal(diamond())
    useQuizStore.getState().startQuiz(trace)
    const stepIndex = useQuizStore.getState().currentStepIndex()!
    useQuizStore.getState().submitGuess(quizAnswerId(trace, stepIndex))
    useQuizStore.getState().nextQuestion()

    expect(useQuizStore.getState().phase).toBe('guessing')
    expect(useQuizStore.getState().pointer).toBe(1)
    expect(useQuizStore.getState().guessId).toBeNull()
  })

  it('reaching the last question and answering it moves to finished', () => {
    const trace = kruskal(diamond())
    useQuizStore.getState().startQuiz(trace)
    const total = useQuizStore.getState().decisionIndices.length

    for (let i = 0; i < total; i++) {
      const stepIndex = useQuizStore.getState().currentStepIndex()!
      useQuizStore.getState().submitGuess(quizAnswerId(trace, stepIndex))
      useQuizStore.getState().nextQuestion()
    }

    expect(useQuizStore.getState().phase).toBe('finished')
    expect(useQuizStore.getState().score.total).toBe(total)
  })

  it('reset clears everything back to idle', () => {
    const trace = kruskal(diamond())
    useQuizStore.getState().startQuiz(trace)
    useQuizStore.getState().reset()
    expect(useQuizStore.getState().phase).toBe('idle')
    expect(useQuizStore.getState().trace).toBeNull()
    expect(useQuizStore.getState().score).toEqual({ correct: 0, total: 0 })
  })

  it('currentStepIndex returns null when idle', () => {
    expect(useQuizStore.getState().currentStepIndex()).toBeNull()
  })
})
