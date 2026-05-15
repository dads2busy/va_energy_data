"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface VariableMeta {
  measure: string;
  scenario: string;
  data_method: string;
  hourly?: boolean;
  unit?: string;
}

type CellValue = number | (number | null)[];
export type RegionData = Record<string, Record<string, CellValue>>;

interface DataState {
  loading: boolean;
  error: string | null;
  countyData: RegionData | null;
  variables: Record<string, VariableMeta> | null;
  scenarios: string[] | null;
  tractData: RegionData | null;
  tractLoading: boolean;
  tractError: string | null;
  loadTracts: () => void;
  /** geoid → human-readable region name. Derived from county.geojson;
   *  populated asynchronously so consumers should handle null. */
  countyNames: Record<string, string> | null;
}

const DataContext = createContext<DataState | null>(null);

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DataProvider({ children }: { children: ReactNode }) {
  const [countyData, setCountyData] = useState<RegionData | null>(null);
  const [variables, setVariables] = useState<
    Record<string, VariableMeta> | null
  >(null);
  const [scenarios, setScenarios] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tractData, setTractData] = useState<RegionData | null>(null);
  const [tractLoading, setTractLoading] = useState(false);
  const [tractError, setTractError] = useState<string | null>(null);
  const [tractRequested, setTractRequested] = useState(false);

  const [countyNames, setCountyNames] = useState<Record<string, string> | null>(
    null
  );

  // Load county.geojson once to derive human-readable names. The map will
  // also fetch this file later; both calls hit the same HTTP cache entry.
  useEffect(() => {
    fetch(`${BASE}/geo/county.geojson`)
      .then((r) => r.json())
      .then((geo) => {
        const names: Record<string, string> = {};
        for (const f of geo.features ?? []) {
          const p = f.properties ?? {};
          if (p.geoid)
            names[String(p.geoid)] = p.region_name ?? String(p.geoid);
        }
        setCountyNames(names);
      })
      .catch(() => setCountyNames({}));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/data/county.json`).then((r) => r.json()),
      fetch(`${BASE}/data/variables.json`).then((r) => r.json()),
      fetch(`${BASE}/data/scenarios.json`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([cd, vars, scns]) => {
        setCountyData(cd);
        setVariables(vars);
        setScenarios(scns);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!tractRequested || tractData || tractLoading) return;
    setTractLoading(true);
    fetch(`${BASE}/data/tract.json`)
      .then((r) => r.json())
      .then((td) => {
        setTractData(td);
        setTractLoading(false);
      })
      .catch((e) => {
        setTractError(String(e));
        setTractLoading(false);
      });
  }, [tractRequested, tractData, tractLoading]);

  const loadTracts = useCallback(() => {
    setTractRequested(true);
  }, []);

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        countyData,
        variables,
        scenarios,
        tractData,
        tractLoading,
        tractError,
        loadTracts,
        countyNames,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
