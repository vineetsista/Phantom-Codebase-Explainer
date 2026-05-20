import React from "react";
import { Composition } from "remotion";

import { PhantomVideo } from "./Video";
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
      narration: "These are the biggest source files.",
      duration_seconds: 18,
      visuals: {
        type: "code_highlight",
        data: {
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
  const totalSeconds = PREVIEW_SCRIPT.sections.reduce(
    (sum, section) => sum + (section.duration_seconds || 10),
    0,
  );

  return (
    <>
      <Composition
        id="PhantomVideo"
        component={PhantomVideo}
        durationInFrames={Math.max(FPS * 5, totalSeconds * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={PREVIEW_PROPS}
        calculateMetadata={({ props }) => {
          const seconds = (props.script?.sections ?? []).reduce(
            (sum, s) => sum + (s.duration_seconds || 10),
            0,
          );
          return { durationInFrames: Math.max(FPS * 5, Math.round(seconds * FPS)) };
        }}
      />
    </>
  );
};
