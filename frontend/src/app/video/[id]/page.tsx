"use client";

import { Download, ExternalLink, RefreshCw, Share2, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ShareModal } from "@/components/video/ShareModal";
import { VideoPlayer, type Chapter } from "@/components/video/VideoPlayer";
import { getVideo, type VideoRecord } from "@/lib/api";
import { formatDuration } from "@/lib/utils";

export default function VideoPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getVideo(params.id)
      .then((data) => setVideo(data.video))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load video"),
      );
  }, [params.id]);

  const chapters: Chapter[] = useMemo(() => {
    if (!video?.script_data?.sections) return [];
    let cursor = 0;
    return video.script_data.sections.map((section) => {
      const start = cursor;
      cursor += section.duration_seconds || 10;
      return { id: section.id, start, label: humanizeSection(section.id) };
    });
  }, [video]);

  if (error) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-32 text-center">
        <div className="kicker text-error">Error</div>
        <p className="mt-3 text-bone">{error}</p>
        <Link
          href="/generate"
          className="mt-8 inline-flex items-center gap-2 text-electric transition-opacity duration-300 hover:opacity-80"
        >
          ← Generate a new video
        </Link>
      </section>
    );
  }

  if (!video) {
    return (
      <section className="mx-auto max-w-[1280px] px-6 py-12">
        <div className="aspect-video w-full animate-pulse rounded-3xl border border-white/[0.04] bg-graphite/30" />
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-[1280px] px-6 pb-32 pt-12">
        <header className="mb-8">
          <div className="kicker">{video.repo_owner}/{video.repo_name}</div>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1] tracking-tighter text-bone sm:text-5xl md:text-6xl">
            {video.script_data?.title || `${video.repo_name} — Codebase Explainer`}
          </h1>
          {video.script_data?.hook && (
            <p className="mt-4 max-w-2xl text-lg text-fog">{video.script_data.hook}</p>
          )}
        </header>

        <VideoPlayer
          src={video.video_url}
          poster={video.thumbnail_url || undefined}
          chapters={chapters}
        />

        {/* Action bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-fog">
            <Badge>{video.video_quality}</Badge>
            {video.duration_seconds > 0 && <Badge>{formatDuration(video.duration_seconds)}</Badge>}
            <Badge>{video.voice_provider} voice</Badge>
            {video.repo_language && <Badge>{video.repo_language}</Badge>}
            {video.repo_stars > 0 && (
              <Badge>
                <Star className="-mt-0.5 inline h-3 w-3 fill-current" /> {video.repo_stars.toLocaleString()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ToolbarButton onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4" /> Share
            </ToolbarButton>
            {video.video_url && (
              <ToolbarButton as="a" href={video.video_url} download>
                <Download className="h-4 w-4" /> Download
              </ToolbarButton>
            )}
            <ToolbarButton as="a" href={video.repo_url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> Repo
            </ToolbarButton>
            <ToolbarButton as={Link} href={`/generate?url=${encodeURIComponent(video.repo_url)}`}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </ToolbarButton>
          </div>
        </div>

        {/* Below the fold */}
        <div className="mt-16 grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Chapters */}
          <div className="surface-1 rounded-2xl p-6">
            <div className="kicker">Chapters</div>
            <ol className="mt-6 divide-y divide-white/[0.04]">
              {chapters.map((chapter) => (
                <li
                  key={chapter.id}
                  className="flex items-baseline justify-between gap-3 py-3 transition-colors duration-300 hover:text-electric"
                >
                  <span className="font-display text-base text-bone">{chapter.label}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.32em] text-mist">
                    {formatDuration(chapter.start)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Insights */}
          <div className="surface-1 rounded-2xl p-6">
            <div className="kicker flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> Insights
            </div>
            <ul className="mt-6 space-y-3 text-sm text-fog">
              {(video.script_data?.key_takeaways ?? []).map((takeaway) => (
                <li key={takeaway} className="flex gap-3 leading-snug">
                  <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-electric" />
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} video={video} />
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-graphite/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.32em] text-fog">
      {children}
    </span>
  );
}

type ToolbarButtonProps =
  | (React.ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button"; children: React.ReactNode })
  | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { as: "a"; children: React.ReactNode })
  | (React.ComponentProps<typeof Link> & { as: typeof Link; children: React.ReactNode });

function ToolbarButton(props: ToolbarButtonProps) {
  const base =
    "inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-graphite/40 px-4 text-sm text-bone transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric";

  if ("as" in props && props.as === "a") {
    const { as: _, children, className, ...rest } = props;
    return (
      <a {...rest} className={`${base} ${className ?? ""}`}>
        {children}
      </a>
    );
  }
  if ("as" in props && props.as === Link) {
    const { as: As, children, className, ...rest } = props;
    return (
      <Link {...(rest as React.ComponentProps<typeof Link>)} className={`${base} ${className ?? ""}`}>
        {children}
      </Link>
    );
  }
  const { children, className, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  };
  return (
    <button type="button" {...rest} className={`${base} ${className ?? ""}`}>
      {children}
    </button>
  );
}

function humanizeSection(id: string): string {
  switch (id) {
    case "intro":
      return "Intro";
    case "architecture":
      return "Architecture";
    case "code_walkthrough":
      return "Code walkthrough";
    case "data_flow":
      return "Data flow";
    case "file_tree":
      return "File tree";
    case "summary":
      return "Summary";
    default:
      return id.replace(/_/g, " ");
  }
}
