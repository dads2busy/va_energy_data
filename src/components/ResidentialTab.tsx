"use client";

import { useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { LayerSelector, type LayerOption } from "./LayerSelector";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { HourOfDayStrip } from "./HourOfDayStrip";
import { ResolutionToggle, type Resolution } from "./ResolutionToggle";
import { useSelectionStore } from "./selectionStore";

const STATIC_OPTIONS: { label: string; measure: string; isRate: boolean }[] = [
  { label: "PV adoption", measure: "pv_adoption_rate", isRate: true },
  { label: "EV adoption", measure: "ev_adoption_rate", isRate: true },
  { label: "Battery adoption", measure: "battery_adoption_rate", isRate: true },
  { label: "Households", measure: "synthetic_household_count", isRate: false },
];

const formatPct = (v: number) => `${Math.round(v * 100)}%`;
const formatCount = (v: number) => Math.round(v).toLocaleString();

export function ResidentialTab() {
  const {
    loading,
    error,
    countyData,
    tractData,
    tractLoading,
    tractError,
    variables,
  } = useData();
  const [selectedMeasure, setSelectedMeasure] = useState("pv_adoption_rate");
  const [resRaw] = useQueryState("res", { defaultValue: "county" as Resolution });
  const res: Resolution = resRaw === "tract" ? "tract" : "county";
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;

  const layerOptions: LayerOption[] = STATIC_OPTIONS.map(({ label, measure }) => {
    const entry = Object.entries(variables).find(
      ([, m]) => m.measure === measure
    );
    return entry ? { code: entry[0], label } : null;
  }).filter((x): x is LayerOption => x !== null);

  const selectedOption = STATIC_OPTIONS.find(
    (o) => o.measure === selectedMeasure
  );
  const isRate = selectedOption?.isRate ?? false;
  const selectedCode = layerOptions.find(
    (o) => variables[o.code]?.measure === selectedMeasure
  )?.code;

  if (!selectedCode) {
    return (
      <ErrorState
        message={`Residential: ${selectedMeasure} missing from variables.json. Re-run build-data.`}
      />
    );
  }

  const measureMeta = variables[selectedCode];
  const measureLabel =
    STATIC_OPTIONS.find((o) => o.measure === measureMeta.measure)?.label ??
    measureMeta.measure;

  // Pick the active dataset based on the resolution toggle
  const regionData =
    res === "tract" ? tractData ?? {} : countyData;
  const stillLoading = res === "tract" && tractLoading;

  // Cast to scalar-only shape for ChoroplethMap
  const choroplethData: Record<string, Record<string, number>> = {};
  for (const geoid of Object.keys(regionData)) {
    const entry = regionData[geoid][selectedCode];
    if (typeof entry === "number") {
      choroplethData[geoid] = { [selectedCode]: entry };
    }
  }

  // Find pv_generation_kwh hourly code
  const pvCode = Object.entries(variables).find(
    ([, m]) => m.measure === "pv_generation_kwh"
  )?.[0];

  // Hourly PV gen for the selected county/tract (or statewide sum)
  const hourlyValues: number[] = (() => {
    if (!pvCode) return new Array(24).fill(0);
    if (selectedGeoid && regionData[selectedGeoid]) {
      const v = regionData[selectedGeoid][pvCode];
      if (Array.isArray(v))
        return v.map((x) => (x === null ? 0 : x));
      return new Array(24).fill(0);
    }
    const sum = new Array(24).fill(0) as number[];
    for (const geoid of Object.keys(regionData)) {
      const v = regionData[geoid][pvCode];
      if (Array.isArray(v)) {
        for (let h = 0; h < 24; h++) sum[h] += v[h] ?? 0;
      }
    }
    return sum;
  })();

  // Snapshot stats
  const values = Object.values(choroplethData)
    .map((m) => m[selectedCode])
    .filter((v): v is number => typeof v === "number");
  const stats = computeStats(values, isRate);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[selectedCode] === stats.max
  )?.[0];

  const formatValue = isRate ? formatPct : formatCount;

  return (
    <article className="fade-up">
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§III</span> · Chapter the Third
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          Where the energy transition{" "}
          <span className="display-italic">arrives at the door</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          Adoption rates for rooftop solar, electric vehicles, and home batteries
          across Virginia's synthetic household population under the
          va_2030_solar_324k_0_25ev scenario. Switch the map between county and
          tract resolution to see how the transition concentrates.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[--color-paper-edge] pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
                Choropleth · Plate 3.1
              </div>
              <h3 className="display mt-0.5 text-lg font-medium text-[--color-ink]">
                {measureLabel}, by {res}
              </h3>
            </div>
            <ProvenanceBadge
              dataMethod={measureMeta.data_method}
              scenario={measureMeta.scenario}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <LayerSelector
              options={layerOptions}
              selected={selectedCode}
              onChange={(code) => {
                const m = variables[code]?.measure;
                if (m) setSelectedMeasure(m);
              }}
            />
            <ResolutionToggle />
          </div>

          {stillLoading && Object.keys(regionData).length === 0 ? (
            <div className="flex h-[560px] items-center justify-center border border-[--color-paper-edge] bg-[--color-paper-deep]">
              <div className="text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
                  Loading tract data
                </div>
                <div className="display mt-2 italic text-[--color-ink-light]">
                  Drawing 1,872 polygons…
                </div>
              </div>
            </div>
          ) : tractError && res === "tract" ? (
            <div className="flex h-[560px] items-center justify-center border border-[--color-energy] bg-[--color-energy-soft]">
              <div className="max-w-md text-center">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy-deep]">
                  Couldn't load tract data
                </div>
                <div className="mt-2 text-sm text-[--color-ink]">{tractError}</div>
              </div>
            </div>
          ) : (
            <ChoroplethMap
              indicatorCode={selectedCode}
              countyData={choroplethData}
              measureLabel={measureLabel}
              region={res}
              formatValue={formatValue}
              isPercent={isRate}
            />
          )}

          <HourOfDayStrip
            values={hourlyValues}
            unit="kWh"
            label={
              selectedGeoid
                ? `PV generation profile — ${selectedGeoid}`
                : `PV generation profile — statewide`
            }
          />
        </div>

        <aside className="col-span-12 lg:col-span-3 space-y-5">
          <div className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              {measureLabel}
            </div>
            <div className="display tabular-nums mt-2 text-4xl font-medium leading-none text-[--color-energy]">
              {isRate
                ? formatPct(stats.mean)
                : formatCount(stats.total)}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
              {isRate ? "Statewide mean" : "Statewide total"}
            </div>

            <div className="mt-4 space-y-2 border-t border-[--color-paper-edge] pt-3 text-xs">
              <Stat
                label={res === "tract" ? "Tracts with data" : "Counties with data"}
                value={values.length.toLocaleString()}
              />
              <Stat
                label={`Top ${res} (${topGeoid ?? "—"})`}
                value={formatValue(stats.max)}
              />
              <Stat
                label="Range"
                value={`${formatValue(stats.min)} — ${formatValue(stats.max)}`}
              />
            </div>

            {selectedGeoid && (
              <div className="mt-4 border-t border-[--color-paper-edge] pt-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy]">
                  Selected · {selectedGeoid}
                </div>
                <div className="display tabular-nums mt-1 text-2xl font-medium text-[--color-ink]">
                  {typeof choroplethData[selectedGeoid]?.[selectedCode] === "number"
                    ? formatValue(choroplethData[selectedGeoid][selectedCode])
                    : "—"}
                </div>
              </div>
            )}
          </div>

          <div className="marginalia">
            <em>Tract view caveat.</em> Tract-level adoption rates and PV
            profiles ride on top of a synthetic population. Counts are exact;
            rates are estimates. The PV generation profile uses a 23% sample of
            statewide PV adopters, scaled by per-tract adopter counts.
          </div>

          <div className="border-l-2 border-[--color-paper-edge] pl-4">
            <div className="citation">Scenario</div>
            <p className="mt-1 text-[11px] leading-snug text-[--color-ink-muted]">
              <code className="font-mono text-[10px]">va_2030_solar_324k_0_25ev</code>
              {" — "}324,461 PV adopters, 14.6% EV adoption, 2.6% battery in 2030.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function computeStats(values: number[], isRate: boolean) {
  if (values.length === 0) {
    return { total: 0, mean: 0, max: 0, min: 0 };
  }
  const total = values.reduce((a, b) => a + b, 0);
  const mean = isRate ? total / values.length : total;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return { total, mean, max, min };
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
