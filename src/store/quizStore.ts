import { create } from 'zustand'
import { getQuizDecisionIndices, quizAnswerId } from '../algorithms/quizDecisions'
import type { Trace } from '../algorithms/types'

export type QuizPhase = 'idle' | 'guessing' | 'revealed' | 'finished'

interface QuizState {
  trace: Trace | null
  decisionIndices: number[]
  /** Index into decisionIndices, not into trace.steps directly. */
  pointer: number
  phase: QuizPhase
  guessId: string | null
  wasCorrect: boolean | null
  score: { correct: number; total: number }

  /** Returns false if the trace has no genuine decision points to quiz on. */
  startQuiz: (trace: Trace) => boolean
  submitGuess: (id: string) => void
  nextQuestion: () => void
  reset: () => void

  /** The trace-step index currently being asked about, or null if not guessing/revealed. */
  currentStepIndex: () => number | null
}

const INITIAL = {
  trace: null as Trace | null,
  decisionIndices: [] as number[],
  pointer: 0,
  phase: 'idle' as QuizPhase,
  guessId: null as string | null,
  wasCorrect: null as boolean | null,
  score: { correct: 0, total: 0 },
}

export const useQuizStore = create<QuizState>((set, get) => ({
  ...INITIAL,

  startQuiz: (trace) => {
    const decisionIndices = getQuizDecisionIndices(trace)
    if (decisionIndices.length === 0) return false
    set({
      trace,
      decisionIndices,
      pointer: 0,
      phase: 'guessing',
      guessId: null,
      wasCorrect: null,
      score: { correct: 0, total: 0 },
    })
    return true
  },

  submitGuess: (id) => {
    const { trace, decisionIndices, pointer, phase, score } = get()
    if (phase !== 'guessing' || !trace) return
    const stepIndex = decisionIndices[pointer]
    const correctId = quizAnswerId(trace, stepIndex)
    const correct = id === correctId
    set({
      guessId: id,
      wasCorrect: correct,
      phase: 'revealed',
      score: { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 },
    })
  },

  nextQuestion: () => {
    const { phase, pointer, decisionIndices } = get()
    if (phase !== 'revealed') return
    const next = pointer + 1
    if (next >= decisionIndices.length) {
      set({ phase: 'finished', pointer: next })
    } else {
      set({ pointer: next, phase: 'guessing', guessId: null, wasCorrect: null })
    }
  },

  reset: () => set({ ...INITIAL, score: { correct: 0, total: 0 } }),

  currentStepIndex: () => {
    const { trace, decisionIndices, pointer, phase } = get()
    if (!trace || phase === 'idle' || pointer >= decisionIndices.length) return null
    return decisionIndices[pointer]
  },
}))
