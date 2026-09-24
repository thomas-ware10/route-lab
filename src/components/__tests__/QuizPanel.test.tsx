import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { QuizPanel } from '../QuizPanel'
import { createEmptyGraph, type Graph } from '../../types'
import { resetGraphIdCounter, useGraphStore } from '../../store/graphStore'
import { useQuizStore } from '../../store/quizStore'

function diamond(): Graph {
  return {
    mode: 'undirected',
    nodes: [
      { id: 'A', x: 0, y: 0, label: 'A' },
      { id: 'B', x: 1, y: 0, label: 'B' },
      { id: 'C', x: 0, y: 1, label: 'C' },
      { id: 'D', x: 1, y: 1, label: 'D' },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 2 },
      { id: 'e2', source: 'A', target: 'C', weight: 1 },
      { id: 'e3', source: 'B', target: 'D', weight: 1 },
      { id: 'e4', source: 'C', target: 'D', weight: 5 },
    ],
  }
}

beforeEach(() => {
  resetGraphIdCounter()
  useGraphStore.setState({ graph: createEmptyGraph(), startNodeId: null, endNodeId: null, locked: false, pickMode: 'none' })
  useQuizStore.getState().reset()
})

describe('QuizPanel', () => {
  it('disables Start quiz for a node-based algorithm until start/end are set', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    expect(screen.getByRole('button', { name: 'Start quiz' })).toBeDisabled()

    act(() => {
      useGraphStore.getState().setStartNode('A')
      useGraphStore.getState().setEndNode('D')
    })
    expect(screen.getByRole('button', { name: 'Start quiz' })).not.toBeDisabled()
  })

  it('enables Start quiz for an MST algorithm without start/end', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    expect(screen.getByRole('button', { name: 'Start quiz' })).not.toBeDisabled()
  })

  it('starting a quiz locks the graph and shows the first question', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))

    expect(useGraphStore.getState().locked).toBe(true)
    expect(screen.getByTestId('quiz-question')).toHaveTextContent(/edge/i)
  })

  it('clicking the correct edge reveals a correct verdict and increments the score', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))

    // The lowest-weight edge (e2, weight 1) is always Kruskal's first pick.
    fireEvent.click(screen.getByTestId('quiz-edge-hit-e2'))

    expect(screen.getByTestId('quiz-reveal')).toHaveTextContent('Correct!')
    expect(useQuizStore.getState().score).toEqual({ correct: 1, total: 1 })
  })

  it('clicking a wrong edge reveals an incorrect verdict with an explanation', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))

    // e4 (weight 5) is never the first edge Kruskal accepts.
    fireEvent.click(screen.getByTestId('quiz-edge-hit-e4'))

    expect(screen.getByTestId('quiz-reveal')).toHaveTextContent('Not quite.')
    expect(useQuizStore.getState().score).toEqual({ correct: 0, total: 1 })
  })

  it('Next question advances to question 2 and clears the reveal', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))
    fireEvent.click(screen.getByTestId('quiz-edge-hit-e2'))
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))

    expect(screen.queryByTestId('quiz-reveal')).not.toBeInTheDocument()
    expect(useQuizStore.getState().pointer).toBe(1)
  })

  it('finishing all questions shows the final score and exiting unlocks the graph', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))

    const total = useQuizStore.getState().decisionIndices.length
    for (let i = 0; i < total; i++) {
      const edgeButtons = screen.getAllByTestId(/quiz-edge-hit-/)
      fireEvent.click(edgeButtons[0])
      fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    }

    expect(screen.getByTestId('quiz-finished')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new quiz' }))
    expect(useGraphStore.getState().locked).toBe(false)
  })

  it('Exit quiz mid-run resets the store and unlocks the graph', () => {
    act(() => useGraphStore.getState().loadGraph(diamond()))
    render(<QuizPanel />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Quiz algorithm' }), { target: { value: 'kruskal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit quiz' }))

    expect(useGraphStore.getState().locked).toBe(false)
    expect(useQuizStore.getState().phase).toBe('idle')
  })
})
