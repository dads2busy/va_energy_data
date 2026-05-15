"use client";

import { useQueryState } from "nuqs";
import { CompassMark } from "./CompassRose";

const TABS = [
  { id: "overview", chapter: "I", label: "Overview" },
  { id: "ev", chapter: "II", label: "EV Infrastructure" },
  { id: "residential", chapter: "III", label: "Residential Adoption" },
  { id: "data-centers", chapter: "IV", label: "Data Center Pressure" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

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
                aria-current={active ? "page" : undefined}
                aria-label={`§${t.chapter} — ${t.label}`}
                className={`group relative flex items-center gap-2.5 px-4 pb-3 pt-3 text-left transition-colors cursor-pointer ${
                  active
                    ? "bg-[#ede4d0] text-[--color-ink]"
                    : "text-[--color-ink-muted] hover:bg-[#ede4d0] hover:text-[--color-ink]"
                }`}
              >
                {/* Selection marker: fixed-width slot so layout doesn't shift
                    when activating a tab. Compass is only visible on the
                    active tab. */}
                <span
                  aria-hidden="true"
                  className="flex h-[14px] w-[14px] shrink-0 items-center justify-center"
                >
                  {active && <CompassMark size={14} />}
                </span>
                <span className="flex flex-col items-start gap-0.5">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest ${
                      active
                        ? "text-[--color-energy]"
                        : "text-[--color-gen-deep]"
                    }`}
                  >
                    §{t.chapter}
                  </span>
                  <span className="display text-base font-medium leading-tight">
                    {t.label}
                  </span>
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-[2px] bg-[--color-energy]"
                  />
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
