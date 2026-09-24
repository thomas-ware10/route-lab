import { useEffect, useMemo, useState } from 'react'
import { ZERO_STATS, isDoneStep } from '../../algorithms/types'
import { describeRoadStep, routeLegs, routeLengthMeters } from '../../roads/describe'
import { formatDistance } from '../../roads/geo'
import { isValidUkPostcode } from '../../roads/postcodes'
import { useRoadStore, type RoadAlgorithm, type RoadStatus } from '../../store/roadStore'
import { RoadMap } from './RoadMap'

const BUSY_TEXT: Partial<Record<RoadStatus, string>> = {
  geocoding: 'Looking up postcodes…',
  downloading: 'Downloading real roads from OpenStreetMap…',
  building: 'Building the road graph…',
  searching: 'Running the search…',
}

const ALGORITHM_NAMES: Record<RoadAlgorithm, string> = {
  dijkstra: "Dijkstra's algorithm",
  astar: 'A* search',
}

const DURATIONS = [5, 15, 30, 60]
const MAX_LEGS_SHOWN = 12

/**
 * Seconds since the current lookup began, so a slow public server doesn't look
 * frozen. Mounted only while busy, so every new search starts again from zero.
 */
function ElapsedSeconds() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])
  if (elapsed < 3) return null
  return <span className="text-xs text-slate-500 tabular-nums">{elapsed}s</span>
}

/** Advances playback on animation frames at (trace length / duration) steps per second. */
function usePlaybackLoop() {
  const isPlaying = useRoadStore((s) => s.isPlaying)
  const trace = useRoadStore((s) => s.trace)
  const durationSeconds = useRoadStore((s) => s.durationSeconds)

  useEffect(() => {
    if (!isPlaying || !trace) return
    const stepsPerSecond = trace.steps.length / durationSeconds
    let last = performance.now()
    let carry = 0
    let raf = 0
    const frame = (now: number) => {
      // Cap dt so returning to a background tab doesn't jump half the search at once.
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      carry += stepsPerSecond * dt
      const whole = Math.floor(carry)
      if (whole > 0) {
        carry -= whole
        useRoadStore.getState().advance(whole)
      }
      if (useRoadStore.getState().isPlaying) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, trace, durationSeconds])
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="contents">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-slate-900" data-testid={testId}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </dd>
    </div>
  )
}

function LegendRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="28" height="10" aria-hidden="true">
        {swatch}
      </svg>
      <span>{label}</span>
    </li>
  )
}

export function RoadsPanel() {
  const fromInput = useRoadStore((s) => s.fromInput)
  const toInput = useRoadStore((s) => s.toInput)
  const algorithm = useRoadStore((s) => s.algorithm)
  const status = useRoadStore((s) => s.status)
  const statusDetail = useRoadStore((s) => s.statusDetail)
  const error = useRoadStore((s) => s.error)
  const route = useRoadStore((s) => s.route)
  const trace = useRoadStore((s) => s.trace)
  const runs = useRoadStore((s) => s.runs)
  const index = useRoadStore((s) => s.index)
  const isPlaying = useRoadStore((s) => s.isPlaying)
  const durationSeconds = useRoadStore((s) => s.durationSeconds)
  const setFromInput = useRoadStore((s) => s.setFromInput)
  const setToInput = useRoadStore((s) => s.setToInput)
  const setAlgorithm = useRoadStore((s) => s.setAlgorithm)
  const setDurationSeconds = useRoadStore((s) => s.setDurationSeconds)
  const findRoute = useRoadStore((s) => s.findRoute)
  const togglePlay = useRoadStore((s) => s.togglePlay)
  const seek = useRoadStore((s) => s.seek)
  const skipToEnd = useRoadStore((s) => s.skipToEnd)
  const restart = useRoadStore((s) => s.restart)

  const [showNetwork, setShowNetwork] = useState(false)
  usePlaybackLoop()

  const busyText = BUSY_TEXT[status]
  const fromValid = isValidUkPostcode(fromInput)
  const toValid = isValidUkPostcode(toInput)
  const canSearch = fromValid && toValid

  const lastIndex = trace ? trace.steps.length - 1 : -1
  const currentStep = trace && index >= 0 ? trace.steps[index] : null
  const stats = currentStep?.stats ?? ZERO_STATS
  const doneStep = trace ? trace.steps.find(isDoneStep) : undefined
  const reachedEnd = !!trace && index >= lastIndex

  const routeInfo = useMemo(() => {
    if (!route || !doneStep?.success) return null
    return {
      meters: routeLengthMeters(route.road, doneStep.resultEdgeIds),
      legs: routeLegs(route.road, doneStep.resultEdgeIds),
    }
  }, [route, doneStep])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (canSearch) void findRoute()
  }

  function swap() {
    setFromInput(toInput)
    setToInput(fromInput)
  }

  const comparison =
    runs.dijkstra && runs.astar
      ? {
          d: runs.dijkstra.nodesVisited,
          a: runs.astar.nodesVisited,
          pct: Math.round((1 - runs.astar.nodesVisited / Math.max(1, runs.dijkstra.nodesVisited)) * 100),
        }
      : null

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="p-4 bg-white rounded-lg border border-slate-200 space-y-3" aria-label="Route search">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            From postcode
            <input
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              placeholder="e.g. SW1A 1AA"
              aria-invalid={fromInput !== '' && !fromValid}
              className={`w-36 border rounded px-2 py-1.5 text-sm uppercase placeholder:normal-case ${fromInput !== '' && !fromValid ? 'border-rose-400' : 'border-slate-300'}`}
            />
          </label>
          <button
            type="button"
            onClick={swap}
            aria-label="Swap postcodes"
            className="mb-0.5 px-2 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50"
          >
            {'⇄'}
          </button>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            To postcode
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="e.g. SE1 7PB"
              aria-invalid={toInput !== '' && !toValid}
              className={`w-36 border rounded px-2 py-1.5 text-sm uppercase placeholder:normal-case ${toInput !== '' && !toValid ? 'border-rose-400' : 'border-slate-300'}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Algorithm
            <select
              aria-label="Road algorithm"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as RoadAlgorithm)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="dijkstra">{ALGORITHM_NAMES.dijkstra}</option>
              <option value="astar">{ALGORITHM_NAMES.astar}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={!canSearch}
            className="px-4 py-1.5 rounded bg-sky-600 text-white text-sm disabled:opacity-40 hover:bg-sky-700"
          >
            Find route
          </button>
        </div>
        <p className="text-xs text-slate-500">
          UK postcodes up to 25 miles apart. Real roads are downloaded from OpenStreetMap&rsquo;s free public servers
          (usually a few seconds; up to a minute for long routes when they&rsquo;re busy), then searched step by step with
          the same engine as the basic model — one-way streets included.
        </p>
        {busyText && (
          <p className="text-sm text-sky-700 flex items-center gap-2" role="status" data-testid="road-status">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
            {busyText}
            <ElapsedSeconds />
            {statusDetail && <span className="text-xs text-slate-500">({statusDetail})</span>}
          </p>
        )}
        {status === 'error' && error && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2" role="alert">
            {error}
          </p>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-3">
          <RoadMap route={route} trace={trace} index={index} showNetwork={showNetwork} />

          {trace && route && (
            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2" data-testid="road-playback">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  aria-label="Restart"
                  className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                >
                  {'⏮'}
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : reachedEnd ? 'Replay' : 'Play'}
                  className="px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  type="button"
                  onClick={skipToEnd}
                  disabled={reachedEnd}
                  aria-label="Skip to end"
                  className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                >
                  {'⏭'}
                </button>
                <input
                  type="range"
                  min={-1}
                  max={lastIndex}
                  value={index}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Road search scrubber"
                  className="flex-1"
                />
                <span className="text-xs text-slate-500 tabular-nums w-28 text-right">
                  {(index + 1).toLocaleString()} / {trace.steps.length.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <label className="flex items-center gap-2">
                  Playback length
                  <select
                    aria-label="Playback length"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="border border-slate-300 rounded px-1 py-0.5"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}s
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={showNetwork} onChange={(e) => setShowNetwork(e.target.checked)} />
                  Show downloaded road network
                </label>
              </div>
              <p className="text-sm text-slate-800 min-h-[1.5em]" data-testid="road-step">
                {currentStep ? describeRoadStep(currentStep, route.road) : 'Ready — press play to watch the search.'}
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {route && trace && (
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">{ALGORITHM_NAMES[algorithm]}</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Stat label="Junctions explored" value={stats.nodesVisited} testId="road-stat-visited" />
                <Stat label="Roads checked" value={stats.edgesConsidered} />
                <Stat label="Total operations" value={stats.totalOperations} />
                {runs[algorithm] && <Stat label="Compute time" value={`${runs[algorithm]!.searchMs.toFixed(0)} ms`} />}
              </dl>
              {comparison ? (
                <p className="text-xs text-slate-700 bg-sky-50 border border-sky-100 rounded p-2" data-testid="road-comparison">
                  On these same roads, A* explored <strong>{comparison.a.toLocaleString()}</strong> junctions vs
                  Dijkstra&rsquo;s <strong>{comparison.d.toLocaleString()}</strong>
                  {comparison.pct > 0 ? ` — ${comparison.pct}% fewer.` : '.'}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Switch algorithm to replay the search on the same roads and compare how much each explores.
                </p>
              )}
            </div>
          )}

          {routeInfo && reachedEnd && (
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-2" data-testid="road-route">
              <h2 className="text-sm font-semibold text-slate-900">Route</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Stat label="Distance" value={formatDistance(routeInfo.meters)} testId="road-route-distance" />
                <Stat label="Straight line" value={formatDistance(route!.plan.straightLineMeters)} />
                <Stat
                  label="Detour factor"
                  value={`${(routeInfo.meters / Math.max(1, route!.plan.straightLineMeters)).toFixed(2)}×`}
                />
              </dl>
              <ol className="text-xs text-slate-700 space-y-0.5 list-decimal list-inside">
                {routeInfo.legs.slice(0, MAX_LEGS_SHOWN).map((leg, i) => (
                  <li key={i}>
                    {leg.name} <span className="text-slate-400">· {formatDistance(leg.meters)}</span>
                  </li>
                ))}
                {routeInfo.legs.length > MAX_LEGS_SHOWN && (
                  <li className="list-none text-slate-400">…and {routeInfo.legs.length - MAX_LEGS_SHOWN} more</li>
                )}
              </ol>
            </div>
          )}

          {route && (
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Road network</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Stat label="Junctions" value={route.road.graph.nodes.length} testId="road-stat-junctions" />
                <Stat label="Road segments" value={route.road.segments.size} />
                <Stat label="OSM ways downloaded" value={route.wayCount} />
                <Stat label="Download" value={`${(route.downloadMs / 1000).toFixed(1)} s`} />
              </dl>
              <p className="text-xs text-slate-500">
                {route.plan.detailRadiusMeters === 0
                  ? 'Every drivable street in the area was downloaded.'
                  : `Major roads across the area, plus every street within ${route.plan.detailRadiusMeters / 1000} km of each postcode — the same hierarchy real sat-navs use to keep long searches fast.`}
              </p>
              {(route.startSnapMeters >= 25 || route.endSnapMeters >= 25) && (
                <p className="text-xs text-slate-500">
                  Postcodes sit off the road network, so each is connected to its nearest junction (A:{' '}
                  {formatDistance(route.startSnapMeters)}, B: {formatDistance(route.endSnapMeters)}; dashed lines).
                </p>
              )}
            </div>
          )}

          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">Key</h2>
            <ul className="text-xs text-slate-700 space-y-1.5">
              <LegendRow
                label="Road being checked right now"
                swatch={<line x1="2" y1="5" x2="26" y2="5" stroke="#f59e0b" strokeWidth="4" strokeDasharray="2 5" strokeLinecap="round" />}
              />
              <LegendRow
                label="Explored — part of the search tree"
                swatch={<line x1="2" y1="5" x2="26" y2="5" stroke="#0ea5e9" strokeWidth="3" />}
              />
              <LegendRow
                label="Checked, but no shorter way"
                swatch={<line x1="2" y1="5" x2="26" y2="5" stroke="#fb7185" strokeWidth="2" strokeOpacity="0.6" strokeDasharray="6 4" />}
              />
              <LegendRow
                label="Final shortest route"
                swatch={<line x1="2" y1="5" x2="26" y2="5" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />}
              />
              <LegendRow
                label="Junction being explored"
                swatch={<circle cx="14" cy="5" r="4" fill="#f59e0b" fillOpacity="0.35" stroke="#f59e0b" strokeWidth="2" />}
              />
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
