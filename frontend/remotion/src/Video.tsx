import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Series,
  staticFile,
} from "remotion";

import { ArchitectureScene } from "./compositions/ArchitectureScene";
import { CodeWalkthroughScene } from "./compositions/CodeWalkthroughScene";
import { IntroScene } from "./compositions/IntroScene";
import { OutroScene } from "./compositions/OutroScene";
import { COLORS, FPS, type CompositionProps, type ScriptSection } from "./types";

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

export const PhantomVideo: React.FC<CompositionProps> = ({ script, audio }) => {
  const audioBySection = new Map(audio.map((a) => [a.section_id, a]));

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Series>
        {script.sections.map((section) => {
          const audioTrack = audioBySection.get(section.id);
          const durationFrames = Math.max(
            FPS * 2,
            Math.round((section.duration_seconds || 10) * FPS),
          );
          return (
            <Series.Sequence key={section.id} durationInFrames={durationFrames}>
              <AbsoluteFill>
                {renderScene(section, script.key_takeaways ?? [])}
                {audioTrack?.audio_path && (
                  <Audio src={resolveAudio(audioTrack.audio_path)} />
                )}
              </AbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

function resolveAudio(path: string): string {
  // Remotion's render CLI accepts both file:// URIs and absolute paths.
  // When the path is already a file:// or http(s):// URL, return as-is;
  // otherwise wrap it as a file URL so the Chromium renderer can load it.
  if (path.startsWith("file://") || path.startsWith("http")) return path;
  return `file://${path.replace(/\\/g, "/")}`;
}

// Re-export Sequence/staticFile so consumers don't have to import them separately.
export { Sequence, staticFile };
