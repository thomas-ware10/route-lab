import { beforeEach, describe, expect, it } from 'vitest'
import { clearRoadDataCache, planRoute } from '../../roads/planRoute'
import { fakeFetch } from '../../roads/__tests__/fixtures'
import { useRoadStore, type RoutePlanner } from '../roadStore'

const planner: RoutePlanner = (from, to, options) =>
  planRoute(from, to, { ...options, fetchImpl: fakeFetch(), endpoints: ['https://x'] })

beforeEach(() => {
  clearRoadDataCache()
  useRoadStore.setState({
    fromInput: 'AB1 1AA',
    toInput: 'AB1 1AB',
    algorithm: 'dijkstra',
    status: 'idle',
    error: null,
    route: null,
    trace: null,
    runs: {},
    index: -1,
    isPlaying: false,
    durationSeconds: 15,
  })
})

describe('roadStore.findRoute', () => {
  it('walks through the progress stages and ends ready, auto-playing from the start', async () => {
    const seen: string[] = []
    const unsubscribe = useRoadStore.subscribe((s, prev) => {
      if (s.status !== prev.status) seen.push(s.status)
    })
    await useRoadStore.getState().findRoute(planner)
    unsubscribe()

    expect(seen).toEqual(['geocoding', 'downloading', 'building', 'searching', 'ready'])
    const s = useRoadStore.getState()
    expect(s.trace).not.toBeNull()
    expect(s.index).toBe(-1)
    expect(s.isPlaying).toBe(true)
    expect(s.runs.dijkstra?.nodesVisited).toBeGreaterThan(0)
  })

  it('reports a friendly error and stays usable', async () => {
    useRoadStore.setState({ toInput: 'ZZ9 9ZZ' })
    await useRoadStore.getState().findRoute(planner)
    const s = useRoadStore.getState()
    expect(s.status).toBe('error')
    expect(s.error).toMatch(/wasn't found/)
    expect(s.trace).toBeNull()
  })

  it('a newer search supersedes an older in-flight one', async () => {
    let releaseFirst!: () => void
    const slow: RoutePlanner = (from, to, options) =>
      new Promise((resolve, reject) => {
        releaseFirst = () => planner(from, to, options).then(resolve, reject)
      })
    const first = useRoadStore.getState().findRoute(slow)
    const second = useRoadStore.getState().findRoute(planner)
    await second
    const traceAfterSecond = useRoadStore.getState().trace
    releaseFirst()
    await first
    expect(useRoadStore.getState().trace).toBe(traceAfterSecond)
    expect(useRoadStore.getState().status).toBe('ready')
  })
})

describe('roadStore playback', () => {
  beforeEach(async () => {
    await useRoadStore.getState().findRoute(planner)
    useRoadStore.getState().pause()
  })

  it('advance moves several steps at once and stops playing at the end', () => {
    const last = useRoadStore.getState().trace!.steps.length - 1
    useRoadStore.getState().play()
    useRoadStore.getState().advance(3)
    expect(useRoadStore.getState().index).toBe(2)
    useRoadStore.getState().advance(10_000)
    expect(useRoadStore.getState().index).toBe(last)
    expect(useRoadStore.getState().isPlaying).toBe(false)
  })

  it('play at the end restarts from the beginning', () => {
    useRoadStore.getState().skipToEnd()
    useRoadStore.getState().play()
    expect(useRoadStore.getState().index).toBe(-1)
    expect(useRoadStore.getState().isPlaying).toBe(true)
  })

  it('seek clamps and pauses', () => {
    useRoadStore.getState().play()
    useRoadStore.getState().seek(99_999)
    expect(useRoadStore.getState().index).toBe(useRoadStore.getState().trace!.steps.length - 1)
    expect(useRoadStore.getState().isPlaying).toBe(false)
    useRoadStore.getState().seek(-10)
    expect(useRoadStore.getState().index).toBe(-1)
  })

  it('switching algorithm re-runs instantly on the same downloaded roads and keeps both results', () => {
    const route = useRoadStore.getState().route
    useRoadStore.getState().setAlgorithm('astar')
    const s = useRoadStore.getState()
    expect(s.route).toBe(route)
    expect(s.trace?.algorithm).toBe('astar')
    expect(s.runs.dijkstra).toBeDefined()
    expect(s.runs.astar).toBeDefined()
    expect(s.index).toBe(-1)
  })

  it('clamps playback duration to a sane range', () => {
    useRoadStore.getState().setDurationSeconds(0)
    expect(useRoadStore.getState().durationSeconds).toBe(2)
    useRoadStore.getState().setDurationSeconds(10_000)
    expect(useRoadStore.getState().durationSeconds).toBe(120)
  })
})
