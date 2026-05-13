"use client";

import { useData } from "./DataProvider";
import { ChoroplethMap } from "./ChoroplethMap";

export function OverviewTab() {
  const { loading, error, countyData, variables } = useData();

  if (loading) return <Loading />;
  if (error || !countyData || !variables)
    return <ErrorState message={error ?? "(unknown)"} />;

  const indicatorCode = Object.entries(variables).find(
    ([, m]) => m.measure === "total_data_center_count"
  )?.[0];

  if (!indicatorCode) {
    return (
      <ErrorState
        message={
          "Indicator total_data_center_count missing from variables.json. Re-run the build script."
        }
      />
    );
  }

  const choroplethData: Record<string, Record<string, number>> = {};
  for (const geoid of Object.keys(countyData)) {
    const entry = countyData[geoid][indicatorCode];
    if (typeof entry === "number") {
      choroplethData[geoid] = { [indicatorCode]: entry };
    }
  }

  const values = Object.values(choroplethData)
    .map((m) => m[indicatorCode])
    .filter((v) => Number.isFinite(v));
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 0);
  const topGeoid = Object.entries(choroplethData).find(
    ([, m]) => m[indicatorCode] === max
  )?.[0];
  const topShare = total > 0 ? Math.round((max / total) * 100) : 0;

  return (
    <article className="fade-up">
      {/* Chapter heading */}
      <header className="mb-8">
        <div className="citation">
          <span className="text-[--color-energy]">§I</span> · Chapter the First
        </div>
        <h2 className="display mt-2 text-4xl font-medium tracking-tight text-[--color-ink]">
          Where is Virginia's energy story{" "}
          <span className="display-italic">already concentrated?</span>
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[--color-ink-muted]">
          The state hosts an outsized share of the country's data center
          infrastructure — and that share is overwhelmingly clustered in a
          handful of Northern Virginia counties. The map below shows where
          OSM-derived facility records sit, colored by density.
        </p>
      </header>

      {/* Pull-quote / headline stat */}
      <section className="mb-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <div className="pull-bracket">
            <p className="display text-2xl leading-snug text-[--color-ink]">
              Virginia hosts{" "}
              <span className="display-italic text-[--color-energy]">
                {total.toLocaleString()}
              </span>{" "}
              data center records, with{" "}
              <span className="display-italic text-[--color-energy]">
                {topShare}%
              </span>{" "}
              concentrated in a single county — {topGeoid ?? "—"}.
            </p>
          </div>
          <p className="marginalia mt-3">
            <em>A note on counting:</em> a single physical facility can appear
            in OSM as a tagged point, a building footprint, and a campus
            polygon — three records, one facility. The dashboard reports
            records, not unique facilities. See the{" "}
            <a
              className="underline decoration-[--color-paper-edge] hover:decoration-[--color-energy]"
              href="https://data.msdlive.org/records/p147s-4h760"
              target="_blank"
              rel="noreferrer"
            >
              IM3 Atlas methodology
            </a>{" "}
            for details.
          </p>
        </div>

        {/* Stat block — large editorial figures */}
        <div className="col-span-12 lg:col-span-5">
          <div className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              Statewide snapshot
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <StatFigure
                value={total.toLocaleString()}
                label="Records"
                tone="ink"
              />
              <StatFigure
                value={values.length.toString()}
                label="Counties"
                tone="ink"
              />
              <StatFigure
                value={max.toLocaleString()}
                label={`${topGeoid ?? "Top"} max`}
                tone="energy"
              />
            </div>
            <div className="mt-3 border-t border-[--color-paper-edge] pt-2 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
              Source · IM3 Atlas v2026.02.09
            </div>
          </div>
        </div>
      </section>

      {/* The map */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg font-medium text-[--color-ink]">
            Data center records, by county
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Plate 1.1
          </span>
        </div>
        <ChoroplethMap
          indicatorCode={indicatorCode}
          countyData={choroplethData}
          measureLabel="Data center records"
        />
      </section>

      {/* Reading guide */}
      <section className="mt-10 border-t border-[--color-paper-edge] pt-8">
        <div className="rule-with-mark mb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest">
            How to read this atlas
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ReadingNote
            number="01"
            title="Maps are heterogeneous, not uniform"
            body="Every paper in the source set argues that aggregate energy statistics mask household- and county-level differences. The map exposes that heterogeneity directly."
          />
          <ReadingNote
            number="02"
            title="Pick a chapter to drill down"
            body="Chapter II turns the map onto EV charging infrastructure. Chapters III–V (in progress) extend to adoption, projected siting, and retrofitting policy."
          />
          <ReadingNote
            number="03"
            title="Click a county anywhere"
            body="The selection persists across chapters. Click Loudoun on the data-center map, then switch to EV Infrastructure — its profile follows you."
          />
        </div>
      </section>
    </article>
  );
}

function StatFigure({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "ink" | "energy";
}) {
  return (
    <div>
      <div
        className={`display tabular-nums text-3xl font-medium leading-none ${
          tone === "energy"
            ? "text-[--color-energy]"
            : "text-[--color-ink]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </div>
    </div>
  );
}

function ReadingNote({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy]">
        {number}
      </div>
      <h4 className="display mt-1 text-base font-medium text-[--color-ink]">
        {title}
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-[--color-ink-muted]">
        {body}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
          Loading
        </div>
        <div className="display mt-2 text-lg italic text-[--color-ink-light]">
          Reading the atlas…
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="border border-[--color-energy] bg-[--color-energy-soft] px-6 py-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy-deep]">
        Error
      </div>
      <div className="mt-1 text-sm text-[--color-ink]">{message}</div>
    </div>
  );
}
