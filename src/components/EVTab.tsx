"use client";

import { useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { LayerSelector, type LayerOption } from "./LayerSelector";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { HourOfDayStrip } from "./HourOfDayStrip";
import { useSelectionStore } from "./selectionStore";

const LAYER_OPTIONS: { label: string; measure: string }[] = [
  { label: "Total stations", measure: "total_station_count" },
  { label: "Total chargers", measure: "total_charger_count" },
  { label: "L1 stations", measure: "l1_station_count" },
  { label: "L2 stations", measure: "l2_station_count" },
  { label: "L3 stations", measure: "l3_station_count" },
];

export function EVTab() {
  const { loading, error, countyData, variables } = useData();
  const [selectedMeasure, setSelectedMeasure] = useState("total_charger_count");
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);

  // Stable identity — never changes, so empty dep array is correct.
  const pointLayers = useMemo(
    () => [
      {
        geojsonUrl: "/geo/ev_stations.geojson",
        cluster: false,
        color: "#1d4ed8",
        radius: 4,
        layerLabel: "Existing station",
      },
      {
        geojsonUrl: "/geo/ev_demand_locations.geojson",
        cluster: true,
        color: "#dc2626",
        radius: 3,
        layerLabel: "Charging location",
      },
    ],
    []
  );

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

  // Resolve indicator codes for the layer-selector options
  const layerOptions: LayerOption[] = LAYER_OPTIONS.map(({ label, measure }) => {
    const entry = Object.entries(variables).find(
      ([, m]) => m.measure === measure
    );
    return entry ? { code: entry[0], label } : null;
  }).filter((x): x is LayerOption => x !== null);

  const selectedCode = layerOptions.find(
    (o) => variables[o.code]?.measure === selectedMeasure
  )?.code;

  if (!selectedCode) {
    return (
      <div className="py-10 text-center text-red-600">
        EV Infrastructure: indicator <code>{selectedMeasure}</code> missing
        from <code>variables.json</code>. Re-run the build script.
      </div>
    );
  }

  const measureMeta = variables[selectedCode];
  const measureLabel =
    LAYER_OPTIONS.find((o) => o.measure === measureMeta.measure)?.label ??
    measureMeta.measure;

  // Hourly demand: find the code for ev_charging_demand_kwh
  const demandCode = Object.entries(variables).find(
    ([, m]) => m.measure === "ev_charging_demand_kwh"
  )?.[0];

  // Get hourly data for the selected county (or statewide aggregate fallback)
  const hourlyValues: number[] = (() => {
    if (!demandCode) return new Array(24).fill(0);
    if (selectedGeoid) {
      const v = countyData[selectedGeoid]?.[demandCode];
      if (Array.isArray(v)) return v;
      return new Array(24).fill(0);
    }
    // Statewide: sum the arrays across all counties
    const sum = new Array(24).fill(0) as number[];
    for (const geoid of Object.keys(countyData)) {
      const v = countyData[geoid][demandCode];
      if (Array.isArray(v)) {
        for (let h = 0; h < 24; h++) sum[h] += v[h] ?? 0;
      }
    }
    return sum;
  })();

  // Cast countyData to ChoroplethMap's expected scalar-only shape
  const choroplethData: Record<string, Record<string, number>> = {};
  for (const geoid of Object.keys(countyData)) {
    const entry = countyData[geoid][selectedCode];
    if (typeof entry === "number") {
      choroplethData[geoid] = { [selectedCode]: entry };
    }
  }

  // Snapshot stats for the selected measure
  const values = Object.values(choroplethData)
    .map((m) => m[selectedCode])
    .filter((v): v is number => typeof v === "number");
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 0);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[selectedCode] === max
  )?.[0];

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">EV Infrastructure</h2>
          <ProvenanceBadge
            dataMethod={measureMeta.data_method}
            scenario={measureMeta.scenario}
          />
        </div>
        <LayerSelector
          options={layerOptions}
          selected={selectedCode}
          onChange={(code) => {
            const m = variables[code]?.measure;
            if (m) setSelectedMeasure(m);
          }}
        />
        <ChoroplethMap
          indicatorCode={selectedCode}
          countyData={choroplethData}
          measureLabel={measureLabel}
          pointLayers={pointLayers}
        />
        <HourOfDayStrip
          values={hourlyValues}
          label={
            selectedGeoid
              ? `Hourly EV charging demand — ${selectedGeoid}`
              : "Hourly EV charging demand — statewide"
          }
        />
      </div>
      <aside className="col-span-12 space-y-4 lg:col-span-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {measureLabel} snapshot
        </h3>
        <div className="rounded border border-gray-200 p-3 text-sm">
          <div>
            Statewide total: <b>{total.toLocaleString()}</b>
          </div>
          <div>
            Counties with data: <b>{values.length}</b>
          </div>
          <div>
            Top county: <b>{topGeoid ?? "n/a"}</b> ({max.toLocaleString()})
          </div>
          {selectedGeoid && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              Selected: <b>{selectedGeoid}</b>
              <br />
              Value:{" "}
              <b>
                {(
                  choroplethData[selectedGeoid]?.[selectedCode] as
                    | number
                    | undefined
                )?.toLocaleString() ?? "n/a"}
              </b>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Click a county on the map to filter the hourly demand strip below.
        </p>
      </aside>
    </div>
  );
}
