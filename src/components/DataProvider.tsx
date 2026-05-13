"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface VariableMeta {
  measure: string;
  scenario: string;
  data_method: string;
  unit?: string;
}

interface DataState {
  loading: boolean;
  error: string | null;
  countyData: Record<string, Record<string, number>> | null;
  variables: Record<string, VariableMeta> | null;
}

const DataContext = createContext<DataState | null>(null);

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    loading: true,
    error: null,
    countyData: null,
    variables: null,
  });

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/data/county.json`).then((r) => r.json()),
      fetch(`${BASE}/data/variables.json`).then((r) => r.json()),
    ])
      .then(([countyData, variables]) =>
        setState({ loading: false, error: null, countyData, variables })
      )
      .catch((e) =>
        setState({
          loading: false,
          error: String(e),
          countyData: null,
          variables: null,
        })
      );
  }, []);

  return <DataContext.Provider value={state}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
