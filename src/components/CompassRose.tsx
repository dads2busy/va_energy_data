/**
 * A shrunken-and-simplified version of the atlas compass-rose. The header
 * compass is rendered at 84px with hairline strokes; at small sizes (12–16px)
 * those strokes vanish, so this variant uses thicker proportional lines and
 * omits the "N" cardinal label. Designed for use as a selection marker.
 */
export function CompassMark({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke="var(--color-ink-faint)"
        strokeWidth="4"
      />
      <circle
        cx="50"
        cy="50"
        r="36"
        fill="none"
        stroke="var(--color-ink-faint)"
        strokeWidth="3"
      />
      {/* North-South arm */}
      <path
        d="M 50 4 L 56 50 L 50 96 L 44 50 Z"
        fill="var(--color-ink)"
        opacity="0.95"
      />
      {/* East-West arm, fainter */}
      <path
        d="M 4 50 L 50 56 L 96 50 L 50 44 Z"
        fill="var(--color-ink-muted)"
        opacity="0.7"
      />
      <circle cx="50" cy="50" r="8" fill="var(--color-energy)" />
    </svg>
  );
}
