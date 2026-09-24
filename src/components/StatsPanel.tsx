import { useMemo } from 'react'
import { COMPLEXITY } from '../algorithms/complexity'
import { ZERO_STATS } from '../algorithms/types'
import { useGraphStore } from '../store/graphStore'
import { usePlaybackStore } from '../store/playbackStore'

const STAT_LABELS: { key: keyof typeof ZERO_STATS; label: string }[] = [
  { key: 'nodesVisited', label: 'Nodes visited' },
  { key: 'edgesConsidered', label: 'Edges considered' },
  { key: 'comparisons', label: 'Comparisons' },
  { key: 'priorityQueueOps', label: 'Priority-queue ops' },
  { key: 'unionFindOps', label: 'Union-find ops' },
]

export function StatsPanel() {
  const graph = useGraphStore((s) => s.graph)
  const trace = usePlaybackStore((s) => s.trace)
  const currentStepIndex = usePlaybackStore((s) => s.currentStepIndex)

  const stats = useMemo(() => {
    if (!trace || currentStepIndex < 0) return ZERO_STATS
    return trace.steps[currentStepIndex].stats
  }, [trace, currentStepIndex])

  const complexity = trace ? COMPLEXITY[trace.algorithm] : null
  const theoreticalEstimate = complexity ? complexity.estimate(graph.nodes.length, graph.edges.length) : 0
  const ratio = theoreticalEstimate > 0 ? stats.totalOperations / theoreticalEstimate : 0
  const barWidth = Math.min(100, ratio * 100)

  return (
    <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3" data-testid="stats-panel">
      <h2 className="text-sm font-semibold text-slate-900">Statistics</h2>

      {complexity ? (
        <div className="text-xs text-slate-600">
          <div>
            {complexity.name}: theoretical <span className="font-mono">{complexity.bigO}</span>
          </div>
          <div>
            V={graph.nodes.length}, E={graph.edges.length}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">Run an algorithm to see live statistics.</p>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-mono text-slate-900" data-testid={`stat-${key}`}>
              {stats[key]}
            </dd>
          </div>
        ))}
        <div className="contents">
          <dt className="text-slate-700 font-medium">Total operations</dt>
          <dd className="text-right font-mono font-semibold text-slate-900" data-testid="stat-totalOperations">
            {stats.totalOperations}
          </dd>
        </div>
      </dl>

      {complexity && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Actual vs. theoretical estimate</span>
            <span data-testid="theoretical-estimate">{Math.round(theoreticalEstimate)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all"
              style={{ width: `${barWidth}%` }}
              data-testid="stat-bar"
            />
          </div>
        </div>
      )}
    </div>
  )
}
