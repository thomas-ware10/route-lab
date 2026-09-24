import type { Graph } from '../types'
import type { VisualState } from '../playback/deriveVisualState'
import {
  ACTIVE_RING_OFFSET,
  ACTIVE_RING_STROKE,
  ACTIVE_RING_WIDTH,
  EDGE_DASH,
  EDGE_GLOW,
  EDGE_OPACITY,
  EDGE_STROKE,
  EDGE_WIDTH,
  END_RING_STROKE,
  NODE_FILL,
  NODE_GLOW,
  NODE_RADIUS,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  NODE_TEXT,
  START_RING_STROKE,
} from './graphVisualStyles'

export interface GraphViewProps {
  graph: Graph
  visualState: VisualState
  startNodeId?: string | null
  endNodeId?: string | null
  ariaLabel?: string
  onNodeClick?: (nodeId: string) => void
  onEdgeClick?: (edgeId: string) => void
  /** Marks a node/edge the viewer guessed incorrectly, distinct from the
   *  amber "active" ring (which, once revealed, already marks the correct
   *  answer via the trace's own current step). */
  wrongGuessNodeId?: string | null
  wrongGuessEdgeId?: string | null
}

/**
 * Read-only graph renderer: same state -> color/shape mapping as the
 * interactive GraphCanvas (via the shared graphVisualStyles module), but with
 * no drag/edit handlers. Used by race mode (no interaction) and quiz mode
 * (optional click-to-guess via onNodeClick/onEdgeClick) so both reuse one
 * rendering path instead of duplicating GraphCanvas's SVG layout logic.
 */
export function GraphView({
  graph,
  visualState,
  startNodeId,
  endNodeId,
  ariaLabel = 'Graph view',
  onNodeClick,
  onEdgeClick,
  wrongGuessNodeId,
  wrongGuessEdgeId,
}: GraphViewProps) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const viewBoxWidth = 900
  const viewBoxHeight = 540

  return (
    <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-auto rounded-lg border border-slate-200 bg-slate-50" role="img" aria-label={ariaLabel}>
      <defs>
        <marker id="race-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="fill-slate-400" />
        </marker>
      </defs>

      {graph.edges.map((edge) => {
        const source = nodeById.get(edge.source)
        const target = nodeById.get(edge.target)
        if (!source || !target) return null
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.hypot(dx, dy) || 1
        const ux = dx / dist
        const uy = dy / dist
        const x1 = source.x + ux * NODE_RADIUS
        const y1 = source.y + uy * NODE_RADIUS
        const pullback = graph.mode === 'directed' ? NODE_RADIUS + 8 : NODE_RADIUS
        const x2 = target.x - ux * pullback
        const y2 = target.y - uy * pullback
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        const state = visualState.edges[edge.id] ?? 'default'
        const isCurrent = visualState.currentEdgeId === edge.id
        const isWrongGuess = wrongGuessEdgeId === edge.id

        return (
          <g key={edge.id}>
            {onEdgeClick && (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth={16}
                onClick={() => onEdgeClick(edge.id)}
                style={{ cursor: 'pointer' }}
                data-testid={`quiz-edge-hit-${edge.id}`}
              />
            )}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`${EDGE_STROKE[state]} ${isCurrent ? 'animate-pulse' : ''} pointer-events-none`}
              strokeWidth={isCurrent ? EDGE_WIDTH[state] + 1 : EDGE_WIDTH[state]}
              strokeDasharray={EDGE_DASH[state]}
              strokeOpacity={EDGE_OPACITY[state]}
              strokeLinecap="round"
              style={{ filter: EDGE_GLOW[state] }}
              markerEnd={graph.mode === 'directed' ? 'url(#race-arrowhead)' : undefined}
            />
            {isWrongGuess && (
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-rose-500 pointer-events-none"
                strokeWidth={EDGE_WIDTH[state] + 3}
                strokeOpacity={0.5}
                strokeLinecap="round"
              />
            )}
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-slate-700 pointer-events-none"
              style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 4 }}
            >
              {edge.weight}
            </text>
          </g>
        )
      })}

      {graph.nodes.map((node) => {
        const state = visualState.nodes[node.id] ?? 'unvisited'
        const isCurrent = visualState.currentNodeId === node.id
        const isStart = node.id === startNodeId
        const isEnd = node.id === endNodeId
        const isWrongGuess = wrongGuessNodeId === node.id

        return (
          <g key={node.id}>
            {(isStart || isEnd) && (
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + 5}
                fill="none"
                className={isStart ? START_RING_STROKE : END_RING_STROKE}
                strokeWidth={3}
              />
            )}
            {isCurrent && (
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + ACTIVE_RING_OFFSET}
                fill="none"
                className={`${ACTIVE_RING_STROKE} animate-pulse`}
                strokeWidth={ACTIVE_RING_WIDTH}
                strokeDasharray="3 3"
              />
            )}
            {isWrongGuess && (
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS + ACTIVE_RING_OFFSET + 3}
                fill="none"
                className="stroke-rose-500"
                strokeWidth={ACTIVE_RING_WIDTH}
                strokeDasharray="2 3"
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              className={`${NODE_FILL[state]} ${NODE_STROKE[state]}`}
              strokeWidth={NODE_STROKE_WIDTH[state]}
              style={{ filter: NODE_GLOW[state], cursor: onNodeClick ? 'pointer' : undefined }}
              onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
              data-testid={`race-node-${node.id}`}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-sm font-medium select-none pointer-events-none ${NODE_TEXT[state]}`}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
