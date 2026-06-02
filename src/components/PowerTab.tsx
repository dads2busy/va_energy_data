"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { LayerSelector, type LayerOption } from "./LayerSelector";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { useSelectionStore } from "./selectionStore";
import {
  DetailPanelShell,
  DetailRow,
  EmptyDetailPanel,
  RankedList,
} from "./DetailPanels";
import { useDefaultTopCounty } from "./useDefaultTopCounty";

type FacilityProps = Record<string, unknown>;

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Marker colors — chosen to read against the cream basemap and to be distinct
// from the blue/orange used by the data-center and EV overlays.
const PLANT_COLOR = "#006a6b"; // generation teal
const SUBSTATION_COLOR = "#3f5170"; // slate

// The 4 HIFLD county measures (single observed snapshot scenario). Labels and
// units follow energy/PowerInfrastructure/measure_info.json.
const LAYER_OPTIONS: { label: string; measure: string; unit: string }[] = [
  { label: "Power facilities", measure: "power_facility_count", unit: "Facilities" },
  { label: "Power plants", measure: "power_plant_count", unit: "Facilities" },
  { label: "Substations", measure: "substation_count", unit: "Facilities" },
  { label: "Plant capacity", measure: "total_plant_capacity_mw", unit: "MW" },
];

const DEFAULT_MEASURE = "power_facility_count";

// EIA energy-source codes (plant_source) → readable fuel names.
const FUEL_NAMES: Record<string, string> = {
  NUC: "Nuclear",
  WAT: "Hydro",
  NG: "Natural gas",
  SUN: "Solar",
  WND: "Wind",
  BIT: "Coal (bituminous)",
  DFO: "Distillate oil",
  RFO: "Residual oil",
  BLQ: "Black liquor",
  WDS: "Wood / wood waste",
  MSW: "Municipal solid waste",
  LFG: "Landfill gas",
  OBG: "Other biomass gas",
};

function fuelName(code: unknown): string {
  if (typeof code !== "string" || !code.trim() || code === "NOT AVAILABLE") {
    return "Unspecified";
  }
  return FUEL_NAMES[code] ?? code;
}

interface PowerFeature {
  properties?: {
    facility_name?: string;
    type?: "power_plant" | "substation";
    geoid?: string;
    operator?: string;
    plant_capacity_mw?: number;
    plant_source?: string;
  };
}

export function PowerTab() {
  const { loading, error, countyData, variables, countyNames } = useData();
  const [selectedMeasure, setSelectedMeasure] = useState(DEFAULT_MEASURE);
  const [showPlants, setShowPlants] = useState(true);
  const [showSubstations, setShowSubstations] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<FacilityProps | null>(
    null
  );
  const [powerByCounty, setPowerByCounty] = useState<
    Record<string, PowerFeature[]> | null
  >(null);
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);

  const handleFacilityClick = useCallback((p: FacilityProps) => {
    setSelectedFacility(p);
  }, []);
  const handleCountyClick = useCallback(() => {
    setSelectedFacility(null);
  }, []);

  // Lazy-load the point layer once and index by county for the detail panel.
  // The map fetches the same file, so it's usually warm in the HTTP cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${BASE}/geo/power_infrastructure.geojson`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const idx: Record<string, PowerFeature[]> = {};
        for (const f of (data.features ?? []) as PowerFeature[]) {
          const g = f.properties?.geoid;
          if (g == null) continue;
          (idx[String(g)] ??= []).push(f);
        }
        setPowerByCounty(idx);
      } catch {
        // Non-fatal; county panel falls back to countyData totals.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Assemble the overlay specs from whichever toggles are active. Plants render
  // as individual teal dots (only 189), substations cluster by county (1,382).
  const pointLayers = useMemo(() => {
    const layers = [];
    if (showPlants) {
      layers.push({
        geojsonUrl: "/geo/power_infrastructure.geojson",
        cluster: false,
        color: PLANT_COLOR,
        radius: 4,
        layerLabel: "Power plant",
        filter: (p: Record<string, unknown>) => p.type === "power_plant",
      });
    }
    if (showSubstations) {
      layers.push({
        geojsonUrl: "/geo/power_infrastructure.geojson",
        cluster: true,
        color: SUBSTATION_COLOR,
        radius: 3,
        layerLabel: "Substation",
        filter: (p: Record<string, unknown>) => p.type === "substation",
      });
    }
    return layers.length > 0 ? layers : undefined;
  }, [showPlants, showSubstations]);

  // Resolve indicator code + the scalar choropleth slice before any conditional
  // returns so the default-selection hook runs unconditionally.
  const findCode = (measure: string): string | undefined => {
    if (!variables) return undefined;
    return Object.entries(variables).find(
      ([, m]) => m.measure === measure
    )?.[0];
  };

  const layerOptions: LayerOption[] = variables
    ? LAYER_OPTIONS.map(({ label, measure }) => {
        const code = findCode(measure);
        return code ? { code, label } : null;
      }).filter((x): x is LayerOption => x !== null)
    : [];

  const selectedCode = findCode(selectedMeasure);

  const choroplethData: Record<string, Record<string, number>> = {};
  if (countyData && selectedCode) {
    for (const geoid of Object.keys(countyData)) {
      const entry = countyData[geoid][selectedCode];
      if (typeof entry === "number") {
        choroplethData[geoid] = { [selectedCode]: entry };
      }
    }
  }

  useDefaultTopCounty(selectedCode, choroplethData);

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;
  if (!selectedCode) {
    return (
      <ErrorState
        message={`Power Infrastructure: indicator ${selectedMeasure} missing from variables.json. Re-run npm run build:data.`}
      />
    );
  }

  const measureMeta = variables[selectedCode];
  const activeOption = LAYER_OPTIONS.find((o) => o.measure === selectedMeasure);
  const measureLabel = activeOption?.label ?? measureMeta.measure;
  const measureUnit = activeOption?.unit ?? "";

  // Statewide totals for all 4 measures.
  const totals = LAYER_OPTIONS.map((o) => {
    const code = findCode(o.measure);
    let total = 0;
    if (code) {
      for (const geoid of Object.keys(countyData)) {
        const v = countyData[geoid][code];
        if (typeof v === "number" && Number.isFinite(v)) total += v;
      }
    }
    return { ...o, code, total };
  });

  const values = Object.values(choroplethData)
    .map((m) => m[selectedCode])
    .filter((v): v is number => typeof v === "number");
  const max = Math.max(...values, 0);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[selectedCode] === max
  )?.[0];

  return (
    <article className="fade-up">
      {/* Chapter heading */}
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§V</span> · Chapter the Fifth
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          The grid that{" "}
          <span className="display-italic">carries the load</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          Where Virginia generates and routes its electricity. The Homeland
          Infrastructure Foundation-Level Data (HIFLD) inventory maps{" "}
          {totals[1].total.toLocaleString()} power plants and{" "}
          {totals[2].total.toLocaleString()} electric substations across the
          state. Generating capacity concentrates in a few large plants;
          substation density tracks where the load actually lives.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[--color-paper-edge] pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
                Choropleth · Plate 5.1
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
            <OverlayToggles
              showPlants={showPlants}
              showSubstations={showSubstations}
              onTogglePlants={() => setShowPlants((p) => !p)}
              onToggleSubstations={() => setShowSubstations((s) => !s)}
            />
          </div>

          {/* Overlay legend */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[--color-paper-edge] pb-3 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Overlay
            </span>
            <LegendDot
              color={PLANT_COLOR}
              label="Power plant"
              count={`${totals[1].total.toLocaleString()} · individual`}
            />
            <LegendDot
              color={SUBSTATION_COLOR}
              label="Substation"
              count={`${totals[2].total.toLocaleString()} · clustered`}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-5">
          <StatewideTotals
            measures={totals}
            activeCode={selectedCode}
            topGeoid={topGeoid}
            max={max}
          />

          {selectedFacility ? (
            <PowerFacilityDetailPanel
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
            />
          ) : selectedGeoid ? (
            <PowerCountyDetailPanel
              geoid={selectedGeoid}
              countyName={countyNames?.[selectedGeoid] ?? selectedGeoid}
              measures={totals}
              countyData={countyData}
              powerByCounty={powerByCounty}
            />
          ) : (
            <EmptyDetailPanel
              label="County detail"
              hint={
                <>
                  <em className="display-italic">Click any county</em> to see
                  its plants, substations, and fuel mix.
                </>
              }
            />
          )}

          <div className="marginalia">
            <em>A note on capacity.</em> Plants with unreported capacity in
            HIFLD are treated as 0 MW, so county capacity is a lower bound.
            Substations are mapped at 69 kV and above.
          </div>

          <div className="border-l-2 border-[--color-paper-edge] pl-4">
            <div className="citation">Method</div>
            <p className="mt-1 text-[11px] leading-snug text-[--color-ink-muted]">
              <em className="display-italic">Observed</em> infrastructure from
              the HIFLD Power Plants and Electric Substations feature services,
              filtered to <code className="font-mono text-[10px]">STATE=VA</code>
              . County assigned from the source COUNTYFIPS field. Snapshot{" "}
              <code className="font-mono text-[10px]">2026-05-29</code>.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

/** Two stacked, independently-toggleable overlay controls. Styled to match
 *  PointsToggle, but as a single combined affordance so the two don't overlap
 *  in the top-right map corner. */
function OverlayToggles({
  showPlants,
  showSubstations,
  onTogglePlants,
  onToggleSubstations,
}: {
  showPlants: boolean;
  showSubstations: boolean;
  onTogglePlants: () => void;
  onToggleSubstations: () => void;
}) {
  return (
    <div className="absolute right-4 top-4 z-[400] border border-[--color-paper-edge] bg-[--color-paper]/95 px-3 py-2 backdrop-blur-sm shadow-[2px_2px_0_rgba(22,29,44,0.06)]">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        Overlay
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5">
        <ToggleRow
          active={showPlants}
          onToggle={onTogglePlants}
          color={PLANT_COLOR}
          label="Power plants"
        />
        <ToggleRow
          active={showSubstations}
          onToggle={onToggleSubstations}
          color={SUBSTATION_COLOR}
          label="Substations"
        />
      </div>
    </div>
  );
}

function ToggleRow({
  active,
  onToggle,
  color,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex cursor-pointer items-center gap-2 text-[11px] leading-none transition-colors ${
        active ? "text-[--color-ink]" : "text-[--color-ink-muted] hover:text-[--color-ink]"
      }`}
    >
      <span
        aria-hidden="true"
        className="block h-3.5 w-3.5 shrink-0 rounded-full border transition-colors"
        style={{
          backgroundColor: active ? color : "#f6f1e6",
          borderColor: active ? color : "#b3aea2",
        }}
      />
      <span>{label}</span>
    </button>
  );
}

interface TotalMeasure {
  label: string;
  measure: string;
  unit: string;
  code: string | undefined;
  total: number;
}

/** Sidebar statewide-totals card listing all 4 measures, with the active
 *  layer highlighted. */
function StatewideTotals({
  measures,
  activeCode,
  topGeoid,
  max,
}: {
  measures: TotalMeasure[];
  activeCode: string;
  topGeoid: string | undefined;
  max: number;
}) {
  return (
    <div className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
        Statewide totals
      </div>
      <dl className="mt-3 space-y-3">
        {measures.map((m) => {
          const active = m.code === activeCode;
          return (
            <div
              key={m.measure}
              className="flex items-baseline justify-between gap-3 border-t border-[--color-paper-edge] pt-2 first:border-t-0 first:pt-0"
            >
              <dt className="text-[11px] leading-snug text-[--color-ink-muted]">
                {m.label}
                <span className="ml-1 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
                  {m.unit}
                </span>
              </dt>
              <dd
                className={`display tabular-nums text-lg font-medium ${
                  active ? "text-[--color-energy]" : "text-[--color-ink]"
                }`}
              >
                {Math.round(m.total).toLocaleString()}
              </dd>
            </div>
          );
        })}
      </dl>
      {topGeoid && (
        <div className="mt-3 border-t border-[--color-paper-edge] pt-2 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
          Top county · {topGeoid} · {Math.round(max).toLocaleString()}
        </div>
      )}
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

/** Panel for a clicked point — fields depend on plant vs substation. */
function PowerFacilityDetailPanel({
  facility,
  onClose,
}: {
  facility: FacilityProps;
  onClose: () => void;
}) {
  const name = String(
    facility.facility_name ?? facility.facility_id ?? "(unnamed)"
  );
  const type = typeof facility.type === "string" ? facility.type : null;
  const isPlant = type === "power_plant";
  const typeLabel = isPlant
    ? "Power plant"
    : type === "substation"
      ? "Substation"
      : "—";

  const num = (k: string): number | null => {
    const v = facility[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v)))
      return Number(v);
    return null;
  };

  const capacity = num("plant_capacity_mw");
  const maxVoltage = num("max_voltage");
  const lines = num("lines");
  const operator =
    typeof facility.operator === "string" && facility.operator.trim()
      ? facility.operator
      : null;
  const status =
    typeof facility.status === "string" &&
    facility.status.trim() &&
    facility.status !== "NOT AVAILABLE"
      ? facility.status
      : null;
  const geoid =
    typeof facility.geoid === "number" || typeof facility.geoid === "string"
      ? String(facility.geoid)
      : null;
  const facilityId =
    typeof facility.facility_id === "string" ? facility.facility_id : null;
  const sourceId =
    typeof facility.source_id === "number" ||
    typeof facility.source_id === "string"
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
        <DetailRow label="Type" value={typeLabel} chip={typeLabel} />
        {isPlant ? (
          <>
            {operator && (
              <DetailRow label="Operator" value={operator} emphasize />
            )}
            <DetailRow
              label="Capacity"
              value={capacity !== null ? `${capacity.toLocaleString()} MW` : "—"}
              mono
              emphasize={capacity !== null}
            />
            <DetailRow
              label="Fuel source"
              value={fuelName(facility.plant_source)}
            />
          </>
        ) : (
          <>
            <DetailRow
              label="Max voltage"
              value={maxVoltage !== null ? `${maxVoltage.toLocaleString()} kV` : "—"}
              mono
              emphasize={maxVoltage !== null}
            />
            <DetailRow
              label="Lines"
              value={lines !== null ? lines.toLocaleString() : "—"}
              mono
            />
          </>
        )}
        <DetailRow label="Status" value={status ?? "—"} mono />
        <DetailRow label="County FIPS" value={geoid ?? "—"} mono />
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

/** County profile — county measures + fuel mix + top plants, aggregated from
 *  the point layer (falls back to countyData totals if it hasn't loaded). */
function PowerCountyDetailPanel({
  geoid,
  countyName,
  measures,
  countyData,
  powerByCounty,
}: {
  geoid: string;
  countyName: string;
  measures: TotalMeasure[];
  countyData: Record<string, Record<string, number | (number | null)[]>>;
  powerByCounty: Record<string, PowerFeature[]> | null;
}) {
  const get = (measure: string): number | null => {
    const code = measures.find((m) => m.measure === measure)?.code;
    if (!code) return null;
    const v = countyData[geoid]?.[code];
    return typeof v === "number" ? v : null;
  };

  const features = powerByCounty?.[geoid] ?? null;

  // Fuel mix + top plants from the points (plants only).
  const fuelMix: Array<{ name: string; count: number }> = [];
  const topPlants: Array<{ name: string; count: string }> = [];
  if (features) {
    const byFuel: Record<string, number> = {};
    const plants: Array<{ name: string; cap: number }> = [];
    for (const f of features) {
      const p = f.properties ?? {};
      if (p.type !== "power_plant") continue;
      const fuel = fuelName(p.plant_source);
      byFuel[fuel] = (byFuel[fuel] ?? 0) + 1;
      plants.push({
        name: p.facility_name ?? "(unnamed)",
        cap: typeof p.plant_capacity_mw === "number" ? p.plant_capacity_mw : 0,
      });
    }
    for (const [name, count] of Object.entries(byFuel)) {
      fuelMix.push({ name, count });
    }
    fuelMix.sort((a, b) => b.count - a.count);
    plants.sort((a, b) => b.cap - a.cap);
    for (const p of plants.slice(0, 5)) {
      topPlants.push({ name: p.name, count: `${p.cap.toLocaleString()} MW` });
    }
  }

  const fmt = (v: number | null) =>
    v === null ? "—" : Math.round(v).toLocaleString();

  return (
    <DetailPanelShell
      label="Selected county"
      title={countyName}
      subtitle={`FIPS · ${geoid}`}
    >
      <dl className="space-y-3 px-4 py-3">
        <DetailRow label="Power plants" value={fmt(get("power_plant_count"))} mono />
        <DetailRow label="Substations" value={fmt(get("substation_count"))} mono />
        <DetailRow
          label="Power facilities"
          value={fmt(get("power_facility_count"))}
          mono
        />
        <DetailRow
          label="Plant capacity"
          value={
            get("total_plant_capacity_mw") !== null
              ? `${fmt(get("total_plant_capacity_mw"))} MW`
              : "—"
          }
          mono
          emphasize={(get("total_plant_capacity_mw") ?? 0) > 0}
        />
      </dl>

      {features && topPlants.length > 0 && (
        <RankedList label="Top plants by capacity" items={topPlants} />
      )}
      {features && fuelMix.length > 0 && (
        <RankedList label="Fuel mix (plants)" items={fuelMix} />
      )}
      {!features && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
          Per-facility breakdown loading…
        </div>
      )}
    </DetailPanelShell>
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
