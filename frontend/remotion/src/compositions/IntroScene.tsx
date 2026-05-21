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
import { formatRelative, formatYear } from "../components/formatDate";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import { COLORS, type ScriptSection } from "../types";

export const IntroScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = section.visuals?.data as {
    title?: string;
    subtitle?: string;
    stars?: number;
    forks?: number;
    language?: string;
    /** ISO-8601 timestamps from the GitHub API. */
    created_at?: string;
    pushed_at?: string;
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

          {/* Real GitHub metadata strip. Counters tick up from 0 to actual
              values over ~800ms with a 90ms stagger so the eye follows
              left-to-right. Four cells: stars · forks · first commit year
              · last update. Numbers come straight from the GitHub REST API
              via repo_analyzer; nothing made up. */}
          <div
            style={{
              opacity: metaOpacity,
              marginTop: 36,
              display: "flex",
              alignItems: "center",
              gap: 0,
              fontFamily: FONT_BODY,
              color: COLORS.text,
              border: `1px solid rgba(255,255,255,0.08)`,
              background: "rgba(17,17,24,0.55)",
              borderRadius: 999,
              padding: "12px 14px",
              backdropFilter: "blur(8px)",
            }}
          >
            <StatCell
              startFrame={metaStart}
              kicker={data?.language || "Code"}
              valueNode={
                typeof data?.stars === "number" && data.stars > 0 ? (
                  <>
                    <span style={{ color: COLORS.cyan, marginRight: 8 }}>★</span>
                    <AnimatedCounter
                      value={data.stars}
                      startFrame={metaStart + 2}
                      durationFrames={24}
                      fontSize={28}
                    />
                  </>
                ) : (
                  <span style={{ color: "rgba(245,245,240,0.5)" }}>—</span>
                )
              }
              label="stars"
            />
            <Divider />
            <StatCell
              startFrame={metaStart + 3}
              kicker="Forks"
              valueNode={
                <AnimatedCounter
                  value={data?.forks ?? 0}
                  startFrame={metaStart + 5}
                  durationFrames={24}
                  fontSize={28}
                />
              }
              label="forks"
            />
            <Divider />
            <StatCell
              startFrame={metaStart + 6}
              kicker="Since"
              valueNode={
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 28,
                    color: COLORS.text,
                  }}
                >
                  {formatYear(data?.created_at)}
                </span>
              }
              label="first commit"
            />
            <Divider />
            <StatCell
              startFrame={metaStart + 9}
              kicker="Updated"
              valueNode={
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 20,
                    color: COLORS.text,
                  }}
                >
                  {formatRelative(data?.pushed_at)}
                </span>
              }
              label="last push"
            />
          </div>
        </AbsoluteFill>
      </CameraMove>
      <Watermark />
    </AbsoluteFill>
  );
};

const StatCell: React.FC<{
  startFrame: number;
  kicker: string;
  valueNode: React.ReactNode;
  label: string;
}> = ({ startFrame, kicker, valueNode, label }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [startFrame, startFrame + 14], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        padding: "4px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 130,
      }}
    >
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "rgba(245,245,240,0.45)",
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        {valueNode}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(245,245,240,0.35)",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Divider: React.FC = () => (
  <div
    style={{
      width: 1,
      height: 56,
      background: "rgba(255,255,255,0.08)",
    }}
  />
);

const center: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 80,
};
