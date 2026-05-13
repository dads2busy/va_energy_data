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
 * A 7-step warm ramp tuned to the cream-paper aesthetic.
 * Inspired by ColorBrewer's YlOrBr but warmer and more editorial.
 */
const RAMP = [
  "#f6ecd4", // very light cream
  "#f1d7a8",
  "#ebc079",
  "#dd9f4c",
  "#c87a25",
  "#a35012",
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
  cluster: boolean;
  color: string;
  radius?: number;
  layerLabel: string;
}

interface Props {
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  measureLabel: string;
  pointLayers?: PointLayerSpec[];
}

export function ChoroplethMap({
  indicatorCode,
  countyData,
  measureLabel,
  pointLayers,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choroplethLayerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);
  const setSelectedGeoid = useSelectionStore((s) => s.setSelectedGeoid);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet.markercluster");

        const resp = await fetch(`${BASE}/geo/county.geojson`);
        const geo = (await resp.json()) as FeatureCollection;

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";

        mapInstance = L.map(containerRef.current, {
          center: [37.6, -78.5],
          zoom: 7,
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
          .filter((v) => Number.isFinite(v));
        const max = Math.max(1, ...values);

        const choroplethLayer = L.geoJSON(
          geo as unknown as GeoJSON.GeoJsonObject,
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style: (feature: any) => {
              const v = countyData[feature.properties.geoid]?.[indicatorCode];
              const isSelected =
                feature.properties.geoid === selectedGeoid;
              return {
                fillColor: colorFor(v, max),
                fillOpacity: Number.isFinite(v) && (v ?? 0) > 0 ? 0.88 : 0.5,
                color: isSelected ? "#b9430b" : "#161d2c",
                weight: isSelected ? 2.5 : 0.4,
                opacity: isSelected ? 1 : 0.55,
                dashArray: isSelected ? undefined : "1,2",
              };
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onEachFeature: (feature: any, layer: any) => {
              const v = countyData[feature.properties.geoid]?.[indicatorCode];
              const name =
                feature.properties.region_name ?? feature.properties.geoid;
              const display =
                typeof v === "number" ? v.toLocaleString() : "—";
              layer.bindTooltip(
                `<div style="font-family: var(--font-display); font-weight: 600; font-size: 12px; color: var(--color-ink);">${name}</div>
                 <div style="font-family: var(--font-mono); font-size: 10px; color: var(--color-ink-muted); margin-top: 2px;">${measureLabel}: <strong style="color: var(--color-energy-deep)">${display}</strong></div>`,
                { sticky: true, direction: "top", offset: [0, -8] }
              );
              layer.on({
                click: () => setSelectedGeoid(feature.properties.geoid),
                mouseover: (e: { target: { setStyle: (s: object) => void } }) => {
                  const isSel =
                    feature.properties.geoid === selectedGeoid;
                  if (!isSel) {
                    e.target.setStyle({ weight: 1.5, opacity: 0.9 });
                  }
                },
                mouseout: (e: { target: { setStyle: (s: object) => void } }) => {
                  const isSel =
                    feature.properties.geoid === selectedGeoid;
                  if (!isSel) {
                    e.target.setStyle({
                      weight: 0.4,
                      opacity: 0.55,
                    });
                  }
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let layer: any;
            if (spec.cluster) {
              layer = L.markerClusterGroup({
                chunkedLoading: true,
                spiderfyOnMaxZoom: false,
                showCoverageOnHover: false,
                disableClusteringAtZoom: 12,
              });
              const pointsLayer = L.geoJSON(data, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pointToLayer: (_feat: any, latlng: any) =>
                  L.circleMarker(latlng, {
                    radius: spec.radius ?? 4,
                    fillColor: spec.color,
                    color: "#f6f1e6",
                    weight: 0.8,
                    opacity: 1,
                    fillOpacity: 0.78,
                  }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onEachFeature: (feature: any, lyr: any) => {
                  const props = feature.properties ?? {};
                  const name =
                    props.facility_name ?? props.facility_id ?? "(unnamed)";
                  lyr.bindTooltip(
                    `<div style="font-family: var(--font-display); font-weight: 600; font-size: 11px; color: var(--color-ink);">${name}</div>
                     <div style="font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">${spec.layerLabel}</div>`,
                    { sticky: true }
                  );
                },
              });
              layer.addLayer(pointsLayer);
            } else {
              layer = L.geoJSON(data, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pointToLayer: (_feat: any, latlng: any) =>
                  L.circleMarker(latlng, {
                    radius: spec.radius ?? 4,
                    fillColor: spec.color,
                    color: "#161d2c",
                    weight: 0.6,
                    opacity: 1,
                    fillOpacity: 0.85,
                  }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onEachFeature: (feature: any, lyr: any) => {
                  const props = feature.properties ?? {};
                  const name =
                    props.facility_name ?? props.facility_id ?? "(unnamed)";
                  lyr.bindTooltip(
                    `<div style="font-family: var(--font-display); font-weight: 600; font-size: 11px; color: var(--color-ink);">${name}</div>
                     <div style="font-family: var(--font-mono); font-size: 9px; color: var(--color-ink-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">${spec.layerLabel}</div>`,
                    { sticky: true }
                  );
                },
              });
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
  }, [indicatorCode, countyData, measureLabel, setSelectedGeoid, pointLayers]);

  // Narrow effect: re-style selection border without rebuilding the map.
  useEffect(() => {
    const layer = choroplethLayerRef.current;
    if (!layer) return;
    const values = Object.values(countyData)
      .map((m: Record<string, number>) => m[indicatorCode])
      .filter((v) => Number.isFinite(v));
    const max = Math.max(1, ...values);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.setStyle((feature: any) => {
      const v = countyData[feature.properties.geoid]?.[indicatorCode];
      const isSelected = feature.properties.geoid === selectedGeoid;
      return {
        fillColor: colorFor(v, max),
        fillOpacity: Number.isFinite(v) && (v ?? 0) > 0 ? 0.88 : 0.5,
        color: isSelected ? "#b9430b" : "#161d2c",
        weight: isSelected ? 2.5 : 0.4,
        opacity: isSelected ? 1 : 0.55,
        dashArray: isSelected ? undefined : "1,2",
      };
    });
  }, [selectedGeoid, countyData, indicatorCode]);

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
        max={Math.max(
          1,
          ...Object.values(countyData)
            .map((m) => m[indicatorCode])
            .filter((v) => Number.isFinite(v))
        )}
        label={measureLabel}
      />
    </div>
  );
}

function ChoroplethLegend({
  ramp,
  max,
  label,
}: {
  ramp: string[];
  max: number;
  label: string;
}) {
  // Compute the value at each step boundary (using the same gamma=0.7)
  const boundaries = ramp.map((_, i) => {
    const frac = (i + 1) / ramp.length;
    return Math.round(Math.pow(frac, 1 / 0.7) * max);
  });

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
        <span>0</span>
        {boundaries.slice(0, -1).map((b, i) => (
          <span key={i}>{b.toLocaleString()}</span>
        ))}
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}
