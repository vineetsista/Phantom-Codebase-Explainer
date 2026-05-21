import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phantom.video";

export const metadata: Metadata = {
  title: "About — why Phantom exists",
  description:
    "Phantom turns any GitHub repository into a narrated video walkthrough. Built by Vineet Sista in Columbus, Ohio.",
  alternates: { canonical: `${BASE_URL}/about` },
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-32 pt-24">
      <div className="kicker">About</div>
      <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl">
        Phantom is the briefing I always wished existed.
      </h1>

      <div className="mt-12 space-y-6 text-lg leading-relaxed text-fog">
        <p>
          I lose a week every time I onboard onto a new codebase. The README is
          too high-level. The code is too low-level. Nothing in the middle
          explains the <em className="text-bone">shape</em> of the system —
          where the work actually lives.
        </p>
        <p>
          Phantom is the middle. Paste a GitHub URL, get a 2–5 minute narrated
          video that walks through architecture, key files, and design
          decisions. The first product is{" "}
          <span className="accent-electric">RepoX</span>. More products are
          coming.
        </p>
        <p>
          The whole pipeline runs end-to-end without paid API keys — Claude,
          OpenAI, ElevenLabs, and Remotion all degrade gracefully to mocks so
          the system stays demoable on a fresh clone.
        </p>
        <p>
          Built by{" "}
          <a
            href="https://twitter.com/usephantom"
            className="text-bone underline decoration-electric/40 underline-offset-4 transition-colors duration-300 hover:text-electric"
          >
            Vineet Sista
          </a>{" "}
          in Columbus, Ohio.
        </p>
      </div>

      <div className="mt-16 flex flex-wrap items-center gap-3">
        <Link
          href="/generate"
          className="inline-flex h-12 items-center rounded-full bg-electric px-6 text-sm font-semibold text-ink transition-all duration-300 hover:brightness-110"
        >
          Generate your first video →
        </Link>
        <a
          href="https://github.com/vineetsista/Phantom"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center rounded-full border border-white/10 px-6 text-sm font-medium text-bone transition-colors duration-300 hover:border-electric/40 hover:text-electric"
        >
          Read the source
        </a>
      </div>
    </section>
  );
}
