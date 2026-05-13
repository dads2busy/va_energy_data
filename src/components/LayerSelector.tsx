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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.code}
          onClick={() => onChange(opt.code)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selected === opt.code
              ? "border-amber-600 bg-amber-50 text-amber-800"
              : "border-gray-300 text-gray-600 hover:border-gray-500"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
