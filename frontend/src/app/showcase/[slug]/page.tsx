import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VideoPlayer } from "@/components/video/VideoPlayer";
import { SHOWCASE_REPOS, findShowcase } from "@/lib/showcase";

export function generateStaticParams() {
  return SHOWCASE_REPOS.map((repo) => ({ slug: repo.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const repo = findShowcase(params.slug);
  if (!repo) return { title: "Not found" };
  return {
    title: `${repo.title} — AI-generated walkthrough`,
    description: repo.description,
    openGraph: {
      title: repo.title,
      description: repo.description,
      images: [
        `/api/og?owner=${encodeURIComponent(repo.repo.split("/")[0])}&name=${encodeURIComponent(repo.repo.split("/")[1])}&language=${encodeURIComponent(repo.language)}&stars=${repo.stars}`,
      ],
    },
  };
}

export default function ShowcaseDetail({ params }: { params: { slug: string } }) {
  const repo = findShowcase(params.slug);
  if (!repo) notFound();

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-32 pt-12">
      <Link
        href="/showcase"
        className="kicker inline-flex items-center gap-2 text-fog transition-colors duration-300 hover:text-electric"
      >
        ← Back to showcase
      </Link>

      <header className="mt-8">
        <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tighter text-bone sm:text-6xl md:text-7xl">
          {repo.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-fog">{repo.description}</p>
      </header>

      <div className="mt-12">
        <VideoPlayer
          src={`/showcase/${repo.slug}.mp4`}
          poster={`/showcase/${repo.slug}-poster.jpg`}
        />
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="surface-1 rounded-2xl p-6">
          <div className="kicker">AI takeaways</div>
          <ul className="mt-6 space-y-3 text-sm text-fog">
            {repo.takeaways.map((takeaway) => (
              <li key={takeaway} className="flex gap-3 leading-snug">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-electric" />
                {takeaway}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface-1 rounded-2xl p-6">
          <div className="kicker">Project</div>
          <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-mist">Repo</dt>
            <dd className="text-bone">
              <a href={repo.url} className="hover:text-electric" target="_blank" rel="noreferrer">
                {repo.repo}
              </a>
            </dd>
            <dt className="text-mist">Language</dt>
            <dd className="text-bone">{repo.language}</dd>
            <dt className="text-mist">Stars</dt>
            <dd className="text-bone">{repo.stars.toLocaleString()}</dd>
            <dt className="text-mist">Length</dt>
            <dd className="text-bone">{repo.durationLabel}</dd>
          </dl>
          <Link
            href={`/generate?url=${encodeURIComponent(repo.url)}`}
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full bg-electric text-sm font-semibold text-ink transition-all duration-300 hover:brightness-110"
          >
            Generate fresh →
          </Link>
        </div>
      </div>
    </section>
  );
}
