"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-glow/10 via-transparent to-violet-glow/10 p-12 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at center, rgba(0,240,255,0.18), transparent 60%)",
          }}
        />
        <h2 className="relative font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl">
          Understand any codebase in minutes.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-ink-50/60">
          Paste a URL. Walk away. Come back to a polished explainer video.
        </p>
        <Link
          href="/generate"
          className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-cyan-glow px-7 text-sm font-semibold text-ink-900 shadow-[0_0_32px_-4px_rgba(0,240,255,0.6)] transition-all hover:brightness-110"
        >
          Try RepoX free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
