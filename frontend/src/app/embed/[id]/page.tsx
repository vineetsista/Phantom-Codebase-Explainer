"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { VideoPlayer, type Chapter } from "@/components/video/VideoPlayer";
import { getVideo, type VideoRecord } from "@/lib/api";
import { track } from "@/lib/analytics";
import { sectionStartTimes } from "@/lib/utils";

/**
 * Bare iframe-friendly player. Loaded by:
 *   <iframe src="https://phantom.video/embed/{id}" width="640" height="360"
 *           frameborder="0" allowfullscreen></iframe>
 *
 * No navbar, no footer, no exit-intent popup (suppressed by path). Just the
 * player and a small "Powered by Phantom" badge that links back. Every
 * embed is a growth vector.
 */
export default function EmbedPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    getVideo(params.id)
      .then((data) => {
        setVideo(data.video);
        track("video_played", { id: params.id, surface: "embed" });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load video"));
  }, [params.id]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-void p-6">
        <div className="text-center">
          <p className="font-display text-lg text-bone">This explainer isn't available.</p>
          <a
            href="https://phantom.video"
            className="mt-4 inline-block text-sm text-electric transition-opacity hover:opacity-80"
          >
            Generate your own at phantom.video →
          </a>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="grid min-h-screen place-items-center bg-void p-6">
        <div className="aspect-video w-full max-w-4xl animate-pulse rounded-2xl border border-white/[0.04] bg-graphite/30" />
      </div>
    );
  }

  // Prefer backend-computed chapters (canonical timing source). Fall back to
  // client-side math for legacy rows.
  const chapters: Chapter[] = (video.script_data?.chapters?.length
    ? video.script_data.chapters.map((c) => ({
        id: c.id,
        start: c.start_seconds,
        label: c.title || humanizeSection(c.id),
      }))
    : sectionStartTimes(video.script_data?.sections ?? []).map(
        ({ id, startSeconds }) => ({
          id,
          start: startSeconds,
          label: humanizeSection(id),
        }),
      ));

  return (
    <div className="relative min-h-screen bg-void p-2 md:p-4">
      <VideoPlayer
        src={video.video_url}
        poster={video.thumbnail_url || undefined}
        chapters={chapters}
        className="mx-auto max-w-[1400px]"
      />

      {/* Powered-by badge — links to phantom.video on a new tab */}
      <a
        href={`https://phantom.video/video/${video.id}?utm_source=embed&utm_medium=iframe`}
        target="_blank"
        rel="noopener"
        aria-label="Watch on Phantom"
        className="group absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink/80 px-3 py-1.5 text-xs text-fog backdrop-blur-md transition-all duration-300 ease-luxe hover:border-electric/40 hover:text-electric"
      >
        <span
          aria-hidden
          className="grid h-4 w-4 place-items-center rounded-sm bg-gradient-to-br from-electric to-plasma font-display text-[8px] font-bold text-ink"
        >
          P
        </span>
        Powered by Phantom
        <span aria-hidden className="transition-transform duration-300 ease-luxe group-hover:translate-x-0.5">
          →
        </span>
      </a>
    </div>
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
