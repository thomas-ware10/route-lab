import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeFetch } from '../../../roads/__tests__/fixtures'
import { clearRoadDataCache } from '../../../roads/planRoute'
import { useRoadStore } from '../../../store/roadStore'
import { RoadsPanel } from '../RoadsPanel'

// Leaflet needs a real canvas/layout engine; the map layer's logic is covered by
// SegmentStateTracker's tests, so here we only check the panel around it.
vi.mock('../RoadMap', () => ({
  RoadMap: (props: { index: number }) => <div data-testid="road-map" data-index={props.index} />,
}))

beforeEach(() => {
  clearRoadDataCache()
  vi.stubGlobal('fetch', fakeFetch())
  useRoadStore.setState({
    fromInput: '',
    toInput: '',
    algorithm: 'dijkstra',
    status: 'idle',
    error: null,
    route: null,
    trace: null,
    runs: {},
    index: -1,
    isPlaying: false,
    durationSeconds: 15,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function searchAndPause(from = 'AB1 1AA', to = 'AB1 1AB') {
  fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('To postcode'), { target: { value: to } })
  fireEvent.click(screen.getByRole('button', { name: 'Find route' }))
  await waitFor(() => expect(useRoadStore.getState().status).toBe('ready'))
  act(() => useRoadStore.getState().pause())
}

describe('RoadsPanel', () => {
  it('keeps Find route disabled until both inputs look like UK postcodes', () => {
    render(<RoadsPanel />)
    const button = screen.getByRole('button', { name: 'Find route' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: 'hello' } })
    fireEvent.change(screen.getByLabelText('To postcode'), { target: { value: 'SE1 7PB' } })
    expect(button).toBeDisabled()
    expect(screen.getByLabelText('From postcode')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: 'sw1a1aa' } })
    expect(button).not.toBeDisabled()
  })

  it('swaps the two postcodes', () => {
    render(<RoadsPanel />)
    fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: 'AB1 1AA' } })
    fireEvent.change(screen.getByLabelText('To postcode'), { target: { value: 'AB1 1AB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Swap postcodes' }))
    expect(screen.getByLabelText('From postcode')).toHaveValue('AB1 1AB')
    expect(screen.getByLabelText('To postcode')).toHaveValue('AB1 1AA')
  })

  it('shows progress while working, then the playback bar and network stats', async () => {
    render(<RoadsPanel />)
    fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: 'AB1 1AA' } })
    fireEvent.change(screen.getByLabelText('To postcode'), { target: { value: 'AB1 1AB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find route' }))

    expect(await screen.findByTestId('road-status')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('road-playback')).toBeInTheDocument())
    expect(screen.queryByTestId('road-status')).not.toBeInTheDocument()
    expect(screen.getByTestId('road-stat-junctions')).toHaveTextContent('6')
  })

  it('describes the current step in road names', async () => {
    render(<RoadsPanel />)
    await searchAndPause()
    act(() => useRoadStore.getState().seek(0))
    expect(screen.getByTestId('road-step')).toHaveTextContent('Exploring from Main Street')
  })

  it('reveals the route card (distance + roads) only once playback reaches the end', async () => {
    render(<RoadsPanel />)
    await searchAndPause()
    expect(screen.queryByTestId('road-route')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Skip to end' }))
    const card = screen.getByTestId('road-route')
    expect(card).toHaveTextContent('Main Street')
    expect(card).toHaveTextContent('Side Road')
    expect(screen.getByTestId('road-route-distance')).toHaveTextContent(/m$/)
  })

  it('shows a Dijkstra-vs-A* comparison after switching algorithm on the same roads', async () => {
    render(<RoadsPanel />)
    await searchAndPause()
    expect(screen.queryByTestId('road-comparison')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Road algorithm' }), { target: { value: 'astar' } })
    expect(screen.getByTestId('road-comparison')).toHaveTextContent(/A\* explored/)
  })

  it('shows lookup errors as an alert', async () => {
    render(<RoadsPanel />)
    fireEvent.change(screen.getByLabelText('From postcode'), { target: { value: 'AB1 1AA' } })
    fireEvent.change(screen.getByLabelText('To postcode'), { target: { value: 'ZZ9 9ZZ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find route' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/wasn't found/)
  })

  it('passes the scrubber position through to the map', async () => {
    render(<RoadsPanel />)
    await searchAndPause()
    fireEvent.change(screen.getByLabelText('Road search scrubber'), { target: { value: '3' } })
    expect(screen.getByTestId('road-map')).toHaveAttribute('data-index', '3')
  })
})
