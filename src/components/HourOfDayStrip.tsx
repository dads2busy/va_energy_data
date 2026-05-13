"use client";

import { useSelectionStore } from "./selectionStore";

interface Props {
  values: number[]; // length 24
  label?: string;
  unit?: string;
}

const HOUR_LABELS: Record<number, string> = {
  0: "12 AM",
  6: "6 AM",
  12: "Noon",
  18: "6 PM",
};

export function HourOfDayStrip({
  values,
  label = "Hourly demand",
  unit = "kWh",
}: Props) {
  const selectedHour = useSelectionStore((s) => s.selectedHour);
  const setSelectedHour = useSelectionStore((s) => s.setSelectedHour);

  if (values.length !== 24) {
    return (
      <div className="font-mono text-xs text-[--color-energy-deep]">
        HourOfDayStrip expected 24 values, got {values.length}
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);

  // Identify the peak hour for the morning (5-11) and evening (16-22) windows
  let morningPeakH = -1;
  let morningPeakV = 0;
  for (let h = 5; h <= 11; h++) {
    if (values[h] > morningPeakV) {
      morningPeakV = values[h];
      morningPeakH = h;
    }
  }
  let eveningPeakH = -1;
  let eveningPeakV = 0;
  for (let h = 16; h <= 22; h++) {
    if (values[h] > eveningPeakV) {
      eveningPeakV = values[h];
      eveningPeakH = h;
    }
  }

  const W = 720;
  const H = 140;
  const PADDING_X = 36;
  const PADDING_TOP = 28;
  const PADDING_BOTTOM = 32;
  const innerW = W - PADDING_X * 2;
  const innerH = H - PADDING_TOP - PADDING_BOTTOM;
  const barW = innerW / 24;

  const xFor = (h: number) => PADDING_X + h * barW + barW / 2;
  const yFor = (v: number) => H - PADDING_BOTTOM - (v / max) * innerH;

  // Build the area path for smooth shape behind the bars
  const areaPoints: string[] = [];
  for (let h = 0; h < 24; h++) {
    areaPoints.push(`${xFor(h)},${yFor(values[h])}`);
  }
  const areaPath =
    `M ${PADDING_X + barW / 2},${H - PADDING_BOTTOM} ` +
    `L ${areaPoints.join(" L ")} ` +
    `L ${PADDING_X + 23 * barW + barW / 2},${H - PADDING_BOTTOM} Z`;

  const linePath = `M ${areaPoints.join(" L ")}`;

  return (
    <section className="border border-[--color-paper-edge] bg-[--color-paper] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Temporal profile
          </div>
          <h3 className="display mt-0.5 text-base font-medium text-[--color-ink]">
            {label}
          </h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            Daily total
          </div>
          <div className="display tabular-nums text-2xl font-medium text-[--color-energy-deep]">
            {Math.round(total).toLocaleString()}
            <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
              {unit}
            </span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-44 w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Filled area */}
        <path d={areaPath} fill="var(--color-energy-soft)" opacity="0.55" />
        {/* Top line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-energy)"
          strokeWidth="1.25"
        />
        {/* Baseline tick lines at quarters */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <line
            key={`gridline-${i}`}
            x1={PADDING_X}
            x2={W - PADDING_X}
            y1={H - PADDING_BOTTOM - frac * innerH}
            y2={H - PADDING_BOTTOM - frac * innerH}
            stroke="var(--color-paper-edge)"
            strokeWidth="0.4"
            strokeDasharray={i === 0 ? "0" : "1,3"}
          />
        ))}
        {/* Hour markers (interactive) */}
        {values.map((v, h) => {
          const isSelected = selectedHour === h;
          const isPeakMorning = h === morningPeakH;
          const isPeakEvening = h === eveningPeakH;
          const isPeak = isPeakMorning || isPeakEvening;
          return (
            <g
              key={h}
              onClick={() => setSelectedHour(isSelected ? null : h)}
              style={{ cursor: "pointer" }}
            >
              {/* Invisible click target */}
              <rect
                x={PADDING_X + h * barW}
                y={PADDING_TOP - 4}
                width={barW}
                height={innerH + 8}
                fill="transparent"
              />
              {/* Dot at the value */}
              <circle
                cx={xFor(h)}
                cy={yFor(v)}
                r={isSelected ? 3.5 : isPeak ? 2.5 : 1.5}
                fill={isSelected || isPeak ? "var(--color-energy-deep)" : "var(--color-energy)"}
                opacity={isSelected || isPeak ? 1 : 0.7}
              />
              {/* Vertical selection line */}
              {isSelected && (
                <line
                  x1={xFor(h)}
                  x2={xFor(h)}
                  y1={PADDING_TOP - 6}
                  y2={H - PADDING_BOTTOM}
                  stroke="var(--color-energy-deep)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              )}
              {/* Value label above selected */}
              {isSelected && (
                <text
                  x={xFor(h)}
                  y={PADDING_TOP - 8}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--color-energy-deep)"
                >
                  {Math.round(v).toLocaleString()}
                </text>
              )}
            </g>
          );
        })}

        {/* Peak annotations */}
        {morningPeakH >= 0 && (
          <PeakAnnotation
            x={xFor(morningPeakH)}
            y={yFor(values[morningPeakH])}
            label="Morning peak"
            valueText={`${Math.round(values[morningPeakH]).toLocaleString()} ${unit}`}
            anchor="left"
          />
        )}
        {eveningPeakH >= 0 && (
          <PeakAnnotation
            x={xFor(eveningPeakH)}
            y={yFor(values[eveningPeakH])}
            label="Evening peak"
            valueText={`${Math.round(values[eveningPeakH]).toLocaleString()} ${unit}`}
            anchor="right"
          />
        )}

        {/* Hour tick labels */}
        {[0, 6, 12, 18].map((h) => (
          <g key={`tick-${h}`}>
            <line
              x1={xFor(h)}
              x2={xFor(h)}
              y1={H - PADDING_BOTTOM}
              y2={H - PADDING_BOTTOM + 4}
              stroke="var(--color-ink-faint)"
              strokeWidth="0.5"
            />
            <text
              x={xFor(h)}
              y={H - 10}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--color-ink-muted)"
              letterSpacing="0.05em"
            >
              {HOUR_LABELS[h]}
            </text>
          </g>
        ))}
        {/* Hour 23 endpoint */}
        <text
          x={xFor(23) + 4}
          y={H - 10}
          textAnchor="end"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-ink-faint)"
        >
          11 PM
        </text>
      </svg>

      <p className="mt-2 text-[11px] leading-snug text-[--color-ink-muted]">
        Bars represent a <em className="display-italic">typical-day profile</em>:
        the model's expected demand at each hour, not events on a specific date.
        Click a point to lock the cursor; click again to release.
      </p>
    </section>
  );
}

function PeakAnnotation({
  x,
  y,
  label,
  valueText,
  anchor,
}: {
  x: number;
  y: number;
  label: string;
  valueText: string;
  anchor: "left" | "right";
}) {
  const dx = anchor === "left" ? -8 : 8;
  const textAnchor = anchor === "left" ? "end" : "start";
  return (
    <g opacity="0.85">
      <line
        x1={x}
        x2={x + dx * 1.5}
        y1={y}
        y2={y - 12}
        stroke="var(--color-ink-muted)"
        strokeWidth="0.4"
      />
      <text
        x={x + dx * 1.5 + (anchor === "left" ? -2 : 2)}
        y={y - 16}
        textAnchor={textAnchor}
        fontFamily="var(--font-mono)"
        fontSize="9"
        letterSpacing="0.08em"
        fill="var(--color-ink-muted)"
      >
        {label.toUpperCase()}
      </text>
      <text
        x={x + dx * 1.5 + (anchor === "left" ? -2 : 2)}
        y={y - 6}
        textAnchor={textAnchor}
        fontFamily="var(--font-display)"
        fontSize="10"
        fontStyle="italic"
        fill="var(--color-ink)"
      >
        {valueText}
      </text>
    </g>
  );
}
