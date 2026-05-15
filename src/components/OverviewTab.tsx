"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { PointsToggle } from "./PointsToggle";
import {
  DetailPanelShell,
  DetailRow,
  EmptyDetailPanel,
  RankedList,
} from "./DetailPanels";
import { useSelectionStore } from "./selectionStore";
import { useDefaultTopCounty } from "./useDefaultTopCounty";

type FacilityProps = Record<string, unknown>;

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface DCFeature {
  properties?: {
    facility_id?: string;
    facility_name?: string;
    operator?: string;
    sqft?: number | string;
    type?: string;
    county_id?: number | string;
  };
}

/** Aggregated metrics for the data-center points within a single county. */
interface CountyAggregate {
  totalRecords: number;
  byGeomType: Record<string, number>;
  totalSqft: number;
  topOperators: Array<{ name: string; count: number }>;
}

export function OverviewTab() {
  const { loading, error, countyData, variables, countyNames } = useData();
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);
  const setSelectedGeoid = useSelectionStore((s) => s.setSelectedGeoid);
  const [showPoints, setShowPoints] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<FacilityProps | null>(
    null
  );
  const [dcByCounty, setDcByCounty] = useState<Record<string, DCFeature[]> | null>(
    null
  );

  // Selection mutex: showing the facility panel hides the county panel
  // visually. Clicking a county clears the facility so the county panel
  // returns to view. Selection itself lives in the global selectionStore.
  const handleFacilityClick = useCallback((props: FacilityProps) => {
    setSelectedFacility(props);
  }, []);
  const handleCountyClick = useCallback(() => {
    setSelectedFacility(null);
  }, []);

  // Lazy-load the existing-DC points once so we can aggregate per county
  // without re-fetching on every click. The map already loads this file, so
  // it's typically warm in the HTTP cache by the time the user clicks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${BASE}/geo/dc_existing.geojson`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const idx: Record<string, DCFeature[]> = {};
        for (const f of (data.features ?? []) as DCFeature[]) {
          const cid = f.properties?.county_id;
          if (cid == null) continue;
          const key = String(cid).padStart(5, "0");
          (idx[key] ??= []).push(f);
        }
        setDcByCounty(idx);
      } catch {
        // Non-fatal; CountyDetailPanel falls back to countyData totals.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable identity for the points layer so the map doesn't rebuild on every
  // unrelated render. The layer is only passed in when showPoints is true.
  const pointLayers = useMemo(
    () =>
      showPoints
        ? [
            {
              geojsonUrl: "/geo/dc_existing.geojson",
              cluster: true,
              color: "#1f3aa1",
              radius: 3,
              layerLabel: "Data center facility",
            },
          ]
        : undefined,
    [showPoints]
  );

  // Resolve indicator code before any conditional return so the hooks below
  // run unconditionally.
  const indicatorCode = variables
    ? Object.entries(variables).find(
        ([, m]) => m.measure === "total_data_center_count"
      )?.[0]
    : undefined;

  // Pre-compute the scalar choropleth slice (also pre-conditional so the
  // hook below sees stable data).
  const choroplethData: Record<string, Record<string, number>> = {};
  if (countyData && indicatorCode) {
    for (const geoid of Object.keys(countyData)) {
      const entry = countyData[geoid][indicatorCode];
      if (typeof entry === "number") {
        choroplethData[geoid] = { [indicatorCode]: entry };
      }
    }
  }

  useDefaultTopCounty(indicatorCode, choroplethData);

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;
  if (!indicatorCode) {
    return (
      <ErrorState
        message={
          "Indicator total_data_center_count missing from variables.json. Re-run the build script."
        }
      />
    );
  }

  const values = Object.values(choroplethData)
    .map((m) => m[indicatorCode])
    .filter((v) => Number.isFinite(v));
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 0);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[indicatorCode] === max
  )?.[0];
  const topShare = total > 0 ? Math.round((max / total) * 100) : 0;

  return (
    <article className="fade-up">
      {/* Chapter heading */}
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§I</span> · Chapter the First
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          Where is Virginia's energy story{" "}
          <span className="display-italic">already concentrated?</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          The state hosts an outsized share of the country's data center
          infrastructure — and that share is overwhelmingly clustered in a
          handful of Northern Virginia counties. The map below shows where
          OSM-derived facility records sit, colored by density.
        </p>
      </header>

      {/* Pull-quote / headline stat */}
      <section className="mb-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="pull-bracket">
            <p className="display text-2xl leading-snug text-[--color-ink]">
              Virginia hosts{" "}
              <span className="display-italic text-[--color-energy]">
                {total.toLocaleString()}
              </span>{" "}
              data center records, with{" "}
              <span className="display-italic text-[--color-energy]">
                {topShare}%
              </span>{" "}
              concentrated in a single county — {topGeoid ?? "—"}.
            </p>
          </div>
          <p className="marginalia mt-3">
            <em>A note on counting:</em> a single physical facility can appear
            in OSM as a tagged point, a building footprint, and a campus
            polygon — three records, one facility. The dashboard reports
            records, not unique facilities. See the{" "}
            <a
              className="underline decoration-[--color-paper-edge] hover:decoration-[--color-energy]"
              href="https://data.msdlive.org/records/p147s-4h760"
              target="_blank"
              rel="noreferrer"
            >
              IM3 Atlas methodology
            </a>{" "}
            for details.
          </p>
        </div>

        {/* Stat block — large editorial figures */}
        <div className="col-span-12 lg:col-span-5">
          <div className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Statewide snapshot
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <StatFigure
                value={total.toLocaleString()}
                label="Records"
                tone="ink"
              />
              <StatFigure
                value={values.length.toString()}
                label="Counties"
                tone="ink"
              />
              <StatFigure
                value={max.toLocaleString()}
                label={`${topGeoid ?? "Top"} max`}
                tone="energy"
              />
            </div>
            <div className="mt-3 border-t border-[--color-paper-edge] pt-2 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
              Source · IM3 Atlas v2026.02.09
            </div>
          </div>
        </div>
      </section>

      {/* The map */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg font-medium text-[--color-ink]">
            Data center records, by county
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Plate 1.1
          </span>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="relative col-span-12 lg:col-span-9">
            <ChoroplethMap
              indicatorCode={indicatorCode}
              countyData={choroplethData}
              measureLabel="Data center records"
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
          <div className="col-span-12 lg:col-span-3">
            {selectedFacility ? (
              <FacilityDetailPanel
                facility={selectedFacility}
                onClose={() => setSelectedFacility(null)}
              />
            ) : selectedGeoid ? (
              <CountyDetailPanel
                geoid={selectedGeoid}
                countyName={countyNames?.[selectedGeoid] ?? selectedGeoid}
                indicatorCode={indicatorCode}
                countyData={choroplethData}
                dcByCounty={dcByCounty}
              />
            ) : (
              <EmptyDetailPanel
                label="County detail"
                hint={
                  <>
                    <em className="display-italic">Click any county</em> to see
                    its aggregated data-center records and operators.
                  </>
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* Reading guide */}
      <section className="mt-10 border-t border-[--color-paper-edge] pt-8">
        <div className="rule-with-mark mb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest">
            How to read this atlas
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ReadingNote
            number="01"
            title="Maps are heterogeneous, not uniform"
            body="Every paper in the source set argues that aggregate energy statistics mask household- and county-level differences. The map exposes that heterogeneity directly."
          />
          <ReadingNote
            number="02"
            title="Pick a chapter to drill down"
            body="Chapter II turns the map onto EV charging infrastructure. Chapter III extends to adoption, Chapter IV to projected siting."
          />
          <ReadingNote
            number="03"
            title="Click a county anywhere"
            body="The selection persists across chapters. Click Loudoun on the data-center map, then switch to EV Infrastructure — its profile follows you."
          />
        </div>
      </section>
    </article>
  );
}

/** Panel shown for a clicked data-center point. */
function FacilityDetailPanel({
  facility,
  onClose,
}: {
  facility: FacilityProps;
  onClose: () => void;
}) {
  const name = String(facility.facility_name ?? facility.facility_id ?? "(unnamed)");
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
        <DetailRow label="Operator" value={operator ?? "—"} emphasize={!!operator} />
        <DetailRow
          label="Surface area"
          value={sqft !== null ? `${sqft.toLocaleString()} sq ft` : "—"}
          mono
          emphasize={sqft !== null}
        />
        <DetailRow
          label="OSM geometry"
          value={geomType ?? "—"}
          chip={geomType ?? undefined}
        />
        <DetailRow label="County FIPS" value={countyId ?? "—"} mono />
        <DetailRow label="Source year" value={year !== null ? String(year) : "—"} mono />
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
            <div className="font-mono text-[10px] text-[--color-ink-muted]">
              osm_id · {sourceId}
            </div>
          )}
        </div>
      )}
    </DetailPanelShell>
  );
}

/** Aggregated data-center metrics for the selected county. */
function CountyDetailPanel({
  geoid,
  countyName,
  indicatorCode,
  countyData,
  dcByCounty,
}: {
  geoid: string;
  countyName: string;
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  dcByCounty: Record<string, DCFeature[]> | null;
}) {
  const countyKey = geoid.padStart(5, "0");
  const features = dcByCounty?.[countyKey] ?? null;
  const fallbackTotal = Number.isFinite(countyData[geoid]?.[indicatorCode])
    ? countyData[geoid][indicatorCode]
    : 0;

  const agg: CountyAggregate = features
    ? aggregateFeatures(features)
    : {
        totalRecords: fallbackTotal,
        byGeomType: {},
        totalSqft: 0,
        topOperators: [],
      };

  return (
    <DetailPanelShell
      label="Selected county"
      title={countyName}
      subtitle={`FIPS · ${geoid}`}
    >
      <dl className="space-y-3 px-4 py-3">
        <DetailRow
          label="Total records"
          value={agg.totalRecords.toLocaleString()}
          mono
          emphasize={agg.totalRecords > 0}
        />
        <DetailRow
          label="Surface area (sum)"
          value={
            agg.totalSqft > 0
              ? `${Math.round(agg.totalSqft).toLocaleString()} sq ft`
              : "—"
          }
          mono
          emphasize={agg.totalSqft > 0}
        />
      </dl>

      <RankedList
        label="By OSM geometry"
        items={Object.entries(agg.byGeomType)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }))}
      />
      <RankedList label="Top operators" items={agg.topOperators} />

      {!features && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
          Per-record breakdown loading…
        </div>
      )}
    </DetailPanelShell>
  );
}

function aggregateFeatures(features: DCFeature[]): CountyAggregate {
  const byGeomType: Record<string, number> = {};
  const byOperator: Record<string, number> = {};
  let totalSqft = 0;
  for (const f of features) {
    const p = f.properties ?? {};
    if (p.type) byGeomType[p.type] = (byGeomType[p.type] ?? 0) + 1;
    if (typeof p.operator === "string" && p.operator.trim()) {
      byOperator[p.operator] = (byOperator[p.operator] ?? 0) + 1;
    }
    const sqftNum =
      typeof p.sqft === "number"
        ? p.sqft
        : typeof p.sqft === "string"
          ? Number(p.sqft)
          : NaN;
    if (Number.isFinite(sqftNum)) totalSqft += sqftNum;
  }
  const topOperators = Object.entries(byOperator)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  return {
    totalRecords: features.length,
    byGeomType,
    totalSqft,
    topOperators,
  };
}

function StatFigure({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "ink" | "energy";
}) {
  return (
    <div>
      <div
        className={`display tabular-nums text-3xl font-medium leading-none ${
          tone === "energy"
            ? "text-[--color-energy]"
            : "text-[--color-ink]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </div>
    </div>
  );
}

function ReadingNote({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy]">
        {number}
      </div>
      <h4 className="display mt-1 text-base font-medium text-[--color-ink]">
        {title}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-[--color-ink-muted]">
        {body}
      </p>
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
