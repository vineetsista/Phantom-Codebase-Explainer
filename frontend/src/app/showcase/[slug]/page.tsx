import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/shared/JsonLd";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { SHOWCASE_REPOS, findShowcase, type ShowcaseRepo } from "@/lib/showcase";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://phantom.video";

export function generateStaticParams() {
  return SHOWCASE_REPOS.map((repo) => ({ slug: repo.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const repo = findShowcase(params.slug);
  if (!repo) return { title: "Not found" };

  const [owner, name] = repo.repo.split("/");
  const ogImage = `${BASE_URL}/api/og?owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(name)}&language=${encodeURIComponent(repo.language)}&stars=${repo.stars}`;
  const description = `Watch a ${repo.durationLabel} AI-generated walkthrough of ${repo.repo}: architecture, key files, and design decisions. Generated automatically by Phantom — no human editing.`;

  return {
    title: `${repo.title} — AI-generated walkthrough`,
    description,
    alternates: { canonical: `${BASE_URL}/showcase/${repo.slug}` },
    openGraph: {
      title: repo.title,
      description,
      type: "video.other",
      url: `${BASE_URL}/showcase/${repo.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: repo.title }],
      videos: [
        {
          url: `${BASE_URL}/showcase/${repo.slug}.mp4`,
          width: 1920,
          height: 1080,
          type: "video/mp4",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: repo.title,
      description,
      images: [ogImage],
    },
  };
}

export default function ShowcaseDetail({ params }: { params: { slug: string } }) {
  const repo = findShowcase(params.slug);
  if (!repo) notFound();

  return (
    <>
      <JsonLd data={buildVideoObject(repo)} />
      <JsonLd data={buildBreadcrumbs(repo)} />

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
    </>
  );
}

/* --- structured data ----------------------------------------------- */

// Approximate upload-date stamp for the showcase library.
// Update when the showcase videos are re-rendered.
const SHOWCASE_UPLOAD_DATE = "2026-05-20";

function buildVideoObject(repo: ShowcaseRepo) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: repo.title,
    description: repo.description,
    thumbnailUrl: [`${BASE_URL}/showcase/${repo.slug}-poster.jpg`],
    uploadDate: SHOWCASE_UPLOAD_DATE,
    duration: durationLabelToISO(repo.durationLabel),
    contentUrl: `${BASE_URL}/showcase/${repo.slug}.mp4`,
    embedUrl: `${BASE_URL}/embed/${repo.slug}`,
    publisher: {
      "@type": "Organization",
      name: "Phantom",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon.svg`,
      },
    },
    inLanguage: "en",
    isFamilyFriendly: true,
    keywords: [
      "codebase explainer",
      "AI generated video",
      "open source",
      repo.language,
      repo.repo,
    ].join(", "),
  };
}

function buildBreadcrumbs(repo: ShowcaseRepo) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Showcase", item: `${BASE_URL}/showcase` },
      {
        "@type": "ListItem",
        position: 3,
        name: repo.repo,
        item: `${BASE_URL}/showcase/${repo.slug}`,
      },
    ],
  };
}

/** "3:14" → "PT3M14S" — ISO 8601 duration required for VideoObject. */
function durationLabelToISO(label: string): string {
  const [mins, secs] = label.split(":").map((n) => parseInt(n, 10));
  const m = isNaN(mins) ? 0 : mins;
  const s = isNaN(secs) ? 0 : secs;
  return `PT${m}M${s}S`;
}
