"use client";

interface Props {
  dataMethod: string;
  scenario: string;
}

const METHOD_COLORS: Record<string, string> = {
  observed: "bg-emerald-100 text-emerald-800",
  simulated: "bg-amber-100 text-amber-800",
  modeled: "bg-blue-100 text-blue-800",
  scaled: "bg-purple-100 text-purple-800",
  interpolated: "bg-gray-100 text-gray-800",
  extrapolated: "bg-gray-100 text-gray-800",
};

export function ProvenanceBadge({ dataMethod, scenario }: Props) {
  const color = METHOD_COLORS[dataMethod] ?? "bg-gray-100 text-gray-800";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-block rounded px-2 py-0.5 font-medium uppercase tracking-wide ${color}`}
      >
        {dataMethod}
      </span>
      <span className="font-mono text-gray-500">{scenario}</span>
    </div>
  );
}
