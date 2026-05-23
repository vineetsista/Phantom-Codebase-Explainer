import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface VideoRow {
  id: string;
  repo_owner: string;
  repo_name: string;
  repo_language: string;
  repo_stars: number;
  repo_description: string;
  thumbnail_url: string;
  duration_seconds: number;
  view_count: number;
  created_at: string;
  summary_data?: { tldr?: string; clever_bit?: string | null } | null;
  status: string;
}

async function fetchRepoVideos(owner: string, repo: string): Promise<VideoRow[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/repo/${owner}/${repo}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.videos as VideoRow[];
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { owner: string; repo: string };
}): Promise<Metadata> {
  const videos = await fetchRepoVideos(params.owner, params.repo);
  const first = videos?.[0];
  const title = `${params.owner}/${params.repo} — video walkthroughs`;
  const description =
    first?.summary_data?.tldr ||
    first?.repo_description ||
    `AI-generated video explainers for ${params.owner}/${params.repo}`;
  const ogImage = first?.id
    ? `${APP_URL}/api/og?id=${first.id}`
    : `${APP_URL}/api/og?owner=${params.owner}&name=${params.repo}`;

  return {
    title: `${title} · Phantom`,
    description,
    alternates: {
      canonical: `${APP_URL}/repo/${params.owner}/${params.repo}`,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${APP_URL}/repo/${params.owner}/${params.repo}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function RepoPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  const videos = await fetchRepoVideos(params.owner, params.repo);
  if (videos === null) notFound();
  const completed = videos.filter((v) => v.status === "complete");
  const latest = completed[0];
  const repoMeta = latest || videos[0];

  return (
    <section className="mx-auto max-w-6xl px-6 pb-32 pt-20">
      {/* Header */}
      <header>
        <div className="kicker">Repo · {repoMeta?.repo_language || "Code"}</div>
        <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight text-bone sm:text-6xl">
          {params.owner}/{params.repo}
        </h1>
        {repoMeta?.repo_description && (
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fog">
            {repoMeta.repo_description}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mist">
          {(repoMeta?.repo_stars || 0) > 0 && (
            <span>
              ★ <span className="text-bone">{repoMeta.repo_stars.toLocaleString()}</span> stars
            </span>
          )}
          <span>
            <span className="text-bone">{completed.length}</span> video
            {completed.length === 1 ? "" : "s"} generated
          </span>
          <Link
            href={`https://github.com/${params.owner}/${params.repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-bone underline-offset-4 hover:text-electric hover:underline"
          >
            View on GitHub ↗
          </Link>
        </div>

        <div className="mt-8">
          <Link
            href={`/generate?url=https://github.com/${params.owner}/${params.repo}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-electric px-6 text-sm font-medium text-ink transition-all duration-300 hover:brightness-110 hover:shadow-[0_0_28px_-4px_rgba(0,240,255,0.7)]"
          >
            Generate a fresh video →
          </Link>
        </div>
      </header>

      {/* Most recent summary (if any) */}
      {latest?.summary_data?.tldr && (
        <div className="mt-12 rounded-2xl border border-electric/20 bg-graphite/40 p-6 backdrop-blur">
          <div className="kicker text-electric">Most recent summary</div>
          <p className="mt-3 text-base leading-relaxed text-bone">
            {latest.summary_data.tldr}
          </p>
          {latest.summary_data.clever_bit && (
            <p className="mt-3 text-sm leading-relaxed text-fog">
              <span className="text-electric">The clever bit:</span>{" "}
              {latest.summary_data.clever_bit}
            </p>
          )}
          <Link
            href={`/video/${latest.id}/summary`}
            className="mt-5 inline-block text-sm text-electric hover:underline"
          >
            Read the full written summary →
          </Link>
        </div>
      )}

      {/* Videos grid */}
      <div className="mt-16">
        <div className="kicker mb-6">All generated videos</div>
        {completed.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-graphite/40 p-12 text-center">
            <p className="text-fog">No videos generated for this repo yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((v) => (
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
                  <div className="mt-auto flex items-center justify-between text-xs text-mist">
                    <span>{new Date(v.created_at).toLocaleDateString()}</span>
                    <span>{v.view_count.toLocaleString()} views</span>
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
