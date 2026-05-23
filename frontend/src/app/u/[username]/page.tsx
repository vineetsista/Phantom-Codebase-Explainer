import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface ProfileResponse {
  profile: {
    id: string;
    slug: string;
    github_username: string;
    name: string;
    avatar_url: string;
    bio: string;
    created_at: string | null;
  };
  stats: { video_count: number; total_views: number };
  videos: Array<{
    id: string;
    repo_owner: string;
    repo_name: string;
    repo_language: string;
    thumbnail_url: string;
    duration_seconds: number;
    view_count: number;
    created_at: string;
  }>;
}

async function fetchProfile(username: string): Promise<ProfileResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/users/${username}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const data = await fetchProfile(params.username);
  if (!data) return { title: "Profile · Phantom" };
  const { profile, stats } = data;
  const display = profile.name || profile.github_username;
  return {
    title: `${display} · Phantom`,
    description:
      profile.bio ||
      `${stats.video_count} codebase video${stats.video_count === 1 ? "" : "s"} on Phantom`,
    alternates: { canonical: `${APP_URL}/u/${profile.slug}` },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const data = await fetchProfile(params.username);
  if (!data) notFound();
  const { profile, stats, videos } = data;
  const display = profile.name || profile.github_username;
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <section className="mx-auto max-w-6xl px-6 pb-32 pt-20">
      {/* Header */}
      <header className="flex items-start gap-6">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={display}
            className="h-24 w-24 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-full bg-graphite text-3xl font-bold text-bone">
            {display[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <div className="kicker">@{profile.slug}</div>
          <h1 className="mt-2 font-display text-4xl font-bold text-bone">
            {display}
          </h1>
          {profile.bio && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-fog">
              {profile.bio}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-mist">
            <span>
              <span className="text-bone">{stats.video_count}</span> public
              video{stats.video_count === 1 ? "" : "s"}
            </span>
            <span>
              <span className="text-bone">{stats.total_views.toLocaleString()}</span>{" "}
              total view{stats.total_views === 1 ? "" : "s"}
            </span>
            {memberSince && <span>Member since {memberSince}</span>}
          </div>
        </div>
      </header>

      {/* Video grid */}
      <div className="mt-16">
        {videos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-graphite/40 p-12 text-center">
            <p className="text-fog">No public videos yet.</p>
            <Link
              href="/generate"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-electric px-5 text-sm font-medium text-ink transition-all duration-300 hover:brightness-110"
            >
              Generate yours →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <Link
                key={v.id}
                href={`/video/${v.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-graphite/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-electric/40 hover:shadow-[0_0_32px_-12px_rgba(0,240,255,0.5)]"
              >
                <div className="aspect-video w-full overflow-hidden bg-ink">
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_URL}${v.thumbnail_url}`}
                      alt={`${v.repo_owner}/${v.repo_name}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-fog">No thumbnail</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="font-mono text-xs uppercase tracking-wider text-mist">
                    {v.repo_language || "Code"}
                  </div>
                  <div className="font-display text-lg font-semibold text-bone">
                    {v.repo_owner}/{v.repo_name}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-mist">
                    <span>{v.view_count.toLocaleString()} views</span>
                    <span>{formatDuration(v.duration_seconds)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDuration(s: number): string {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
