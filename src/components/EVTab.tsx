"use client";

import { useCallback, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { LayerSelector, type LayerOption } from "./LayerSelector";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { HourOfDayStrip } from "./HourOfDayStrip";
import { PointsToggle } from "./PointsToggle";
import { useSelectionStore } from "./selectionStore";
import {
  DetailPanelShell,
  DetailRow,
  EmptyDetailPanel,
} from "./DetailPanels";
import { useDefaultTopCounty } from "./useDefaultTopCounty";

type FacilityProps = Record<string, unknown>;

const LAYER_OPTIONS: { label: string; measure: string }[] = [
  { label: "Total chargers", measure: "total_charger_count" },
  { label: "Total stations", measure: "total_station_count" },
  { label: "L3 fast", measure: "l3_station_count" },
  { label: "L2 medium", measure: "l2_station_count" },
  { label: "L1 slow", measure: "l1_station_count" },
];

export function EVTab() {
  const { loading, error, countyData, variables, countyNames } = useData();
  const [selectedMeasure, setSelectedMeasure] = useState("total_charger_count");
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

  // Match the layer-selector measure to the station-type filter applied to
  // the points overlay. Level-specific measures show only that level; the
  // "Total stations" / "Total chargers" measures show all stations.
  const stationType: "l1" | "l2" | "l3" | null = (() => {
    if (selectedMeasure === "l1_station_count") return "l1";
    if (selectedMeasure === "l2_station_count") return "l2";
    if (selectedMeasure === "l3_station_count") return "l3";
    return null;
  })();

  const overlayLabel = stationType
    ? `${stationType.toUpperCase()} station`
    : "EV station";

  const pointLayers = useMemo(
    () =>
      showPoints
        ? [
            {
              geojsonUrl: "/geo/ev_stations.geojson",
              cluster: true,
              color: "#1f3aa1",
              radius: 3.5,
              layerLabel: overlayLabel,
              filter: stationType
                ? (p: Record<string, unknown>) => p.type === stationType
                : undefined,
            },
          ]
        : undefined,
    [showPoints, stationType, overlayLabel]
  );

  // Resolve indicator metadata and the scalar choropleth slice before any
  // conditional returns, so the hook below runs unconditionally.
  const layerOptions: LayerOption[] = variables
    ? LAYER_OPTIONS.map(({ label, measure }) => {
        const entry = Object.entries(variables).find(
          ([, m]) => m.measure === measure
        );
        return entry ? { code: entry[0], label } : null;
      }).filter((x): x is LayerOption => x !== null)
    : [];

  const selectedCode = variables
    ? layerOptions.find(
        (o) => variables[o.code]?.measure === selectedMeasure
      )?.code
    : undefined;

  const choroplethDataEarly: Record<string, Record<string, number>> = {};
  if (countyData && selectedCode) {
    for (const geoid of Object.keys(countyData)) {
      const entry = countyData[geoid][selectedCode];
      if (typeof entry === "number") {
        choroplethDataEarly[geoid] = { [selectedCode]: entry };
      }
    }
  }

  useDefaultTopCounty(selectedCode, choroplethDataEarly);

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;

  if (!selectedCode) {
    return (
      <ErrorState
        message={`EV Infrastructure: indicator ${selectedMeasure} missing from variables.json. Re-run the build script.`}
      />
    );
  }

  const measureMeta = variables[selectedCode];
  const measureLabel =
    LAYER_OPTIONS.find((o) => o.measure === measureMeta.measure)?.label ??
    measureMeta.measure;

  const demandCode = Object.entries(variables).find(
    ([, m]) => m.measure === "ev_charging_demand_kwh"
  )?.[0];

  const hourlyValues: number[] = (() => {
    if (!demandCode) return new Array(24).fill(0);
    if (selectedGeoid) {
      const v = countyData[selectedGeoid]?.[demandCode];
      if (Array.isArray(v)) return v;
      return new Array(24).fill(0);
    }
    const sum = new Array(24).fill(0) as number[];
    for (const geoid of Object.keys(countyData)) {
      const v = countyData[geoid][demandCode];
      if (Array.isArray(v)) {
        for (let h = 0; h < 24; h++) sum[h] += v[h] ?? 0;
      }
    }
    return sum;
  })();

  const choroplethData = choroplethDataEarly;

  const values = Object.values(choroplethData)
    .map((m) => m[selectedCode])
    .filter((v): v is number => typeof v === "number");
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 0);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[selectedCode] === max
  )?.[0];

  return (
    <article className="fade-up">
      {/* Chapter heading */}
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§II</span> · Chapter the Second
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          Where Virginians will{" "}
          <span className="display-italic">plug in</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          Simulated charging infrastructure and hourly demand across Virginia
          under a 2026 scenario. The CHARGE-MAP framework places stations and
          flags transformer upgrades; the digital twin generates the demand
          curve below from synthetic households.
        </p>
      </header>

      {/* Layout grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9 space-y-5">
          {/* Layer selector + provenance */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[--color-paper-edge] pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
                Choropleth · Plate 2.1
              </div>
              <h3 className="display mt-0.5 text-lg font-medium text-[--color-ink]">
                {measureLabel}, by county
              </h3>
            </div>
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
              swatchColor="#1f3aa1"
            />
          </div>

          {/* Point overlay legend — reflects the type currently shown */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[--color-paper-edge] pb-3 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Overlay
            </span>
            <LegendDot
              color="#1f3aa1"
              label={
                stationType
                  ? `${stationType.toUpperCase()} station`
                  : "EV station (all levels)"
              }
              count={
                stationType === "l1"
                  ? "13"
                  : stationType === "l2"
                    ? "4,922"
                    : stationType === "l3"
                      ? "580"
                      : "~5,515"
              }
            />
          </div>

          {/* Hour-of-day */}
          <HourOfDayStrip
            values={hourlyValues}
            unit="kWh"
            label={
              selectedGeoid
                ? `Hourly EV charging demand — ${selectedGeoid}`
                : `Hourly EV charging demand — statewide`
            }
          />
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-5">
          {selectedFacility ? (
            <EVFacilityDetailPanel
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
            />
          ) : selectedGeoid ? (
            <EVCountyDetailPanel
              geoid={selectedGeoid}
              countyName={countyNames?.[selectedGeoid] ?? selectedGeoid}
              variables={variables}
              countyData={countyData}
              measureLabel={measureLabel}
              measureValue={
                (choroplethData[selectedGeoid]?.[selectedCode] as
                  | number
                  | undefined) ?? null
              }
              demandCode={demandCode}
            />
          ) : (
            <EmptyDetailPanel
              label="County detail"
              hint={
                <>
                  <em className="display-italic">Click any county</em> to see
                  its EV infrastructure profile.
                </>
              }
            />
          )}

          <div className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              {measureLabel}
            </div>
            <div className="display tabular-nums mt-2 text-4xl font-medium leading-none text-[--color-energy]">
              {total.toLocaleString()}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
              Statewide total
            </div>

            <div className="mt-4 space-y-2 border-t border-[--color-paper-edge] pt-3 text-xs">
              <Stat
                label="Counties with data"
                value={values.length.toLocaleString()}
              />
              <Stat
                label={`Top county (${topGeoid ?? "—"})`}
                value={max.toLocaleString()}
              />
            </div>
          </div>

          <div className="marginalia">
            <em>How to read.</em> Click any county to filter the hourly profile.
            Click a peak hour on the temporal axis to mark it. Selection
            persists when you switch chapters.
          </div>

          <div className="border-l-2 border-[--color-paper-edge] pl-4">
            <div className="citation">Method</div>
            <p className="mt-1 text-[11px] leading-snug text-[--color-ink-muted]">
              Stations and charging locations are{" "}
              <em className="display-italic">simulated</em> under the{" "}
              <code className="font-mono text-[10px]">
                va_2026_run2_eval30
              </code>{" "}
              scenario. Demand kWh per (county, hour-of-day) is summed across
              all locations attributed to that county by point-in-polygon.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[--color-ink-muted]">{label}</span>
      <span className="tabular-nums font-medium text-[--color-ink]">
        {value}
      </span>
    </div>
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

/** Panel shown for a clicked EV station point. */
function EVFacilityDetailPanel({
  facility,
  onClose,
}: {
  facility: FacilityProps;
  onClose: () => void;
}) {
  const name = String(
    facility.facility_name ?? facility.facility_id ?? "(unnamed)"
  );
  const stationType =
    typeof facility.type === "string" ? facility.type.toUpperCase() : null;
  const chargers =
    typeof facility.count === "number" ? facility.count : null;
  const year = typeof facility.year === "number" ? facility.year : null;
  const geoid =
    typeof facility.geoid === "number" || typeof facility.geoid === "string"
      ? String(facility.geoid)
      : null;
  const facilityId =
    typeof facility.facility_id === "string" ? facility.facility_id : null;
  const stationId =
    typeof facility.station_id === "string" ? facility.station_id : null;

  return (
    <DetailPanelShell
      label="Selected station"
      title={name}
      onClose={onClose}
      closeAriaLabel="Close station detail"
    >
      <dl className="space-y-3 px-4 py-3">
        <DetailRow
          label="Charger level"
          value={stationType ?? "—"}
          chip={stationType ?? undefined}
        />
        <DetailRow
          label="Chargers at this station"
          value={chargers !== null ? chargers.toLocaleString() : "—"}
          mono
          emphasize={chargers !== null}
        />
        <DetailRow label="County FIPS" value={geoid ?? "—"} mono />
        <DetailRow
          label="Source year"
          value={year !== null ? String(year) : "—"}
          mono
        />
      </dl>

      {(facilityId || stationId) && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
            Provenance
          </div>
          {facilityId && (
            <div className="mt-1 break-all font-mono text-[10px] text-[--color-ink-muted]">
              facility_id · {facilityId}
            </div>
          )}
          {stationId && (
            <div className="break-all font-mono text-[10px] text-[--color-ink-muted]">
              station_id · {stationId}
            </div>
          )}
        </div>
      )}
    </DetailPanelShell>
  );
}

/** EV infrastructure profile for the selected county. */
function EVCountyDetailPanel({
  geoid,
  countyName,
  variables,
  countyData,
  measureLabel,
  measureValue,
  demandCode,
}: {
  geoid: string;
  countyName: string;
  variables: Record<string, { measure: string; scenario: string }>;
  countyData: Record<string, Record<string, number | (number | null)[]>>;
  measureLabel: string;
  measureValue: number | null;
  demandCode: string | undefined;
}) {
  // Resolve all EV station/charger measures so the panel can show a
  // breakdown alongside the currently-active layer.
  const codeFor = (measure: string): string | undefined =>
    Object.entries(variables).find(([, m]) => m.measure === measure)?.[0];
  const get = (measure: string): number | null => {
    const c = codeFor(measure);
    if (!c) return null;
    const v = countyData[geoid]?.[c];
    return typeof v === "number" ? v : null;
  };
  const totalChargers = get("total_charger_count");
  const totalStations = get("total_station_count");
  const l1 = get("l1_station_count");
  const l2 = get("l2_station_count");
  const l3 = get("l3_station_count");

  // Peak hourly demand for the county.
  let peakKwh: number | null = null;
  let peakHour: number | null = null;
  if (demandCode) {
    const arr = countyData[geoid]?.[demandCode];
    if (Array.isArray(arr)) {
      for (let h = 0; h < arr.length; h++) {
        const v = arr[h];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (peakKwh === null || v > peakKwh) {
            peakKwh = v;
            peakHour = h;
          }
        }
      }
    }
  }

  const fmt = (v: number | null) =>
    v === null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <DetailPanelShell
      label="Selected county"
      title={countyName}
      subtitle={`FIPS · ${geoid}`}
    >
      <dl className="space-y-3 px-4 py-3">
        <DetailRow
          label={measureLabel}
          value={fmt(measureValue)}
          mono
          emphasize={measureValue !== null && measureValue > 0}
        />
        <DetailRow label="Total chargers" value={fmt(totalChargers)} mono />
        <DetailRow label="Total stations" value={fmt(totalStations)} mono />
      </dl>

      <div className="border-t border-[--color-paper-edge] px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
          Stations by level
        </div>
        <ul className="mt-2 space-y-1 text-[12px]">
          <li className="flex items-baseline justify-between gap-2">
            <span className="text-[--color-ink-muted]">L1 slow</span>
            <span className="font-mono tabular-nums text-[--color-ink]">
              {fmt(l1)}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-2">
            <span className="text-[--color-ink-muted]">L2 medium</span>
            <span className="font-mono tabular-nums text-[--color-ink]">
              {fmt(l2)}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-2">
            <span className="text-[--color-ink-muted]">L3 fast</span>
            <span className="font-mono tabular-nums text-[--color-ink]">
              {fmt(l3)}
            </span>
          </li>
        </ul>
      </div>

      {peakKwh !== null && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
            Peak charging demand
          </div>
          <div className="mt-1 flex items-baseline gap-3 text-[12px]">
            <span className="font-mono tabular-nums text-[--color-ink]">
              {fmt(peakKwh)} kWh
            </span>
            <span className="text-[--color-ink-muted]">
              at hour {String(peakHour).padStart(2, "0")}:00
            </span>
          </div>
        </div>
      )}
    </DetailPanelShell>
  );
}
