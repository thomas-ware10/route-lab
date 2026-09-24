import type { PathOptions } from 'leaflet'
import type { SegmentVisualState } from './segmentStates'

/**
 * Leaflet needs literal colors, not Tailwind classes, but these deliberately
 * mirror the basic model's graphVisualStyles so the two modes read the same:
 * dotted amber = being checked, faded dashed rose = rejected, solid blue =
 * part of the search tree, thick glowing green = the final route. Width and
 * dash pattern differ per state too, so color is never the only signal.
 */
export const SEGMENT_STYLE: Record<Exclude<SegmentVisualState, 'default'>, PathOptions> = {
  considering: { color: '#f59e0b', weight: 5, opacity: 1, dashArray: '2 7', lineCap: 'round' },
  rejected: { color: '#fb7185', weight: 2, opacity: 0.45, dashArray: '6 5', lineCap: 'butt' },
  accepted: { color: '#0ea5e9', weight: 3, opacity: 0.85, dashArray: undefined, lineCap: 'round' },
  path: { color: '#10b981', weight: 7, opacity: 0.95, dashArray: undefined, lineCap: 'round' },
}

export const NETWORK_STYLE: PathOptions = { color: '#64748b', weight: 1, opacity: 0.35, interactive: false }

export const START_COLOR = '#16a34a'
export const END_COLOR = '#9333ea'
export const ACTIVE_COLOR = '#f59e0b'
