interface PaperRef {
  short: string;
  long: string;
  href: string;
}

interface Props {
  chapter: string;
  title: string;
  subtitle: string;
  papers?: PaperRef[];
}

/**
 * Editorial "next chapter" placeholder. Frames yet-to-be-built tabs as the
 * upcoming chapter of an atlas — papers cited, narrative previewed, but the
 * plate itself is "in preparation."
 */
export function TabPlaceholder({ chapter, title, subtitle, papers }: Props) {
  return (
    <article className="fade-up mx-auto max-w-3xl py-12">
      <div className="citation text-center">
        <span className="text-[--color-energy]">§{chapter}</span> · In
        preparation
      </div>
      <h2 className="display mt-3 text-center text-4xl font-medium tracking-tight text-[--color-ink]">
        <span className="display-italic">{title}</span>
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-[--color-ink-muted]">
        {subtitle}
      </p>

      <div className="my-10 flex items-center justify-center">
        <div
          aria-hidden="true"
          className="flex h-32 w-32 items-center justify-center border border-[--color-paper-edge] bg-[--color-paper]"
        >
          <svg viewBox="0 0 60 60" width="60" height="60">
            <rect
              x="6"
              y="6"
              width="48"
              height="48"
              fill="none"
              stroke="var(--color-ink-faint)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <text
              x="30"
              y="36"
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontStyle="italic"
              fontSize="22"
              fill="var(--color-ink-faint)"
            >
              {chapter}
            </text>
          </svg>
        </div>
      </div>

      {papers && papers.length > 0 && (
        <>
          <div className="rule-with-mark">
            <span className="font-mono text-[10px] uppercase tracking-widest">
              Will draw on
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {papers.map((p) => (
              <li key={p.short} className="flex items-baseline gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[--color-energy]">
                  Paper
                </span>
                <div className="flex-1">
                  <span className="display text-base font-medium text-[--color-ink]">
                    {p.short}
                  </span>
                  <span className="ml-2 text-sm text-[--color-ink-muted]">
                    {p.long}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-widest text-[--color-ink-light]">
        plate forthcoming
      </p>
    </article>
  );
}
