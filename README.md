# Urban AI — Collaborative City Planning (Taganrog MVP)

Click a point on the 2D map of Taganrog and a 10×10 m **3D Planning Sandbox** opens
for that spot, wired to four AI pillars.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. **No API keys are required** — every service runs in
Mock Mode by default (including an offline procedural basemap of Taganrog).

## Going live

Copy `.env.local.example` to `.env.local` and add any of:

| Key | Service | Powers |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS | Optional — without it the map runs on free Leaflet + CARTO dark raster tiles |
| `NEXT_PUBLIC_OPENROUTER_API_KEY` | OpenRouter | Community Sentiment NLP |
| `NEXT_PUBLIC_FAL_API_KEY` | Fal.ai (FLUX) | "Visualize" image renders |
| `NEXT_PUBLIC_TRIPO_API_KEY` | Tripo AI | Text-to-3D assets (placeholder) |

## Architecture

- `lib/store.ts` — Zustand store syncing map clicks → 3D scene, placed objects,
  cost, sentiment and compliance state.
- `components/MapComponent.tsx` — basemap with graceful degradation
  (Mapbox GL if token → free Leaflet + CARTO dark raster tiles → offline canvas),
  emits the Sync event on click.
- `components/Scene3D.tsx` — React Three Fiber viewport: 10×10 grid, real
  OSM surroundings, placeable objects with TransformControls,
  Environment / ContactShadows / OrbitControls.
- `services/osm.ts` + `components/scene/Surroundings.tsx` — real city context:
  building footprints, roads, trees and parks fetched from OpenStreetMap
  (Overpass; VK/mail.ru mirror first — it is the reliable one from Russian
  networks) and extruded into 3D with height data and window-lit facades.
  Falls back to procedural blocks if every mirror is unreachable.
- `services/ai.ts` — all AI calls with automatic Mock Mode fallback.
- `components/panels/` — the four pillars: Sentiment (NLP), Visualize
  (generative design), Cost Estimator, Compliance safety check.

## Urban-planning toolkit (ArcGIS-Urban-style)

- **Sun & shadow analysis** — time-of-day slider drives real solar position
  for Taganrog's latitude; shadows, sky, window glow and street lamps react.
- **Land-use zoning** — colour-coded OSM landuse overlays with a legend
  (residential / commercial / industrial / retail / education) and a toggle.
- **Parametric development blocks** — place a 6×8 m volume, set floors (1–25)
  and use (residential / commercial / mixed); cost and label update live.
- **Capacity metrics** — GFA, estimated residents, jobs, investment and site
  FAR per scenario, plus surrounding-context totals from real OSM buildings.
- **Scenario A/B** — two independent design alternatives with side-by-side
  metric columns; switch from the header or the Capacity panel.

## The four pillars

1. **NLP Analysis** — every map click triggers sentiment categorization
   (Park, Road repair, Transit, …) with a request breakdown.
2. **Generative Design** — "Visualize" turns the current 3D scene into an
   AI render prompt and displays the result.
3. **Estimator AI** — live cost card; Tree $200, Bench $500, Lamp $350,
   Fountain $4,200, updates as you add/remove/select objects.
4. **Compliance AI** — status light re-checks mock GIS layers (underground
   utilities, water mains, heritage zone, gas) on every scene change.
