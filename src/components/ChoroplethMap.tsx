"use client";

import { useEffect, useRef, useState } from "react";

interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { geoid: string; region_name?: string };
    geometry: GeoJSON.Geometry;
  }>;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface Props {
  indicatorCode: string;
  countyData: Record<string, Record<string, number>>;
  measureLabel: string;
}

export function ChoroplethMap({
  indicatorCode,
  countyData,
  measureLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Leaflet is window-dependent — lazy import at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        // Inject Leaflet CSS once
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

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

        const colorFor = (val: number | undefined): string => {
          if (!Number.isFinite(val ?? NaN)) return "#eeeeee";
          const frac = Math.min(1, (val ?? 0) / max);
          // simple white→amber ramp (replace with cmocean lajolla later)
          const lum = Math.round(255 - frac * 200);
          const g = Math.round(255 - frac * 100);
          return `rgb(${255}, ${g}, ${lum})`;
        };

        L.geoJSON(geo as unknown as GeoJSON.GeoJsonObject, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: (feature: any) => {
            const v = countyData[feature.properties.geoid]?.[indicatorCode];
            return {
              fillColor: colorFor(v),
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
          },
        }).addTo(mapInstance);
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
    };
  }, [indicatorCode, countyData, measureLabel]);

  if (error) return <div className="text-red-600">Map error: {error}</div>;
  return (
    <div
      ref={containerRef}
      className="h-[500px] w-full rounded border border-gray-200"
    />
  );
}
