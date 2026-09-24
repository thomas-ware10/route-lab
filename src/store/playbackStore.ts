import { create } from 'zustand'
import type { Trace } from '../algorithms/types'

interface PlaybackState {
  trace: Trace | null
  /** -1 means "not started" (before the first step). */
  currentStepIndex: number
  isPlaying: boolean
  /** Steps advanced per second while playing. */
  speed: number

  setTrace: (trace: Trace) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  stepForward: () => void
  stepBackward: () => void
  jumpToStep: (index: number) => void
  /** Rewinds to -1 but keeps the trace, so playback can be replayed. */
  reset: () => void
  /** Drops the trace entirely, e.g. when the user edits the graph. */
  clear: () => void
  setSpeed: (speed: number) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  trace: null,
  currentStepIndex: -1,
  isPlaying: false,
  speed: 2,

  setTrace: (trace) => set({ trace, currentStepIndex: -1, isPlaying: false }),

  play: () => {
    const { trace, currentStepIndex } = get()
    if (!trace || currentStepIndex >= trace.steps.length - 1) return
    set({ isPlaying: true })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => {
    get().isPlaying ? get().pause() : get().play()
  },

  stepForward: () => {
    const { trace, currentStepIndex } = get()
    if (!trace) return
    const next = Math.min(currentStepIndex + 1, trace.steps.length - 1)
    const atEnd = next === trace.steps.length - 1
    set({ currentStepIndex: next, isPlaying: atEnd ? false : get().isPlaying })
  },

  stepBackward: () => {
    const { currentStepIndex } = get()
    set({ currentStepIndex: Math.max(currentStepIndex - 1, -1), isPlaying: false })
  },

  jumpToStep: (index) => {
    const { trace } = get()
    if (!trace) return
    const clamped = Math.max(-1, Math.min(index, trace.steps.length - 1))
    set({ currentStepIndex: clamped, isPlaying: false })
  },

  reset: () => set({ currentStepIndex: -1, isPlaying: false }),

  clear: () => set({ trace: null, currentStepIndex: -1, isPlaying: false }),

  setSpeed: (speed) => set({ speed: Math.max(0.25, Math.min(speed, 8)) }),
}))
