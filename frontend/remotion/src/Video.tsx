import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Series,
  staticFile,
} from "remotion";

import { MusicBed } from "./components/MusicBed";
import { SceneFrame } from "./components/SceneFrame";
import { ArchitectureScene } from "./compositions/ArchitectureScene";
import { CodeWalkthroughScene } from "./compositions/CodeWalkthroughScene";
import { IntroScene } from "./compositions/IntroScene";
import { OutroScene } from "./compositions/OutroScene";
import { loadFonts } from "./loadFonts";
import { COLORS, FPS, type CompositionProps, type ScriptSection } from "./types";

// Kick off font loading on module evaluation. delayRender() inside ensures the
// renderer waits for the first paint until the FontFaces resolve (or fail).
loadFonts();

function renderScene(section: ScriptSection, takeaways: string[]) {
  switch (section.id) {
    case "intro":
      return <IntroScene section={section} />;
    case "architecture":
      return <ArchitectureScene section={section} />;
    case "code_walkthrough":
      return <CodeWalkthroughScene section={section} />;
    case "summary":
      return <OutroScene section={section} takeaways={takeaways} />;
    default:
      return <IntroScene section={section} />;
  }
}

export const PhantomVideo: React.FC<CompositionProps> = ({
  script,
  audio,
  musicSrc,
}) => {
  const audioBySection = new Map(audio.map((a) => [a.section_id, a]));

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {musicSrc && <MusicBed src={musicSrc} />}
      <Series>
        {script.sections.map((section) => {
          const audioTrack = audioBySection.get(section.id);
          const durationFrames = Math.max(
            FPS * 2,
            Math.round((section.duration_seconds || 10) * FPS),
          );
          return (
            <Series.Sequence key={section.id} durationInFrames={durationFrames}>
              <SceneFrame durationInFrames={durationFrames}>
                {renderScene(section, script.key_takeaways ?? [])}
              </SceneFrame>
              {audioTrack?.audio_path && (
                <Audio src={resolveAudio(audioTrack.audio_path)} />
              )}
            </Series.Sequence>
          );
        })}
      </Series>
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

// Re-export Sequence/staticFile so consumers don't have to import them separately.
export { Sequence, staticFile };
