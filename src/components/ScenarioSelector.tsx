"use client";

import { useEffect, useRef } from "react";
import { CompassMark } from "./CompassRose";

const TIERS = [
  { key: "low", label: "Low growth" },
  { key: "moderate", label: "Moderate growth" },
  { key: "high", label: "High growth" },
  { key: "higher", label: "Higher growth" },
] as const;

const WEIGHTS = [0, 25, 50, 75, 100] as const;

export interface ParsedScenario {
  tier: (typeof TIERS)[number]["key"];
  weight: (typeof WEIGHTS)[number];
}

export function parseScenario(s: string): ParsedScenario | null {
  // Expected: im3_cerf_<tier>_<weight>
  const match = s.match(/^im3_cerf_(low|moderate|high|higher)_(\d+)$/);
  if (!match) return null;
  const tier = match[1] as ParsedScenario["tier"];
  const weight = Number(match[2]) as ParsedScenario["weight"];
  if (!WEIGHTS.includes(weight)) return null;
  return { tier, weight };
}

export function makeScenario(p: ParsedScenario): string {
  return `im3_cerf_${p.tier}_${p.weight}`;
}

interface Props {
  selected: string;
  onChange: (scenario: string) => void;
}

export function ScenarioSelector({ selected, onChange }: Props) {
  const parsed = parseScenario(selected);
  const activeTier = parsed?.tier ?? "moderate";
  const activeWeight = parsed?.weight ?? 50;

  // First render uses a 3-blink animation; subsequent user-driven selection
  // changes use 2 blinks. The ref is read during render (allowed) and
  // flipped in an effect so the *next* render uses the change animation.
  const isFirstRenderRef = useRef(true);
  const blinkClass = isFirstRenderRef.current
    ? "animate-scenario-blink-3"
    : "animate-scenario-blink-2";

  useEffect(() => {
    isFirstRenderRef.current = false;
  }, [selected]);

  return (
    <div className="border border-[--color-paper-edge] bg-[--color-paper] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Scenario chooser
          </div>
          <h3 className="display mt-0.5 text-lg font-medium text-[--color-ink]">
            <span className="display-italic">{activeTier}</span> demand growth ·{" "}
            <span className="display-italic">{activeWeight}%</span> market gravity
          </h3>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
          {selected}
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "120px repeat(5, minmax(0, 1fr))" }}
      >
        <div />
        {WEIGHTS.map((w) => (
          <div
            key={w}
            className="px-2 pb-2 text-center font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]"
          >
            {w}% gravity
          </div>
        ))}
      </div>

      {/* Body rows */}
      {TIERS.map((tier) => (
        <div
          key={tier.key}
          className="grid border-t border-[--color-paper-edge]"
          style={{ gridTemplateColumns: "120px repeat(5, minmax(0, 1fr))" }}
        >
          <div className="flex items-center pr-2 text-right text-xs text-[--color-ink-muted]">
            {tier.label}
          </div>
          {WEIGHTS.map((w) => {
            const active = tier.key === activeTier && w === activeWeight;
            return (
              <button
                key={w}
                onClick={() => onChange(makeScenario({ tier: tier.key, weight: w }))}
                aria-pressed={active}
                className={`relative cursor-pointer border-l border-[--color-paper-edge] py-[9px] transition-colors ${
                  active
                    ? `bg-[#ede4d0] text-[--color-energy-deep] ${blinkClass}`
                    : "text-[--color-ink-muted] hover:bg-[#ede4d0] hover:text-[--color-ink]"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -top-px h-[2px] bg-[--color-energy]"
                  />
                )}
                <span className="flex items-center justify-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="flex h-[11px] w-[11px] shrink-0 items-center justify-center"
                  >
                    {active && <CompassMark size={11} />}
                  </span>
                  <span className="font-mono text-[11px] font-bold">
                    {tier.key.charAt(0).toUpperCase()}-{w}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}

      <p className="mt-3 text-[11px] text-[--color-ink-muted]">
        <em className="display-italic">20 scenarios</em>: 4 demand-growth tiers ×
        5 market-gravity weights. Each cell re-sites the same siting model under
        different assumptions; the choropleth and the implication strip update.
      </p>
    </div>
  );
}
