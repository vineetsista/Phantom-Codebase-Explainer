"use client";

import { Code2, Download, ExternalLink, RefreshCw, Share2, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/shared/Toaster";
import { EmbedModal } from "@/components/video/EmbedModal";
import { ShareModal } from "@/components/video/ShareModal";
import { VideoPlayer, type Chapter } from "@/components/video/VideoPlayer";
import { getVideo, startGeneration, type VideoRecord } from "@/lib/api";
import { formatDuration, sectionStartTimes } from "@/lib/utils";

export default function VideoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!params.id) return;
    getVideo(params.id)
      .then((data) => setVideo(data.video))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load video"),
      );
  }, [params.id]);

  const chapters: Chapter[] = useMemo(() => {
    if (!video?.script_data) return [];
    // Prefer the canonical chapter list written by the backend
    // (video_assembler.compute_chapters). That's the same math the
    // Remotion Sequences use — drift becomes impossible. Only fall back
    // to the client-side math for legacy DB rows generated before the
    // backend-side chapter writer landed.
    const fromBackend = video.script_data.chapters;
    if (fromBackend && fromBackend.length) {
      return fromBackend.map((c) => ({
        id: c.id,
        start: c.start_seconds,
        label: c.title || humanizeSection(c.id),
      }));
    }
    if (!video.script_data.sections) return [];
    return sectionStartTimes(video.script_data.sections).map(({ id, startSeconds }) => ({
      id,
      start: startSeconds,
      label: humanizeSection(id),
    }));
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
            <button type="button" onClick={() => setShareOpen(true)} className={TOOLBAR_BTN}>
              <Share2 className="h-4 w-4" /> Share
            </button>
            <button type="button" onClick={() => setEmbedOpen(true)} className={TOOLBAR_BTN}>
              <Code2 className="h-4 w-4" /> Embed
            </button>
            {video.video_url && (
              <a
                href={video.video_url}
                download={`${video.repo_owner}-${video.repo_name}.mp4`}
                className={TOOLBAR_BTN}
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
            <a
              href={video.repo_url}
              target="_blank"
              rel="noreferrer"
              className={TOOLBAR_BTN}
            >
              <ExternalLink className="h-4 w-4" /> Repo
            </a>
            <button
              type="button"
              disabled={regenLoading}
              onClick={async () => {
                setRegenLoading(true);
                try {
                  const { job_id } = await startGeneration(video.repo_url);
                  toast.success("New job queued", "Heading to the live pipeline…");
                  router.push(
                    `/generate?job=${job_id}&url=${encodeURIComponent(video.repo_url)}`,
                  );
                } catch (err) {
                  toast.error(
                    "Couldn't queue regeneration",
                    err instanceof Error ? err.message : undefined,
                  );
                  setRegenLoading(false);
                }
              }}
              className={TOOLBAR_BTN}
            >
              <RefreshCw
                className={`h-4 w-4 ${regenLoading ? "animate-spin" : ""}`}
              />{" "}
              {regenLoading ? "Queueing…" : "Regenerate"}
            </button>
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
      <EmbedModal open={embedOpen} onClose={() => setEmbedOpen(false)} video={video} />
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

// Shared className for the per-video action toolbar (Share / Download / Repo /
// Regenerate). A polymorphic <ToolbarButton as={...}> component was tried but
// React's HTMLAttributes<T> unions don't narrow cleanly under strict mode —
// raw button/anchor/Link at the call site is simpler and provably typesafe.
const TOOLBAR_BTN =
  "inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-graphite/40 px-4 text-sm text-bone transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric";

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
