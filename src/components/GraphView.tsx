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
}

/**
 * Read-only graph renderer: same state -> color/shape mapping as the
 * interactive GraphCanvas (via the shared graphVisualStyles module), but with
 * no editing handlers. Used by race mode to show two synchronized traces
 * side by side without duplicating the editor's drag/click logic. Node
 * coordinates come from the graph itself (laid out in the 900x540 editor
 * space), so the viewBox matches that space and scales down via CSS.
 */
export function GraphView({ graph, visualState, startNodeId, endNodeId }: GraphViewProps) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const viewBoxWidth = 900
  const viewBoxHeight = 540

  return (
    <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-auto rounded-lg border border-slate-200 bg-slate-50" role="img" aria-label="Algorithm race graph view">
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

        return (
          <g key={edge.id}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`${EDGE_STROKE[state]} ${isCurrent ? 'animate-pulse' : ''}`}
              strokeWidth={isCurrent ? EDGE_WIDTH[state] + 1 : EDGE_WIDTH[state]}
              strokeDasharray={EDGE_DASH[state]}
              strokeOpacity={EDGE_OPACITY[state]}
              strokeLinecap="round"
              style={{ filter: EDGE_GLOW[state] }}
              markerEnd={graph.mode === 'directed' ? 'url(#race-arrowhead)' : undefined}
            />
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-slate-700"
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
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_RADIUS}
              className={`${NODE_FILL[state]} ${NODE_STROKE[state]}`}
              strokeWidth={NODE_STROKE_WIDTH[state]}
              style={{ filter: NODE_GLOW[state] }}
              data-testid={`race-node-${node.id}`}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-sm font-medium select-none ${NODE_TEXT[state]}`}
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
