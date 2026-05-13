"use client";

import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";

export function OverviewTab() {
  const { loading, error, countyData, variables } = useData();

  if (loading)
    return (
      <div className="py-10 text-center text-gray-500">Loading data…</div>
    );
  if (error || !countyData || !variables)
    return (
      <div className="py-10 text-center text-red-600">
        Error loading data: {error ?? "(unknown)"}
      </div>
    );

  // Find the indicator code for total_data_center_count
  const indicatorCode = Object.entries(variables).find(
    ([, m]) => m.measure === "total_data_center_count"
  )?.[0];

  if (!indicatorCode)
    return (
      <div className="py-10 text-center text-red-600">
        Indicator <code>total_data_center_count</code> missing from{" "}
        <code>variables.json</code>. Re-run the build script.
      </div>
    );

  // Cast to scalar-only shape for ChoroplethMap (filters out any hourly arrays)
  const choroplethData: Record<string, Record<string, number>> = {};
  for (const geoid of Object.keys(countyData)) {
    const entry = countyData[geoid][indicatorCode];
    if (typeof entry === "number") {
      choroplethData[geoid] = { [indicatorCode]: entry };
    }
  }

  // Compute snapshot stats
  const values = Object.values(choroplethData)
    .map((m) => m[indicatorCode])
    .filter((v) => Number.isFinite(v));
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[indicatorCode] === max
  )?.[0];

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9">
        <h2 className="text-lg font-medium">
          Existing Data Centers in Virginia (IM3 Atlas, 2026)
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          County-level count of OSM-derived data center records. A single
          physical facility may appear as multiple records (point + building +
          campus) — see the{" "}
          <a
            className="text-amber-700 underline"
            href="https://data.msdlive.org/records/p147s-4h760"
            target="_blank"
            rel="noreferrer"
          >
            IM3 Atlas page
          </a>
          .
        </p>
        <div className="mt-4">
          <ChoroplethMap
            indicatorCode={indicatorCode}
            countyData={choroplethData}
            measureLabel="Data center records"
          />
        </div>
      </div>
      <aside className="col-span-12 space-y-4 lg:col-span-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Statewide snapshot
        </h3>
        <div className="rounded border border-gray-200 p-3 text-sm">
          <div>
            Total VA data center records: <b>{total}</b>
          </div>
          <div>
            Counties with data centers: <b>{values.length}</b>
          </div>
          <div>
            Top county: <b>{topGeoid ?? "n/a"}</b> ({max} records)
          </div>
        </div>
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          About this dashboard
        </h3>
        <p className="text-sm text-gray-600">
          Interactive companion to the UVA Biocomplexity residential energy
          digital twin research program. Currently in Phase 1: only the
          Overview tab is fully wired.
        </p>
      </aside>
    </div>
  );
}
