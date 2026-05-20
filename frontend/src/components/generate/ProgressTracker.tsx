"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Film,
  FileSearch,
  GitBranch,
  LoaderCircle,
  Mic,
  PenLine,
  Workflow,
} from "lucide-react";

import { JobStatus } from "@/lib/api";

const STAGES: { id: JobStatus["status"]; label: string; icon: typeof FileSearch }[] = [
  { id: "queued", label: "Queued", icon: LoaderCircle },
  { id: "analyzing", label: "Analyzing repository", icon: FileSearch },
  { id: "scripting", label: "Writing narration", icon: PenLine },
  { id: "diagramming", label: "Drawing architecture", icon: Workflow },
  { id: "voiceover", label: "Generating voiceover", icon: Mic },
  { id: "rendering", label: "Rendering video", icon: Film },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

function stageIndex(status: JobStatus["status"]): number {
  const i = STAGES.findIndex((s) => s.id === status);
  return i === -1 ? 0 : i;
}

export function ProgressTracker({ status }: { status: JobStatus | null }) {
  const current = status ? stageIndex(status.status) : 0;
  const failed = status?.status === "failed";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold text-ink-50">
          {status?.status === "complete"
            ? "Your video is ready"
            : failed
              ? "Something went wrong"
              : "Generating your explainer"}
        </h2>
        <span className="text-sm tabular-nums text-ink-50/50">
          {Math.min(100, status?.progress ?? 0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, status?.progress ?? 0)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={
            failed
              ? "h-full bg-rose-400"
              : "h-full bg-gradient-to-r from-cyan-glow to-violet-glow"
          }
        />
      </div>

      <div className="mt-8 grid gap-3">
        {STAGES.filter((stage) => stage.id !== "queued").map((stage, index) => {
          const adjustedIndex = index + 1; // queued is index 0
          const isCompleted = adjustedIndex < current || status?.status === "complete";
          const isActive = adjustedIndex === current && !failed;
          const isPending = adjustedIndex > current && !failed && status?.status !== "complete";
          const Icon = stage.icon;

          return (
            <div
              key={stage.id}
              className={
                "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors " +
                (isActive
                  ? "border-cyan-glow/40 bg-cyan-glow/5"
                  : isCompleted
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-transparent opacity-60")
              }
            >
              <span
                className={
                  "grid h-8 w-8 place-items-center rounded-full " +
                  (isActive
                    ? "bg-cyan-glow/15 text-cyan-glow"
                    : isCompleted
                      ? "bg-white/5 text-ink-50/70"
                      : "bg-white/5 text-ink-50/30")
                }
              >
                {isActive ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span
                className={
                  "text-sm " +
                  (isActive
                    ? "text-ink-50"
                    : isCompleted
                      ? "text-ink-50/80"
                      : "text-ink-50/40")
                }
              >
                {stage.label}
              </span>
              {isActive && status?.details && typeof status.details["stage"] === "string" && (
                <span className="ml-auto text-xs text-ink-50/40">
                  {status.details["stage"] as string}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {failed && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Generation failed</p>
            <p className="mt-0.5 text-rose-200/80">
              {status?.error || "An unknown error occurred."}
            </p>
          </div>
        </div>
      )}

      {status?.status === "analyzing" && status?.details && (
        <AnalysisPreview details={status.details} />
      )}
    </div>
  );
}

function AnalysisPreview({ details }: { details: Record<string, unknown> }) {
  const summary = details["summary"] as
    | { file_count?: number; primary_language?: string; module_count?: number; architecture_hint?: string }
    | undefined;
  if (!summary) return null;
  return (
    <div className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm sm:grid-cols-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-50/40">Files</p>
        <p className="mt-1 font-display text-xl text-ink-50">{summary.file_count ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-50/40">Primary</p>
        <p className="mt-1 font-display text-xl text-ink-50">{summary.primary_language ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-50/40">Modules</p>
        <p className="mt-1 font-display text-xl text-ink-50">{summary.module_count ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-ink-50/40">Pattern</p>
        <p className="mt-1 font-display text-xl capitalize text-ink-50">
          {summary.architecture_hint ?? "—"}
        </p>
      </div>
    </div>
  );
}

export { stageIndex };
