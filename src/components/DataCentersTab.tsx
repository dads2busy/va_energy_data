"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { PointsToggle } from "./PointsToggle";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { ScenarioSelector } from "./ScenarioSelector";
import {
  ImplicationStrip,
  type ImplicationMeasure,
} from "./ImplicationStrip";
import { useSelectionStore } from "./selectionStore";
import {
  DetailPanelShell,
  DetailRow,
  EmptyDetailPanel,
} from "./DetailPanels";
import { useDefaultTopCounty } from "./useDefaultTopCounty";

type FacilityProps = Record<string, unknown>;

const DEFAULT_SCENARIO = "im3_cerf_moderate_50";

// Order + presentation of the 6 projected measures
const PROJECTED_MEASURES: {
  measure: string;
  label: string;
  unit: string;
  format?: (v: number) => string;
}[] = [
  {
    measure: "projected_data_center_count",
    label: "Projected facilities",
    unit: "Sites",
  },
  {
    measure: "total_projected_it_power_mw",
    label: "Total IT power",
    unit: "MW",
  },
  {
    measure: "total_projected_campus_sqft",
    label: "Total campus area",
    unit: "Sq ft",
    format: (v: number) =>
      v >= 1e9
        ? `${(v / 1e9).toFixed(1)}B`
        : v >= 1e6
          ? `${(v / 1e6).toFixed(0)}M`
          : Math.round(v).toLocaleString(),
  },
  {
    measure: "total_projected_cost_million_usd",
    label: "Locational cost",
    unit: "$ Million",
    format: (v: number) =>
      v >= 1000
        ? `$${(v / 1000).toFixed(1)}B`
        : `$${Math.round(v).toLocaleString()}M`,
  },
  {
    measure: "total_projected_water_demand_mgy",
    label: "Cooling water demand",
    unit: "MGal/yr",
  },
  {
    measure: "total_projected_water_consumption_mgy",
    label: "Cooling water consumption",
    unit: "MGal/yr",
  },
];

export function DataCentersTab() {
  const { loading, error, countyData, variables, countyNames } = useData();
  const [scenario, setScenario] = useQueryState("dc_scenario", {
    defaultValue: DEFAULT_SCENARIO,
  });
  const [selectedMeasure, setSelectedMeasure] = useState(
    "projected_data_center_count"
  );
  const [showPoints, setShowPoints] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<FacilityProps | null>(
    null
  );
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);

  const handleFacilityClick = useCallback((p: FacilityProps) => {
    setSelectedFacility(p);
  }, []);
  const handleCountyClick = useCallback(() => {
    setSelectedFacility(null);
  }, []);

  // Pre-compute the point layers — depend on scenario so they refresh when it changes
  const pointLayers = useMemo(
    () =>
      showPoints
        ? [
            {
              geojsonUrl: "/geo/dc_existing.geojson",
              cluster: true,
              color: "#475569",
              radius: 3,
              layerLabel: "Existing facility",
            },
            {
              geojsonUrl: `/geo/dc_projected/${scenario}.geojson`,
              cluster: true,
              color: "#b9430b",
              radius: 3,
              layerLabel: "Projected facility",
            },
          ]
        : undefined,
    [showPoints, scenario]
  );

  // Resolve the variable code for the selected (measure, scenario)
  // (safe to call with null variables — returns undefined)
  const findCode = (measure: string, scn: string): string | undefined => {
    if (!variables) return undefined;
    const entry = Object.entries(variables).find(
      ([, m]) => m.measure === measure && m.scenario === scn
    );
    return entry?.[0];
  };

  // Compute statewide totals for ALL 6 projected measures under the active scenario
  // (safe to compute before guards — returns [] when countyData/variables are null)
  const implications: ImplicationMeasure[] = (!countyData || !variables)
    ? []
    : PROJECTED_MEASURES.map((m) => {
        const code = findCode(m.measure, scenario);
        if (!code) return null;
        let total = 0;
        for (const geoid of Object.keys(countyData)) {
          const v = countyData[geoid][code];
          if (typeof v === "number" && Number.isFinite(v)) total += v;
        }
        return { ...m, code, total };
      }).filter((x): x is ImplicationMeasure => x !== null);

  // The current `selectedMeasure` may not have a code under the new scenario
  // (rare, but defensive). If so, snap to the first implication.
  // Must be called unconditionally before any early returns (rules of hooks).
  useEffect(() => {
    if (implications.length === 0) return;
    const hasSelected = implications.find(
      (m) => m.measure === selectedMeasure
    );
    if (!hasSelected) {
      setSelectedMeasure(implications[0].measure);
    }
  }, [scenario, implications, selectedMeasure]);

  // Resolve indicator + choropleth slice before any conditional returns so
  // the default-selection hook runs unconditionally.
  const preSelectedCode = findCode(selectedMeasure, scenario);
  const preChoropleth: Record<string, Record<string, number>> = {};
  if (countyData && preSelectedCode) {
    for (const geoid of Object.keys(countyData)) {
      const entry = countyData[geoid][preSelectedCode];
      if (typeof entry === "number") {
        preChoropleth[geoid] = { [preSelectedCode]: entry };
      }
    }
  }

  useDefaultTopCounty(preSelectedCode, preChoropleth);

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;

  const selectedCode = preSelectedCode;
  if (!selectedCode) {
    return (
      <ErrorState
        message={`No (measure=${selectedMeasure}, scenario=${scenario}) entry in variables.json. Re-run build-data.`}
      />
    );
  }
  const measureMeta = variables[selectedCode];
  const choroplethData = preChoropleth;

  const activeImplication = implications.find(
    (m) => m.code === selectedCode
  );
  const measureLabel = activeImplication?.label ?? measureMeta.measure;

  return (
    <article className="fade-up">
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§IV</span> · Chapter the Fourth
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          Where the data centers{" "}
          <span className="display-italic">go next</span>
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <p className="text-[15px] leading-relaxed text-[--color-ink-muted]">
            Pacific Northwest National Laboratory's CERF model places ~3,770
            candidate data center facilities across the contiguous US under each
            of 20 scenarios — four demand-growth trajectories crossed with five
            market-gravity weightings. The map below shows Virginia under your
            chosen scenario; existing facilities ride along as slate-colored
            markers.
          </p>
          <ScenarioSelector selected={scenario} onChange={setScenario} />
        </div>
      </header>

      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[--color-paper-edge] pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
                Choropleth · Plate 4.1
              </div>
              <h3 className="display mt-0.5 text-lg font-medium text-[--color-ink]">
                {measureLabel}, by county · {scenario}
              </h3>
            </div>
            <ProvenanceBadge
              dataMethod={measureMeta.data_method}
              scenario={measureMeta.scenario}
            />
          </div>

          <div className="relative">
            <ChoroplethMap
              indicatorCode={selectedCode}
              countyData={choroplethData}
              measureLabel={measureLabel}
              pointLayers={pointLayers}
              onPointClick={handleFacilityClick}
              onCountyClick={handleCountyClick}
            />
            <PointsToggle
              active={showPoints}
              onToggle={() => setShowPoints((p) => !p)}
              swatchColor="#b9430b"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[--color-paper-edge] pb-3 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Overlay
            </span>
            <LegendDot
              color="#475569"
              label="Existing facility"
              count="~319 · IM3 Atlas 2026"
            />
            <LegendDot
              color="#b9430b"
              label="Projected centroid"
              count="this scenario only"
            />
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-3 space-y-5">
          {selectedFacility ? (
            <DCFacilityDetailPanel
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
            />
          ) : selectedGeoid ? (
            <DCCountyDetailPanel
              geoid={selectedGeoid}
              countyName={countyNames?.[selectedGeoid] ?? selectedGeoid}
              measureLabel={measureLabel}
              measureValue={
                (choroplethData[selectedGeoid]?.[selectedCode] as
                  | number
                  | undefined) ?? null
              }
              scenario={scenario}
              implications={implications}
              countyData={countyData}
            />
          ) : (
            <EmptyDetailPanel
              label="County detail"
              hint={
                <>
                  <em className="display-italic">Click any county</em> to see
                  its projected data-center pressure under this scenario.
                </>
              }
            />
          )}

          <div className="marginalia">
            <em>Scenario independence.</em> A single source <code className="font-mono text-[10px]">id</code> (say,{" "}
            <code className="font-mono text-[10px]">51_0</code>) is NOT the same
            facility across scenarios. Each scenario is a full re-siting; only
            statewide totals are commensurable.
          </div>

          <div className="border-l-2 border-[--color-paper-edge] pl-4">
            <div className="citation">Method</div>
            <p className="mt-1 text-[11px] leading-snug text-[--color-ink-muted]">
              CERF projections{" "}
              <em className="display-italic">simulated</em> by PNNL for the
              IM3 program. Polygons reprojected from Albers Equal Area Conic to
              WGS84; centroids spatial-joined to 2020 county boundaries.
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-6">
        <ImplicationStrip
          measures={implications}
          selectedCode={selectedCode}
          onSelect={(code) => {
            const m = variables[code]?.measure;
            if (m) setSelectedMeasure(m);
          }}
        />
      </div>
    </article>
  );
}

function LegendDot({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="block h-2.5 w-2.5 rounded-full border border-[--color-ink]"
        style={{ backgroundColor: color }}
      />
      <span className="text-[--color-ink]">{label}</span>
      <span className="font-mono text-[10px] text-[--color-ink-muted]">
        {count}
      </span>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
          Loading
        </div>
        <div className="display mt-2 text-lg italic text-[--color-ink-light]">
          Reading the atlas…
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-[--color-energy] bg-[--color-energy-soft] px-6 py-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy-deep]">
        Error
      </div>
      <div className="mt-1 text-sm text-[--color-ink]">{message}</div>
    </div>
  );
}

/** Panel shown for a clicked data-center point (existing or projected). */
function DCFacilityDetailPanel({
  facility,
  onClose,
}: {
  facility: FacilityProps;
  onClose: () => void;
}) {
  const name = String(
    facility.facility_name ?? facility.facility_id ?? "(unnamed)"
  );
  const operator =
    typeof facility.operator === "string" && facility.operator.trim()
      ? facility.operator
      : null;
  const sqftNum =
    typeof facility.sqft === "number"
      ? facility.sqft
      : typeof facility.sqft === "string"
        ? Number(facility.sqft)
        : NaN;
  const sqft = Number.isFinite(sqftNum) ? Math.round(sqftNum) : null;
  const itPowerNum =
    typeof facility.it_power_mw === "number"
      ? facility.it_power_mw
      : typeof facility.it_power_mw === "string"
        ? Number(facility.it_power_mw)
        : NaN;
  const itPower = Number.isFinite(itPowerNum) ? itPowerNum : null;
  const geomType = typeof facility.type === "string" ? facility.type : null;
  const countyId =
    typeof facility.county_id === "number" || typeof facility.county_id === "string"
      ? String(facility.county_id)
      : null;
  const year = typeof facility.year === "number" ? facility.year : null;
  const facilityId =
    typeof facility.facility_id === "string" ? facility.facility_id : null;
  const sourceId =
    typeof facility.source_id === "number" || typeof facility.source_id === "string"
      ? String(facility.source_id)
      : null;

  return (
    <DetailPanelShell
      label="Selected facility"
      title={name}
      onClose={onClose}
      closeAriaLabel="Close facility detail"
    >
      <dl className="space-y-3 px-4 py-3">
        {operator && (
          <DetailRow label="Operator" value={operator} emphasize />
        )}
        <DetailRow
          label="IT power"
          value={itPower !== null ? `${itPower.toLocaleString()} MW` : "—"}
          mono
          emphasize={itPower !== null}
        />
        <DetailRow
          label="Surface area"
          value={sqft !== null ? `${sqft.toLocaleString()} sq ft` : "—"}
          mono
          emphasize={sqft !== null}
        />
        {geomType && (
          <DetailRow label="OSM geometry" value={geomType} chip={geomType} />
        )}
        <DetailRow label="County FIPS" value={countyId ?? "—"} mono />
        <DetailRow
          label="Source year"
          value={year !== null ? String(year) : "—"}
          mono
        />
      </dl>

      {(facilityId || sourceId) && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
            Provenance
          </div>
          {facilityId && (
            <div className="mt-1 break-all font-mono text-[10px] text-[--color-ink-muted]">
              facility_id · {facilityId}
            </div>
          )}
          {sourceId && (
            <div className="break-all font-mono text-[10px] text-[--color-ink-muted]">
              source_id · {sourceId}
            </div>
          )}
        </div>
      )}
    </DetailPanelShell>
  );
}

/** County panel: shows every projected measure for the selected county
 *  under the current scenario, plus the active measure highlighted. */
function DCCountyDetailPanel({
  geoid,
  countyName,
  measureLabel,
  measureValue,
  scenario,
  implications,
  countyData,
}: {
  geoid: string;
  countyName: string;
  measureLabel: string;
  measureValue: number | null;
  scenario: string;
  implications: ImplicationMeasure[];
  countyData: Record<string, Record<string, number | (number | null)[]>>;
}) {
  return (
    <DetailPanelShell
      label="Selected county"
      title={countyName}
      subtitle={`FIPS · ${geoid} · ${scenario}`}
    >
      <dl className="space-y-3 px-4 py-3">
        <DetailRow
          label={measureLabel}
          value={
            measureValue !== null
              ? Math.round(measureValue).toLocaleString()
              : "—"
          }
          mono
          emphasize={measureValue !== null && measureValue > 0}
        />
      </dl>

      <div className="border-t border-[--color-paper-edge] px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
          All projected measures (this scenario)
        </div>
        <ul className="mt-2 space-y-1 text-[12px]">
          {implications.map((m) => {
            const v = countyData[geoid]?.[m.code];
            const num = typeof v === "number" ? v : null;
            const display =
              num === null
                ? "—"
                : m.format
                  ? m.format(num)
                  : Math.round(num).toLocaleString();
            return (
              <li
                key={m.code}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="truncate text-[--color-ink-muted]">
                  {m.label}
                </span>
                <span className="font-mono tabular-nums text-[--color-ink]">
                  {display}
                  <span className="ml-1 text-[10px] text-[--color-ink-light]">
                    {m.unit}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DetailPanelShell>
  );
}
