import { useEffect, useMemo, useState } from 'react'
import {
  ALGORITHM_FAMILY,
  COMPLEXITY,
  algorithmIdsInFamily,
  algorithmsInSameFamily,
  type AlgorithmId,
} from '../algorithms/complexity'
import { requiresEndpoints, runAlgorithm } from '../algorithms/runAlgorithm'
import type { StepStats } from '../algorithms/types'
import { ZERO_STATS } from '../algorithms/types'
import { deriveVisualState } from '../playback/deriveVisualState'
import { useGraphStore } from '../store/graphStore'
import { useRaceStore } from '../store/raceStore'
import { GraphView } from './GraphView'

const ALL_ALGORITHMS: AlgorithmId[] = ['dijkstra', 'astar', 'kruskal', 'prim']

function StatRow({ label, a, b }: { label: string; a: number; b: number }) {
  const winner = a === b ? null : a < b ? 'a' : 'b'
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-mono ${winner === 'a' ? 'text-emerald-600 font-semibold' : 'text-slate-900'}`}>{a}</span>
      <span className={`text-right font-mono ${winner === 'b' ? 'text-emerald-600 font-semibold' : 'text-slate-900'}`}>{b}</span>
    </div>
  )
}

export function RacePanel() {
  const graph = useGraphStore((s) => s.graph)
  const startNodeId = useGraphStore((s) => s.startNodeId)
  const endNodeId = useGraphStore((s) => s.endNodeId)
  const pickMode = useGraphStore((s) => s.pickMode)
  const locked = useGraphStore((s) => s.locked)
  const setPickMode = useGraphStore((s) => s.setPickMode)
  const setLocked = useGraphStore((s) => s.setLocked)

  const algorithmA = useRaceStore((s) => s.algorithmA)
  const algorithmB = useRaceStore((s) => s.algorithmB)
  const traceA = useRaceStore((s) => s.traceA)
  const traceB = useRaceStore((s) => s.traceB)
  const currentStepIndex = useRaceStore((s) => s.currentStepIndex)
  const isPlaying = useRaceStore((s) => s.isPlaying)
  const speed = useRaceStore((s) => s.speed)
  const setAlgorithmA = useRaceStore((s) => s.setAlgorithmA)
  const setAlgorithmB = useRaceStore((s) => s.setAlgorithmB)
  const setTraces = useRaceStore((s) => s.setTraces)
  const play = useRaceStore((s) => s.play)
  const pause = useRaceStore((s) => s.pause)
  const stepForward = useRaceStore((s) => s.stepForward)
  const stepBackward = useRaceStore((s) => s.stepBackward)
  const jumpToStep = useRaceStore((s) => s.jumpToStep)
  const setSpeed = useRaceStore((s) => s.setSpeed)
  const clearRace = useRaceStore((s) => s.clear)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => useRaceStore.getState().stepForward(), 1000 / speed)
    return () => window.clearInterval(id)
  }, [isPlaying, speed])

  function handleSetAlgorithmA(id: AlgorithmId) {
    setAlgorithmA(id)
    if (!algorithmsInSameFamily(id, algorithmB)) {
      const other = algorithmIdsInFamily(ALGORITHM_FAMILY[id]).find((x) => x !== id)!
      setAlgorithmB(other)
    }
  }
  function handleSetAlgorithmB(id: AlgorithmId) {
    setAlgorithmB(id)
    if (!algorithmsInSameFamily(algorithmA, id)) {
      const other = algorithmIdsInFamily(ALGORITHM_FAMILY[id]).find((x) => x !== id)!
      setAlgorithmA(other)
    }
  }

  const family = ALGORITHM_FAMILY[algorithmA]
  const needsEnd = requiresEndpoints(algorithmA) || requiresEndpoints(algorithmB)
  const nodeLabel = (id: string | null) => (id ? (graph.nodes.find((n) => n.id === id)?.label ?? id) : 'not set')

  const canRun =
    !locked &&
    graph.nodes.length > 0 &&
    (family === 'mst' || (!!startNodeId && !!endNodeId && startNodeId !== endNodeId))

  function handleRunRace() {
    setError(null)
    try {
      const a = runAlgorithm({ algorithm: algorithmA, graph, startNodeId, endNodeId })
      const b = runAlgorithm({ algorithm: algorithmB, graph, startNodeId, endNodeId })
      setTraces(a, b)
      setLocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleReset() {
    clearRace()
    setLocked(false)
  }

  const visualStateA = useMemo(() => deriveVisualState(traceA, currentStepIndex), [traceA, currentStepIndex])
  const visualStateB = useMemo(() => deriveVisualState(traceB, currentStepIndex), [traceB, currentStepIndex])

  const lastIndexA = traceA ? traceA.steps.length - 1 : -1
  const lastIndexB = traceB ? traceB.steps.length - 1 : -1
  const sharedLastIndex = Math.max(lastIndexA, lastIndexB)
  const clampedIndexA = traceA ? Math.min(currentStepIndex, lastIndexA) : -1
  const clampedIndexB = traceB ? Math.min(currentStepIndex, lastIndexB) : -1
  const finishedA = traceA !== null && currentStepIndex >= lastIndexA
  const finishedB = traceB !== null && currentStepIndex >= lastIndexB
  const statsA: StepStats = traceA && clampedIndexA >= 0 ? traceA.steps[clampedIndexA].stats : ZERO_STATS
  const statsB: StepStats = traceB && clampedIndexB >= 0 ? traceB.steps[clampedIndexB].stats : ZERO_STATS

  const atStart = currentStepIndex <= -1
  const atEnd = currentStepIndex >= sharedLastIndex

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Algorithm race</h2>
        <p className="text-xs text-slate-500">
          Pick two algorithms that solve the same problem and run them on the same graph, step for step. A shorter
          run holds at "Finished" while the other keeps going — that gap is the point.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            Algorithm A
            <select
              aria-label="Race algorithm A"
              value={algorithmA}
              disabled={locked}
              onChange={(e) => handleSetAlgorithmA(e.target.value as AlgorithmId)}
              className="border border-slate-300 rounded px-2 py-1"
            >
              {ALL_ALGORITHMS.map((id) => (
                <option key={id} value={id}>
                  {COMPLEXITY[id].name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Algorithm B
            <select
              aria-label="Race algorithm B"
              value={algorithmB}
              disabled={locked}
              onChange={(e) => handleSetAlgorithmB(e.target.value as AlgorithmId)}
              className="border border-slate-300 rounded px-2 py-1"
            >
              {ALL_ALGORITHMS.map((id) => (
                <option key={id} value={id}>
                  {COMPLEXITY[id].name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Only algorithms that solve the same problem can race each other — picking Algorithm A also constrains
          Algorithm B to the same family (shortest-path or MST), and vice versa.
        </p>

        <div className="flex flex-col gap-1 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span>
              Start: <strong>{nodeLabel(startNodeId)}</strong> {family === 'mst' && '(Prim root)'}
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
          {needsEnd && (
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
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canRun}
            onClick={handleRunRace}
            className="flex-1 text-sm px-3 py-1.5 rounded bg-sky-600 text-white disabled:opacity-40 hover:bg-sky-700"
          >
            Run race
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
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      {traceA && traceB && (
        <>
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stepBackward}
                disabled={atStart}
                aria-label="Step back"
                className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40"
              >
                {'⏮'}
              </button>
              <button
                type="button"
                onClick={() => (isPlaying ? pause() : play())}
                disabled={atEnd && !isPlaying}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="px-3 py-1 rounded bg-sky-600 text-white disabled:opacity-40"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                onClick={stepForward}
                disabled={atEnd}
                aria-label="Step forward"
                className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40"
              >
                {'⏭'}
              </button>
              <input
                type="range"
                min={-1}
                max={sharedLastIndex}
                value={currentStepIndex}
                onChange={(e) => jumpToStep(Number(e.target.value))}
                aria-label="Race step scrubber"
                className="flex-1"
              />
              <span className="text-xs text-slate-500 tabular-nums w-16 text-right">
                {currentStepIndex + 1} / {sharedLastIndex + 1}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label htmlFor="race-speed">Speed</label>
              <input
                id="race-speed"
                type="range"
                min={0.25}
                max={8}
                step={0.25}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-28"
              />
              <span className="tabular-nums">{speed.toFixed(2)}x</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{COMPLEXITY[algorithmA].name}</h3>
                {finishedA && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" data-testid="race-a-finished">
                    Finished at step {lastIndexA + 1}
                  </span>
                )}
              </div>
              <GraphView graph={graph} visualState={visualStateA} startNodeId={startNodeId} endNodeId={endNodeId} ariaLabel="Algorithm race graph view" />
              <p className="text-xs text-slate-600 min-h-[1.5em]">
                {clampedIndexA >= 0 ? traceA.steps[clampedIndexA].description : 'Not started.'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{COMPLEXITY[algorithmB].name}</h3>
                {finishedB && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" data-testid="race-b-finished">
                    Finished at step {lastIndexB + 1}
                  </span>
                )}
              </div>
              <GraphView graph={graph} visualState={visualStateB} startNodeId={startNodeId} endNodeId={endNodeId} ariaLabel="Algorithm race graph view" />
              <p className="text-xs text-slate-600 min-h-[1.5em]">
                {clampedIndexB >= 0 ? traceB.steps[clampedIndexB].description : 'Not started.'}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Live stats comparison</h3>
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-500 pb-1 border-b border-slate-200">
              <span>Metric</span>
              <span className="text-right">{COMPLEXITY[algorithmA].name}</span>
              <span className="text-right">{COMPLEXITY[algorithmB].name}</span>
            </div>
            <StatRow label="Nodes visited" a={statsA.nodesVisited} b={statsB.nodesVisited} />
            <StatRow label="Edges considered" a={statsA.edgesConsidered} b={statsB.edgesConsidered} />
            <StatRow label="Comparisons" a={statsA.comparisons} b={statsB.comparisons} />
            <StatRow label="Priority-queue ops" a={statsA.priorityQueueOps} b={statsB.priorityQueueOps} />
            <StatRow label="Union-find ops" a={statsA.unionFindOps} b={statsB.unionFindOps} />
            <StatRow label="Total operations" a={statsA.totalOperations} b={statsB.totalOperations} />
          </div>
        </>
      )}
    </div>
  )
}
