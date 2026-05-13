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
