import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ControlPanel } from '../ControlPanel'
import { createEmptyGraph } from '../../types'
import { resetGraphIdCounter, useGraphStore } from '../../store/graphStore'
import { usePlaybackStore } from '../../store/playbackStore'

beforeEach(() => {
  resetGraphIdCounter()
  useGraphStore.setState({
    graph: createEmptyGraph(),
    startNodeId: null,
    endNodeId: null,
    locked: false,
    pickMode: 'none',
  })
  usePlaybackStore.setState({ trace: null, currentStepIndex: -1, isPlaying: false, speed: 2 })
})

describe('ControlPanel', () => {
  it('disables Run for dijkstra until both start and end nodes are set', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    useGraphStore.getState().addEdge(a, b, 1)
    render(<ControlPanel />)

    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()

    act(() => {
      useGraphStore.getState().setStartNode(a)
      useGraphStore.getState().setEndNode(b)
    })
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled()
  })

  it('enables Run for kruskal with no start/end selection needed', () => {
    useGraphStore.getState().addNode(0, 0)
    render(<ControlPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Algorithm' }), { target: { value: 'kruskal' } })
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled()
  })

  it('toggles pick-start mode and reflects the picked node label after a pick', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    render(<ControlPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Pick start' }))
    expect(useGraphStore.getState().pickMode).toBe('start')

    act(() => {
      useGraphStore.getState().pickNode(a)
    })
    const label = useGraphStore.getState().graph.nodes.find((n) => n.id === a)!.label
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('running an algorithm locks the graph, and Edit graph unlocks it', () => {
    const a = useGraphStore.getState().addNode(0, 0)
    const b = useGraphStore.getState().addNode(1, 1)
    useGraphStore.getState().addEdge(a, b, 1)
    useGraphStore.getState().setStartNode(a)
    useGraphStore.getState().setEndNode(b)
    render(<ControlPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(useGraphStore.getState().locked).toBe(true)
    expect(usePlaybackStore.getState().trace).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit graph' }))
    expect(useGraphStore.getState().locked).toBe(false)
    expect(usePlaybackStore.getState().trace).toBeNull()
  })

  it('clears the graph', () => {
    useGraphStore.getState().addNode(0, 0)
    render(<ControlPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear graph' }))
    expect(useGraphStore.getState().graph.nodes).toHaveLength(0)
  })

  it('generates a random graph with the requested node count', () => {
    render(<ControlPanel />)
    fireEvent.change(screen.getByLabelText('Nodes'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate random graph' }))
    expect(useGraphStore.getState().graph.nodes).toHaveLength(8)
  })

  it('clamps generated node count to the 3-30 range', () => {
    render(<ControlPanel />)
    fireEvent.change(screen.getByLabelText('Nodes'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate random graph' }))
    expect(useGraphStore.getState().graph.nodes).toHaveLength(30)
  })

  it('applies a custom weight range to generated edges', () => {
    render(<ControlPanel />)
    fireEvent.change(screen.getByLabelText('Nodes'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Minimum weight'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Maximum weight'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate random graph' }))
    const edges = useGraphStore.getState().graph.edges
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.weight === 5)).toBe(true)
  })

  it('disables all controls while locked', () => {
    useGraphStore.setState({ locked: true })
    render(<ControlPanel />)
    expect(screen.getByRole('combobox', { name: 'Algorithm' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear graph' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generate random graph' })).toBeDisabled()
  })
})
