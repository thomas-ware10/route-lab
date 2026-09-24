import { beforeEach, describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import { kruskal } from '../../algorithms/kruskal'
import type { Graph } from '../../types'
import { useRaceStore } from '../raceStore'

function line(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 2, y: 0, label: 'C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
    ],
  }
}

beforeEach(() => {
  useRaceStore.setState({
    algorithmA: 'dijkstra',
    algorithmB: 'astar',
    traceA: null,
    traceB: null,
    currentStepIndex: -1,
    isPlaying: false,
    speed: 2,
  })
})

describe('raceStore', () => {
  it('the shared index advances up to the LONGER trace length, not the shorter one', () => {
    const g = line()
    const shortTrace = kruskal(g) // few steps
    const longTrace = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' }) // more steps typically
    useRaceStore.getState().setTraces(longTrace, shortTrace)

    for (let i = 0; i < longTrace.steps.length; i++) {
      useRaceStore.getState().stepForward()
    }
    expect(useRaceStore.getState().currentStepIndex).toBe(
      Math.max(longTrace.steps.length, shortTrace.steps.length) - 1,
    )
  })

  it('stops playing automatically once both traces have reached their end', () => {
    const g = line()
    const traceA = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' })
    const traceB = kruskal(g)
    useRaceStore.getState().setTraces(traceA, traceB)
    useRaceStore.getState().play()

    const last = Math.max(traceA.steps.length, traceB.steps.length) - 1
    for (let i = 0; i <= last; i++) useRaceStore.getState().stepForward()

    expect(useRaceStore.getState().currentStepIndex).toBe(last)
    expect(useRaceStore.getState().isPlaying).toBe(false)
  })

  it('does nothing on play/step when traces are not both set', () => {
    useRaceStore.getState().play()
    useRaceStore.getState().stepForward()
    expect(useRaceStore.getState().currentStepIndex).toBe(-1)
    expect(useRaceStore.getState().isPlaying).toBe(false)
  })

  it('jumpToStep clamps to the combined valid range', () => {
    const g = line()
    const traceA = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' })
    const traceB = kruskal(g)
    useRaceStore.getState().setTraces(traceA, traceB)
    const last = Math.max(traceA.steps.length, traceB.steps.length) - 1

    useRaceStore.getState().jumpToStep(9999)
    expect(useRaceStore.getState().currentStepIndex).toBe(last)
    useRaceStore.getState().jumpToStep(-50)
    expect(useRaceStore.getState().currentStepIndex).toBe(-1)
  })

  it('clear drops both traces', () => {
    const g = line()
    useRaceStore.getState().setTraces(dijkstra(g, { startNodeId: 'A', endNodeId: 'C' }), kruskal(g))
    useRaceStore.getState().clear()
    expect(useRaceStore.getState().traceA).toBeNull()
    expect(useRaceStore.getState().traceB).toBeNull()
  })

  it('setAlgorithmA/B update the selected algorithms', () => {
    useRaceStore.getState().setAlgorithmA('astar')
    useRaceStore.getState().setAlgorithmB('dijkstra')
    expect(useRaceStore.getState().algorithmA).toBe('astar')
    expect(useRaceStore.getState().algorithmB).toBe('dijkstra')
  })
})
