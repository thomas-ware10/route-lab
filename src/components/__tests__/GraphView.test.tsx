import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('marks the start and end nodes with their rings', () => {
    const { container } = render(
      <GraphView graph={line()} visualState={EMPTY_VISUAL_STATE} startNodeId="A" endNodeId="B" />,
    )
    expect(container.querySelectorAll('.stroke-green-500').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.stroke-purple-500').length).toBeGreaterThan(0)
  })
})
