"use client";

import { motion } from "framer-motion";
import { Github } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { startGeneration } from "@/lib/api";
import { isValidGitHubUrl } from "@/lib/utils";

// Lazy-load Three.js so it doesn't block first paint or bloat the LCP bundle.
const HeroObject3D = dynamic(() => import("./hero/HeroObject3D"), {
  ssr: false,
  loading: () => <Hero3DFallback />,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const HEADLINE_LINE_ONE = ["Any", "codebase."];
const HEADLINE_LINE_TWO = ["Explained", "in", "minutes."];

export function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidGitHubUrl(url)) {
      setError("Paste a full GitHub repository URL.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { job_id } = await startGeneration(url);
      router.push(`/generate?job=${job_id}&url=${encodeURIComponent(url)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setLoading(false);
    }
  }

  return (
    <section className="relative isolate min-h-screen overflow-hidden px-6 pt-16">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 pt-12 md:grid-cols-[3fr_2fr] md:gap-16 md:pt-24">
        {/* LEFT — content (60%) */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="kicker mb-6 inline-flex items-center gap-3 text-electric"
          >
            <span className="live-dot" />
            RepoX · the first product from Phantom
          </motion.div>

          <h1 className="font-display text-[14vw] font-bold leading-[0.95] tracking-tighter text-bone sm:text-7xl md:text-8xl lg:text-9xl">
            <span className="block">
              {HEADLINE_LINE_ONE.map((word, index) => (
                <WordReveal key={word} index={index}>
                  {word}
                </WordReveal>
              ))}
            </span>
            <span className="block">
              {HEADLINE_LINE_TWO.map((word, index) => (
                <WordReveal
                  key={word}
                  index={index + HEADLINE_LINE_ONE.length}
                  accent={word === "minutes."}
                >
                  {word}
                </WordReveal>
              ))}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
            className="mt-8 max-w-[560px] text-lg text-fog md:text-xl"
          >
            Drop a GitHub URL. Get a cinematic video walkthrough of any codebase
            — architecture, key files, and design decisions, narrated by AI.
          </motion.p>

          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.05, ease: EASE }}
            className="mt-12 flex w-full max-w-[560px] flex-col gap-3 sm:flex-row"
          >
            <label className="group relative flex-1">
              <span className="sr-only">GitHub repository URL</span>
              <Github className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist transition-colors duration-300 group-focus-within:text-electric" />
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://github.com/..."
                className="h-16 w-full rounded-full border border-white/[0.08] bg-graphite/60 pl-12 pr-6 font-body text-base text-bone placeholder:text-mist outline-none transition-all duration-300 ease-luxe focus:border-electric/60 focus:bg-graphite focus:glow-electric"
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="group inline-flex h-16 items-center justify-center gap-3 rounded-full bg-electric px-8 text-base font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110 hover:shadow-[0_0_40px_-4px_rgba(0,240,255,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{loading ? "Starting" : "Generate explainer"}</span>
              <span
                aria-hidden
                className="inline-block transition-transform duration-300 ease-luxe group-hover:translate-x-1"
              >
                →
              </span>
            </button>
          </motion.form>

          {error ? (
            <p className="mt-4 text-sm text-error" role="alert">
              {error}
            </p>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.3, ease: EASE }}
              className="mt-4 text-sm text-mist"
            >
              Try it free — no signup required for your first video.
            </motion.p>
          )}
        </div>

        {/* RIGHT — 3D element (40%) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE }}
          className="relative aspect-square w-full max-w-[480px] justify-self-center md:justify-self-end"
        >
          <div className="absolute inset-0 rounded-full bg-electric/10 blur-[120px]" />
          <div className="absolute inset-0 rounded-full bg-plasma/15 blur-[100px] [animation-delay:1s]" />
          <div className="relative h-full w-full">
            <HeroObject3D />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function WordReveal({
  children,
  index,
  accent,
}: {
  children: string;
  index: number;
  accent?: boolean;
}) {
  return (
    <span className="mr-[0.22em] inline-block overflow-hidden align-bottom">
      <motion.span
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{
          duration: 0.85,
          delay: 0.1 + index * 0.08,
          ease: EASE,
        }}
        className={accent ? "inline-block accent-electric" : "inline-block"}
      >
        {children}
      </motion.span>
    </span>
  );
}

function Hero3DFallback() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="h-48 w-48 animate-pulse-glow rounded-full bg-gradient-to-br from-electric/40 to-plasma/40 blur-2xl" />
    </div>
  );
}
