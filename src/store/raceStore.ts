import { create } from 'zustand'
import type { AlgorithmId } from '../algorithms/complexity'
import type { Trace } from '../algorithms/types'

interface RaceState {
  algorithmA: AlgorithmId
  algorithmB: AlgorithmId
  traceA: Trace | null
  traceB: Trace | null
  /** A single shared index drives both traces. A trace shorter than the other
   *  simply clamps at its own last step (via deriveVisualState) and holds there
   *  while the other keeps advancing — that visible "waiting" gap IS the point:
   *  it's what lets you see one algorithm finish before the other. Playback
   *  speed is never artificially scaled to make them finish together, since
   *  doing so would hide the exact signal this feature exists to show. */
  currentStepIndex: number
  isPlaying: boolean
  speed: number

  setAlgorithmA: (id: AlgorithmId) => void
  setAlgorithmB: (id: AlgorithmId) => void
  setTraces: (a: Trace, b: Trace) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  stepForward: () => void
  stepBackward: () => void
  jumpToStep: (index: number) => void
  reset: () => void
  clear: () => void
  setSpeed: (speed: number) => void
}

function maxLastIndex(traceA: Trace | null, traceB: Trace | null): number {
  const lenA = traceA?.steps.length ?? 0
  const lenB = traceB?.steps.length ?? 0
  return Math.max(lenA, lenB) - 1
}

export const useRaceStore = create<RaceState>((set, get) => ({
  algorithmA: 'dijkstra',
  algorithmB: 'astar',
  traceA: null,
  traceB: null,
  currentStepIndex: -1,
  isPlaying: false,
  speed: 2,

  setAlgorithmA: (id) => set({ algorithmA: id }),
  setAlgorithmB: (id) => set({ algorithmB: id }),

  setTraces: (a, b) => set({ traceA: a, traceB: b, currentStepIndex: -1, isPlaying: false }),

  play: () => {
    const { traceA, traceB, currentStepIndex } = get()
    if (!traceA || !traceB) return
    if (currentStepIndex >= maxLastIndex(traceA, traceB)) return
    set({ isPlaying: true })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => {
    if (get().isPlaying) get().pause()
    else get().play()
  },

  stepForward: () => {
    const { traceA, traceB, currentStepIndex } = get()
    if (!traceA || !traceB) return
    const last = maxLastIndex(traceA, traceB)
    const next = Math.min(currentStepIndex + 1, last)
    set({ currentStepIndex: next, isPlaying: next >= last ? false : get().isPlaying })
  },

  stepBackward: () => {
    set({ currentStepIndex: Math.max(get().currentStepIndex - 1, -1), isPlaying: false })
  },

  jumpToStep: (index) => {
    const { traceA, traceB } = get()
    if (!traceA || !traceB) return
    const clamped = Math.max(-1, Math.min(index, maxLastIndex(traceA, traceB)))
    set({ currentStepIndex: clamped, isPlaying: false })
  },

  reset: () => set({ currentStepIndex: -1, isPlaying: false }),

  clear: () => set({ traceA: null, traceB: null, currentStepIndex: -1, isPlaying: false }),

  setSpeed: (speed) => set({ speed: Math.max(0.25, Math.min(speed, 8)) }),
}))

export { maxLastIndex }
