import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { AnimatedCounter } from "../components/AnimatedCounter";
import { BackgroundGrid } from "../components/BackgroundGrid";
import { CameraMove } from "../components/CameraMove";
import { ChromaticGlitch } from "../components/ChromaticGlitch";
import { CodeRain } from "../components/CodeRain";
import { FocusGlow } from "../components/FocusGlow";
import { LogoMark } from "../components/LogoMark";
import { Particles } from "../components/Particles";
import { TypewriterText } from "../components/TypewriterText";
import { Watermark } from "../components/Watermark";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import { COLORS, type ScriptSection } from "../types";

export const IntroScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = section.visuals?.data as {
    title?: string;
    subtitle?: string;
    stars?: number;
    language?: string;
  };

  const logoStart = 0;
  const kickerStart = 18;
  const titleStart = 28;
  const subtitleStart = 46;
  const metaStart = 58;

  const titleSpring = spring({
    frame: frame - titleStart,
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const subtitleOpacity = interpolate(frame, [subtitleStart, subtitleStart + 16], [0, 1], {
    extrapolateRight: "clamp",
  });
  const metaOpacity = interpolate(frame, [metaStart, metaStart + 16], [0, 1], {
    extrapolateRight: "clamp",
  });
  const kickerOpacity = interpolate(frame, [kickerStart, kickerStart + 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* Far layer: grid + radial glow (already inside BackgroundGrid). */}
      <BackgroundGrid />
      {/* Mid layer: drifting particles. Atmosphere, not content. */}
      <Particles count={28} seed={Math.floor((data?.title ?? "x").length * 17)} />
      {/* Near layer: blurred code rain, slowest visual element. */}
      <CodeRain />
      {/* Focus glow draws the eye to where the title will land. */}
      <FocusGlow x={50} y={48} radius={55} intensity={0.10} />

      <CameraMove pan="right" intensity={0.85}>
        <AbsoluteFill style={center}>
          <LogoMark size={120} startFrame={logoStart} />

          <div
            style={{
              opacity: kickerOpacity,
              marginTop: 36,
              fontFamily: FONT_MONO,
              fontSize: 18,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COLORS.cyan,
            }}
          >
            {/* One brief chromatic glitch in the opening seconds — signals
                "this is a generated video" without belaboring the point.
                Triggers at frame ~24, ~6 frames after the kicker fades in. */}
            <ChromaticGlitch startFrame={kickerStart + 6} durationFrames={6} amplitude={5}>
              PHANTOM · REPOX
            </ChromaticGlitch>
          </div>

          <div
            style={{
              opacity: titleSpring,
              transform: `translateY(${titleY}px)`,
              marginTop: 32,
              fontFamily: FONT_DISPLAY,
              fontSize: 128,
              fontWeight: 800,
              letterSpacing: -2,
              color: COLORS.text,
              textAlign: "center",
              maxWidth: 1500,
              lineHeight: 1.05,
            }}
          >
            {/* Typewriter reveal — characters appear at ~32ms/char. The repo
                name is the headline, so this carries the weight of the opening
                moment. */}
            <TypewriterText
              text={data?.title ?? "Repository"}
              startFrame={titleStart}
              msPerChar={28}
              cursorColor={COLORS.cyan}
            />
          </div>

        <div
          style={{
            opacity: subtitleOpacity,
            marginTop: 24,
            maxWidth: 1200,
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontSize: 30,
            color: "rgba(245,245,240,0.7)",
            lineHeight: 1.3,
          }}
        >
          {data?.subtitle ?? section.narration}
        </div>

        <div
          style={{
            opacity: metaOpacity,
            marginTop: 36,
            display: "flex",
            gap: 16,
            fontFamily: FONT_BODY,
            fontSize: 22,
            color: COLORS.text,
          }}
        >
            {data?.language && <Pill label={data.language} accent={COLORS.cyan} />}
            {typeof data?.stars === "number" && data.stars > 0 && (
              <Pill
                accent={COLORS.violet}
                custom={
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span>★</span>
                    <AnimatedCounter
                      value={data.stars}
                      startFrame={metaStart}
                      durationFrames={36}
                      fontSize={22}
                    />
                  </span>
                }
              />
            )}
          </div>
        </AbsoluteFill>
      </CameraMove>
      <Watermark />
    </AbsoluteFill>
  );
};

const Pill: React.FC<{
  label?: string;
  accent: string;
  custom?: React.ReactNode;
}> = ({ label, accent, custom }) => (
  <div
    style={{
      padding: "12px 24px",
      borderRadius: 999,
      border: `1px solid ${accent}55`,
      background: `${accent}10`,
      color: accent,
      display: "inline-flex",
      alignItems: "center",
    }}
  >
    {custom ?? label}
  </div>
);

const center: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 80,
};
