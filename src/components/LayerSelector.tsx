"use client";

export interface LayerOption {
  code: string;
  label: string;
}

interface Props {
  options: LayerOption[];
  selected: string;
  onChange: (code: string) => void;
}

export function LayerSelector({ options, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-y border-[--color-paper-edge] py-1">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
        Layer
      </span>
      {options.map((opt) => {
        const active = selected === opt.code;
        return (
          <button
            key={opt.code}
            onClick={() => onChange(opt.code)}
            className={`relative border-l border-[--color-paper-edge] px-3 py-1 text-xs transition-colors first:border-l-0 ${
              active
                ? "font-medium text-[--color-energy-deep]"
                : "text-[--color-ink-muted] hover:text-[--color-ink]"
            }`}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -top-px h-[2px] bg-[--color-energy]"
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
