import { create } from 'zustand'
import { astar } from '../algorithms/astar'
import { dijkstra } from '../algorithms/dijkstra'
import type { Trace } from '../algorithms/types'
import { planRoute, type PlannedRoute, type PlanRouteOptions, type RouteProgress } from '../roads/planRoute'

export type RoadAlgorithm = 'dijkstra' | 'astar'
export type RoadStatus = 'idle' | RouteProgress | 'searching' | 'ready' | 'error'

export interface RunSummary {
  nodesVisited: number
  edgesConsidered: number
  totalOperations: number
  steps: number
  searchMs: number
}

export type RoutePlanner = (from: string, to: string, options: PlanRouteOptions) => Promise<PlannedRoute>

interface RoadState {
  fromInput: string
  toInput: string
  algorithm: RoadAlgorithm
  status: RoadStatus
  /** Extra progress context, e.g. "trying backup server 1 of 2". */
  statusDetail: string | null
  error: string | null
  route: PlannedRoute | null
  trace: Trace | null
  /** Results per algorithm on the current route, for the "Dijkstra vs A*" comparison line. */
  runs: Partial<Record<RoadAlgorithm, RunSummary>>
  index: number
  isPlaying: boolean
  /** Target total playback time; steps per second scale with trace length. */
  durationSeconds: number

  setFromInput: (value: string) => void
  setToInput: (value: string) => void
  setAlgorithm: (algorithm: RoadAlgorithm) => void
  setDurationSeconds: (seconds: number) => void
  findRoute: (planner?: RoutePlanner) => Promise<void>
  play: () => void
  pause: () => void
  togglePlay: () => void
  advance: (steps: number) => void
  seek: (index: number) => void
  skipToEnd: () => void
  restart: () => void
}

let inFlight: AbortController | null = null

function runSearch(route: PlannedRoute, algorithm: RoadAlgorithm): { trace: Trace; summary: RunSummary } {
  const t0 = performance.now()
  const options = { startNodeId: route.startNodeId, endNodeId: route.endNodeId }
  const trace = algorithm === 'astar' ? astar(route.road.graph, options) : dijkstra(route.road.graph, options)
  const searchMs = performance.now() - t0
  const final = trace.steps[trace.steps.length - 1].stats
  return {
    trace,
    summary: {
      nodesVisited: final.nodesVisited,
      edgesConsidered: final.edgesConsidered,
      totalOperations: final.totalOperations,
      steps: trace.steps.length,
      searchMs,
    },
  }
}

const lastIndex = (trace: Trace | null) => (trace ? trace.steps.length - 1 : -1)

export const useRoadStore = create<RoadState>((set, get) => ({
  fromInput: '',
  toInput: '',
  algorithm: 'dijkstra',
  status: 'idle',
  statusDetail: null,
  error: null,
  route: null,
  trace: null,
  runs: {},
  index: -1,
  isPlaying: false,
  durationSeconds: 15,

  setFromInput: (fromInput) => set({ fromInput }),
  setToInput: (toInput) => set({ toInput }),
  setDurationSeconds: (seconds) => set({ durationSeconds: Math.max(2, Math.min(seconds, 120)) }),

  setAlgorithm: (algorithm) => {
    const { route, status } = get()
    set({ algorithm })
    // Re-running on the already-downloaded graph is instant, so switching algorithm
    // immediately replays the new search on the same roads for a direct comparison.
    if (route && status === 'ready') {
      const { trace, summary } = runSearch(route, algorithm)
      set((s) => ({ trace, index: -1, isPlaying: true, runs: { ...s.runs, [algorithm]: summary } }))
    }
  },

  findRoute: async (planner = planRoute) => {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller
    const { fromInput, toInput, algorithm } = get()
    set({ status: 'geocoding', statusDetail: null, error: null, route: null, trace: null, runs: {}, index: -1, isPlaying: false })

    try {
      const route = await planner(fromInput, toInput, {
        signal: controller.signal,
        onProgress: (stage, detail) => {
          if (inFlight === controller) set({ status: stage, statusDetail: detail ?? null })
        },
      })
      if (inFlight !== controller) return
      set({ status: 'searching', statusDetail: null })
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (inFlight !== controller) return
      const { trace, summary } = runSearch(route, algorithm)
      set({ route, trace, status: 'ready', index: -1, isPlaying: true, runs: { [algorithm]: summary } })
    } catch (err) {
      if (inFlight !== controller || (err as Error).name === 'AbortError') return
      set({ status: 'error', error: (err as Error).message || 'Something went wrong finding that route.' })
    } finally {
      if (inFlight === controller) inFlight = null
    }
  },

  play: () => {
    const { trace, index } = get()
    if (!trace) return
    // Pressing play at the end replays from the start rather than doing nothing.
    if (index >= lastIndex(trace)) set({ index: -1, isPlaying: true })
    else set({ isPlaying: true })
  },
  pause: () => set({ isPlaying: false }),
  togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

  advance: (steps) => {
    const { trace, index } = get()
    if (!trace) return
    const last = lastIndex(trace)
    const next = Math.min(index + Math.max(0, steps), last)
    set({ index: next, isPlaying: next < last && get().isPlaying })
  },

  seek: (target) => {
    const { trace } = get()
    if (!trace) return
    set({ index: Math.max(-1, Math.min(target, lastIndex(trace))), isPlaying: false })
  },

  skipToEnd: () => set((s) => ({ index: lastIndex(s.trace), isPlaying: false })),
  restart: () => set({ index: -1, isPlaying: false }),
}))
