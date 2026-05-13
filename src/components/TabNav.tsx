"use client";

import { useQueryState } from "nuqs";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "ev", label: "EV Infrastructure" },
  { id: "residential", label: "Residential Adoption" },
  { id: "data-centers", label: "Data Center Pressure" },
  { id: "retrofit", label: "Retrofit & Equity" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function TabNav() {
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "overview" as TabId,
  });

  return (
    <nav className="flex gap-2 border-b border-gray-200 px-6">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTab(t.id)}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === t.id
              ? "border-b-2 border-amber-600 text-amber-700"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export { TABS };
