"use client";

import { useQueryState } from "nuqs";
import { DataProvider } from "./DataProvider";
import { TabNav, type TabId } from "./TabNav";
import { OverviewTab } from "./OverviewTab";
import { TabPlaceholder } from "./TabPlaceholder";
import { EVTab } from "./EVTab";
import { ResidentialTab } from "./ResidentialTab";

export function AppLayout() {
  const [tab] = useQueryState("tab", {
    defaultValue: "overview" as TabId,
  });

  return (
    <DataProvider>
      <div className="mx-auto max-w-[1400px]">
        <SiteHeader />
        <TabNav />
        <main className="px-8 pb-16 pt-8">
          {tab === "overview" && <OverviewTab />}
          {tab === "ev" && <EVTab />}
          {tab === "residential" && <ResidentialTab />}
          {tab === "data-centers" && (
            <TabPlaceholder
              chapter="IV"
              title="Data Center Pressure"
              subtitle="Existing IM3 Atlas data centers and the CERF-modeled 2035 projections, framed against power, water, and cost demand."
              papers={[
                {
                  short: "IM3 Atlas",
                  long: "Pacific Northwest National Laboratory — Open Source Data Center Atlas",
                  href: "https://data.msdlive.org/records/p147s-4h760",
                },
                {
                  short: "IM3 CERF",
                  long: "PNNL — Projected US Data Center Locations (20 siting scenarios)",
                  href: "https://data.msdlive.org/records/r0cga-34g05",
                },
              ]}
            />
          )}
          {tab === "retrofit" && (
            <TabPlaceholder
              chapter="V"
              title="Retrofit & Equity"
              subtitle="The RAISE budget allocation with an income-equity dial; trade total energy savings against equitable distribution across counties and income groups."
              papers={[
                {
                  short: "RAISE",
                  long: "Kishore, Sundar, Deka, Marathe — Two-tier retrofit allocation",
                  href: "#",
                },
              ]}
            />
          )}
        </main>
        <SiteFooter />
      </div>
    </DataProvider>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-[--color-paper-edge] px-8 pb-6 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="citation mb-3">
            Edition I · Spring 2026 · UVA Biocomplexity Institute
          </div>
          <h1 className="display text-5xl leading-[1.05] tracking-tight text-[--color-ink]">
            Virginia Energy{" "}
            <span className="display-italic text-[--color-energy]">
              Data Atlas
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[--color-ink-muted]">
            An interactive companion to four working papers on the residential
            energy digital twin of Virginia — its households, its grid, its
            charging infrastructure, and its projected 2030 future.
          </p>
        </div>
        <div className="hidden lg:block">
          <Compass />
        </div>
      </div>
    </header>
  );
}

/** Decorative compass rose — a small visual nod to the atlas concept. */
function Compass() {
  return (
    <svg
      width="84"
      height="84"
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="opacity-70"
    >
      <defs>
        <pattern
          id="compass-bg"
          patternUnits="userSpaceOnUse"
          width="4"
          height="4"
        >
          <circle cx="2" cy="2" r="0.3" fill="var(--color-ink-faint)" />
        </pattern>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="var(--color-ink-faint)"
        strokeWidth="0.5"
      />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="var(--color-ink-faint)"
        strokeWidth="0.5"
      />
      {/* North */}
      <path
        d="M 50 4 L 53 50 L 50 96 L 47 50 Z"
        fill="var(--color-ink)"
        opacity="0.9"
      />
      {/* East-West fainter */}
      <path
        d="M 4 50 L 50 53 L 96 50 L 50 47 Z"
        fill="var(--color-ink-muted)"
        opacity="0.55"
      />
      <text
        x="50"
        y="14"
        textAnchor="middle"
        fontSize="9"
        fontFamily="var(--font-mono)"
        fill="var(--color-ink)"
      >
        N
      </text>
      <circle cx="50" cy="50" r="2.5" fill="var(--color-energy)" />
    </svg>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-[--color-paper-edge] px-8 pb-12 pt-8">
      <div className="rule-with-mark mb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest">
          Source papers
        </span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <PaperRef
          tag="§II"
          title="CHARGE-MAP"
          subtitle="Islam et al. — EV charging station placement under uncertainty"
          venue="PNAS 2026"
        />
        <PaperRef
          tag="§III"
          title="REVI-Twin"
          subtitle="Kishore, Islam, Marathe — Digital twin of VA residential energy"
          venue="npj 2026"
        />
        <PaperRef
          tag="§V"
          title="RAISE"
          subtitle="Kishore, Sundar, Deka, Marathe — Two-tier retrofit allocation"
          venue="PNAS Nexus, draft"
        />
        <PaperRef
          tag="§III"
          title="Thorve scidata"
          subtitle="Thorve et al. — Synthetic hourly residential energy, nationwide"
          venue="Scientific Data, submitted"
        />
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-[10px] uppercase tracking-widest text-[--color-ink-light]">
        <div className="font-mono">
          Built on Social-Data-Commons · va_energy_data
        </div>
        <div className="font-mono">v0.1 · Phase 3 — Residential Adoption</div>
      </div>
    </footer>
  );
}

function PaperRef({
  tag,
  title,
  subtitle,
  venue,
}: {
  tag: string;
  title: string;
  subtitle: string;
  venue: string;
}) {
  return (
    <div>
      <div className="citation">
        <span className="text-[--color-energy]">{tag}</span> · {venue}
      </div>
      <div className="display mt-1 text-base font-semibold text-[--color-ink]">
        {title}
      </div>
      <div className="mt-1 text-xs leading-snug text-[--color-ink-muted]">
        {subtitle}
      </div>
    </div>
  );
}
