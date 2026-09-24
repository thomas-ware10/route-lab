import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { WarningBanner } from '../WarningBanner'
import { dijkstra } from '../../algorithms/dijkstra'
import type { Graph } from '../../types'
import { usePlaybackStore } from '../../store/playbackStore'

beforeEach(() => {
  usePlaybackStore.setState({ trace: null, currentStepIndex: -1, isPlaying: false, speed: 2 })
})

describe('WarningBanner', () => {
  it('renders nothing when there is no trace', () => {
    render(<WarningBanner />)
    expect(screen.queryByTestId('warning-banner')).not.toBeInTheDocument()
  })

  it('renders nothing when the trace has no warnings', () => {
    const g: Graph = {
      mode: 'undirected',
      nodes: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 1, y: 0, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'A', target: 'B', weight: 1 }],
    }
    act(() => usePlaybackStore.getState().setTrace(dijkstra(g, { startNodeId: 'A', endNodeId: 'B' })))
    render(<WarningBanner />)
    expect(screen.queryByTestId('warning-banner')).not.toBeInTheDocument()
  })

  it('renders a negative-weight warning', () => {
    const g: Graph = {
      mode: 'undirected',
      nodes: [
        { id: 'A', x: 0, y: 0, label: 'A' },
        { id: 'B', x: 1, y: 0, label: 'B' },
      ],
      edges: [{ id: 'e1', source: 'A', target: 'B', weight: -5 }],
    }
    act(() => usePlaybackStore.getState().setTrace(dijkstra(g, { startNodeId: 'A', endNodeId: 'B' })))
    render(<WarningBanner />)
    expect(screen.getByRole('alert')).toHaveTextContent(/negative/i)
  })
})
