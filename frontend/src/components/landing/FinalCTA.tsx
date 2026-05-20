"use client";

import { motion } from "framer-motion";
import { Github } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { startGeneration } from "@/lib/api";
import { isValidGitHubUrl } from "@/lib/utils";

export function FinalCTA() {
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
    <section className="relative mx-auto max-w-[1280px] px-6 py-48 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/10 blur-[140px]" />
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-plasma/8 blur-[160px]" />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30%" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[18ch] text-balance font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-7xl md:text-8xl"
      >
        Stop reading code.
        <br />
        <span className="accent-electric">Start watching it.</span>
      </motion.h2>

      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30%" }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-16 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
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
          className="inline-flex h-16 items-center justify-center gap-3 rounded-full bg-electric px-8 text-base font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110 hover:shadow-[0_0_40px_-4px_rgba(0,240,255,0.7)] disabled:opacity-50"
        >
          {loading ? "Starting" : "Generate"} →
        </button>
      </motion.form>

      {error ? (
        <p className="mt-4 text-sm text-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-4 text-sm text-mist">First video free. No credit card.</p>
      )}
    </section>
  );
}
