import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GraphCanvas, CANVAS_WIDTH, CANVAS_HEIGHT } from '../GraphCanvas'
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

  // Coordinate math assumes the rendered SVG matches the viewBox 1:1.
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: CANVAS_WIDTH,
    bottom: CANVAS_HEIGHT,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    toJSON: () => {},
  })
})

function clickBackground(x: number, y: number) {
  const bg = screen.getByTestId('graph-canvas-background')
  fireEvent.mouseDown(bg, { clientX: x, clientY: y })
  fireEvent.mouseUp(bg, { clientX: x, clientY: y })
}

function dragNode(nodeTestId: string, from: [number, number], to: [number, number]) {
  const node = screen.getByTestId(nodeTestId)
  fireEvent.mouseDown(node, { clientX: from[0], clientY: from[1] })
  fireEvent.mouseMove(window, { clientX: to[0], clientY: to[1] })
  fireEvent.mouseUp(window, { clientX: to[0], clientY: to[1] })
}

describe('GraphCanvas', () => {
  it('adds a node when clicking empty background', () => {
    render(<GraphCanvas />)
    expect(useGraphStore.getState().graph.nodes).toHaveLength(0)
    clickBackground(100, 100)
    expect(useGraphStore.getState().graph.nodes).toHaveLength(1)
  })

  it('does not add a node while locked', () => {
    useGraphStore.setState({ locked: true })
    render(<GraphCanvas />)
    clickBackground(100, 100)
    expect(useGraphStore.getState().graph.nodes).toHaveLength(0)
  })

  it('creates an edge by dragging from one node to another', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    const b = useGraphStore.getState().addNode(300, 100)
    render(<GraphCanvas />)

    dragNode(`node-${a}`, [100, 100], [300, 100])

    const state = useGraphStore.getState()
    expect(state.graph.edges).toHaveLength(1)
    expect(state.graph.edges[0]).toMatchObject({ source: a, target: b, weight: 1 })
  })

  it('moves a node when dragging it onto empty space', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    render(<GraphCanvas />)

    dragNode(`node-${a}`, [100, 100], [400, 300])

    const node = useGraphStore.getState().graph.nodes.find((n) => n.id === a)!
    expect(node.x).toBeCloseTo(400)
    expect(node.y).toBeCloseTo(300)
  })

  it('does not move or connect nodes while locked', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    const b = useGraphStore.getState().addNode(300, 100)
    useGraphStore.setState({ locked: true })
    render(<GraphCanvas />)

    dragNode(`node-${a}`, [100, 100], [300, 100])

    expect(useGraphStore.getState().graph.edges).toHaveLength(0)
    const node = useGraphStore.getState().graph.nodes.find((n) => n.id === a)!
    expect(node.x).toBe(100)
    void b
  })

  it('a plain click (no drag) on a node in start-pick mode sets it as the start node', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    useGraphStore.getState().setPickMode('start')
    render(<GraphCanvas />)

    const node = screen.getByTestId(`node-${a}`)
    fireEvent.mouseDown(node, { clientX: 100, clientY: 100 })
    fireEvent.mouseUp(window, { clientX: 100, clientY: 100 })

    expect(useGraphStore.getState().startNodeId).toBe(a)
    expect(useGraphStore.getState().pickMode).toBe('none')
  })

  it('removes a node on right-click', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    render(<GraphCanvas />)
    fireEvent.contextMenu(screen.getByTestId(`node-${a}`))
    expect(useGraphStore.getState().graph.nodes).toHaveLength(0)
  })

  it('removes an edge on right-click', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    const b = useGraphStore.getState().addNode(300, 100)
    const edgeId = useGraphStore.getState().addEdge(a, b, 5)!
    render(<GraphCanvas />)
    fireEvent.contextMenu(screen.getByTestId(`edge-${edgeId}`))
    expect(useGraphStore.getState().graph.edges).toHaveLength(0)
  })

  it('edits an edge weight inline: click reveals an input, Enter commits', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    const b = useGraphStore.getState().addNode(300, 100)
    const edgeId = useGraphStore.getState().addEdge(a, b, 5)!
    render(<GraphCanvas />)

    fireEvent.click(screen.getByTestId(`edge-${edgeId}`))
    const input = screen.getByTestId(`edge-weight-input-${edgeId}`)
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(useGraphStore.getState().graph.edges[0].weight).toBe(42)
  })

  it('cancels an edge weight edit on Escape without committing', () => {
    const a = useGraphStore.getState().addNode(100, 100)
    const b = useGraphStore.getState().addNode(300, 100)
    const edgeId = useGraphStore.getState().addEdge(a, b, 5)!
    render(<GraphCanvas />)

    fireEvent.click(screen.getByTestId(`edge-${edgeId}`))
    const input = screen.getByTestId(`edge-weight-input-${edgeId}`)
    fireEvent.change(input, { target: { value: '999' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(useGraphStore.getState().graph.edges[0].weight).toBe(5)
  })
})
