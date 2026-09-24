import type { EdgeVisualState, NodeVisualState } from '../playback/deriveVisualState'

/**
 * Shared node/edge styling for algorithm playback, used by the interactive editor
 * canvas and the read-only race-mode view so both render identical state colors.
 *
 * Design (see audit in commit history): color alone is not a safe signal, so every
 * state also gets a distinct stroke width and/or dash pattern as a redundant,
 * colorblind-safe cue. Thickness escalates with how "settled" a state is
 * (unvisited < visited < finalized/path), and "currently active" is a ring
 * (a shape, not a color) rather than relying on hue alone.
 */

export const NODE_RADIUS = 20

export const NODE_FILL: Record<NodeVisualState, string> = {
  unvisited: 'fill-white',
  visited: 'fill-sky-200',
  finalized: 'fill-sky-600',
  path: 'fill-emerald-500',
}
export const NODE_STROKE: Record<NodeVisualState, string> = {
  unvisited: 'stroke-slate-400',
  visited: 'stroke-sky-600',
  finalized: 'stroke-sky-800',
  path: 'stroke-emerald-700',
}
export const NODE_STROKE_WIDTH: Record<NodeVisualState, number> = {
  unvisited: 2,
  visited: 3,
  finalized: 4,
  path: 4,
}
export const NODE_TEXT: Record<NodeVisualState, string> = {
  unvisited: 'fill-slate-700',
  visited: 'fill-slate-900',
  finalized: 'fill-white',
  path: 'fill-white',
}
/** Extra CSS filter for states that should visually "pop" as the final answer. */
export const NODE_GLOW: Partial<Record<NodeVisualState, string>> = {
  path: 'drop-shadow(0 0 3px rgba(16,185,129,0.7))',
}

export const EDGE_STROKE: Record<EdgeVisualState, string> = {
  default: 'stroke-slate-300',
  considering: 'stroke-amber-500',
  rejected: 'stroke-rose-400',
  accepted: 'stroke-sky-500',
  path: 'stroke-emerald-500',
}
export const EDGE_WIDTH: Record<EdgeVisualState, number> = {
  default: 2,
  considering: 3,
  rejected: 2,
  accepted: 3,
  path: 5,
}
/** Dotted = pending/being examined, dashed = rejected (de-emphasized), solid = confirmed. */
export const EDGE_DASH: Partial<Record<EdgeVisualState, string>> = {
  considering: '2 4',
  rejected: '6 3',
}
export const EDGE_OPACITY: Partial<Record<EdgeVisualState, number>> = {
  rejected: 0.55,
}
export const EDGE_GLOW: Partial<Record<EdgeVisualState, string>> = {
  path: 'drop-shadow(0 0 2px rgba(16,185,129,0.6))',
}

/** Ring drawn around whichever node/edge the current playback step just touched. */
export const ACTIVE_RING_STROKE = 'stroke-amber-500'
export const ACTIVE_RING_WIDTH = 3
export const ACTIVE_RING_OFFSET = 6

export const START_RING_STROKE = 'stroke-green-500'
export const END_RING_STROKE = 'stroke-purple-500'
