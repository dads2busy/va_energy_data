"use client";

interface Props {
  dataMethod: string;
  scenario: string;
}

const METHOD_STYLE: Record<
  string,
  { ring: string; dot: string; word: string }
> = {
  observed: {
    ring: "border-[--color-pm-observed]",
    dot: "bg-[--color-pm-observed]",
    word: "text-[--color-pm-observed]",
  },
  simulated: {
    ring: "border-[--color-pm-simulated]",
    dot: "bg-[--color-pm-simulated]",
    word: "text-[--color-pm-simulated]",
  },
  modeled: {
    ring: "border-[--color-pm-modeled]",
    dot: "bg-[--color-pm-modeled]",
    word: "text-[--color-pm-modeled]",
  },
  scaled: {
    ring: "border-[--color-pm-scaled]",
    dot: "bg-[--color-pm-scaled]",
    word: "text-[--color-pm-scaled]",
  },
  interpolated: {
    ring: "border-[--color-pm-interpolated]",
    dot: "bg-[--color-pm-interpolated]",
    word: "text-[--color-pm-interpolated]",
  },
  extrapolated: {
    ring: "border-[--color-pm-extrapolated]",
    dot: "bg-[--color-pm-extrapolated]",
    word: "text-[--color-pm-extrapolated]",
  },
};

/**
 * A wax-seal style provenance stamp. Communicates the data_method (observed,
 * simulated, modeled, etc.) and the active scenario label as a footnote.
 */
export function ProvenanceBadge({ dataMethod, scenario }: Props) {
  const style =
    METHOD_STYLE[dataMethod] ?? METHOD_STYLE.observed;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center gap-2 border ${style.ring} bg-[--color-paper] px-2.5 py-1`}
      >
        <span
          aria-hidden="true"
          className={`block h-1.5 w-1.5 rounded-full ${style.dot}`}
        />
        <span
          className={`font-mono text-[10px] font-medium uppercase tracking-widest ${style.word}`}
        >
          {dataMethod}
        </span>
      </div>
      <span className="font-mono text-[10px] text-[--color-ink-muted]">
        scenario · <span className="text-[--color-ink]">{scenario}</span>
      </span>
    </div>
  );
}
