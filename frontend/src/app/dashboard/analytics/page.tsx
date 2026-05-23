"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Analytics {
  total_videos: number;
  total_views: number;
  by_status: Record<string, number>;
  top_videos: {
    id: string;
    repo_owner: string;
    repo_name: string;
    view_count: number;
  }[];
  views_by_day: { day: string; views: number }[];
  engagement: { favorites: number; reactions: number; comments: number };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/me/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setData)
      .catch(() => setError("Couldn't load analytics. Are you signed in?"));
  }, []);

  if (error)
    return (
      <section className="mx-auto max-w-3xl px-6 pb-32 pt-20">
        <p className="text-rose-300">{error}</p>
      </section>
    );
  if (!data) return null;

  const max = Math.max(1, ...data.views_by_day.map((d) => d.views));

  return (
    <section className="mx-auto max-w-4xl px-6 pb-32 pt-20">
      <header className="flex items-end justify-between">
        <div>
          <div className="kicker">Analytics</div>
          <h1 className="mt-3 font-display text-4xl font-bold text-bone">
            Your videos at a glance.
          </h1>
        </div>
        <Link href="/dashboard" className="text-sm text-fog hover:text-bone">
          ← Dashboard
        </Link>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Videos" value={data.total_videos} />
        <Stat label="Views" value={data.total_views} />
        <Stat label="Favorites" value={data.engagement.favorites} />
        <Stat label="Reactions" value={data.engagement.reactions} />
      </div>

      <section className="mt-14">
        <h2 className="font-display text-xl font-bold text-bone">
          Views, last 30 days
        </h2>
        {data.views_by_day.length === 0 ? (
          <p className="mt-3 text-mist">No view activity yet.</p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-1">
            {data.views_by_day.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: ${d.views}`}>
                <div
                  className="w-full rounded-t bg-electric/40 transition-colors hover:bg-electric"
                  style={{ height: `${(d.views / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-bold text-bone">
          Top videos by views
        </h2>
        {data.top_videos.length === 0 ? (
          <p className="mt-3 text-mist">No videos yet.</p>
        ) : (
          <ol className="mt-6 space-y-2">
            {data.top_videos.map((v, i) => (
              <li key={v.id}>
                <Link
                  href={`/v/${v.id}`}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-graphite/60 px-4 py-3 transition hover:border-electric/40"
                >
                  <div className="w-8 font-mono text-mist">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1 font-mono text-sm text-bone">
                    {v.repo_owner}/{v.repo_name}
                  </div>
                  <div className="font-mono text-xs text-mist">
                    {v.view_count} views
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-graphite/60 p-5">
      <div className="kicker text-fog">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold text-bone">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
