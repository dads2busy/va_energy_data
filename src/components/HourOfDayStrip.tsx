"use client";

import { useSelectionStore } from "./selectionStore";

interface Props {
  values: number[]; // length 24
  label?: string;
}

export function HourOfDayStrip({ values, label = "Hourly demand" }: Props) {
  const selectedHour = useSelectionStore((s) => s.selectedHour);
  const setSelectedHour = useSelectionStore((s) => s.setSelectedHour);

  if (values.length !== 24) {
    return (
      <div className="text-xs text-red-600">
        HourOfDayStrip expected 24 values, got {values.length}
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600">
          {label}
        </span>
        <span className="text-xs text-gray-500">
          Total: {Math.round(total).toLocaleString()} kWh/day
        </span>
      </div>
      <svg
        viewBox="0 0 240 60"
        className="h-16 w-full"
        preserveAspectRatio="none"
      >
        {values.map((v, h) => {
          const barH = (v / max) * 50;
          const x = h * 10;
          const isSelected = selectedHour === h;
          return (
            <g
              key={h}
              onClick={() => setSelectedHour(isSelected ? null : h)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={60 - barH - 4}
                width={8}
                height={barH}
                fill={isSelected ? "#d97706" : "#fbbf24"}
                opacity={isSelected ? 1 : 0.75}
              />
              {isSelected && (
                <rect
                  x={x - 0.5}
                  y={60 - barH - 4.5}
                  width={9}
                  height={barH + 1}
                  fill="none"
                  stroke="#92400e"
                  strokeWidth={1}
                />
              )}
              <text
                x={x + 4}
                y={58}
                fontSize={5}
                textAnchor="middle"
                fill="#666"
              >
                {h}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-[10px] text-gray-500">
        Hour of day (0 = midnight, 12 = noon, 23 = 11 pm)
      </div>
    </div>
  );
}
