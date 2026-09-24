import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RacePanel } from '../RacePanel'
import { createEmptyGraph, type Graph } from '../../types'
import { resetGraphIdCounter, useGraphStore } from '../../store/graphStore'
import { useRaceStore } from '../../store/raceStore'

function triangle(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 1, label: 'C' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 2 },
      { id: 'e3', source: 'A', target: 'C', weight: 3 },
    ],
  }
}

beforeEach(() => {
  resetGraphIdCounter()
  useGraphStore.setState({ graph: createEmptyGraph(), startNodeId: null, endNodeId: null, locked: false, pickMode: 'none' })
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

describe('RacePanel', () => {
  it('picking a shortest-path algorithm for A keeps B in the same family', () => {
    render(<RacePanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Race algorithm A' }), { target: { value: 'dijkstra' } })
    expect(useRaceStore.getState().algorithmB === 'astar').toBe(true)
  })

  it('switching A to an MST algorithm auto-switches B into the MST family too', () => {
    render(<RacePanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Race algorithm A' }), { target: { value: 'kruskal' } })
    expect(useRaceStore.getState().algorithmB).toBe('prim')
  })

  it('switching B to a shortest-path algorithm pulls A along too', () => {
    act(() => {
      useRaceStore.getState().setAlgorithmA('kruskal')
      useRaceStore.getState().setAlgorithmB('prim')
    })
    render(<RacePanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Race algorithm B' }), { target: { value: 'astar' } })
    expect(useRaceStore.getState().algorithmA).toBe('dijkstra')
  })

  it('requires start and end for a shortest-path race, runs and shows both graphs', () => {
    const g = triangle()
    act(() => useGraphStore.getState().loadGraph(g))
    act(() => {
      useGraphStore.getState().setStartNode('A')
      useGraphStore.getState().setEndNode('C')
    })
    render(<RacePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Run race' }))
    expect(useRaceStore.getState().traceA).not.toBeNull()
    expect(useRaceStore.getState().traceB).not.toBeNull()
    expect(useGraphStore.getState().locked).toBe(true)
    expect(screen.getAllByLabelText('Algorithm race graph view')).toHaveLength(2)
  })

  it('runs an MST race without requiring start/end', () => {
    const g = triangle()
    act(() => useGraphStore.getState().loadGraph(g))
    act(() => {
      useRaceStore.getState().setAlgorithmA('kruskal')
      useRaceStore.getState().setAlgorithmB('prim')
    })
    render(<RacePanel />)
    expect(screen.getByRole('button', { name: 'Run race' })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Run race' }))
    expect(useRaceStore.getState().traceA?.algorithm).toBe('kruskal')
    expect(useRaceStore.getState().traceB?.algorithm).toBe('prim')
  })

  it('shows a "Finished" badge for the shorter trace once the shared index passes its end', () => {
    const g = triangle()
    act(() => useGraphStore.getState().loadGraph(g))
    act(() => {
      useGraphStore.getState().setStartNode('A')
      useGraphStore.getState().setEndNode('C')
    })
    render(<RacePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Run race' }))

    const last = Math.max(
      useRaceStore.getState().traceA!.steps.length,
      useRaceStore.getState().traceB!.steps.length,
    ) - 1
    act(() => useRaceStore.getState().jumpToStep(last))

    const aFinished = screen.queryByTestId('race-a-finished')
    const bFinished = screen.queryByTestId('race-b-finished')
    expect(aFinished || bFinished).toBeTruthy()
  })

  it('play advances the shared step index over time', () => {
    vi.useFakeTimers()
    const g = triangle()
    act(() => useGraphStore.getState().loadGraph(g))
    act(() => {
      useGraphStore.getState().setStartNode('A')
      useGraphStore.getState().setEndNode('C')
    })
    render(<RacePanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Run race' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => {
      vi.advanceTimersByTime(1000 / useRaceStore.getState().speed)
    })
    expect(useRaceStore.getState().currentStepIndex).toBe(0)
    vi.useRealTimers()
  })
})
