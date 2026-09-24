import { useState } from 'react'
import { ComparisonPanel } from './components/ComparisonPanel'
import { ControlPanel } from './components/ControlPanel'
import { GraphCanvas } from './components/GraphCanvas'
import { PlaybackControls } from './components/PlaybackControls'
import { StatsPanel } from './components/StatsPanel'
import { WarningBanner } from './components/WarningBanner'

type Tab = 'editor' | 'compare'

function App() {
  const [tab, setTab] = useState<Tab>('editor')

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold text-slate-900">Graph Theory & Network Optimization Visualizer</h1>
        <p className="text-xs text-slate-500">
          Click to add nodes, drag between them to connect. Right-click deletes. Click an edge to edit its weight.
        </p>
      </header>

      <nav className="px-6 pt-3 flex gap-1">
        {(
          [
            ['editor', 'Editor'],
            ['compare', 'Sparse vs. Dense'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`text-sm px-3 py-1.5 rounded-t-lg border border-b-0 ${
              tab === id ? 'bg-white border-slate-200 text-slate-900 font-medium' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800'
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
        ) : (
          <ComparisonPanel />
        )}
      </main>
    </div>
  )
}

export default App
