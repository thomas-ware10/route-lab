import { lazy, Suspense, useState } from 'react'
import { ComparisonPanel } from './components/ComparisonPanel'
import { ControlPanel } from './components/ControlPanel'
import { GraphCanvas } from './components/GraphCanvas'
import { PlaybackControls } from './components/PlaybackControls'
import { QuizPanel } from './components/QuizPanel'
import { RacePanel } from './components/RacePanel'
import { StatsPanel } from './components/StatsPanel'
import { WarningBanner } from './components/WarningBanner'

// Leaflet and the map stack only load when Real roads mode is first opened,
// so the basic model stays as light as it was.
const RoadsPanel = lazy(() => import('./components/roads/RoadsPanel').then((m) => ({ default: m.RoadsPanel })))

type Mode = 'basic' | 'roads'
type Tab = 'editor' | 'race' | 'quiz' | 'compare'

const MODES: [Mode, string][] = [
  ['basic', 'Basic model'],
  ['roads', 'Real roads'],
]

const TABS: [Tab, string][] = [
  ['editor', 'Editor'],
  ['race', 'Algorithm Race'],
  ['quiz', 'Quiz'],
  ['compare', 'Sparse vs. Dense'],
]

function App() {
  const [mode, setMode] = useState<Mode>('basic')
  const [tab, setTab] = useState<Tab>('editor')

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Graph Theory & Network Optimization Visualizer</h1>
          <p className="text-xs text-slate-500">
            {mode === 'basic'
              ? 'Click to add nodes, drag between them to connect. Right-click deletes. Click an edge to edit its weight.'
              : 'Enter two UK postcodes and watch the search find the shortest route over real roads.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50" role="tablist" aria-label="Mode">
          {MODES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`text-sm px-3 py-1 rounded-md ${
                mode === id ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {mode === 'basic' ? (
        <>
          <nav className="px-6 pt-3 flex gap-1">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`text-sm px-3 py-1.5 rounded-t-lg border border-b-0 ${
                  tab === id
                    ? 'bg-white border-slate-200 text-slate-900 font-medium'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <main className="p-6 pt-3 bg-white border-t border-slate-200">
            {tab === 'editor' ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-3">
                  <GraphCanvas />
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <PlaybackControls />
                  </div>
                </div>
                <div className="space-y-4">
                  <ControlPanel />
                  <WarningBanner />
                  <StatsPanel />
                </div>
              </div>
            ) : tab === 'race' ? (
              <RacePanel />
            ) : tab === 'quiz' ? (
              <QuizPanel />
            ) : (
              <ComparisonPanel />
            )}
          </main>
        </>
      ) : (
        <main className="p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading map…</p>}>
            <RoadsPanel />
          </Suspense>
        </main>
      )}
    </div>
  )
}

export default App
