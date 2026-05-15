"use client";

import { useEffect, useRef, useState } from "react";
import { useSelectionStore } from "./selectionStore";

interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { geoid: string; region_name?: string };
    geometry: GeoJSON.Geometry;
  }>;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * A 5-step warm ramp tuned to the cream-paper aesthetic.
 * Inspired by ColorBrewer's YlOrBr but warmer and more editorial.
 * Fewer bins = more counties get differentiated across the visible range.
 */
const RAMP = [
  "#f6ecd4", // very light cream
  "#ebc079",
  "#dd9f4c",
  "#c87a25",
  "#6e2306", // deep burnt umber
];

function colorFor(val: number | undefined, max: number): string {
  if (!Number.isFinite(val ?? NaN) || (val ?? 0) <= 0) {
    return "#ede4d0"; // paper-deep — empty / no-data
  }
  // Smooth, slightly compressed step so the high end isn't too dominant
  const frac = Math.min(1, Math.pow((val ?? 0) / max, 0.7));
  const idx = Math.min(RAMP.length - 1, Math.floor(frac * RAMP.length));
  return RAMP[idx];
}

interface PointLayerSpec {
  geojsonUrl: string;
  /** When true, points are grid-clustered: cells with ≥ clusterMin points
   *  collapse to a numbered circle that zooms to fit on click. Cells with
   *  fewer points always render as individual dots. */
  cluster: boolean;
  /** Minimum point count in a county before it collapses into a cluster.
   *  Default 20. Only used when cluster is true. */
  clusterMin?: number;
  color: string;
  radius?: number;
  layerLabel: string;
  /** Optional predicate. When provided, only features whose properties pass
   *  the predicate are rendered. */
  filter?: (props: Record<string, unknown>) => boolean;
}

interface Props {
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  measureLabel: string;
  pointLayers?: PointLayerSpec[];
  /** Which boundary file to render. Default "county" preserves Phase 1+2 behavior. */
  region?: "county" | "tract";
  /** Optional formatter for tooltip + legend display (e.g. percentage formatting). */
  formatValue?: (v: number) => string;
  /** Fires when a point overlay marker is clicked, with the feature's properties. */
  onPointClick?: (properties: Record<string, unknown>) => void;
  /** Fires when a county (or tract) polygon is clicked, with its feature properties. */
  onCountyClick?: (properties: Record<string, unknown>) => void;
  /** When true, values are fractions in [0,1]; legend top + boundary labels snap
   *  to whole percents. */
  isPercent?: boolean;
}

/** Snap the observed max to the binning ceiling used by the legend.
 *  - Percent mode: round up to the next whole percent (0.01). */
function niceMaxFor(rawMax: number, isPercent: boolean | undefined): number {
  if (rawMax <= 0) return 1;
  if (isPercent) return Math.ceil(rawMax * 100) / 100;
  return rawMax;
}

export function ChoroplethMap({
  indicatorCode,
  countyData,
  measureLabel,
  pointLayers,
  region = "county",
  formatValue,
  onPointClick,
  onCountyClick,
  isPercent,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choroplethLayerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const setSelectedGeoid = useSelectionStore((s) => s.setSelectedGeoid);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;

        const boundaryUrl =
          region === "tract" ? `${BASE}/geo/tract.geojson` : `${BASE}/geo/county.geojson`;
        const resp = await fetch(boundaryUrl);
        const geo = (await resp.json()) as FeatureCollection;

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";

        mapInstance = L.map(containerRef.current, {
          center: [37.6, -78.5],
          zoom: region === "tract" ? 8 : 7,
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
        });

        // CARTO Positron — clean, light, neutral. CSS filter in globals.css
        // gives it the muted "paper" feel without needing a custom tile server.
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · CARTO',
            subdomains: "abcd",
            maxZoom: 19,
          }
        ).addTo(mapInstance);

        const values = Object.values(countyData)
          .map((m) => m[indicatorCode])
          .filter((v) => Number.isFinite(v) && v > 0);
        const rawMax = values.length > 0 ? Math.max(...values) : 0;
        const max = niceMaxFor(rawMax, isPercent);

        const choroplethLayer = L.geoJSON(
          geo as unknown as GeoJSON.GeoJsonObject,
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style: (feature: any) => {
              const v = countyData[feature.properties.geoid]?.[indicatorCode];
              return {
                fillColor: colorFor(v, max),
                fillOpacity: Number.isFinite(v) && (v ?? 0) > 0 ? 0.88 : 0.5,
                color: "#161d2c",
                weight: 0.4,
                opacity: 0.55,
                dashArray: "1,2",
              };
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onEachFeature: (feature: any, layer: any) => {
              const v = countyData[feature.properties.geoid]?.[indicatorCode];
              const name =
                feature.properties.region_name ?? feature.properties.geoid;
              const display =
                typeof v === "number"
                  ? formatValue
                    ? formatValue(v)
                    : v.toLocaleString()
                  : "—";
              layer.bindTooltip(
                `<div style="font-family: var(--font-display); font-weight: 600; font-size: 12px; color: var(--color-ink);">${name}</div>
                 <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-ink-muted); margin-top: 2px;">${measureLabel}: <strong style="color: var(--color-energy-deep)">${display}</strong></div>`,
                { sticky: true, direction: "top", offset: [0, -8] }
              );
              layer.on({
                click: (e: { target: { setStyle: (s: object) => void; _path?: SVGElement } }) => {
                  setSelectedGeoid(feature.properties.geoid);
                  if (onCountyClick) onCountyClick(feature.properties ?? {});
                  // Brief amber flash, then revert to default county styling.
                  e.target.setStyle({
                    color: "#b9430b",
                    weight: 2.5,
                    opacity: 1,
                    dashArray: undefined,
                  });
                  // Drop focus immediately so the browser's blue outline never paints.
                  if (e.target._path && typeof e.target._path.blur === "function") {
                    e.target._path.blur();
                  }
                  window.setTimeout(() => {
                    e.target.setStyle({
                      color: "#161d2c",
                      weight: 0.4,
                      opacity: 0.55,
                      dashArray: "1,2",
                    });
                  }, 650);
                },
                mouseover: (e: { target: { setStyle: (s: object) => void } }) => {
                  e.target.setStyle({ weight: 1.5, opacity: 0.9 });
                },
                mouseout: (e: { target: { setStyle: (s: object) => void } }) => {
                  e.target.setStyle({
                    weight: 0.4,
                    opacity: 0.55,
                  });
                },
              });
            },
          }
        );
        choroplethLayer.addTo(mapInstance);
        choroplethLayerRef.current = choroplethLayer;

        // Point overlays
        if (pointLayers) {
          for (const spec of pointLayers) {
            const r = await fetch(`${BASE}${spec.geojsonUrl}`);
            if (!r.ok) {
              console.warn("Failed to load point layer", spec.geojsonUrl);
              continue;
            }
            const data = await r.json();
            if (cancelled) return;

            // Filter once, up front.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allFeatures: any[] = (data.features ?? []).filter((f: any) =>
              spec.filter ? spec.filter(f.properties ?? {}) : true
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const buildIndividualMarker = (f: any) => {
              const [lng, lat] = f.geometry.coordinates;
              const m = L.circleMarker([lat, lng], {
                radius: spec.radius ?? 4,
                fillColor: spec.color,
                color: spec.cluster ? "#f6f1e6" : "#161d2c",
                weight: spec.cluster ? 0.8 : 0.6,
                opacity: 1,
                fillOpacity: spec.cluster ? 0.78 : 0.85,
              });
              const props = f.properties ?? {};
              const name =
                props.facility_name ?? props.facility_id ?? "(unnamed)";
              m.bindTooltip(
                `<div style="font-family: var(--font-display); font-weight: 600; font-size: 11px; color: var(--color-ink);">${name}</div>
                 <div style="font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">${spec.layerLabel}</div>`,
                { sticky: true }
              );
              if (onPointClick) m.on("click", () => onPointClick(props));
              return m;
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let layer: any;
            if (spec.cluster) {
              // Custom geographic clusterer: group points by their county FIPS
              // (geoid or county_id). Counties with ≥ clusterMin points
              // collapse to a numbered circle centered on the mean lat/lng of
              // their points. Above dissolveZoom, all points render
              // individually so they can be inspected.
              const clusterMin = spec.clusterMin ?? 20;
              const dissolveZoom = 10;
              const group = L.layerGroup();

              const rebuild = () => {
                group.clearLayers();
                const zoom = mapInstance.getZoom();

                if (zoom >= dissolveZoom) {
                  for (const f of allFeatures) {
                    buildIndividualMarker(f).addTo(group);
                  }
                  return;
                }

                const buckets = new Map<
                  string,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  { features: any[]; bounds: any; latSum: number; lngSum: number }
                >();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const unkeyed: any[] = [];

                for (const f of allFeatures) {
                  const props = f.properties ?? {};
                  const fips = props.geoid ?? props.county_id;
                  const [lng, lat] = f.geometry.coordinates;
                  if (fips == null) {
                    unkeyed.push(f);
                    continue;
                  }
                  const key = String(fips);
                  let b = buckets.get(key);
                  if (!b) {
                    b = {
                      features: [],
                      bounds: L.latLngBounds([lat, lng], [lat, lng]),
                      latSum: 0,
                      lngSum: 0,
                    };
                    buckets.set(key, b);
                  }
                  b.features.push(f);
                  b.bounds.extend([lat, lng]);
                  b.latSum += lat;
                  b.lngSum += lng;
                }

                for (const f of unkeyed) buildIndividualMarker(f).addTo(group);

                for (const b of buckets.values()) {
                  const count = b.features.length;
                  if (count >= clusterMin) {
                    const sizeClass =
                      count < 100
                        ? "marker-cluster-small"
                        : count < 1000
                          ? "marker-cluster-medium"
                          : "marker-cluster-large";
                    const icon = L.divIcon({
                      html: `<div><span>${count}</span></div>`,
                      className: `marker-cluster ${sizeClass}`,
                      iconSize: L.point(40, 40),
                    });
                    const centroid: [number, number] = [
                      b.latSum / count,
                      b.lngSum / count,
                    ];
                    const m = L.marker(centroid, { icon });
                    m.on("click", () => {
                      mapInstance.fitBounds(b.bounds, {
                        padding: [40, 40],
                        maxZoom: 13,
                      });
                    });
                    m.addTo(group);
                  } else {
                    for (const f of b.features) {
                      buildIndividualMarker(f).addTo(group);
                    }
                  }
                }
              };

              rebuild();
              mapInstance.on("zoomend", rebuild);
              layer = group;
            } else {
              layer = L.layerGroup();
              for (const f of allFeatures) {
                buildIndividualMarker(f).addTo(layer);
              }
            }
            layer.addTo(mapInstance);
          }
        }
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
      choroplethLayerRef.current = null;
    };
  }, [indicatorCode, countyData, measureLabel, setSelectedGeoid, pointLayers, region, onPointClick, onCountyClick, formatValue, isPercent]);

  // Narrow effect: refresh the choropleth fill when the indicator or data
  // changes, without rebuilding the map. Selection no longer paints a
  // persistent border — the click handler renders a brief flash instead.
  useEffect(() => {
    const layer = choroplethLayerRef.current;
    if (!layer) return;
    const values = Object.values(countyData)
      .map((m: Record<string, number>) => m[indicatorCode])
      .filter((v) => Number.isFinite(v) && v > 0);
    const rawMax = values.length > 0 ? Math.max(...values) : 0;
    const max = niceMaxFor(rawMax, isPercent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.setStyle((feature: any) => {
      const v = countyData[feature.properties.geoid]?.[indicatorCode];
      return {
        fillColor: colorFor(v, max),
        fillOpacity: Number.isFinite(v) && (v ?? 0) > 0 ? 0.88 : 0.5,
        color: "#161d2c",
        weight: 0.4,
        opacity: 0.55,
        dashArray: "1,2",
      };
    });
  }, [countyData, indicatorCode, isPercent]);

  if (error)
    return (
      <div className="rounded border border-[--color-energy] bg-[--color-energy-soft] px-4 py-3 text-sm text-[--color-energy-deep]">
        <div className="font-mono text-[10px] uppercase tracking-widest">
          Map error
        </div>
        <div className="mt-1">{error}</div>
      </div>
    );
  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[560px] w-full border border-[--color-paper-edge] bg-[--color-paper-deep]"
      />
      <ChoroplethLegend
        ramp={RAMP}
        max={(() => {
          const vs = Object.values(countyData)
            .map((m) => m[indicatorCode])
            .filter((v) => Number.isFinite(v) && v > 0);
          const rm = vs.length > 0 ? Math.max(...vs) : 0;
          return niceMaxFor(rm, isPercent);
        })()}
        label={measureLabel}
        formatValue={formatValue}
        isPercent={isPercent}
      />
    </div>
  );
}

function ChoroplethLegend({
  ramp,
  max,
  label,
  formatValue,
  isPercent,
}: {
  ramp: string[];
  max: number;
  label: string;
  formatValue?: (v: number) => string;
  isPercent?: boolean;
}) {
  // Compute the value at each step boundary (using the same gamma=0.7)
  const boundaries = ramp.map((_, i) => {
    const frac = (i + 1) / ramp.length;
    return Math.pow(frac, 1 / 0.7) * max;
  });
  const fmt = (v: number): string => {
    if (isPercent) return `${Math.round(v * 100)}%`;
    if (formatValue) return formatValue(v);
    return Math.round(v).toLocaleString();
  };

  return (
    <div className="absolute bottom-4 left-4 z-[400] max-w-[300px] border border-[--color-paper-edge] bg-[--color-paper]/95 px-3 py-2 backdrop-blur-sm">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        Legend · {label}
      </div>
      <div className="mt-1.5 flex h-3 w-full overflow-hidden">
        {ramp.map((c, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-[--color-ink-muted]">
        <span>{fmt(0)}</span>
        {boundaries.slice(0, -1).map((b, i) => (
          <span key={i}>{fmt(b)}</span>
        ))}
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
