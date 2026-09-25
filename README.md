# Route Lab

> Vibe coded with [Claude Code](https://claude.com/claude-code).

An interactive visualizer for graph algorithms. You can watch Dijkstra, A\*, Kruskal and Prim solve a problem step by step: on graphs you draw yourself, or on real UK roads between two postcodes.

## Two modes

### Basic model
Draw a graph and watch the algorithms work on it.

- **Editor**: click to add nodes, drag from one node to another to connect them, click an edge to change its weight, right-click to delete. You can also generate a random graph with a set node count, density and weight range.
- **Step-by-step playback**: play, pause, step, and scrub through every decision the algorithm makes. Live stats show operation counts next to the theoretical Big-O.
- **Algorithm race**: run two algorithms that solve the same problem (Dijkstra vs A\*, or Kruskal vs Prim) side by side on the same graph with one shared timeline, and see which finishes first.
- **Quiz**: predict which node or edge the algorithm picks next, then see whether you were right and why.
- **Sparse vs dense**: compare how operation counts change as the graph gets denser.

Supports directed and undirected graphs. It warns about negative weights, disconnected graphs, and A\* heuristics that may be inadmissible.

### Real roads
Enter two UK postcodes up to 25 miles apart. The app downloads the real road network from OpenStreetMap and builds a routing graph from it, including one-way streets and roundabouts. It then animates the search on a live map.

- Watch Dijkstra spread out in every direction while A\* heads towards the destination, then compare how many junctions each one explored.
- See the final route as a list of roads with distances, next to the straight-line distance.

## Running it

Requires Node 20+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |

## How it works

- **React + TypeScript + Vite**, **Zustand** for state, **Tailwind** for styling, **Vitest** for tests.
- Each algorithm is a pure function that returns a *trace*: the full list of steps it took. Playback just moves through that list, so scrubbing, stepping and racing never re-run the algorithm.
- Real roads mode uses [postcodes.io](https://postcodes.io) to look up postcodes and the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) to download OpenStreetMap roads. It draws on a [Leaflet](https://leafletjs.com) map.
- For longer trips, it downloads major roads across the whole area plus every street near each postcode, the same approach real sat-navs use.

### Notes on the road data
Overpass runs on free, volunteer-hosted servers. Downloads usually take a few seconds, but when the servers are busy they can take up to a minute. The app retries and falls back to backup servers automatically. To use a different Overpass server, set it in a `.env` file:

```bash
VITE_OVERPASS_URL=https://your-overpass-instance/api/interpreter
```

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the ODbL.
