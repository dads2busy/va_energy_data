"use client";

/**
 * Floating click-to-toggle overlay that turns the map's point layer on/off.
 * Positioned top-right of a relatively-positioned map container. Caller owns
 * the boolean state; this component renders the affordance.
 */
export function PointsToggle({
  active,
  onToggle,
  swatchColor,
}: {
  active: boolean;
  onToggle: () => void;
  /** Hex color shown in the small chip next to the label, so the user can
   *  associate the toggle with what kind of point it controls. */
  swatchColor: string;
}) {
  return (
    <div className="absolute right-4 top-4 z-[400] border border-[--color-paper-edge] bg-[--color-paper]/95 px-3 py-2 backdrop-blur-sm shadow-[2px_2px_0_rgba(22,29,44,0.06)]">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        Overlay
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className={`mt-1.5 flex cursor-pointer items-center gap-2 text-[11px] leading-none transition-colors ${
          active
            ? "text-[--color-ink]"
            : "text-[--color-ink-muted] hover:text-[--color-ink]"
        }`}
      >
        <span
          aria-hidden="true"
          className="block h-3.5 w-3.5 shrink-0 rounded-full border transition-colors"
          style={{
            backgroundColor: active ? "#b9430b" : "#f6f1e6",
            borderColor: active ? "#6e2306" : "#b3aea2",
          }}
        />
        <span>Show points</span>
        <span
          aria-hidden="true"
          className="ml-1 block h-2 w-2 shrink-0 rounded-full border border-[--color-ink]"
          style={{ backgroundColor: swatchColor }}
        />
      </button>
    </div>
  );
}
