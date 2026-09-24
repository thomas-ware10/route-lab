import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { StatsPanel } from '../StatsPanel'
import { dijkstra } from '../../algorithms/dijkstra'
import { createEmptyGraph, type Graph } from '../../types'
import { resetGraphIdCounter, useGraphStore } from '../../store/graphStore'
import { usePlaybackStore } from '../../store/playbackStore'

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
  resetGraphIdCounter()
  useGraphStore.setState({ graph: createEmptyGraph(), startNodeId: null, endNodeId: null, locked: false, pickMode: 'none' })
  usePlaybackStore.setState({ trace: null, currentStepIndex: -1, isPlaying: false, speed: 2 })
})

describe('StatsPanel', () => {
  it('shows zeroed stats before any algorithm has run', () => {
    render(<StatsPanel />)
    expect(screen.getByTestId('stat-totalOperations').textContent).toBe('0')
  })

  it('shows the stats snapshot for the current step, not the final totals', () => {
    const g = line()
    act(() => useGraphStore.getState().loadGraph(g))
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' })
    act(() => {
      usePlaybackStore.getState().setTrace(trace)
      usePlaybackStore.getState().jumpToStep(1)
    })
    render(<StatsPanel />)
    expect(screen.getByTestId('stat-totalOperations').textContent).toBe(String(trace.steps[1].stats.totalOperations))
  })

  it('shows the final cumulative stats at the last step', () => {
    const g = line()
    act(() => useGraphStore.getState().loadGraph(g))
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' })
    act(() => {
      usePlaybackStore.getState().setTrace(trace)
      usePlaybackStore.getState().jumpToStep(trace.steps.length - 1)
    })
    render(<StatsPanel />)
    const finalStats = trace.steps[trace.steps.length - 1].stats
    expect(screen.getByTestId('stat-totalOperations').textContent).toBe(String(finalStats.totalOperations))
    expect(screen.getByTestId('stat-nodesVisited').textContent).toBe(String(finalStats.nodesVisited))
  })

  it('shows a theoretical estimate once a trace exists', () => {
    const g = line()
    act(() => useGraphStore.getState().loadGraph(g))
    const trace = dijkstra(g, { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<StatsPanel />)
    expect(screen.getByTestId('theoretical-estimate')).toBeInTheDocument()
  })
})
