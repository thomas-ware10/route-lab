import { useEffect } from 'react'
import { usePlaybackStore } from '../store/playbackStore'

export function PlaybackControls() {
  const trace = usePlaybackStore((s) => s.trace)
  const currentStepIndex = usePlaybackStore((s) => s.currentStepIndex)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const speed = usePlaybackStore((s) => s.speed)
  const play = usePlaybackStore((s) => s.play)
  const pause = usePlaybackStore((s) => s.pause)
  const stepForward = usePlaybackStore((s) => s.stepForward)
  const stepBackward = usePlaybackStore((s) => s.stepBackward)
  const jumpToStep = usePlaybackStore((s) => s.jumpToStep)
  const setSpeed = usePlaybackStore((s) => s.setSpeed)

  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      usePlaybackStore.getState().stepForward()
    }, 1000 / speed)
    return () => window.clearInterval(id)
  }, [isPlaying, speed])

  if (!trace) {
    return <p className="text-sm text-slate-500 italic">Run an algorithm to see step-by-step playback here.</p>
  }

  const lastIndex = trace.steps.length - 1
  const currentStep = currentStepIndex >= 0 ? trace.steps[currentStepIndex] : null
  const atStart = currentStepIndex <= -1
  const atEnd = currentStepIndex >= lastIndex

  return (
    <div className="space-y-2" data-testid="playback-controls">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={stepBackward}
          disabled={atStart}
          aria-label="Step back"
          className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
        >
          {'⏮'}
        </button>
        <button
          type="button"
          onClick={() => (isPlaying ? pause() : play())}
          disabled={atEnd && !isPlaying}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="px-3 py-1 rounded bg-sky-600 text-white disabled:opacity-40 hover:bg-sky-700"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={stepForward}
          disabled={atEnd}
          aria-label="Step forward"
          className="px-2 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
        >
          {'⏭'}
        </button>

        <input
          type="range"
          min={-1}
          max={lastIndex}
          value={currentStepIndex}
          onChange={(e) => jumpToStep(Number(e.target.value))}
          aria-label="Step scrubber"
          className="flex-1"
        />
        <span className="text-xs text-slate-500 tabular-nums w-14 text-right">
          {currentStepIndex + 1} / {trace.steps.length}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <label htmlFor="speed">Speed</label>
        <input
          id="speed"
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

      <p className="text-sm text-slate-800 min-h-[1.5em]" data-testid="step-description">
        {currentStep ? currentStep.description : 'Not started.'}
      </p>
    </div>
  )
}
