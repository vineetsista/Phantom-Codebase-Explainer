import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SummaryPayload {
  video_id: string;
  repo_owner: string;
  repo_name: string;
  summary: {
    title: string;
    tldr?: string;
    clever_bit?: string | null;
    markdown?: string;
    sections?: Array<{ heading: string; body: string }>;
  };
}

async function fetchSummary(id: string): Promise<SummaryPayload | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/videos/${id}/summary`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SummaryPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await fetchSummary(params.id);
  if (!data) return { title: "Summary · Phantom" };
  return {
    title: `${data.summary.title} — written summary`,
    description: data.summary.tldr || "Companion written summary to the video walkthrough.",
    alternates: { canonical: `${APP_URL}/video/${params.id}/summary` },
    openGraph: {
      title: data.summary.title,
      description: data.summary.tldr || "",
      type: "article",
      url: `${APP_URL}/video/${params.id}/summary`,
      images: [`${APP_URL}/api/og?id=${params.id}`],
    },
  };
}

export default async function SummaryPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchSummary(params.id);
  if (!data) notFound();
  const { summary, repo_owner, repo_name } = data;

  return (
    <article className="mx-auto max-w-3xl px-6 pb-32 pt-20">
      <div className="kicker">
        Summary · {repo_owner}/{repo_name}
      </div>
      <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-bone sm:text-6xl">
        {summary.title}
      </h1>

      {summary.tldr && (
        <p className="mt-8 border-l-2 border-electric/60 pl-6 text-xl leading-relaxed text-bone">
          {summary.tldr}
        </p>
      )}

      {summary.clever_bit && (
        <div className="mt-12 rounded-2xl border border-electric/30 bg-graphite/40 p-6">
          <div className="kicker text-electric">The clever bit</div>
          <p className="mt-3 text-base leading-relaxed text-bone">
            {summary.clever_bit}
          </p>
        </div>
      )}

      <div className="prose-summary mt-12 space-y-10 text-lg leading-relaxed text-fog">
        {(summary.sections || []).map((s) => (
          <section key={s.heading}>
            <h2 className="font-display text-2xl font-semibold text-bone">
              {s.heading}
            </h2>
            <p className="mt-3">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-16 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8 text-sm">
        <Link
          href={`/video/${params.id}`}
          className="rounded-full bg-electric px-5 py-2.5 font-medium text-ink transition-colors hover:brightness-110"
        >
          Watch the video instead →
        </Link>
        <Link
          href={`/repo/${repo_owner}/${repo_name}`}
          className="rounded-full border border-white/10 px-5 py-2.5 text-bone transition-colors hover:border-electric/40"
        >
          All videos for this repo
        </Link>
      </div>
    </article>
  );
}
