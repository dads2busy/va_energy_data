"use client";

import { useEffect } from "react";
import { useSelectionStore } from "./selectionStore";

/**
 * When no county is currently selected in the global selectionStore, pick the
 * geoid with the highest value for the given indicator and select it. Re-runs
 * whenever the indicator or data changes — so changing measures while no
 * county is selected updates the default. Once the user has clicked a county
 * (or the store already has a value from another tab) this hook becomes a
 * no-op.
 */
export function useDefaultTopCounty(
  indicatorCode: string | undefined,
  countyData: Record<string, Record<string, number>> | null | undefined
) {
  const selectedGeoid = useSelectionStore((s) => s.selectedGeoid);
  const setSelectedGeoid = useSelectionStore((s) => s.setSelectedGeoid);

  useEffect(() => {
    if (selectedGeoid) return;
    if (!indicatorCode || !countyData) return;
    let topGeoid: string | null = null;
    let topVal = -Infinity;
    for (const [geoid, m] of Object.entries(countyData)) {
      const v = m[indicatorCode];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (v > topVal) {
        topVal = v;
        topGeoid = geoid;
      }
    }
    if (topGeoid) setSelectedGeoid(topGeoid);
  }, [selectedGeoid, setSelectedGeoid, indicatorCode, countyData]);
}
