import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";

import { MusicBed } from "./components/MusicBed";
import { SceneFrame } from "./components/SceneFrame";
import { ArchitectureScene } from "./compositions/ArchitectureScene";
import { CodeWalkthroughScene } from "./compositions/CodeWalkthroughScene";
import { IntroScene } from "./compositions/IntroScene";
import { OutroScene } from "./compositions/OutroScene";
import { loadFonts } from "./loadFonts";
import {
  COLORS,
  FPS,
  SCENE_TRAILING_BUFFER_S,
  SCENE_TRANSITION_S,
  type CompositionProps,
  type ScriptSection,
} from "./types";

// Kick off font loading on module evaluation. delayRender() inside ensures the
// renderer waits for the first paint until the FontFaces resolve (or fail).
loadFonts();

function renderScene(
  section: ScriptSection,
  takeaways: string[],
  whyItMatters?: string,
) {
  switch (section.id) {
    case "intro":
      return <IntroScene section={section} />;
    case "architecture":
      return <ArchitectureScene section={section} />;
    case "code_walkthrough":
      return <CodeWalkthroughScene section={section} />;
    case "summary":
      return (
        <OutroScene
          section={section}
          takeaways={takeaways}
          whyItMatters={whyItMatters}
        />
      );
    default:
      return <IntroScene section={section} />;
  }
}

/** Resolve a single scene's allocated frame count.
 * Uses the real audio duration when present (set by the worker after ffprobe),
 * with a 1.0 s trailing buffer for most scenes so the last word of narration
 * completes before the cut.
 *
 * The SUMMARY scene gets a tighter 0.5 s buffer because it's the last scene
 * — there's no crossfade into a following scene to absorb the trailing silence,
 * so a full 1 s buffer reads as dead time at the very end of the video. The
 * sonar-ping brand finale inside OutroScene already starts 1 s before the
 * audio ends, so 0.5 s of tail is enough.
 */
function sceneFrames(section: ScriptSection): number {
  const trailingBuffer = section.id === "summary" ? 0.5 : SCENE_TRAILING_BUFFER_S;
  const seconds = (section.audio_duration_seconds ?? section.duration_seconds ?? 10)
    + trailingBuffer;
  return Math.max(FPS * 2, Math.round(seconds * FPS));
}

export const PhantomVideo: React.FC<CompositionProps> = ({
  script,
  audio,
  musicSrc,
}) => {
  const audioBySection = new Map(audio.map((a) => [a.section_id, a]));
  const transitionFrames = Math.round(SCENE_TRANSITION_S * FPS);

  // Compute each scene's absolute `from` so consecutive scenes overlap by
  // `transitionFrames`. The existing SceneFrame fade-in/out at the start +
  // end of its allocated window then becomes a true visual crossfade — no
  // black flash at the boundary. Audio doesn't overlap meaningfully because
  // each scene's real narration ends 0.6 s before its allocated window does.
  let cursor = 0;
  const placements = script.sections.map((section) => {
    const frames = sceneFrames(section);
    const from = cursor;
    cursor += frames - transitionFrames;
    return { section, from, frames };
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {musicSrc && <MusicBed src={musicSrc} />}
      {placements.map(({ section, from, frames }) => {
        const audioTrack = audioBySection.get(section.id);
        return (
          <Sequence
            key={section.id}
            from={from}
            durationInFrames={frames}
            name={`scene-${section.id}`}
          >
            <SceneFrame
              durationInFrames={frames}
              transitionFrames={transitionFrames}
            >
              {renderScene(
                section,
                script.key_takeaways ?? [],
                script.why_it_matters,
              )}
            </SceneFrame>
            {audioTrack?.audio_path && (
              <Audio src={resolveAudio(audioTrack.audio_path)} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

function resolveAudio(path: string): string {
  // Remotion's renderer explicitly rejects file:// URIs (see
  // @remotion/renderer/dist/assets/download-file.js). The backend now
  // copies per-job audio into publicDir and emits a relative path like
  // "jobs/<id>/audio/intro.mp3"; resolve those through staticFile() so
  // Chromium fetches them over HTTP from Remotion's dev server.
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("file://")) return path;
  // Strip any leading slashes; staticFile expects publicDir-relative.
  const cleaned = path.replace(/^\/+/, "");
  return staticFile(cleaned);
}

/** Total video length in frames, matching the placement math above so
 *  Root.tsx's calculateMetadata and the worker's duration log line agree. */
export function totalFrames(script: CompositionProps["script"]): number {
  const transitionFrames = Math.round(SCENE_TRANSITION_S * FPS);
  if (!script.sections.length) return FPS * 5;
  let cursor = 0;
  let lastFrames = 0;
  for (const section of script.sections) {
    lastFrames = sceneFrames(section);
    cursor += lastFrames - transitionFrames;
  }
  // The cumulative cursor stopped subtracting after the last scene because
  // there's no scene after it. Add the last scene's full length back.
  return Math.max(FPS * 5, cursor + transitionFrames);
}

// Re-export Sequence/staticFile so consumers don't have to import them separately.
export { Sequence, staticFile };
