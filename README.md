# Virginia Energy Data

Interactive companion to the UVA Biocomplexity Institute residential energy digital twin research program.

This dashboard lets readers of the CHARGE-MAP, REVI-Twin, RAISE, and Thorve scidata papers (and viewers of related presentations) explore the same VA-synthetic-population data the papers analyze.

## Status

**Phase 1** — Overview tab is fully wired; tabs 1–4 are stubbed and land in subsequent phases.

| Tab | Status |
|---|---|
| Overview | Live (data center counts) |
| EV Infrastructure | Stub (Phase 2) |
| Residential Adoption | Stub (Phase 3) |
| Data Center Pressure | Stub (Phase 3) |
| Retrofit & Equity | Stub (Phase 4, blocked on RAISE pipeline) |

## Data source

Built-time CSVs from `~/git/social-data-commons/dashboard_data/va_energy_data/`. Each of the 5 energy pipelines in `social-data-commons/energy/*` has a `prepare.py` that drops its outputs there. The dashboard's `scripts/build-data.ts` transforms those CSVs into `public/data/*.json` at build time.

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
