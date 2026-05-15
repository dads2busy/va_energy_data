"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";
import { PointsToggle } from "./PointsToggle";

type FacilityProps = Record<string, unknown>;
type CountyProps = Record<string, unknown>;

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
  const { loading, error, countyData, variables } = useData();
  const [showPoints, setShowPoints] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<FacilityProps | null>(
    null
  );
  const [selectedCounty, setSelectedCountyState] = useState<CountyProps | null>(
    null
  );
  const [dcByCounty, setDcByCounty] = useState<Record<string, DCFeature[]> | null>(
    null
  );

  // Selection mutex: clicking a county clears the facility selection (and vice
  // versa) so only one detail panel is ever active.
  const handleFacilityClick = useCallback((props: FacilityProps) => {
    setSelectedCountyState(null);
    setSelectedFacility(props);
  }, []);
  const handleCountyClick = useCallback((props: CountyProps) => {
    setSelectedFacility(null);
    setSelectedCountyState(props);
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
              color: "#475569",
              radius: 3,
              layerLabel: "Data center facility",
            },
          ]
        : undefined,
    [showPoints]
  );

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;

  const indicatorCode = Object.entries(variables).find(
    ([, m]) => m.measure === "total_data_center_count"
  )?.[0];

  if (!indicatorCode) {
    return (
      <ErrorState
        message={
          "Indicator total_data_center_count missing from variables.json. Re-run the build script."
        }
      />
    );
  }

  const choroplethData: Record<string, Record<string, number>> = {};
  for (const geoid of Object.keys(countyData)) {
    const entry = countyData[geoid][indicatorCode];
    if (typeof entry === "number") {
      choroplethData[geoid] = { [indicatorCode]: entry };
    }
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
              swatchColor="#475569"
            />
          </div>
          <div className="col-span-12 lg:col-span-3">
            {selectedFacility ? (
              <FacilityDetailPanel
                facility={selectedFacility}
                onClose={() => setSelectedFacility(null)}
              />
            ) : (
              <CountyDetailPanel
                county={selectedCounty}
                indicatorCode={indicatorCode}
                countyData={choroplethData}
                dcByCounty={dcByCounty}
                onClose={() => setSelectedCountyState(null)}
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

/**
 * Sidebar panel that fills with the clicked facility's attributes.
 * Empty state when nothing is selected.
 */
function FacilityDetailPanel({
  facility,
  onClose,
}: {
  facility: FacilityProps | null;
  onClose: () => void;
}) {
  if (!facility) {
    return (
      <div className="border border-dashed border-[--color-paper-edge] bg-[--color-paper] px-4 py-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
          Facility detail
        </div>
        <p className="mt-3 text-[12px] leading-snug text-[--color-ink-muted]">
          <em className="display-italic">Click a data center point</em> on the
          map to inspect its operator, surface area, and provenance.
        </p>
      </div>
    );
  }

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
  const year =
    typeof facility.year === "number" ? facility.year : null;
  const facilityId =
    typeof facility.facility_id === "string" ? facility.facility_id : null;
  const sourceId =
    typeof facility.source_id === "number" || typeof facility.source_id === "string"
      ? String(facility.source_id)
      : null;

  return (
    <div className="border border-[--color-paper-edge] bg-[--color-paper]">
      <div className="flex items-start justify-between gap-2 border-b border-[--color-paper-edge] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Selected facility
          </div>
          <h3 className="display mt-1 text-lg leading-tight text-[--color-ink]">
            {name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close facility detail"
          className="text-[--color-ink-muted] transition-colors hover:text-[--color-ink]"
        >
          <span aria-hidden="true" className="text-xl leading-none">×</span>
        </button>
      </div>

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
    </div>
  );
}

/**
 * Sidebar panel that fills with the aggregated data-center metrics for the
 * clicked county. Falls back to the choropleth's record count when the
 * per-point geojson hasn't loaded yet.
 */
function CountyDetailPanel({
  county,
  indicatorCode,
  countyData,
  dcByCounty,
  onClose,
}: {
  county: CountyProps | null;
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  dcByCounty: Record<string, DCFeature[]> | null;
  onClose: () => void;
}) {
  if (!county) {
    return (
      <div className="border border-dashed border-[--color-paper-edge] bg-[--color-paper] px-4 py-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
          County detail
        </div>
        <p className="mt-3 text-[12px] leading-snug text-[--color-ink-muted]">
          <em className="display-italic">Click any county</em> to see its
          aggregated data-center records and operators.
        </p>
      </div>
    );
  }

  const geoid =
    typeof county.geoid === "string" || typeof county.geoid === "number"
      ? String(county.geoid)
      : null;
  const name =
    typeof county.region_name === "string"
      ? county.region_name
      : (geoid ?? "(unknown)");
  const countyKey = geoid ? geoid.padStart(5, "0") : null;
  const features = countyKey ? dcByCounty?.[countyKey] ?? null : null;
  const fallbackTotal =
    geoid && Number.isFinite(countyData[geoid]?.[indicatorCode])
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
    <div className="border border-[--color-paper-edge] bg-[--color-paper]">
      <div className="flex items-start justify-between gap-2 border-b border-[--color-paper-edge] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Selected county
          </div>
          <h3 className="display mt-1 text-lg leading-tight text-[--color-ink]">
            {name}
          </h3>
          <div className="mt-0.5 font-mono text-[10px] text-[--color-ink-light]">
            FIPS · {geoid ?? "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close county detail"
          className="text-[--color-ink-muted] transition-colors hover:text-[--color-ink]"
        >
          <span aria-hidden="true" className="text-xl leading-none">×</span>
        </button>
      </div>

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

      {Object.keys(agg.byGeomType).length > 0 && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
            By OSM geometry
          </div>
          <ul className="mt-2 space-y-1">
            {Object.entries(agg.byGeomType)
              .sort((a, b) => b[1] - a[1])
              .map(([t, n]) => (
                <li
                  key={t}
                  className="flex items-baseline justify-between gap-2 text-[12px]"
                >
                  <span className="text-[--color-ink-muted]">{t}</span>
                  <span className="font-mono tabular-nums text-[--color-ink]">
                    {n.toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {agg.topOperators.length > 0 && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
            Top operators
          </div>
          <ul className="mt-2 space-y-1">
            {agg.topOperators.map((op) => (
              <li
                key={op.name}
                className="flex items-baseline justify-between gap-2 text-[12px]"
              >
                <span className="truncate text-[--color-ink]">{op.name}</span>
                <span className="font-mono tabular-nums text-[--color-ink-muted]">
                  {op.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!features && (
        <div className="border-t border-[--color-paper-edge] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-light]">
          Per-record breakdown loading…
        </div>
      )}
    </div>
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

function DetailRow({
  label,
  value,
  mono,
  chip,
  emphasize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  chip?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </dt>
      <dd>
        {chip ? (
          <span
            className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              emphasize ?? true
                ? "border-[--color-ink-faint] text-[--color-ink]"
                : "border-[--color-paper-edge] text-[--color-ink-muted]"
            }`}
          >
            {value}
          </span>
        ) : (
          <span
            className={`${mono ? "font-mono text-[12px]" : "text-[13px]"} ${
              emphasize ? "text-[--color-ink]" : "text-[--color-ink-muted]"
            }`}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
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
