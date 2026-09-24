import { useState } from 'react'
import { COMPLEXITY, type AlgorithmId } from '../algorithms/complexity'
import { generateRandomGraph, graphDensity } from '../algorithms/randomGraph'
import { runAlgorithm } from '../algorithms/runAlgorithm'
import type { Trace } from '../algorithms/types'

const ALGORITHMS: AlgorithmId[] = ['dijkstra', 'astar', 'kruskal', 'prim']

interface ComparisonResult {
  label: 'Sparse' | 'Dense'
  nodeCount: number
  edgeCount: number
  density: number
  trace: Trace
  theoreticalEstimate: number
}

function buildResult(label: 'Sparse' | 'Dense', algorithm: AlgorithmId, nodeCount: number, density: number, seed: number): ComparisonResult {
  const graph = generateRandomGraph({ nodeCount, density, seed, mode: 'undirected' })
  const startNodeId = graph.nodes[0]?.id ?? null
  const endNodeId = graph.nodes[graph.nodes.length - 1]?.id ?? null
  const trace = runAlgorithm({ algorithm, graph, startNodeId, endNodeId })
  const finalStats = trace.steps[trace.steps.length - 1].stats
  const theoreticalEstimate = COMPLEXITY[algorithm].estimate(graph.nodes.length, graph.edges.length)
  return {
    label,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    density: graphDensity(graph),
    trace: { ...trace, steps: [{ ...trace.steps[trace.steps.length - 1], stats: finalStats }] },
    theoreticalEstimate,
  }
}

export function ComparisonPanel() {
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('dijkstra')
  const [nodeCount, setNodeCount] = useState(20)
  const [sparseDensity, setSparseDensity] = useState(0.1)
  const [denseDensity, setDenseDensity] = useState(0.7)
  const [results, setResults] = useState<[ComparisonResult, ComparisonResult] | null>(null)

  function handleCompare() {
    const seed = Date.now()
    const sparse = buildResult('Sparse', algorithm, nodeCount, sparseDensity, seed)
    const dense = buildResult('Dense', algorithm, nodeCount, denseDensity, seed)
    setResults([sparse, dense])
  }

  const rows: { key: 'nodeCount' | 'edgeCount' | 'density'; label: string; format?: (v: number) => string }[] = [
    { key: 'nodeCount', label: 'Nodes' },
    { key: 'edgeCount', label: 'Edges' },
    { key: 'density', label: 'Density', format: (v) => v.toFixed(3) },
  ]

  const statRows: { key: keyof Trace['steps'][number]['stats']; label: string }[] = [
    { key: 'nodesVisited', label: 'Nodes visited' },
    { key: 'edgesConsidered', label: 'Edges considered' },
    { key: 'comparisons', label: 'Comparisons' },
    { key: 'priorityQueueOps', label: 'Priority-queue ops' },
    { key: 'unionFindOps', label: 'Union-find ops' },
    { key: 'totalOperations', label: 'Total operations' },
  ]

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">Sparse vs. dense comparison</h2>
      <p className="text-xs text-slate-500">
        Generates two random graphs with the same node count but different densities, runs the same algorithm on
        each, and compares operation counts against the theoretical estimate.
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1">
          Algorithm
          <select
            aria-label="Comparison algorithm"
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
        <label className="flex flex-col gap-1">
          Node count
          <input
            aria-label="Comparison node count"
            type="number"
            min={4}
            max={60}
            value={nodeCount}
            onChange={(e) => setNodeCount(Number(e.target.value))}
            className="border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          Sparse density ({sparseDensity.toFixed(2)})
          <input
            aria-label="Sparse density"
            type="range"
            min={0}
            max={0.5}
            step={0.05}
            value={sparseDensity}
            onChange={(e) => setSparseDensity(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1">
          Dense density ({denseDensity.toFixed(2)})
          <input
            aria-label="Dense density"
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={denseDensity}
            onChange={(e) => setDenseDensity(Number(e.target.value))}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleCompare}
        className="text-sm px-3 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700"
      >
        Run comparison
      </button>

      {results && (
        <table className="w-full text-xs border-collapse" data-testid="comparison-table">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-1 font-medium text-slate-500">Metric</th>
              <th className="text-right py-1 font-medium text-slate-500">Sparse</th>
              <th className="text-right py-1 font-medium text-slate-500">Dense</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, format }) => (
              <tr key={key} className="border-b border-slate-100">
                <td className="py-1 text-slate-600">{label}</td>
                <td className="py-1 text-right font-mono">
                  {format ? format(results[0][key]) : results[0][key]}
                </td>
                <td className="py-1 text-right font-mono">
                  {format ? format(results[1][key]) : results[1][key]}
                </td>
              </tr>
            ))}
            {statRows.map(({ key, label }) => (
              <tr key={key} className="border-b border-slate-100">
                <td className="py-1 text-slate-600">{label}</td>
                <td className="py-1 text-right font-mono" data-testid={`compare-sparse-${key}`}>
                  {results[0].trace.steps[0].stats[key]}
                </td>
                <td className="py-1 text-right font-mono" data-testid={`compare-dense-${key}`}>
                  {results[1].trace.steps[0].stats[key]}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1 text-slate-600 font-medium">Theoretical estimate</td>
              <td className="py-1 text-right font-mono" data-testid="compare-sparse-theoretical">
                {Math.round(results[0].theoreticalEstimate)}
              </td>
              <td className="py-1 text-right font-mono" data-testid="compare-dense-theoretical">
                {Math.round(results[1].theoreticalEstimate)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
