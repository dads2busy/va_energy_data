# Virginia Energy Data

Interactive companion to the UVA Biocomplexity Institute residential energy digital twin research program.

This dashboard lets readers of the CHARGE-MAP, REVI-Twin, RAISE, and Thorve scidata papers (and viewers of related presentations) explore the same VA-synthetic-population data the papers analyze.

## Status

All chapters are live, plus a Data appendix documenting every source dataset.

| Tab | Chapter | Status |
|---|---|---|
| Data Centers | §I | Live — existing data-center facility counts (IM3 OSM atlas) |
| Data Center Pressure | §II | Live — projected siting, 20 CERF scenarios (IM3) |
| EV Infrastructure | §III | Live — CHARGE-MAP stations + hourly demand |
| Residential Adoption | §IV | Live — REVI-Twin / Thorve adoption + PV generation |
| Power Infrastructure | §V | Live — HIFLD power plants & substations |
| Data | Appendix | Live — source datasets & methodology |

Retrofit & Equity (RAISE) is documented in the appendix but not yet rendered — it's blocked on the RAISE pipeline.

## Data source

Built-time CSVs from `~/git/social-data-commons/dashboard_data/va_energy_data/`. Each of the 6 energy pipelines in `social-data-commons/energy/*` has a `prepare.py` that drops its outputs there. The dashboard's `scripts/build-data.ts` transforms those CSVs into `public/data/*.json` at build time.

The datasets:

- **DataCenters** / **DataCentersProjected** — IM3 existing (OSM-derived) and CERF-projected data-center siting.
- **EVChargingStations** / **EVChargingDemand** — CHARGE-MAP simulated stations and hourly charging demand.
- **ResidentialEnergyScenario** — REVI-Twin + Thorve synthetic-household adoption and PV generation (county + tract).
- **PowerInfrastructure** — *observed* HIFLD Power Plants & Electric Substations for Virginia (snapshot `2026-05-29`): per-county plant/substation/facility counts and total operating capacity (MW), plus a point overlay distinguishing plants from substations. County FIPS comes from HIFLD's `COUNTYFIPS`, with facilities lacking a usable code (e.g. the offshore CVOW wind farm) backfilled to the nearest 2020 county polygon so the point layer and county counts agree.

## Develop

Requires `~/git/social-data-commons` checked out alongside this repo with the energy pipelines having run.

```bash
npm install
npm run build:data   # transforms CSVs from ../social-data-commons into public/data/
npm run dev          # http://localhost:3000
```

## Build for production

```bash
npm run build
# static export in ./out/
```

## Architecture

- Next.js 15 App Router, `output: 'export'`
- React 19 + TypeScript strict + Tailwind 4
- React Leaflet 5 for choropleth maps; Plotly.js basic for charts (added in later phases)
- Zustand 5 for UI preferences (localStorage-persisted); Nuqs 2 for URL state (shareable)
- Build-time CSV → JSON transform via `scripts/build-data.ts`; no backend at runtime

See `docs/superpowers/specs/2026-05-13-va-energy-dashboard-design.md` in the `social-data-commons` repo for the full design.

## License

(To be determined.)
