import { useState } from 'react'
import { COMPLEXITY, type AlgorithmId } from '../algorithms/complexity'
import { generateRandomGraph } from '../algorithms/randomGraph'
import { requiresEndpoints, runAlgorithm } from '../algorithms/runAlgorithm'
import { useGraphStore } from '../store/graphStore'
import { usePlaybackStore } from '../store/playbackStore'

const ALGORITHMS: AlgorithmId[] = ['dijkstra', 'astar', 'kruskal', 'prim']

export function ControlPanel() {
  const graph = useGraphStore((s) => s.graph)
  const startNodeId = useGraphStore((s) => s.startNodeId)
  const endNodeId = useGraphStore((s) => s.endNodeId)
  const pickMode = useGraphStore((s) => s.pickMode)
  const locked = useGraphStore((s) => s.locked)
  const setMode = useGraphStore((s) => s.setMode)
  const setPickMode = useGraphStore((s) => s.setPickMode)
  const setLocked = useGraphStore((s) => s.setLocked)
  const doClearGraph = useGraphStore((s) => s.clearGraph)
  const loadGraph = useGraphStore((s) => s.loadGraph)

  const setTrace = usePlaybackStore((s) => s.setTrace)
  const clearTrace = usePlaybackStore((s) => s.clear)

  const [algorithm, setAlgorithm] = useState<AlgorithmId>('dijkstra')
  const [error, setError] = useState<string | null>(null)
  const [randomNodeCount, setRandomNodeCount] = useState(10)
  const [randomDensity, setRandomDensity] = useState(0.3)
  const [randomMinWeight, setRandomMinWeight] = useState(1)
  const [randomMaxWeight, setRandomMaxWeight] = useState(20)

  const nodeLabel = (id: string | null) => (id ? (graph.nodes.find((n) => n.id === id)?.label ?? id) : 'not set')

  function handleRun() {
    setError(null)
    try {
      const trace = runAlgorithm({ algorithm, graph, startNodeId, endNodeId })
      setTrace(trace)
      setLocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleReset() {
    clearTrace()
    setLocked(false)
  }

  function handleGenerateRandom() {
    const nodeCount = Math.min(30, Math.max(3, randomNodeCount))
    const minWeight = Math.min(randomMinWeight, randomMaxWeight)
    const maxWeight = Math.max(randomMinWeight, randomMaxWeight)
    const g = generateRandomGraph({
      nodeCount,
      density: randomDensity,
      mode: graph.mode,
      width: 900,
      height: 540,
      minWeight,
      maxWeight,
    })
    loadGraph(g)
    clearTrace()
    setLocked(false)
  }

  const needsEndpoints = requiresEndpoints(algorithm)
  const canRun = !locked && (algorithm === 'kruskal' || (algorithm === 'prim' && graph.nodes.length > 0) || (needsEndpoints && !!startNodeId && !!endNodeId && startNodeId !== endNodeId))

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-slate-200">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Graph</h2>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-slate-600" htmlFor="mode-select">
            Edge type
          </label>
          <select
            id="mode-select"
            value={graph.mode}
            disabled={locked}
            onChange={(e) => setMode(e.target.value as 'directed' | 'undirected')}
            className="text-xs border border-slate-300 rounded px-2 py-1"
          >
            <option value="undirected">Undirected</option>
            <option value="directed">Directed</option>
          </select>
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={doClearGraph}
          className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          Clear graph
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Algorithm</h2>
        <select
          aria-label="Algorithm"
          value={algorithm}
          disabled={locked}
          onChange={(e) => setAlgorithm(e.target.value as AlgorithmId)}
          className="w-full text-sm border border-slate-300 rounded px-2 py-1 mb-2"
        >
          {ALGORITHMS.map((id) => (
            <option key={id} value={id}>
              {COMPLEXITY[id].name} — {COMPLEXITY[id].bigO}
            </option>
          ))}
        </select>

        {needsEndpoints && (
          <div className="flex flex-col gap-1 mb-2 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span>
                Start: <strong>{nodeLabel(startNodeId)}</strong>
              </span>
              <button
                type="button"
                disabled={locked}
                onClick={() => setPickMode(pickMode === 'start' ? 'none' : 'start')}
                aria-pressed={pickMode === 'start'}
                className={`px-2 py-0.5 rounded border ${pickMode === 'start' ? 'bg-green-500 text-white border-green-600' : 'border-slate-300'}`}
              >
                {pickMode === 'start' ? 'Click a node…' : 'Pick start'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span>
                End: <strong>{nodeLabel(endNodeId)}</strong>
              </span>
              <button
                type="button"
                disabled={locked}
                onClick={() => setPickMode(pickMode === 'end' ? 'none' : 'end')}
                aria-pressed={pickMode === 'end'}
                className={`px-2 py-0.5 rounded border ${pickMode === 'end' ? 'bg-purple-500 text-white border-purple-600' : 'border-slate-300'}`}
              >
                {pickMode === 'end' ? 'Click a node…' : 'Pick end'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canRun}
            onClick={handleRun}
            className="flex-1 text-sm px-3 py-1.5 rounded bg-sky-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-sky-700"
          >
            Run
          </button>
          <button
            type="button"
            disabled={!locked}
            onClick={handleReset}
            className="text-sm px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
          >
            Edit graph
          </button>
        </div>
        {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Random graph</h2>
        <div className="flex items-center gap-2 mb-2 text-xs">
          <label htmlFor="node-count">Nodes</label>
          <input
            id="node-count"
            type="number"
            min={3}
            max={30}
            value={randomNodeCount}
            disabled={locked}
            onChange={(e) => setRandomNodeCount(Number(e.target.value))}
            className="w-16 border border-slate-300 rounded px-1 py-0.5"
          />
          <label htmlFor="density">Density</label>
          <input
            id="density"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={randomDensity}
            disabled={locked}
            onChange={(e) => setRandomDensity(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 text-right">{randomDensity.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 mb-2 text-xs">
          <label htmlFor="min-weight">Weight range</label>
          <input
            id="min-weight"
            type="number"
            aria-label="Minimum weight"
            value={randomMinWeight}
            disabled={locked}
            onChange={(e) => setRandomMinWeight(Number(e.target.value))}
            className="w-14 border border-slate-300 rounded px-1 py-0.5"
          />
          <span>to</span>
          <input
            id="max-weight"
            type="number"
            aria-label="Maximum weight"
            value={randomMaxWeight}
            disabled={locked}
            onChange={(e) => setRandomMaxWeight(Number(e.target.value))}
            className="w-14 border border-slate-300 rounded px-1 py-0.5"
          />
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={handleGenerateRandom}
          className="w-full text-sm px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Generate random graph
        </button>
      </div>
    </div>
  )
}
