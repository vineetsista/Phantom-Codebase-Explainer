"use client";

/**
 * Quality signals panel — renders the structured observable signals
 * from the analyzer. Each signal is a card with a value, label, and
 * one-line explanation, color-coded by `color` (green / yellow / red).
 *
 * Renders nothing if no signals are present (e.g. legacy videos from
 * before v7).
 */
import { cn } from "@/lib/utils";

interface Signal {
  value: string | number;
  label: string;
  color: "green" | "yellow" | "red";
  explain: string;
  raw?: string;
}

interface Props {
  signals?: Record<string, Signal> | null;
}

const COLOR_STYLES: Record<Signal["color"], string> = {
  green: "border-emerald-400/30 bg-emerald-400/5 text-emerald-300",
  yellow: "border-amber-400/30 bg-amber-400/5 text-amber-300",
  red: "border-rose-400/30 bg-rose-400/5 text-rose-300",
};

const DOT_STYLES: Record<Signal["color"], string> = {
  green: "bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.5)]",
  yellow: "bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.5)]",
  red: "bg-rose-400 shadow-[0_0_12px_2px_rgba(244,114,182,0.5)]",
};

export function QualitySignalsPanel({ signals }: Props) {
  if (!signals || Object.keys(signals).length === 0) return null;
  const entries = Object.entries(signals);

  return (
    <section className="mt-12">
      <div className="kicker">Quality signals</div>
      <h2 className="mt-3 font-display text-2xl font-bold text-bone">
        What the code tells us
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fog">
        Observable signals — tests, docs, license, file shape, read time —
        derived directly from the repo. No subjective grading.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, signal]) => (
          <div
            key={key}
            className={cn(
              "rounded-2xl border bg-graphite/40 p-5 backdrop-blur transition-colors",
              COLOR_STYLES[signal.color] || COLOR_STYLES.yellow,
            )}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  DOT_STYLES[signal.color] || DOT_STYLES.yellow,
                )}
              />
              <span className="kicker text-fog">{signal.label}</span>
            </div>
            <div className="mt-3 font-display text-2xl font-semibold text-bone">
              {signal.value}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fog">
              {signal.explain}
            </p>
            {signal.raw && (
              <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-mist">
                {signal.raw}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
