"use client";

import { useQueryState } from "nuqs";
import { DataProvider } from "./DataProvider";
import { TabNav, type TabId } from "./TabNav";
import { OverviewTab } from "./OverviewTab";
import { TabPlaceholder } from "./TabPlaceholder";
import { EVTab } from "./EVTab";

export function AppLayout() {
  const [tab] = useQueryState("tab", {
    defaultValue: "overview" as TabId,
  });

  return (
    <DataProvider>
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Virginia Energy Data
        </h1>
        <p className="text-sm text-gray-500">
          Companion to UVA Biocomplexity&apos;s residential energy digital twin
          research.
        </p>
      </header>
      <TabNav />
      <main className="px-6 py-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "ev" && <EVTab />}
        {tab === "residential" && (
          <TabPlaceholder
            title="Residential Adoption"
            description="PV/EV/battery adoption rates + hourly PV generation. Lands in Phase 3."
          />
        )}
        {tab === "data-centers" && (
          <TabPlaceholder
            title="Data Center Pressure"
            description="Existing + projected data centers + grid implications. Lands in Phase 3."
          />
        )}
        {tab === "retrofit" && (
          <TabPlaceholder
            title="Retrofit & Equity"
            description="RAISE allocation with equity slider. Lands in Phase 4 (requires RAISE pipeline)."
          />
        )}
      </main>
    </DataProvider>
  );
}
