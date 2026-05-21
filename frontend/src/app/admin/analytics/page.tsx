"use client";

import { useEffect, useMemo, useState } from "react";

import { listVideos, type VideoRecord } from "@/lib/api";
import { cn, formatDuration } from "@/lib/utils";

/**
 * Internal analytics dashboard at /admin/analytics.
 *
 * Auth: gates on a shared-secret password stored in NEXT_PUBLIC_ADMIN_PASSWORD
 * (env var; default "phantom-dev" in development). The password is compared
 * client-side — this is the operational equivalent of "internal use only,"
 * NOT a real authorization boundary. Before exposing this URL publicly,
 * either swap to a server-side auth check or gate the route at the edge.
 *
 * Data: reads /api/v1/videos and aggregates client-side. Refresh-on-mount
 * + manual refresh button. No caching beyond the browser's fetch cache.
 */

const SESSION_KEY = "phantom.admin.unlocked";
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "phantom-dev";

export default function AdminAnalyticsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUnlocked(window.sessionStorage.getItem(SESSION_KEY) === "1");
    setBootChecked(true);
  }, []);

  if (!bootChecked) return null;

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return <Dashboard onLock={() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }} />;
}

/* ------------------------------------------------------------------ */

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (value === EXPECTED_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setError("Nope.");
    }
  }

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-6">
      <form onSubmit={submit} className="surface-1 w-full rounded-3xl p-8">
        <div className="kicker">Admin</div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-bone">
          Locked.
        </h1>
        <p className="mt-2 text-sm text-fog">
          Internal dashboard. Password gated for operational sanity, not real auth.
        </p>
        <label className="mt-8 block">
          <span className="sr-only">Password</span>
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            placeholder="Password"
            className="h-12 w-full rounded-full border border-white/[0.08] bg-ink/60 px-5 font-mono text-sm text-bone placeholder:text-mist outline-none transition-all duration-300 focus:border-electric/60 focus:glow-electric"
          />
        </label>
        {error && (
          <p className="mt-3 text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-electric text-sm font-semibold text-ink transition-all duration-300 ease-luxe hover:brightness-110"
        >
          Unlock
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Dashboard({ onLock }: { onLock: () => void }) {
  const [videos, setVideos] = useState<VideoRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const data = await listVideos();
      setVideos(data.videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => (videos ? aggregate(videos) : null), [videos]);

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-24 pt-12">
      <header className="mb-12 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="kicker">Admin · Analytics</div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-bone md:text-5xl">
            What's happening.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-bone transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={onLock}
            className="inline-flex h-10 items-center rounded-full px-4 text-sm text-mist transition-colors duration-300 hover:text-fog"
          >
            Lock
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {!stats ? (
        <SkeletonGrid />
      ) : (
        <div className="space-y-10">
          {/* Top metric row */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Metric
              label="Generations · all-time"
              value={stats.total.toLocaleString()}
              hint={`${stats.byStatus.complete} complete · ${stats.byStatus.failed} failed`}
            />
            <Metric
              label="Complete rate"
              value={`${stats.completeRate.toFixed(1)}%`}
              hint="(complete / total)"
            />
            <Metric
              label="Failure rate"
              value={`${stats.failureRate.toFixed(1)}%`}
              tone={stats.failureRate > 5 ? "warn" : "default"}
              hint={`${stats.byStatus.failed} jobs`}
            />
            <Metric
              label="Avg duration"
              value={formatDuration(stats.avgDuration)}
              hint="of completed videos"
            />
          </div>

          {/* Status breakdown + funnel */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Status breakdown">
              <ul className="mt-6 space-y-3">
                {Object.entries(stats.byStatus).map(([key, count]) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <li key={key} className="grid grid-cols-[140px_1fr_60px] items-center gap-3">
                      <span className="font-mono text-xs uppercase tracking-[0.32em] text-mist">
                        {key}
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            key === "complete"
                              ? "bg-success"
                              : key === "failed"
                                ? "bg-error"
                                : "bg-electric",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="text-right font-mono text-xs tabular-nums text-bone">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Failure breakdown by stage">
              {Object.keys(stats.failureByStage).length === 0 ? (
                <p className="mt-6 text-sm text-mist">No failures recorded. Excellent.</p>
              ) : (
                <ul className="mt-6 space-y-3">
                  {Object.entries(stats.failureByStage).map(([stage, count]) => (
                    <li key={stage} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-bone">{stage}</span>
                      <span className="font-mono text-xs tabular-nums text-error">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Top repos + recent activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Top repos analyzed">
              {stats.topRepos.length === 0 ? (
                <p className="mt-6 text-sm text-mist">No data yet.</p>
              ) : (
                <ul className="mt-6 space-y-2 text-sm">
                  {stats.topRepos.map(({ repo, count }) => (
                    <li
                      key={repo}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-white/[0.03]"
                    >
                      <span className="truncate font-mono text-bone">{repo}</span>
                      <span className="ml-3 font-mono text-xs tabular-nums text-mist">
                        ×{count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Recent activity">
              <ul className="mt-6 divide-y divide-white/[0.04]">
                {stats.recent.map((video) => (
                  <li key={video.id} className="flex items-baseline justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm text-bone">
                        {video.repo_owner}/{video.repo_name}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-mist">
                        {relativeTime(video.created_at)}
                      </div>
                    </div>
                    <StatusPill status={video.status} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}

/* --- subcomponents -------------------------------------------------- */

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={cn(
        "surface-1 rounded-2xl p-6",
        tone === "warn" && "border-ember/30",
      )}
    >
      <div className="kicker text-fog">{label}</div>
      <div className="mt-3 font-display text-4xl font-bold tabular-nums text-bone">
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-mist">{hint}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-1 rounded-2xl p-6">
      <div className="kicker text-fog">{title}</div>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: VideoRecord["status"] }) {
  const tone =
    status === "complete"
      ? "bg-success/15 text-success border-success/30"
      : status === "failed"
        ? "bg-error/15 text-error border-error/30"
        : "bg-electric/10 text-electric border-electric/25";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.32em]",
        tone,
      )}
    >
      {status}
    </span>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border border-white/[0.04] bg-graphite/30"
        />
      ))}
    </div>
  );
}

/* --- aggregation ---------------------------------------------------- */

interface Stats {
  total: number;
  completeRate: number;
  failureRate: number;
  avgDuration: number;
  byStatus: Record<string, number>;
  failureByStage: Record<string, number>;
  topRepos: { repo: string; count: number }[];
  recent: VideoRecord[];
}

function aggregate(videos: VideoRecord[]): Stats {
  const total = videos.length;
  const byStatus: Record<string, number> = {
    queued: 0,
    analyzing: 0,
    scripting: 0,
    diagramming: 0,
    voiceover: 0,
    rendering: 0,
    complete: 0,
    failed: 0,
  };
  for (const v of videos) byStatus[v.status] = (byStatus[v.status] || 0) + 1;

  const completeCount = byStatus.complete;
  const failedCount = byStatus.failed;
  const completeRate = total > 0 ? (completeCount / total) * 100 : 0;
  const failureRate = total > 0 ? (failedCount / total) * 100 : 0;

  const completedVideos = videos.filter((v) => v.status === "complete" && v.duration_seconds > 0);
  const avgDuration =
    completedVideos.length > 0
      ? completedVideos.reduce((sum, v) => sum + v.duration_seconds, 0) / completedVideos.length
      : 0;

  // Failure breakdown — bucket by progress at time of failure
  const failureByStage: Record<string, number> = {};
  for (const v of videos) {
    if (v.status !== "failed") continue;
    const stage = stageFromProgress(v.progress);
    failureByStage[stage] = (failureByStage[stage] || 0) + 1;
  }

  // Top repos (group by owner/name)
  const repoCounts = new Map<string, number>();
  for (const v of videos) {
    const key = `${v.repo_owner}/${v.repo_name}`;
    if (key === "/") continue;
    repoCounts.set(key, (repoCounts.get(key) || 0) + 1);
  }
  const topRepos = Array.from(repoCounts.entries())
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recent = videos.slice(0, 15);

  return {
    total,
    completeRate,
    failureRate,
    avgDuration,
    byStatus,
    failureByStage,
    topRepos,
    recent,
  };
}

function stageFromProgress(progress: number): string {
  if (progress < 25) return "Analyzing";
  if (progress < 50) return "Scripting";
  if (progress < 65) return "Diagramming";
  if (progress < 80) return "Voiceover";
  if (progress < 100) return "Rendering";
  return "Finalizing";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffSec = (Date.now() - then) / 1000;
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
