import { beforeEach, describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import type { Graph } from '../../types'
import { usePlaybackStore } from '../playbackStore'

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
  usePlaybackStore.setState({ trace: null, currentStepIndex: -1, isPlaying: false, speed: 2 })
})

describe('playbackStore', () => {
  it('starts at index -1 and not playing when a trace is set', () => {
    usePlaybackStore.getState().setTrace(dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' }))
    const state = usePlaybackStore.getState()
    expect(state.currentStepIndex).toBe(-1)
    expect(state.isPlaying).toBe(false)
  })

  it('does nothing on play/step when there is no trace', () => {
    usePlaybackStore.getState().play()
    usePlaybackStore.getState().stepForward()
    expect(usePlaybackStore.getState().currentStepIndex).toBe(-1)
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })

  it('steps forward and backward within bounds', () => {
    usePlaybackStore.getState().setTrace(dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' }))
    usePlaybackStore.getState().stepBackward() // clamps at -1, does not go negative
    expect(usePlaybackStore.getState().currentStepIndex).toBe(-1)
    usePlaybackStore.getState().stepForward()
    expect(usePlaybackStore.getState().currentStepIndex).toBe(0)
    usePlaybackStore.getState().stepBackward()
    expect(usePlaybackStore.getState().currentStepIndex).toBe(-1)
  })

  it('stops playing automatically once the last step is reached', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    usePlaybackStore.getState().setTrace(trace)
    usePlaybackStore.getState().play()
    for (let i = 0; i < trace.steps.length; i++) {
      usePlaybackStore.getState().stepForward()
    }
    const state = usePlaybackStore.getState()
    expect(state.currentStepIndex).toBe(trace.steps.length - 1)
    expect(state.isPlaying).toBe(false)
  })

  it('refuses to play once already at the last step', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    usePlaybackStore.getState().setTrace(trace)
    usePlaybackStore.getState().jumpToStep(trace.steps.length - 1)
    usePlaybackStore.getState().play()
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })

  it('jumpToStep clamps to valid range', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    usePlaybackStore.getState().setTrace(trace)
    usePlaybackStore.getState().jumpToStep(9999)
    expect(usePlaybackStore.getState().currentStepIndex).toBe(trace.steps.length - 1)
    usePlaybackStore.getState().jumpToStep(-50)
    expect(usePlaybackStore.getState().currentStepIndex).toBe(-1)
  })

  it('reset rewinds to -1 but keeps the trace', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    usePlaybackStore.getState().setTrace(trace)
    usePlaybackStore.getState().jumpToStep(2)
    usePlaybackStore.getState().reset()
    const state = usePlaybackStore.getState()
    expect(state.currentStepIndex).toBe(-1)
    expect(state.trace).not.toBeNull()
  })

  it('clear drops the trace entirely', () => {
    usePlaybackStore.getState().setTrace(dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' }))
    usePlaybackStore.getState().clear()
    expect(usePlaybackStore.getState().trace).toBeNull()
  })

  it('clamps speed to the [0.25, 8] range', () => {
    usePlaybackStore.getState().setSpeed(100)
    expect(usePlaybackStore.getState().speed).toBe(8)
    usePlaybackStore.getState().setSpeed(0)
    expect(usePlaybackStore.getState().speed).toBe(0.25)
  })

  it('togglePlay flips isPlaying', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    usePlaybackStore.getState().setTrace(trace)
    usePlaybackStore.getState().togglePlay()
    expect(usePlaybackStore.getState().isPlaying).toBe(true)
    usePlaybackStore.getState().togglePlay()
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })
})
