import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaybackControls } from '../PlaybackControls'
import { dijkstra } from '../../algorithms/dijkstra'
import type { Graph } from '../../types'
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
  usePlaybackStore.setState({ trace: null, currentStepIndex: -1, isPlaying: false, speed: 2 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PlaybackControls', () => {
  it('shows a placeholder message when there is no trace', () => {
    render(<PlaybackControls />)
    expect(screen.getByText(/Run an algorithm/)).toBeInTheDocument()
  })

  it('step forward/backward buttons move the index and respect bounds', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<PlaybackControls />)

    expect(screen.getByRole('button', { name: 'Step back' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Step forward' }))
    expect(usePlaybackStore.getState().currentStepIndex).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Step back' }))
    expect(usePlaybackStore.getState().currentStepIndex).toBe(-1)
  })

  it('disables step-forward and play once the last step is reached', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    act(() => usePlaybackStore.getState().jumpToStep(trace.steps.length - 1))
    render(<PlaybackControls />)
    expect(screen.getByRole('button', { name: 'Step forward' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })

  it('the scrubber jumps directly to a step', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<PlaybackControls />)

    fireEvent.change(screen.getByLabelText('Step scrubber'), { target: { value: '2' } })
    expect(usePlaybackStore.getState().currentStepIndex).toBe(2)
  })

  it('shows the current step description', () => {
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    act(() => usePlaybackStore.getState().jumpToStep(0))
    render(<PlaybackControls />)
    expect(screen.getByTestId('step-description').textContent).toBe(trace.steps[0].description)
  })

  it('clicking Play advances steps automatically over time', () => {
    vi.useFakeTimers()
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<PlaybackControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(usePlaybackStore.getState().isPlaying).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000 / usePlaybackStore.getState().speed)
    })
    expect(usePlaybackStore.getState().currentStepIndex).toBe(0)

    act(() => {
      vi.advanceTimersByTime(1000 / usePlaybackStore.getState().speed)
    })
    expect(usePlaybackStore.getState().currentStepIndex).toBe(1)
  })

  it('clicking Pause stops automatic advancement', () => {
    vi.useFakeTimers()
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<PlaybackControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    const indexAfterPause = usePlaybackStore.getState().currentStepIndex

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(usePlaybackStore.getState().currentStepIndex).toBe(indexAfterPause)
  })

  it('automatically stops playing once it reaches the final step', () => {
    vi.useFakeTimers()
    const trace = dijkstra(line(), { startNodeId: 'A', endNodeId: 'C' })
    act(() => usePlaybackStore.getState().setTrace(trace))
    render(<PlaybackControls />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => {
      vi.advanceTimersByTime((1000 / usePlaybackStore.getState().speed) * (trace.steps.length + 5))
    })
    expect(usePlaybackStore.getState().currentStepIndex).toBe(trace.steps.length - 1)
    expect(usePlaybackStore.getState().isPlaying).toBe(false)
  })
})
