"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { JobStatus } from "@/lib/api";

interface FeedLine {
  id: string;
  text: string;
  kind: "info" | "highlight" | "warn" | "success";
}

const STAGE_NARRATION: Record<JobStatus["status"], (status: JobStatus) => FeedLine[]> = {
  queued: () => [
    { id: "q1", text: "Job queued · waiting for worker", kind: "info" },
  ],
  analyzing: (status) => {
    const summary = (status.details as { summary?: Record<string, unknown> }).summary;
    const repoFull = `${status.repo_owner ?? "user"}/${status.repo_name ?? "repo"}`;
    return [
      { id: "a1", text: `Cloning https://github.com/${repoFull}`, kind: "info" },
      ...(summary
        ? [
            {
              id: "a2",
              text: `Found ${summary.file_count ?? "—"} files`,
              kind: "info" as const,
            },
            {
              id: "a3",
              text: `Primary language → ${summary.primary_language ?? "unknown"}`,
              kind: "info" as const,
            },
            {
              id: "a4",
              text: `Detected pattern → ${summary.architecture_hint ?? "—"}`,
              kind: "highlight" as const,
            },
            {
              id: "a5",
              text: `${summary.module_count ?? 0} top-level modules identified`,
              kind: "info" as const,
            },
          ]
        : []),
    ];
  },
  scripting: () => [
    { id: "s1", text: "Sending analysis to Claude (sonnet-4-5)", kind: "info" },
    { id: "s2", text: "Drafting narration · scene-by-scene", kind: "info" },
    { id: "s3", text: "Targeting 90-240s total runtime", kind: "info" },
  ],
  diagramming: () => [
    { id: "d1", text: "Composing architecture diagram", kind: "info" },
    { id: "d2", text: "Laying out modules + connection arcs", kind: "info" },
  ],
  voiceover: (status) => [
    {
      id: "v1",
      text: `Synthesizing voiceover · provider: ${
        (status.details as { voice_provider?: string }).voice_provider ?? "openai"
      }`,
      kind: "info",
    },
    { id: "v2", text: "Rendering per-section audio segments", kind: "info" },
  ],
  rendering: () => [
    { id: "r1", text: "Spinning up Remotion render", kind: "info" },
    { id: "r2", text: "Compositing scenes at 1920×1080 · 30fps", kind: "info" },
    { id: "r3", text: "Encoding to H.264 + AAC", kind: "info" },
  ],
  complete: () => [
    { id: "c1", text: "Render complete · MP4 written to disk", kind: "success" },
    { id: "c2", text: "Thumbnail extracted from key frame", kind: "success" },
  ],
  failed: (status) => [
    { id: "f1", text: status.error ?? "Generation failed", kind: "warn" },
  ],
};

const TICK_OPEN = "›";

export function LiveFeed({ status, repoUrl }: { status: JobStatus | null; repoUrl?: string }) {
  // Accumulate lines so the feed feels like a streaming terminal — not a
  // wipe-and-replace every poll.
  const seenRef = useRef<Set<string>>(new Set());
  const [lines, setLines] = useState<FeedLine[]>(() =>
    repoUrl ? [{ id: "boot", text: `phantom @ analyze --repo "${repoUrl}"`, kind: "highlight" }] : [],
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull the latest lines for the current stage and append anything new.
  useEffect(() => {
    if (!status) return;
    const next = STAGE_NARRATION[status.status]?.(status) ?? [];
    const fresh = next.filter((line) => !seenRef.current.has(line.id));
    if (fresh.length === 0) return;
    fresh.forEach((line) => seenRef.current.add(line.id));
    setLines((prev) => [...prev, ...fresh]);
  }, [status]);

  // Auto-scroll to the bottom as new lines arrive.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  const tail = useMemo(() => lines.slice(-40), [lines]);

  return (
    <div className="surface-1 relative flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 font-mono text-xs text-fog">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-ember/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 uppercase tracking-[0.32em]">phantom · live</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="uppercase tracking-[0.32em]">stream</span>
        </div>
      </header>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-5 py-5 font-mono text-[13px] leading-relaxed"
      >
        {tail.map((line, index) => {
          const isLast = index === tail.length - 1;
          return (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: index < tail.length - 6 ? 0.5 : 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={
                "flex gap-3 " +
                (line.kind === "highlight"
                  ? "text-electric"
                  : line.kind === "success"
                    ? "text-success"
                    : line.kind === "warn"
                      ? "text-error"
                      : "text-bone")
              }
            >
              <span className="select-none text-mist">{TICK_OPEN}</span>
              <span className={isLast ? "after:ml-0.5 after:inline-block after:h-[1em] after:w-[8px] after:translate-y-[2px] after:animate-pulse after:bg-electric after:align-middle after:content-['']" : undefined}>
                {line.text}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
