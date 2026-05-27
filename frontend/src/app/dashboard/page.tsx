import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const metadata: Metadata = {
  title: "Dashboard · Phantom",
  description: "Your Phantom videos, usage, and account settings.",
  robots: { index: false, follow: false },
};

interface MeData {
  id: string;
  github_username: string;
  name: string;
  avatar_url: string;
  bio?: string;
  custom_slug?: string;
}
interface VideoRow {
  id: string;
  repo_owner: string;
  repo_name: string;
  thumbnail_url: string;
  status: string;
  visibility: string;
  view_count: number;
  duration_seconds: number;
  created_at: string;
}

const POPULAR_REPOS = [
  { url: "https://github.com/sindresorhus/is-online", label: "is-online" },
  { url: "https://github.com/sindresorhus/ky", label: "ky" },
  { url: "https://github.com/colinhacks/zod", label: "zod" },
  { url: "https://github.com/expressjs/express", label: "express" },
  { url: "https://github.com/tiangolo/fastapi", label: "fastapi" },
  { url: "https://github.com/vercel/next.js", label: "next.js" },
  { url: "https://github.com/facebook/react", label: "react" },
  { url: "https://github.com/vuejs/core", label: "vue" },
];

async function fetchMe(backendId: string): Promise<MeData | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/me`, {
      headers: { "X-User-Id": backendId },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMyVideos(backendId: string): Promise<VideoRow[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/videos?mine=true&limit=12`,
      { headers: { "X-User-Id": backendId }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos as VideoRow[];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const backendId = (session as { backendId?: string } | null)?.backendId;
  if (!backendId) redirect("/login?next=/dashboard");

  const [me, videos] = await Promise.all([
    fetchMe(backendId),
    fetchMyVideos(backendId),
  ]);
  if (!me) redirect("/login?next=/dashboard");

  return (
    <section className="mx-auto max-w-6xl px-6 pb-32 pt-20">
      {/* Header */}
      <header className="flex items-center gap-5">
        {me.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatar_url}
            alt=""
            className="h-16 w-16 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-full bg-graphite text-2xl text-bone">
            {(me.name || me.github_username)[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <div className="kicker">Welcome back</div>
          <h1 className="mt-1 font-display text-3xl font-bold text-bone">
            {me.name || me.github_username}
          </h1>
        </div>
      </header>

      {/* Quick generate row */}
      <div className="mt-12 grid gap-6">
        <div className="rounded-2xl border border-white/10 bg-graphite/40 p-6 backdrop-blur">
          <div className="kicker">Generate</div>
          <h2 className="mt-2 font-display text-xl font-semibold text-bone">
            Paste a GitHub URL
          </h2>
          <Link
            href="/generate"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-electric px-5 text-sm font-medium text-ink transition-all duration-300 hover:brightness-110"
          >
            Open generator →
          </Link>
          <p className="mt-4 text-xs text-mist">
            Or pick a popular repo:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {POPULAR_REPOS.slice(0, 4).map((r) => (
              <Link
                key={r.url}
                href={`/generate?url=${encodeURIComponent(r.url)}`}
                className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-fog transition-colors hover:border-electric/40 hover:text-electric"
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent videos */}
      <div className="mt-16">
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">Recent</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-bone">
              Your videos
            </h2>
          </div>
          <Link
            href="/dashboard/history"
            className="text-sm text-electric hover:underline"
          >
            See all →
          </Link>
        </div>

        {videos.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-graphite/40 p-12 text-center">
            <p className="text-fog">
              Pick a repo, any repo. Even better — pick your own.
            </p>
            <Link
              href="/generate"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-electric px-5 text-sm font-medium text-ink transition-all duration-300 hover:brightness-110"
            >
              Generate your first video →
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Link
                key={v.id}
                href={`/video/${v.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-graphite/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-electric/40 hover:shadow-[0_0_32px_-12px_rgba(0,240,255,0.5)]"
              >
                <div className="aspect-video w-full overflow-hidden bg-ink">
                  {v.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}${v.thumbnail_url}`}
                      alt={`${v.repo_owner}/${v.repo_name}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[11px] uppercase tracking-wider text-mist">
                      {v.visibility}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-mist">
                      {v.status}
                    </div>
                  </div>
                  <div className="font-display text-base font-semibold text-bone">
                    {v.repo_owner}/{v.repo_name}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-mist">
                    <span>{new Date(v.created_at).toLocaleDateString()}</span>
                    <span>{v.view_count.toLocaleString()} views</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links footer row */}
      <div className="mt-16 flex flex-wrap gap-3 border-t border-white/10 pt-8 text-sm">
        <Link
          href={`/u/${me.custom_slug || me.github_username}`}
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          View public profile →
        </Link>
        <Link
          href="/dashboard/history"
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          History
        </Link>
        <Link
          href="/dashboard/api-keys"
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          API keys
        </Link>
        <Link
          href="/dashboard/analytics"
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          Analytics
        </Link>
        <Link
          href="/dashboard/favorites"
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          Favorites
        </Link>
        <Link
          href="/dashboard/settings"
          className="rounded-full border border-white/10 px-4 py-2 text-bone transition-colors hover:border-electric/40 hover:text-electric"
        >
          Settings
        </Link>
      </div>
    </section>
  );
}
