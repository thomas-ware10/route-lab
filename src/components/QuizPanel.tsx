import { useMemo, useState } from 'react'
import { COMPLEXITY, type AlgorithmId } from '../algorithms/complexity'
import { quizQuestionKind, quizQuestionText } from '../algorithms/quizDecisions'
import { requiresEndpoints, runAlgorithm } from '../algorithms/runAlgorithm'
import { deriveVisualState } from '../playback/deriveVisualState'
import { useGraphStore } from '../store/graphStore'
import { useQuizStore } from '../store/quizStore'
import { GraphView } from './GraphView'

const ALGORITHMS: AlgorithmId[] = ['dijkstra', 'astar', 'kruskal', 'prim']

export function QuizPanel() {
  const graph = useGraphStore((s) => s.graph)
  const startNodeId = useGraphStore((s) => s.startNodeId)
  const endNodeId = useGraphStore((s) => s.endNodeId)
  const pickMode = useGraphStore((s) => s.pickMode)
  const locked = useGraphStore((s) => s.locked)
  const setPickMode = useGraphStore((s) => s.setPickMode)
  const setLocked = useGraphStore((s) => s.setLocked)

  const trace = useQuizStore((s) => s.trace)
  const phase = useQuizStore((s) => s.phase)
  const pointer = useQuizStore((s) => s.pointer)
  const decisionIndices = useQuizStore((s) => s.decisionIndices)
  const guessId = useQuizStore((s) => s.guessId)
  const wasCorrect = useQuizStore((s) => s.wasCorrect)
  const score = useQuizStore((s) => s.score)
  const startQuiz = useQuizStore((s) => s.startQuiz)
  const submitGuess = useQuizStore((s) => s.submitGuess)
  const nextQuestion = useQuizStore((s) => s.nextQuestion)
  const resetQuiz = useQuizStore((s) => s.reset)

  const [algorithm, setAlgorithm] = useState<AlgorithmId>('dijkstra')
  const [error, setError] = useState<string | null>(null)

  const needsEndpoints = requiresEndpoints(algorithm)
  const nodeLabel = (id: string | null) => (id ? (graph.nodes.find((n) => n.id === id)?.label ?? id) : 'not set')
  const canStart =
    !locked && graph.nodes.length > 0 && (!needsEndpoints || (!!startNodeId && !!endNodeId && startNodeId !== endNodeId))

  function handleStart() {
    setError(null)
    try {
      const t = runAlgorithm({ algorithm, graph, startNodeId, endNodeId })
      const ok = startQuiz(t)
      if (!ok) {
        setError('This graph is too small for a meaningful quiz on this algorithm — try a bigger graph.')
        return
      }
      setLocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleExit() {
    resetQuiz()
    setLocked(false)
  }

  const stepIndex = phase === 'guessing' || phase === 'revealed' ? decisionIndices[pointer] : null
  const questionKind = trace ? quizQuestionKind(trace.algorithm) : null

  // Guessing: show state strictly BEFORE the decision, so the answer isn't
  // visible. Revealed: show state THROUGH the decision, so the correct
  // node/edge picks up the same amber "active" ring the live playback uses.
  const visualState = useMemo(() => {
    if (!trace || stepIndex === null) return deriveVisualState(null, -1)
    return deriveVisualState(trace, phase === 'revealed' ? stepIndex : stepIndex - 1)
  }, [trace, stepIndex, phase])

  const wrongGuessNodeId = phase === 'revealed' && wasCorrect === false && questionKind === 'node' ? guessId : null
  const wrongGuessEdgeId = phase === 'revealed' && wasCorrect === false && questionKind === 'edge' ? guessId : null

  function handleGuess(id: string) {
    if (phase !== 'guessing') return
    submitGuess(id)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Quiz mode</h2>
        <p className="text-xs text-slate-500">
          Predict the algorithm's next move before it's revealed. Free scrubbing is disabled in quiz mode on
          purpose — you only ever see the graph as it stood right before each decision, never ahead.
        </p>

        {phase === 'idle' && (
          <>
            <label className="flex flex-col gap-1 text-xs">
              Algorithm
              <select
                aria-label="Quiz algorithm"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as AlgorithmId)}
                className="border border-slate-300 rounded px-2 py-1"
              >
                {ALGORITHMS.map((id) => (
                  <option key={id} value={id}>
                    {COMPLEXITY[id].name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span>
                  Start: <strong>{nodeLabel(startNodeId)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setPickMode(pickMode === 'start' ? 'none' : 'start')}
                  aria-pressed={pickMode === 'start'}
                  className={`px-2 py-0.5 rounded border ${pickMode === 'start' ? 'bg-green-500 text-white border-green-600' : 'border-slate-300'}`}
                >
                  {pickMode === 'start' ? 'Click a node…' : 'Pick start'}
                </button>
              </div>
              {needsEndpoints && (
                <div className="flex items-center justify-between">
                  <span>
                    End: <strong>{nodeLabel(endNodeId)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickMode(pickMode === 'end' ? 'none' : 'end')}
                    aria-pressed={pickMode === 'end'}
                    className={`px-2 py-0.5 rounded border ${pickMode === 'end' ? 'bg-purple-500 text-white border-purple-600' : 'border-slate-300'}`}
                  >
                    {pickMode === 'end' ? 'Click a node…' : 'Pick end'}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!canStart}
              onClick={handleStart}
              className="w-full text-sm px-3 py-1.5 rounded bg-sky-600 text-white disabled:opacity-40 hover:bg-sky-700"
            >
              Start quiz
            </button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </>
        )}

        {phase !== 'idle' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">
              Score: <strong>{score.correct}</strong> / {score.total}
              {phase !== 'finished' && (
                <>
                  {' '}
                  &middot; Question {pointer + 1} of {decisionIndices.length}
                </>
              )}
            </span>
            <button type="button" onClick={handleExit} className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">
              Exit quiz
            </button>
          </div>
        )}
      </div>

      {trace && (phase === 'guessing' || phase === 'revealed') && (
        <div className="space-y-3">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
            <p className="text-sm font-medium text-slate-900" data-testid="quiz-question">
              {quizQuestionText(trace.algorithm)}
            </p>
            {phase === 'guessing' && (
              <p className="text-xs text-slate-500 mt-1">Click the {questionKind} you think comes next.</p>
            )}
          </div>

          <GraphView
            graph={graph}
            visualState={visualState}
            startNodeId={startNodeId}
            endNodeId={endNodeId}
            ariaLabel="Quiz graph view"
            onNodeClick={phase === 'guessing' && questionKind === 'node' ? handleGuess : undefined}
            onEdgeClick={phase === 'guessing' && questionKind === 'edge' ? handleGuess : undefined}
            wrongGuessNodeId={wrongGuessNodeId}
            wrongGuessEdgeId={wrongGuessEdgeId}
          />

          {phase === 'revealed' && stepIndex !== null && trace && (
            <div
              className={`p-3 rounded-lg border space-y-2 ${wasCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}
              data-testid="quiz-reveal"
            >
              <p className={`text-sm font-semibold ${wasCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                {wasCorrect ? 'Correct!' : 'Not quite.'}
              </p>
              <p className="text-xs text-slate-700">{trace.steps[stepIndex].description}</p>
              <button
                type="button"
                onClick={nextQuestion}
                className="text-sm px-3 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700"
              >
                Next question
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <div className="p-4 bg-white rounded-lg border border-slate-200 text-center space-y-2" data-testid="quiz-finished">
          <p className="text-sm font-semibold text-slate-900">Quiz complete!</p>
          <p className="text-2xl font-bold text-sky-600">
            {score.correct} / {score.total}
          </p>
          <button
            type="button"
            onClick={handleExit}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
          >
            Start a new quiz
          </button>
        </div>
      )}
    </div>
  )
}
