import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { NodeVisualState, EdgeVisualState } from '../playback/deriveVisualState'
import { deriveVisualState } from '../playback/deriveVisualState'
import { useGraphStore } from '../store/graphStore'
import { usePlaybackStore } from '../store/playbackStore'

export const CANVAS_WIDTH = 900
export const CANVAS_HEIGHT = 540
const NODE_RADIUS = 20
const DRAG_THRESHOLD = 4

const NODE_FILL: Record<NodeVisualState, string> = {
  unvisited: 'fill-white',
  visited: 'fill-sky-200',
  finalized: 'fill-sky-500',
  path: 'fill-emerald-500',
}
const NODE_STROKE: Record<NodeVisualState, string> = {
  unvisited: 'stroke-slate-400',
  visited: 'stroke-sky-500',
  finalized: 'stroke-sky-700',
  path: 'stroke-emerald-700',
}
const NODE_TEXT: Record<NodeVisualState, string> = {
  unvisited: 'fill-slate-700',
  visited: 'fill-slate-900',
  finalized: 'fill-white',
  path: 'fill-white',
}
const EDGE_STROKE: Record<EdgeVisualState, string> = {
  default: 'stroke-slate-300',
  considering: 'stroke-amber-500',
  rejected: 'stroke-rose-300',
  accepted: 'stroke-sky-500',
  path: 'stroke-emerald-500',
}
const EDGE_WIDTH: Record<EdgeVisualState, number> = {
  default: 2,
  considering: 3,
  rejected: 2,
  accepted: 3,
  path: 4,
}

interface DragState {
  nodeId: string
  startClientX: number
  startClientY: number
  moved: boolean
  currentX: number
  currentY: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

export function GraphCanvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const graph = useGraphStore((s) => s.graph)
  const startNodeId = useGraphStore((s) => s.startNodeId)
  const endNodeId = useGraphStore((s) => s.endNodeId)
  const locked = useGraphStore((s) => s.locked)
  const addNode = useGraphStore((s) => s.addNode)
  const moveNode = useGraphStore((s) => s.moveNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const addEdge = useGraphStore((s) => s.addEdge)
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const updateEdgeWeight = useGraphStore((s) => s.updateEdgeWeight)
  const pickNode = useGraphStore((s) => s.pickNode)

  const trace = usePlaybackStore((s) => s.trace)
  const currentStepIndex = usePlaybackStore((s) => s.currentStepIndex)
  const visualState = useMemo(() => deriveVisualState(trace, currentStepIndex), [trace, currentStepIndex])

  const [drag, setDrag] = useState<DragState | null>(null)
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const backgroundDownRef = useRef<{ x: number; y: number } | null>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes])

  function getSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const scaleX = rect.width > 0 ? CANVAS_WIDTH / rect.width : 1
    const scaleY = rect.height > 0 ? CANVAS_HEIGHT / rect.height : 1
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function findNodeAt(x: number, y: number, excludeId?: string): string | null {
    for (const node of graph.nodes) {
      if (node.id === excludeId) continue
      if (Math.hypot(node.x - x, node.y - y) <= NODE_RADIUS) return node.id
    }
    return null
  }

  function handleBackgroundMouseDown(e: React.MouseEvent) {
    if (locked) return
    backgroundDownRef.current = { x: e.clientX, y: e.clientY }
  }

  function handleBackgroundMouseUp(e: React.MouseEvent) {
    const start = backgroundDownRef.current
    backgroundDownRef.current = null
    if (!start || locked) return
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    if (dist > DRAG_THRESHOLD) return
    const pt = getSvgPoint(e.clientX, e.clientY)
    addNode(clamp(pt.x, NODE_RADIUS, CANVAS_WIDTH - NODE_RADIUS), clamp(pt.y, NODE_RADIUS, CANVAS_HEIGHT - NODE_RADIUS))
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation()
    if (locked) return
    const node = nodeById.get(nodeId)!
    // dragStateRef is the source of truth read by handleMove/handleUp; setDrag only
    // drives rendering. Store mutations must never happen inside a setState updater
    // (React may invoke updaters outside the normal commit flow), so every side
    // effect below is a plain statement in a native event handler instead.
    const initial: DragState = { nodeId, startClientX: e.clientX, startClientY: e.clientY, moved: false, currentX: node.x, currentY: node.y }
    dragStateRef.current = initial
    setDrag(initial)

    const handleMove = (moveEvent: MouseEvent) => {
      const prev = dragStateRef.current
      if (!prev) return
      const pt = getSvgPoint(moveEvent.clientX, moveEvent.clientY)
      const dist = Math.hypot(moveEvent.clientX - prev.startClientX, moveEvent.clientY - prev.startClientY)
      const next: DragState = { ...prev, moved: prev.moved || dist > DRAG_THRESHOLD, currentX: pt.x, currentY: pt.y }
      dragStateRef.current = next
      setDrag(next)
    }

    const handleUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      const prev = dragStateRef.current
      dragStateRef.current = null
      // Flush this local update synchronously before the Zustand mutations below:
      // otherwise the store's external-store notification and this component's own
      // pending re-render can interleave, which React reports as "update while
      // rendering a different component".
      flushSync(() => setDrag(null))
      if (!prev) return

      if (!prev.moved) {
        pickNode(prev.nodeId)
        return
      }
      const pt = getSvgPoint(upEvent.clientX, upEvent.clientY)
      const targetId = findNodeAt(pt.x, pt.y, prev.nodeId)
      if (targetId) {
        addEdge(prev.nodeId, targetId, 1)
      } else {
        moveNode(prev.nodeId, clamp(pt.x, NODE_RADIUS, CANVAS_WIDTH - NODE_RADIUS), clamp(pt.y, NODE_RADIUS, CANVAS_HEIGHT - NODE_RADIUS))
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  function handleNodeContextMenu(e: React.MouseEvent, nodeId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    removeNode(nodeId)
  }

  function handleEdgeClick(e: React.MouseEvent, edgeId: string, currentWeight: number) {
    e.stopPropagation()
    if (locked) return
    setEditingEdgeId(edgeId)
    setEditingValue(String(currentWeight))
  }

  function handleEdgeContextMenu(e: React.MouseEvent, edgeId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    removeEdge(edgeId)
  }

  function commitEdgeWeight() {
    if (!editingEdgeId) return
    const parsed = Number(editingValue)
    if (Number.isFinite(parsed)) updateEdgeWeight(editingEdgeId, parsed)
    setEditingEdgeId(null)
  }

  const draggedNode = drag ? nodeById.get(drag.nodeId) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      className={`w-full h-auto rounded-lg border border-slate-200 bg-slate-50 ${locked ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
      data-testid="graph-canvas"
      role="img"
      aria-label="Graph editing canvas"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" className="fill-slate-400" />
        </marker>
      </defs>

      <rect
        x={0}
        y={0}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        fill="transparent"
        data-testid="graph-canvas-background"
        onMouseDown={handleBackgroundMouseDown}
        onMouseUp={handleBackgroundMouseUp}
      />

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
            {/* Wide invisible hit-area so the thin visible line is still easy to click. */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={16}
              onClick={(e) => handleEdgeClick(e, edge.id, edge.weight)}
              onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
              style={{ cursor: locked ? 'default' : 'pointer' }}
              data-testid={`edge-${edge.id}`}
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={`${EDGE_STROKE[state]} ${isCurrent ? 'animate-pulse' : ''} pointer-events-none`}
              strokeWidth={EDGE_WIDTH[state]}
              strokeDasharray={state === 'rejected' ? '4 4' : undefined}
              markerEnd={graph.mode === 'directed' ? 'url(#arrowhead)' : undefined}
            />
            {editingEdgeId === edge.id ? (
              <foreignObject x={midX - 28} y={midY - 12} width={56} height={24}>
                <input
                  type="number"
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={commitEdgeWeight}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdgeWeight()
                    if (e.key === 'Escape') setEditingEdgeId(null)
                  }}
                  className="w-full h-full text-center text-xs border border-sky-400 rounded"
                  data-testid={`edge-weight-input-${edge.id}`}
                />
              </foreignObject>
            ) : (
              <text
                x={midX}
                y={midY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-slate-700 select-none pointer-events-none"
                style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 4 }}
              >
                {edge.weight}
              </text>
            )}
          </g>
        )
      })}

      {drag?.moved && draggedNode && (
        <line
          x1={draggedNode.x}
          y1={draggedNode.y}
          x2={drag.currentX}
          y2={drag.currentY}
          className="stroke-slate-400"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}

      {graph.nodes.map((node) => {
        const state = visualState.nodes[node.id] ?? 'unvisited'
        const isCurrent = visualState.currentNodeId === node.id
        const isDragging = drag?.moved && drag.nodeId === node.id
        const cx = isDragging ? drag.currentX : node.x
        const cy = isDragging ? drag.currentY : node.y
        const isStart = node.id === startNodeId
        const isEnd = node.id === endNodeId

        return (
          <g key={node.id}>
            {(isStart || isEnd) && (
              <circle
                cx={cx}
                cy={cy}
                r={NODE_RADIUS + 5}
                fill="none"
                className={isStart ? 'stroke-green-500' : 'stroke-purple-500'}
                strokeWidth={3}
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={NODE_RADIUS}
              className={`${NODE_FILL[state]} ${NODE_STROKE[state]} ${isCurrent ? 'animate-pulse' : ''}`}
              strokeWidth={3}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
              style={{ cursor: locked ? 'default' : 'grab' }}
              data-testid={`node-${node.id}`}
            />
            <text
              x={cx}
              y={cy}
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
