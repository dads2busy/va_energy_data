"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for the right-side detail panels used on every map tab.
 * Owns the bordered container, the header (label, title, optional close X),
 * and renders arbitrary section children below.
 */
export function DetailPanelShell({
  label,
  title,
  subtitle,
  onClose,
  closeAriaLabel,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeAriaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-[--color-paper-edge] bg-[--color-paper]">
      <div className="flex items-start justify-between gap-2 border-b border-[--color-paper-edge] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
            {label}
          </div>
          <h3 className="display mt-1 text-lg leading-tight text-[--color-ink]">
            {title}
          </h3>
          {subtitle && (
            <div className="mt-0.5 font-mono text-[10px] text-[--color-ink-light]">
              {subtitle}
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeAriaLabel ?? "Close"}
            className="cursor-pointer text-[--color-ink-muted] transition-colors hover:text-[--color-ink]"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Empty placeholder shown when no selection is active. */
export function EmptyDetailPanel({
  label,
  hint,
}: {
  label: string;
  hint: ReactNode;
}) {
  return (
    <div className="border border-dashed border-[--color-paper-edge] bg-[--color-paper] px-4 py-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </div>
      <p className="mt-3 text-[12px] leading-snug text-[--color-ink-muted]">
        {hint}
      </p>
    </div>
  );
}

/** Single label / value row for the body of a detail panel. */
export function DetailRow({
  label,
  value,
  mono,
  chip,
  emphasize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  chip?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </dt>
      <dd>
        {chip ? (
          <span
            className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              emphasize ?? true
                ? "border-[--color-ink-faint] text-[--color-ink]"
                : "border-[--color-paper-edge] text-[--color-ink-muted]"
            }`}
          >
            {value}
          </span>
        ) : (
          <span
            className={`${mono ? "font-mono text-[12px]" : "text-[13px]"} ${
              emphasize ? "text-[--color-ink]" : "text-[--color-ink-muted]"
            }`}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}

/** A simple two-column list (label left, value right) for ranked breakdowns. */
export function RankedList({
  label,
  items,
  emptyHint,
}: {
  label: string;
  items: Array<{ name: string; count: string | number }>;
  emptyHint?: string;
}) {
  if (items.length === 0) {
    if (!emptyHint) return null;
    return (
      <div className="border-t border-[--color-paper-edge] px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
          {label}
        </div>
        <p className="mt-1 text-[11px] text-[--color-ink-light]">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="border-t border-[--color-paper-edge] px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[--color-ink-muted]">
        {label}
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((it) => (
          <li
            key={it.name}
            className="flex items-baseline justify-between gap-2 text-[12px]"
          >
            <span className="truncate text-[--color-ink]">{it.name}</span>
            <span className="font-mono tabular-nums text-[--color-ink-muted]">
              {typeof it.count === "number"
                ? it.count.toLocaleString()
                : it.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
