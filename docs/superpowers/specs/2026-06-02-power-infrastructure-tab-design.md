# §V — Power Infrastructure tab — design

Date: 2026-06-02
Status: approved

## Goal

Wire the new HIFLD "Power Infrastructure" dataset (staged into
`../social-data-commons/dashboard_data/va_energy_data/`) into the Virginia
Energy Data Atlas as its own tab: a county choropleth over 4 measures plus a
point overlay that distinguishes power plants from substations. Follow the
existing DataCenters/EV patterns throughout — no new shared components.

## Source data (verified)

- `va_pt_hifld_2026_power_infrastructure.geojson` — 1,571 Point features.
  - `type` is `"power_plant"` (189) or `"substation"` (1,382).
  - Common props: `facility_id`, `facility_name`, `year` (2026), `type`,
    `geoid` (5-digit county FIPS), `status`, `source_id`.
  - Plants also carry: `operator`, `plant_capacity_mw`, `plant_source`
    (EIA fuel code: NUC/WAT/NG/SUN/BIT/DFO/RFO/BLQ/WDS/MSW/LFG/OBG/WND/…).
  - Substations also carry: `max_voltage` (kV), `lines`.
  - Null props are omitted per feature.
- `va_ct_hifld_2026_power_infrastructure.csv.xz` — county long-format, 512 rows
  = 128 counties × 4 measures. Standard energy schema
  (`geoid, datetime, measure, value, moe, region_type, data_method, scenario`).
  - measures: `power_plant_count`, `substation_count`, `power_facility_count`,
    `total_plant_capacity_mw`.
  - `region_type=county`, `data_method=observed`,
    `scenario=hifld_snapshot_2026_05_29`.
- `../social-data-commons/energy/PowerInfrastructure/measure_info.json` — text
  (short/long descriptions, provenance, unit) for the 4 measures. Source for
  component-level labels/units/descriptions only.

Sanity values: Bath 51017 = 2,862 MW (county capacity leader); Surry 51181 NUC
1,695 MW; North Anna 51109 NUC 1,960 MW; Prince William 51153 / Fairfax 51059
lead facility counts.

## Design decisions (approved)

1. **Overlay UX:** two *independent* toggles (show plants / show substations,
   both default on). Plants = individual teal dots; substations = slate
   clusters.
2. **County detail panel:** per-point aggregation (Overview pattern) — lazy-load
   the GeoJSON, show the 4 county measures + fuel mix + top plants by capacity,
   with a `countyData`-only fallback.
3. **Default choropleth measure:** `power_facility_count`.

## 1. Build pipeline (`scripts/build-data.ts`)

Add `loadPowerInfrastructureCounty()` mirroring `loadDataCentersCounty` exactly
(single scenario, scalar values, `hourly=false`). Call it in `main()`, fold it
into the `counties` merge chain, and log the county count.

`codeFor()` auto-emits the 4 measures into `variables.json` as
`{measure, scenario: "hifld_snapshot_2026_05_29", data_method: "observed",
hourly: false}` — identical to every other dataset. No `variables.json` schema
change; human-readable units/labels/descriptions live in the components, sourced
from `measure_info.json`.

`copyFileSync` the point GeoJSON to `public/geo/power_infrastructure.geojson`
(mirrors `va_pt_im3_2026_data_centers.geojson` → `dc_existing.geojson`).

## 2. New tab component (`src/components/PowerTab.tsx`)

Hybrid of `EVTab` (LayerSelector over scalar measures) + `OverviewTab` (lazy
per-county point aggregation).

- **LayerSelector** over the 4 measures; default `power_facility_count`.
  - `power_facility_count` → "Power facilities" · facilities
  - `power_plant_count` → "Power plants" · facilities
  - `substation_count` → "Substations" · facilities
  - `total_plant_capacity_mw` → "Plant capacity" · MW
- **ChoroplethMap** on the selected measure (`findCode` over `variables`),
  reusing `useDefaultTopCounty`.
- **Two independent overlay toggles** (`showPlants`, `showSubstations`, both
  default true). `pointLayers` is assembled from whichever are on:
  - Plants — `filter: p => p.type === "power_plant"`, `cluster: false`,
    color `#006a6b` (gen teal), radius 4.
  - Substations — `filter: p => p.type === "substation"`, `cluster: true`,
    color `#3f5170` (slate), radius 3.
  - Control: a small local `OverlayToggles` block (two buttons styled like
    `PointsToggle`) inside `PowerTab`. Not a new shared component — two stacked
    `PointsToggle` instances would overlap.
- **Sidebar:** statewide-totals card (4 totals) + detail panels.
- Editorial header in the §-chapter voice ("§V · Chapter the Fifth").

## 3. Detail panels (in `PowerTab.tsx`)

- **Facility panel** (clicked point), type-aware, modeled on
  `DCFacilityDetailPanel`:
  - Plant: operator, capacity MW, fuel (mapped fuel-code → name with raw
    fallback), status, county FIPS.
  - Substation: max voltage (kV), lines, status, county FIPS.
  - Provenance: `facility_id`, `source_id`.
- **County panel** (Overview-style): lazy-load
  `power_infrastructure.geojson` once, index by `geoid`. Show the 4 county
  measures + fuel mix (count by `plant_source`) + top plants by capacity.
  Fall back to `countyData` measures if the fetch fails.

## 4. Wiring & appendix

- `TabNav.tsx`: add `{ id: "power", marker: "§V", label: "Power Infrastructure" }`
  before the `data` (Appendix) tab.
- `AppLayout.tsx`: import `PowerTab`, add `{tab === "power" && <PowerTab />}`.
- `DataTab.tsx`: add `DatasetSection index="07"` for HIFLD Power Infrastructure
  (venue, `measure_info.json` provenance text, the 4 measures), referencing §V.

## 5. Verification

- `npm run build:data` → `public/geo/power_infrastructure.geojson` exists;
  `variables.json` gains 4 codes; `county.json` has Bath 51017 capacity ≈ 2,862.
- `npm run dev`, open `?tab=power`: choropleth renders; both overlays toggle
  independently; Bath leads capacity layer; Surry/North Anna nuclear appear on
  click; Prince William/Fairfax lead facility counts.

## Out of scope

- No changes to shared components (`ChoroplethMap`, `LayerSelector`,
  `PointsToggle`, `DetailPanels`, `DataProvider`).
- No `variables.json` schema change.
- No new dependencies.
