"use client";

import { useQueryState } from "nuqs";

const TABS = [
  { id: "overview", chapter: "I", label: "Overview", phase: "live" },
  { id: "ev", chapter: "II", label: "EV Infrastructure", phase: "live" },
  { id: "residential", chapter: "III", label: "Residential Adoption", phase: "next" },
  { id: "data-centers", chapter: "IV", label: "Data Center Pressure", phase: "next" },
  { id: "retrofit", chapter: "V", label: "Retrofit & Equity", phase: "later" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

const PHASE_CHIP: Record<string, string> = {
  live: "text-[--color-gen-deep]",
  next: "text-[--color-ink-faint]",
  later: "text-[--color-ink-faint]",
};

export function TabNav() {
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "overview" as TabId,
  });

  return (
    <nav className="border-b border-[--color-paper-edge] px-8">
      <ul className="flex flex-wrap items-end gap-x-1 gap-y-2">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <li key={t.id}>
              <button
                onClick={() => setActiveTab(t.id)}
                className={`group relative flex flex-col items-start gap-0.5 px-4 pb-3 pt-3 text-left transition-colors ${
                  active
                    ? "text-[--color-ink]"
                    : "text-[--color-ink-muted] hover:text-[--color-ink]"
                }`}
              >
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest ${
                    active ? "text-[--color-energy]" : PHASE_CHIP[t.phase]
                  }`}
                >
                  §{t.chapter}
                </span>
                <span className="display text-base font-medium leading-tight">
                  {t.label}
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-[2px] bg-[--color-energy]"
                  />
                )}
                {!active && t.phase !== "live" && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-faint]">
                    {t.phase === "next" ? "next chapter" : "future"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { TABS };
