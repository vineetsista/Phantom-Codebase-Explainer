"use client";

import { motion } from "framer-motion";

import {
  AnalyzeIcon,
  CheckIcon,
  CloneIcon,
  MapIcon,
  RenderIcon,
  ScriptIcon,
  VoiceIcon,
} from "@/components/generate/PipelineIcons";
import { JobStatus } from "@/lib/api";

type StageId = JobStatus["status"];

const STAGES: {
  id: StageId;
  label: string;
  icon: (p: { active: boolean }) => JSX.Element;
}[] = [
  { id: "queued", label: "Queued", icon: CloneIcon },
  { id: "analyzing", label: "Cloning + analyzing", icon: AnalyzeIcon },
  { id: "scripting", label: "Mapping the system", icon: MapIcon },
  { id: "diagramming", label: "Writing narration", icon: ScriptIcon },
  { id: "voiceover", label: "Generating voiceover", icon: VoiceIcon },
  { id: "rendering", label: "Rendering scenes", icon: RenderIcon },
  { id: "complete", label: "Finalizing", icon: CheckIcon },
];

function stageIndex(status: StageId): number {
  const i = STAGES.findIndex((s) => s.id === status);
  return i === -1 ? 0 : i;
}

export function PipelineStages({ status }: { status: JobStatus | null }) {
  const current = status ? stageIndex(status.status) : 0;
  const failed = status?.status === "failed";

  return (
    <ol className="space-y-3">
      {STAGES.map((stage, index) => {
        const isCompleted =
          index < current || status?.status === "complete";
        const isActive = index === current && !failed;
        const isPending =
          index > current && !failed && status?.status !== "complete";
        const Icon = stage.icon;

        return (
          <motion.li
            key={stage.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className={
              "relative flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-400 ease-luxe " +
              (isActive
                ? "border-electric/40 bg-electric/[0.05]"
                : isCompleted
                  ? "border-white/[0.06] bg-graphite/40"
                  : "border-white/[0.04] bg-transparent opacity-50")
            }
          >
            <div className="relative grid h-11 w-11 shrink-0 place-items-center">
              {isActive && (
                <span className="absolute inset-0 animate-ping rounded-full bg-electric/20" />
              )}
              <span
                className={
                  "relative grid h-11 w-11 place-items-center rounded-full " +
                  (isActive
                    ? "bg-electric/15"
                    : isCompleted
                      ? "bg-graphite"
                      : "bg-graphite/60")
                }
              >
                <Icon active={isActive || isCompleted} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={
                    "font-display text-base font-medium " +
                    (isActive ? "text-bone" : isCompleted ? "text-bone/85" : "text-fog")
                  }
                >
                  {stage.label}
                </span>
                {isActive && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] accent-electric">
                    Now
                  </span>
                )}
                {isCompleted && index !== current && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-mist">
                    Done
                  </span>
                )}
              </div>

              {isActive && typeof status?.details?.["stage"] === "string" && (
                <p className="mt-1 truncate text-sm text-fog">
                  {status.details["stage"] as string}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

export { stageIndex };
