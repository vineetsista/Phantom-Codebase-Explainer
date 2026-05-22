import React from "react";
import { Composition } from "remotion";

import { PhantomVideo, totalFrames } from "./Video";
import { FPS, type CompositionProps, type VideoScript } from "./types";

// A preview-only fallback script so `remotion preview` works without props.
const PREVIEW_SCRIPT: VideoScript = {
  title: "Phantom Demo Repository",
  hook: "A sample explainer used when no props are supplied.",
  total_duration_seconds: 60,
  sections: [
    {
      id: "intro",
      narration: "Welcome to the Phantom demo.",
      duration_seconds: 8,
      visuals: {
        type: "intro_card",
        data: {
          title: "Phantom",
          subtitle: "Your codebase, explained in minutes.",
          stars: 1234,
          language: "TypeScript",
        },
      },
    },
    {
      id: "architecture",
      narration: "Here's how the system is laid out.",
      duration_seconds: 22,
      visuals: {
        type: "architecture_diagram",
        data: {
          hint: "monorepo",
          modules: [
            { name: "frontend", role: "Next.js client", description: "Landing, generation UX, and player" },
            { name: "backend", role: "FastAPI surface", description: "Routes and pipeline orchestration" },
            { name: "workers", role: "Celery workers", description: "Async repo analysis + rendering" },
            { name: "remotion", role: "Video scenes", description: "React-based programmatic video templates" },
          ],
        },
      },
    },
    {
      id: "code_walkthrough",
      narration: "Here's a window into the code.",
      duration_seconds: 18,
      visuals: {
        type: "code_highlight",
        data: {
          path: "backend/workers/tasks.py",
          language: "Python",
          code: [
            "from celery import shared_task",
            "from services import analyzer, script, voice, assembler",
            "",
            "@shared_task(bind=True, name=\"phantom.generate_video\")",
            "def generate_video(self, job_id, repo_url, options):",
            "    analysis = analyzer.analyze(repo_url)",
            "    script_data = script.generate(analysis)",
            "    audio = voice.generate(script_data, job_id)",
            "    output = assembler.assemble(job_id, script_data, audio)",
            "    return {\"video_url\": output[\"video_path\"]}",
          ].join("\n"),
          highlight_lines: [4, 6, 9],
          files: [
            { path: "backend/workers/tasks.py", language: "Python", bytes: 4200 },
            { path: "backend/services/repo_analyzer.py", language: "Python", bytes: 7800 },
            { path: "frontend/src/app/page.tsx", language: "TypeScript", bytes: 2200 },
          ],
        },
      },
    },
    {
      id: "summary",
      narration: "And that's the system in a minute.",
      duration_seconds: 12,
      visuals: {
        type: "key_takeaways",
        data: {
          takeaways: [
            "Monorepo with shared brand styling across web and video",
            "Async pipeline orchestrated by Celery",
            "Remotion compositions are pure React",
          ],
        },
      },
    },
  ],
  key_takeaways: [
    "Monorepo with shared brand styling across web and video",
    "Async pipeline orchestrated by Celery",
    "Remotion compositions are pure React",
  ],
};

const PREVIEW_PROPS: CompositionProps = {
  script: PREVIEW_SCRIPT,
  audio: [],
  diagramSvgPath: "",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PhantomVideo"
        component={PhantomVideo}
        durationInFrames={totalFrames(PREVIEW_SCRIPT)}
        fps={FPS}
        // v4 — dropped from 1920×1080 to 1280×720 (44% the pixel count)
        // to cut render time roughly in half. 720p still looks crisp
        // for a code-walkthrough video and is the default everywhere
        // it's actually consumed (embedded players, blog posts,
        // Twitter previews). 4K only matters for cinematic content,
        // which this isn't.
        width={1280}
        height={720}
        defaultProps={PREVIEW_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: totalFrames(props.script),
        })}
      />
    </>
  );
};
