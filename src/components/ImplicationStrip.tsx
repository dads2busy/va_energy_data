"use client";

export interface ImplicationMeasure {
  code: string;       // variable code (X-id from variables.json)
  measure: string;    // raw measure name
  label: string;      // human-readable, multi-line allowed
  unit: string;       // e.g. "MW", "M GAL/YR", "$M"
  total: number;      // statewide sum for the selected scenario
  format?: (v: number) => string;
}

interface Props {
  measures: ImplicationMeasure[];
  selectedCode: string;
  onSelect: (code: string) => void;
}

const defaultFormat = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
    : Math.round(v).toLocaleString();

export function ImplicationStrip({ measures, selectedCode, onSelect }: Props) {
  return (
    <section className="border border-[--color-paper-edge] bg-[--color-paper]">
      <div className="border-b border-[--color-paper-edge] px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
          Implications · Statewide totals
        </div>
        <p className="mt-0.5 text-[11px] text-[--color-ink-muted]">
          Click a measure to color the map by it.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {measures.map((m, i) => {
          const active = m.code === selectedCode;
          const fmt = m.format ?? defaultFormat;
          return (
            <button
              key={m.code}
              onClick={() => onSelect(m.code)}
              className={`group relative border-b border-l border-[--color-paper-edge] px-4 py-4 text-left transition-colors first:border-l-0 ${
                active
                  ? "bg-[--color-energy-soft]"
                  : "hover:bg-[--color-paper-deep]"
              } ${i >= 3 ? "md:border-b-0" : ""}`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 -top-px h-[2px] bg-[--color-energy]"
                />
              )}
              <div
                className={`font-mono text-[9px] uppercase tracking-widest ${
                  active ? "text-[--color-energy-deep]" : "text-[--color-ink-muted]"
                }`}
              >
                {m.unit}
              </div>
              <div
                className={`display tabular-nums mt-1 text-2xl font-medium leading-tight ${
                  active ? "text-[--color-energy-deep]" : "text-[--color-ink]"
                }`}
              >
                {fmt(m.total)}
              </div>
              <div
                className={`mt-1 text-[11px] leading-snug ${
                  active ? "text-[--color-ink]" : "text-[--color-ink-muted]"
                }`}
              >
                {m.label}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
