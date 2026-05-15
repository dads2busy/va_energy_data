"use client";

import { useEffect } from "react";
import { useQueryState } from "nuqs";
import { useData } from "./DataProvider";
import { CompassMark } from "./CompassRose";

export type Resolution = "county" | "tract";

interface Props {
  paramKey?: string; // URL param name; default "res"
}

export function ResolutionToggle({ paramKey = "res" }: Props) {
  const [res, setRes] = useQueryState(paramKey, {
    defaultValue: "county" as Resolution,
  });
  const { loadTracts, tractLoading } = useData();

  // Kick off tract load the first time we switch to it
  useEffect(() => {
    if (res === "tract") loadTracts();
  }, [res, loadTracts]);

  return (
    <div className="inline-flex items-center gap-x-1 border-y border-[--color-paper-edge] py-1">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
        Resolution
      </span>
      {(["county", "tract"] as const).map((r) => {
        const active = res === r;
        return (
          <button
            key={r}
            onClick={() => setRes(r)}
            aria-pressed={active}
            className={`relative inline-flex cursor-pointer items-center gap-1.5 border-l border-[--color-paper-edge] px-3 py-1 text-xs transition-colors first:border-l-0 ${
              active
                ? "bg-[#ede4d0] font-medium text-[--color-energy-deep]"
                : "text-[--color-ink-muted] hover:bg-[#ede4d0] hover:text-[--color-ink]"
            }`}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -top-px h-[2px] bg-[--color-energy]"
              />
            )}
            <span
              aria-hidden="true"
              className="flex h-[11px] w-[11px] shrink-0 items-center justify-center"
            >
              {active && <CompassMark size={11} />}
            </span>
            <span>{r === "county" ? "County (133)" : "Tract (1,872)"}</span>
            {r === "tract" && tractLoading && (
              <span className="ml-1 font-mono text-[9px] text-[--color-ink-muted]">
                loading…
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
