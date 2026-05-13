"use client";

import { useData } from "./DataProvider";

export function OverviewTab() {
  const { loading, error, countyData, variables } = useData();

  if (error)
    return (
      <div className="py-10 text-center text-red-600">Error: {error}</div>
    );

  const counties = countyData ? Object.keys(countyData) : [];
  const variableCount = variables ? Object.keys(variables).length : 0;
  const totalDataCenterCode = variables
    ? Object.entries(variables).find(
        ([, m]) => m.measure === "total_data_center_count"
      )?.[0] ?? null
    : null;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9">
        <h2 className="text-lg font-medium">Overview</h2>
        <p className="mt-2 text-sm text-gray-600">
          Choropleth map renders in Task 5 of Phase 1. Today this tab confirms
          that data is loading and the indicator is available.
        </p>
        <div className="mt-4 rounded border border-gray-200 p-4 text-sm">
          <div>
            Counties loaded:{" "}
            <b>{loading ? "…" : counties.length}</b>
          </div>
          <div>
            Indicators loaded:{" "}
            <b>{loading ? "…" : variableCount}</b>
          </div>
          <div>
            <code>total_data_center_count</code> indicator code:{" "}
            <b>
              {loading
                ? "…"
                : (totalDataCenterCode ?? "(not found — check build script)")}
            </b>
          </div>
        </div>
      </div>
      <aside className="col-span-12 lg:col-span-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Per-county snapshot
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Sidebar coming in Task 5.
        </p>
      </aside>
    </div>
  );
}
