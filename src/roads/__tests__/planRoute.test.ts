import { beforeEach, describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import { isDoneStep } from '../../algorithms/types'
import { describeRoadStep, routeLegs, routeLengthMeters } from '../describe'
import { clearRoadDataCache, planRoute, RouteError } from '../planRoute'
import { fakeFetch } from './fixtures'

beforeEach(() => clearRoadDataCache())

describe('planRoute', () => {
  it('geocodes, downloads, builds the graph, and snaps both ends onto the main network', async () => {
    const fetchImpl = fakeFetch()
    const stages: string[] = []
    const route = await planRoute('ab11aa', 'AB1 1AB', { fetchImpl, endpoints: ['https://x'], onProgress: (s) => stages.push(s) })

    expect(stages).toEqual(['geocoding', 'downloading', 'building'])
    expect(route.from.postcode).toBe('AB1 1AA')
    expect(route.startNodeId).toBe('n1')
    expect(route.endNodeId).toBe('n6')
    expect(route.startSnapMeters).toBeLessThan(20)
    expect(route.wayCount).toBe(4)
  })

  it('produces a graph the shortest-path engine can actually route on', async () => {
    const route = await planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl: fakeFetch(), endpoints: ['https://x'] })
    const done = dijkstra(route.road.graph, { startNodeId: route.startNodeId, endNodeId: route.endNodeId }).steps.find(isDoneStep)!
    expect(done.success).toBe(true)
    expect(routeLegs(route.road, done.resultEdgeIds).map((l) => l.name)).toEqual(['Main Street', 'Side Road'])
    expect(routeLengthMeters(route.road, done.resultEdgeIds)).toBeGreaterThan(300)
  })

  it('rejects the same postcode entered twice without any network calls', async () => {
    const fetchImpl = fakeFetch()
    await expect(planRoute('AB1 1AA', 'ab1 1aa', { fetchImpl })).rejects.toBeInstanceOf(RouteError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects postcodes more than 25 miles apart before downloading any roads', async () => {
    const fetchImpl = fakeFetch()
    await expect(planRoute('AB1 1AA', 'AB1 9ZZ', { fetchImpl, endpoints: ['https://x'] })).rejects.toThrow(/25 miles/)
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('surfaces an unknown postcode error', async () => {
    await expect(planRoute('AB1 1AA', 'ZZ9 9ZZ', { fetchImpl: fakeFetch(), endpoints: ['https://x'] })).rejects.toThrow(/wasn't found/)
  })

  it('reports an area with no drivable roads', async () => {
    const fetchImpl = fakeFetch({ elements: [] })
    await expect(planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl, endpoints: ['https://x'] })).rejects.toThrow(/No drivable roads/)
  })

  it('tells the UI when it falls back to a backup road-data server', async () => {
    const base = fakeFetch()
    let posts = 0
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST' && posts++ === 0) return new Response('', { status: 406 })
      return base(input, init)
    }
    const progress: [string, string | undefined][] = []
    await planRoute('AB1 1AA', 'AB1 1AB', {
      fetchImpl,
      endpoints: ['https://blocked', 'https://ok'],
      onProgress: (stage, detail) => progress.push([stage, detail]),
    })
    expect(progress).toContainEqual(['downloading', expect.stringMatching(/trying backup 1 of 1/)])
  })

  it('reuses downloaded road data for a repeat search of the same pair', async () => {
    const fetchImpl = fakeFetch()
    await planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl, endpoints: ['https://x'] })
    await planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl, endpoints: ['https://x'] })
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  })
})

describe('describeRoadStep', () => {
  it('describes steps with road names instead of internal ids', async () => {
    const route = await planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl: fakeFetch(), endpoints: ['https://x'] })
    const trace = dijkstra(route.road.graph, { startNodeId: route.startNodeId, endNodeId: route.endNodeId })
    const texts = trace.steps.map((s) => describeRoadStep(s, route.road))
    expect(texts[0]).toBe('Exploring from Main Street')
    expect(texts.some((t) => t.startsWith('Checking Main Street ('))).toBe(true)
    expect(texts.some((t) => t === 'Found a shorter way along Side Road')).toBe(true)
    expect(texts[texts.length - 1]).toMatch(/^Route found: /)
    for (const t of texts) expect(t).not.toMatch(/\bn\d+\b|\be\d+\b/)
  })

  it('explains a failed search in road terms', async () => {
    const route = await planRoute('AB1 1AA', 'AB1 1AB', { fetchImpl: fakeFetch(), endpoints: ['https://x'] })
    // n6 is a dead end for leaving (one-way streets), so routing out of it fails.
    const trace = dijkstra(route.road.graph, { startNodeId: 'n6', endNodeId: 'n1' })
    expect(describeRoadStep(trace.steps[trace.steps.length - 1], route.road)).toMatch(/one-way/)
  })
})
