import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Trace } from '../../algorithms/types'
import { ACTIVE_COLOR, END_COLOR, NETWORK_STYLE, SEGMENT_STYLE, START_COLOR } from '../../roads/mapStyles'
import type { PlannedRoute } from '../../roads/planRoute'
import { SegmentStateTracker } from '../../roads/segmentStates'

export interface RoadMapProps {
  route: PlannedRoute | null
  trace: Trace | null
  index: number
  showNetwork: boolean
}

const UK_CENTER: [number, number] = [54.3, -2.5]
const SNAP_LINE_MIN_METERS = 25

function FitToRoute({ route }: { route: PlannedRoute | null }) {
  const map = useMap()
  useEffect(() => {
    if (!route) return
    const bounds = L.latLngBounds([route.from.lat, route.from.lng], [route.to.lat, route.to.lng]).pad(0.2)
    map.fitBounds(bounds, { maxZoom: 16 })
  }, [route, map])
  return null
}

/** Every downloaded road, faintly — "what the algorithm can see". Built once per route. */
function NetworkLayer({ route }: { route: PlannedRoute }) {
  const map = useMap()
  useEffect(() => {
    const renderer = L.canvas({ padding: 0.3 })
    const group = L.layerGroup()
    for (const seg of route.road.segments.values()) {
      L.polyline(seg.points, { ...NETWORK_STYLE, renderer }).addTo(group)
    }
    group.addTo(map)
    return () => {
      group.remove()
    }
  }, [route, map])
  return null
}

/**
 * The algorithm's progress, drawn imperatively. A React component per road
 * segment would mean reconciling tens of thousands of elements every animation
 * frame; instead the tracker reports only the segments whose state changed
 * since the last frame, and only those polylines are created, restyled, or
 * removed. Roads never touched by the search are never created at all.
 */
function SearchLayer({ route, trace, index }: Pick<RoadMapProps, 'route' | 'trace' | 'index'>) {
  const map = useMap()
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), [])
  const activeRenderer = useMemo(() => L.svg(), [])
  const layersRef = useRef(new Map<string, L.Polyline>())
  const trackerRef = useRef<SegmentStateTracker | null>(null)
  const activeRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    const layers = layersRef.current
    trackerRef.current = route && trace ? new SegmentStateTracker(trace, route.road.edgeSegment) : null
    return () => {
      for (const layer of layers.values()) layer.remove()
      layers.clear()
      activeRef.current?.remove()
      activeRef.current = null
      trackerRef.current = null
    }
  }, [route, trace, map])

  useEffect(() => {
    const tracker = trackerRef.current
    if (!tracker || !route) return
    const layers = layersRef.current

    for (const [segmentId, state] of tracker.seek(index)) {
      let layer = layers.get(segmentId)
      if (state === 'default') {
        layer?.remove()
        layers.delete(segmentId)
        continue
      }
      const style = SEGMENT_STYLE[state]
      if (!layer) {
        const seg = route.road.segments.get(segmentId)
        if (!seg) continue
        layer = L.polyline(seg.points, { ...style, renderer, interactive: false }).addTo(map)
        layers.set(segmentId, layer)
      } else {
        layer.setStyle(style)
      }
      if (state === 'path') layer.bringToFront()
    }

    const isDone = trace ? index >= trace.steps.length - 1 : false
    const activeLatLng = tracker.activeNodeId ? route.road.nodeLatLng.get(tracker.activeNodeId) : undefined
    if (activeLatLng && !isDone && index >= 0) {
      if (!activeRef.current) {
        activeRef.current = L.circleMarker(activeLatLng, {
          renderer: activeRenderer,
          radius: 8,
          color: ACTIVE_COLOR,
          weight: 3,
          fillColor: ACTIVE_COLOR,
          fillOpacity: 0.35,
          interactive: false,
          className: 'road-active-marker',
        }).addTo(map)
      } else {
        activeRef.current.setLatLng(activeLatLng)
      }
    } else {
      activeRef.current?.remove()
      activeRef.current = null
    }
  }, [index, route, trace, map, renderer, activeRenderer])

  return null
}

function EndpointMarkers({ route }: { route: PlannedRoute }) {
  const startNode = route.road.nodeLatLng.get(route.startNodeId)!
  const endNode = route.road.nodeLatLng.get(route.endNodeId)!
  const markers = [
    { key: 'A', point: route.from, snapped: startNode, snapMeters: route.startSnapMeters, color: START_COLOR },
    { key: 'B', point: route.to, snapped: endNode, snapMeters: route.endSnapMeters, color: END_COLOR },
  ]
  return (
    <>
      {markers.map((m) => (
        <Fragment key={m.key}>
          {m.snapMeters >= SNAP_LINE_MIN_METERS && (
            <Polyline
              positions={[m.point, m.snapped]}
              pathOptions={{ color: m.color, weight: 2, dashArray: '4 4', opacity: 0.8 }}
            />
          )}
          <CircleMarker
            center={m.point}
            radius={9}
            pathOptions={{ color: 'white', weight: 3, fillColor: m.color, fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <strong>{m.key}</strong> {m.point.postcode}
            </Tooltip>
          </CircleMarker>
        </Fragment>
      ))}
    </>
  )
}

export function RoadMap({ route, trace, index, showNetwork }: RoadMapProps) {
  return (
    <MapContainer
      center={UK_CENTER}
      zoom={6}
      preferCanvas
      scrollWheelZoom
      className="h-[560px] w-full rounded-lg border border-slate-200 z-0"
      aria-label="Real roads map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitToRoute route={route} />
      {showNetwork && route && <NetworkLayer route={route} />}
      <SearchLayer route={route} trace={trace} index={index} />
      {route && <EndpointMarkers route={route} />}
    </MapContainer>
  )
}
