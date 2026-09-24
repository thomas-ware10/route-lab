import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComparisonPanel } from '../ComparisonPanel'

describe('ComparisonPanel', () => {
  it('shows no table until a comparison has been run', () => {
    render(<ComparisonPanel />)
    expect(screen.queryByTestId('comparison-table')).not.toBeInTheDocument()
  })

  it('runs a comparison and populates the table for the default (dijkstra) algorithm', () => {
    render(<ComparisonPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
    expect(screen.getByTestId('comparison-table')).toBeInTheDocument()
    expect(screen.getByTestId('compare-sparse-totalOperations')).toBeInTheDocument()
    expect(screen.getByTestId('compare-dense-totalOperations')).toBeInTheDocument()
  })

  it('the dense graph has more edges than the sparse graph', () => {
    render(<ComparisonPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
    const table = screen.getByTestId('comparison-table')
    const rows = table.querySelectorAll('tbody tr')
    const edgeRow = Array.from(rows).find((r) => r.textContent?.startsWith('Edges'))!
    const cells = edgeRow.querySelectorAll('td')
    const sparseEdges = Number(cells[1].textContent)
    const denseEdges = Number(cells[2].textContent)
    expect(denseEdges).toBeGreaterThan(sparseEdges)
  })

  it('works for kruskal (no start/end endpoints required)', () => {
    render(<ComparisonPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Comparison algorithm' }), {
      target: { value: 'kruskal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
    expect(screen.getByTestId('comparison-table')).toBeInTheDocument()
  })

  it('respects a custom node count', () => {
    render(<ComparisonPanel />)
    fireEvent.change(screen.getByLabelText('Comparison node count'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run comparison' }))
    const table = screen.getByTestId('comparison-table')
    const rows = table.querySelectorAll('tbody tr')
    const nodeRow = Array.from(rows).find((r) => r.textContent?.startsWith('Nodes'))!
    const cells = nodeRow.querySelectorAll('td')
    expect(cells[1].textContent).toBe('12')
    expect(cells[2].textContent).toBe('12')
  })
})
