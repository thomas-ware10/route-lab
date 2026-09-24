import type { AlgorithmId } from './complexity'
import { isEdgeStep, isNodeStep, type Trace } from './types'

export type QuizQuestionKind = 'node' | 'edge'

export function quizQuestionKind(algorithm: AlgorithmId): QuizQuestionKind {
  return algorithm === 'kruskal' || algorithm === 'prim' ? 'edge' : 'node'
}

const QUESTION_TEXT: Record<AlgorithmId, string> = {
  dijkstra: 'Which node will Dijkstra’s algorithm visit next?',
  astar: 'Which node will A* visit next?',
  kruskal: 'Which edge will Kruskal’s algorithm add to the MST next?',
  prim: 'Which edge will Prim’s algorithm add to the tree next?',
}

export function quizQuestionText(algorithm: AlgorithmId): string {
  return QUESTION_TEXT[algorithm]
}

/**
 * The trace-step indices worth quizzing on: for Dijkstra/A*, every 'visit-node'
 * step except the first (visiting the start node isn't a real prediction — it's
 * given). For Kruskal/Prim, every 'accept-edge' step, including the first
 * (even the first MST edge requires knowing "lowest weight wins", a genuine
 * test of the algorithm's rule).
 */
export function getQuizDecisionIndices(trace: Trace): number[] {
  if (quizQuestionKind(trace.algorithm) === 'edge') {
    return trace.steps.reduce<number[]>((acc, step, i) => {
      if (step.kind === 'accept-edge') acc.push(i)
      return acc
    }, [])
  }
  const visitIndices = trace.steps.reduce<number[]>((acc, step, i) => {
    if (step.kind === 'visit-node') acc.push(i)
    return acc
  }, [])
  return visitIndices.slice(1)
}

/** The correct answer (a node id or edge id) for the decision at this step index. */
export function quizAnswerId(trace: Trace, stepIndex: number): string {
  const step = trace.steps[stepIndex]
  if (isNodeStep(step)) return step.nodeId
  if (isEdgeStep(step)) return step.edgeId
  throw new Error(`Step ${stepIndex} (kind "${step.kind}") is not a valid quiz decision point`)
}

/** A short, human explanation of why the algorithm chose this answer. */
export function quizExplanation(trace: Trace, stepIndex: number): string {
  return trace.steps[stepIndex].description
}
