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

/** Module-level color helper — shared by both useEffects to avoid duplication. */
function colorFor(
  val: number | undefined,
  max: number
): string {
  if (!Number.isFinite(val ?? NaN)) return "#eeeeee";
  const frac = Math.min(1, (val ?? 0) / max);
  const lum = Math.round(255 - frac * 200);
  const g = Math.round(255 - frac * 100);
  return `rgb(${255}, ${g}, ${lum})`;
}

interface PointLayerSpec {
  /** URL or relative path to the GeoJSON file */
  geojsonUrl: string;
  /** Whether to cluster (use for dense layers). */
  cluster: boolean;
  /** Fill color for markers */
  color: string;
  /** Marker radius in pixels */
  radius?: number;
  /** Display name for tooltips */
  layerLabel: string;
}

interface Props {
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  measureLabel: string;
  /** Optional point layers to overlay on the choropleth. */
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
    // Leaflet is window-dependent — lazy import at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        // Markercluster augments L; must be a dynamic import to avoid SSR failures.
        await import("leaflet.markercluster");

        const resp = await fetch(`${BASE}/geo/county.geojson`);
        const geo = (await resp.json()) as FeatureCollection;

        if (cancelled || !containerRef.current) return;

        // Clear any prior content (StrictMode double-mounts in dev)
        containerRef.current.innerHTML = "";

        mapInstance = L.map(containerRef.current, {
          center: [37.7, -78.5],
          zoom: 7,
          scrollWheelZoom: false,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          {
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CARTO',
          }
        ).addTo(mapInstance);

        const values = Object.values(countyData)
          .map((m) => m[indicatorCode])
          .filter((v) => Number.isFinite(v));
        const max = Math.max(1, ...values);

        // simple white→amber ramp (replace with cmocean lajolla later)
        const choroplethLayer = L.geoJSON(geo as unknown as GeoJSON.GeoJsonObject, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: (feature: any) => {
            const v = countyData[feature.properties.geoid]?.[indicatorCode];
            return {
              fillColor: colorFor(v, max),
              fillOpacity: 0.85,
              color: "#555",
              weight: 0.5,
            };
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEachFeature: (feature: any, layer: any) => {
            const v = countyData[feature.properties.geoid]?.[indicatorCode];
            const name =
              feature.properties.region_name ?? feature.properties.geoid;
            layer.bindTooltip(
              `<b>${name}</b><br>${measureLabel}: ${v ?? "n/a"}`,
              { sticky: true }
            );
            layer.on({
              click: () => setSelectedGeoid(feature.properties.geoid),
            });
          },
        });
        choroplethLayer.addTo(mapInstance);
        choroplethLayerRef.current = choroplethLayer;

        // Point overlays (Phase 2)
        if (pointLayers) {
          for (const spec of pointLayers) {
            const resp = await fetch(`${BASE}${spec.geojsonUrl}`);
            if (!resp.ok) {
              console.warn("Failed to load point layer", spec.geojsonUrl);
              continue;
            }
            const data = await resp.json();
            if (cancelled) return;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let layer: any;
            if (spec.cluster) {
              layer = L.markerClusterGroup({ chunkedLoading: true });
              const pointsLayer = L.geoJSON(data, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pointToLayer: (_feat: any, latlng: any) =>
                  L.circleMarker(latlng, {
                    radius: spec.radius ?? 4,
                    fillColor: spec.color,
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.85,
                  }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onEachFeature: (feature: any, lyr: any) => {
                  const props = feature.properties ?? {};
                  const name =
                    props.facility_name ?? props.facility_id ?? "(unnamed)";
                  lyr.bindTooltip(`<b>${name}</b><br>${spec.layerLabel}`, {
                    sticky: true,
                  });
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
                    color: "#fff",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.85,
                  }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onEachFeature: (feature: any, lyr: any) => {
                  const props = feature.properties ?? {};
                  const name =
                    props.facility_name ?? props.facility_id ?? "(unnamed)";
                  lyr.bindTooltip(`<b>${name}</b><br>${spec.layerLabel}`, {
                    sticky: true,
                  });
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
        fillOpacity: 0.85,
        color: isSelected ? "#dc2626" : "#555",
        weight: isSelected ? 2.5 : 0.5,
      };
    });
  }, [selectedGeoid, countyData, indicatorCode]);

  if (error) return <div className="text-red-600">Map error: {error}</div>;
  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full rounded border border-gray-200"
    />
  );
}
