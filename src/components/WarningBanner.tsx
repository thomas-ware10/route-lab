import { usePlaybackStore } from '../store/playbackStore'

export function WarningBanner() {
  const trace = usePlaybackStore((s) => s.trace)
  const warnings = trace?.warnings ?? []
  if (warnings.length === 0) return null

  return (
    <div
      role="alert"
      className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs space-y-1"
      data-testid="warning-banner"
    >
      {warnings.map((w, i) => (
        <p key={i}>{'⚠️'} {w}</p>
      ))}
    </div>
  )
}
