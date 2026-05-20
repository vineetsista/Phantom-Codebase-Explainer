"use client";

import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { LiveFeed } from "@/components/generate/LiveFeed";
import { PipelineStages } from "@/components/generate/PipelineStages";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { startGeneration } from "@/lib/api";
import { isValidGitHubUrl } from "@/lib/utils";

export function GenerationLayout({
  initialJob,
  initialUrl,
}: {
  initialJob: string | null;
  initialUrl: string;
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(initialJob);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { status, error: statusError } = useGenerationStatus(jobId);

  // Auto-route to player on success.
  useEffect(() => {
    if (status?.status === "complete") {
      const timer = setTimeout(() => {
        router.push(`/video/${status.job_id}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status?.status, status?.job_id, router]);

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
      setJobId(job_id);
      router.replace(`/generate?job=${job_id}&url=${encodeURIComponent(url)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
    } finally {
      setLoading(false);
    }
  }

  if (!jobId) {
    return (
      <section className="mx-auto max-w-3xl px-6 pb-32 pt-24">
        <div className="kicker">RepoX</div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl md:text-7xl">
          Generate a codebase explainer.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-fog">
          Paste any public GitHub repository. The pipeline analyzes, narrates,
          and renders a video — usually in 2-5 minutes.
        </p>

        <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-3 sm:flex-row">
          <label className="group relative flex-1">
            <span className="sr-only">GitHub repository URL</span>
            <Github className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist transition-colors duration-300 group-focus-within:text-electric" />
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/..."
              autoFocus
              className="h-16 w-full rounded-full border border-white/[0.08] bg-graphite/60 pl-12 pr-6 font-body text-base text-bone placeholder:text-mist outline-none transition-all duration-300 ease-luxe focus:border-electric/60 focus:bg-graphite focus:glow-electric"
              disabled={loading}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-16 items-center justify-center gap-3 rounded-full bg-electric px-8 text-base font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110 hover:shadow-[0_0_40px_-4px_rgba(0,240,255,0.7)] disabled:opacity-50"
          >
            {loading ? "Starting" : "Generate"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1440px] px-6 pb-32 pt-12">
      <header className="mb-12 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="kicker">Generating</div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-bone md:text-4xl">
            {status?.repo_owner && status?.repo_name
              ? `${status.repo_owner}/${status.repo_name}`
              : "Building your explainer"}
          </h1>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-fog transition-colors duration-300 hover:border-electric/40 hover:text-electric"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="truncate max-w-[280px]">{url.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
      </header>

      {/* SPLIT — 40% left, 60% right on desktop */}
      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          <PipelineStages status={status} />
          <ProgressBar
            progress={status?.progress ?? 0}
            failed={status?.status === "failed"}
            complete={status?.status === "complete"}
          />
        </div>

        <div className="min-h-[480px]">
          <LiveFeed status={status} repoUrl={url} />
        </div>
      </div>

      {status?.status === "complete" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 flex justify-end"
        >
          <Link
            href={`/video/${status.job_id}`}
            className="group inline-flex h-14 items-center gap-3 rounded-full bg-electric px-8 text-base font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110 hover:shadow-[0_0_40px_-4px_rgba(0,240,255,0.7)]"
          >
            Watch your video
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      )}

      {statusError && (
        <p className="mt-6 text-sm text-error">{statusError}</p>
      )}
    </section>
  );
}

function ProgressBar({
  progress,
  failed,
  complete,
}: {
  progress: number;
  failed: boolean;
  complete: boolean;
}) {
  const eta = etaFromProgress(progress, complete);
  return (
    <div className="surface-1 rounded-2xl p-5">
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.32em] text-fog">
        <span>Progress</span>
        <span>{eta}</span>
      </div>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, progress)}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={
            failed
              ? "h-full bg-error"
              : "h-full bg-gradient-to-r from-electric via-electric to-plasma"
          }
        />
      </div>
      <div className="mt-3 font-display text-2xl tabular-nums text-bone">
        {Math.min(100, Math.round(progress))}%
      </div>
    </div>
  );
}

function etaFromProgress(progress: number, complete: boolean): string {
  if (complete) return "Done";
  if (progress < 5) return "Starting…";
  const remaining = Math.max(20, Math.round((100 - progress) * 2.4));
  if (remaining < 60) return `~${remaining}s remaining`;
  const mins = Math.round(remaining / 60);
  return `~${mins}m remaining`;
}
