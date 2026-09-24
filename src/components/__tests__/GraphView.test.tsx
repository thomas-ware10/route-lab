import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GraphView } from '../GraphView'
import { EMPTY_VISUAL_STATE } from '../../playback/deriveVisualState'
import type { Graph } from '../../types'

function line(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 100, y: 100, label: 'A' },
      { id: 'B', x: 300, y: 100, label: 'B' },
    ],
    edges: [{ id: 'e1', source: 'A', target: 'B', weight: 3 }],
  }
}

describe('GraphView', () => {
  it('renders every node and edge with no interactive handlers', () => {
    render(<GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} />)
    expect(screen.getByTestId('race-node-A')).toBeInTheDocument()
    expect(screen.getByTestId('race-node-B')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('applies the finalized fill to a finalized node', () => {
    render(
      <GraphView graph={line()} visualState={{ nodes: { A: 'finalized' }, edges: {} }} />,
    )
    expect(screen.getByTestId('race-node-A')).toHaveClass('fill-sky-600')
  })

  it('applies the path fill to nodes/edges on the final result', () => {
    render(<GraphView graph={line()} visualState={{ nodes: { A: 'path', B: 'path' }, edges: { e1: 'path' } }} />)
    expect(screen.getByTestId('race-node-A')).toHaveClass('fill-emerald-500')
  })

  it('calls onNodeClick with the clicked node id when provided', () => {
    const onNodeClick = vi.fn()
    render(<GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} onNodeClick={onNodeClick} />)
    fireEvent.click(screen.getByTestId('race-node-B'))
    expect(onNodeClick).toHaveBeenCalledWith('B')
  })

  it('calls onEdgeClick with the clicked edge id when provided', () => {
    const onEdgeClick = vi.fn()
    render(<GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} onEdgeClick={onEdgeClick} />)
    fireEvent.click(screen.getByTestId('quiz-edge-hit-e1'))
    expect(onEdgeClick).toHaveBeenCalledWith('e1')
  })

  it('does not render an edge hit-area when onEdgeClick is not provided', () => {
    render(<GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} />)
    expect(screen.queryByTestId('quiz-edge-hit-e1')).not.toBeInTheDocument()
  })

  it('marks the start and end nodes with their rings', () => {
    const { container } = render(
      <GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} startNodeId="A" endNodeId="B" />,
    )
    expect(container.querySelectorAll('.stroke-green-500').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.stroke-purple-500').length).toBeGreaterThan(0)
  })

  it('marks a wrong-guess node with a distinct rose ring', () => {
    const { container } = render(
      <GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} wrongGuessNodeId="A" />,
    )
    expect(container.querySelectorAll('.stroke-rose-500').length).toBeGreaterThan(0)
  })

  it('marks a wrong-guess edge with a distinct rose overlay', () => {
    const { container } = render(
      <GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} wrongGuessEdgeId="e1" />,
    )
    expect(container.querySelectorAll('.stroke-rose-500').length).toBeGreaterThan(0)
  })
})
