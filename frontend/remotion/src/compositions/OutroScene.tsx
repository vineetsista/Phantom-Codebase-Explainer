import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { CameraMove } from "../components/CameraMove";
import { FocusGlow } from "../components/FocusGlow";
import { HaloRings } from "../components/HaloRings";
import { Particles } from "../components/Particles";
import { SETTLE } from "../components/motion";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import { COLORS, type ScriptSection } from "../types";

export const OutroScene: React.FC<{
  section: ScriptSection;
  takeaways: string[];
  whyItMatters?: string;
}> = ({ section, takeaways, whyItMatters }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = takeaways.length ? takeaways : ((section.visuals?.data as { takeaways?: string[] })?.takeaways ?? []);

  // Scene plan: three beats inside the same allocated frame budget.
  //   Beat 1: "Why this matters" frame                ~0   → 30%
  //   Beat 2: KEY TAKEAWAYS list                      ~30% → 88%
  //   Beat 3: sonar-ping brand finale                 ~88% → end
  const totalFrames = Math.round(
    ((section.audio_duration_seconds ?? section.duration_seconds ?? 12) + 1.0) * 30,
  );
  const beat1End = Math.round(totalFrames * 0.30);
  const beat2Start = beat1End - 12;       // 12-frame crossfade overlap
  const haloStart = Math.max(0, totalFrames - 60);

  const why = (whyItMatters || "").trim();
  // First beat fades out as the takeaways come in.
  const whyOpacity = interpolate(
    frame,
    [12, 30, beat1End - 12, beat1End],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Takeaways crossfade in at beat 2.
  const takeawaysOpacity = interpolate(
    frame,
    [beat2Start, beat2Start + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const headerSpring = spring({ frame: frame - beat2Start, fps, config: SETTLE });

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <Particles count={22} seed={items.length * 23 + 7} speed={0.6} />
      <FocusGlow x={50} y={50} radius={70} intensity={0.10} />
      <CameraMove pan="right" intensity={1}>
      {/* BEAT 1 — "Why this matters" frame. Single sentence, big and
          centred. Crossfades to beat 2. */}
      {why && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 120,
            opacity: whyOpacity,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 18,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COLORS.cyan,
            }}
          >
            Why this matters
          </div>
          <div
            style={{
              marginTop: 36,
              maxWidth: 1500,
              textAlign: "center",
              fontFamily: FONT_DISPLAY,
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.text,
              lineHeight: 1.15,
              letterSpacing: -0.5,
            }}
          >
            {why}
          </div>
        </AbsoluteFill>
      )}

      {/* BEAT 2 — Key takeaways list. Fades in as beat 1 fades out. */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 100,
          fontFamily: FONT_DISPLAY,
          opacity: takeawaysOpacity,
        }}
      >
        <div
          style={{
            opacity: headerSpring,
            transform: `translateY(${interpolate(headerSpring, [0, 1], [30, 0])}px)`,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.cyan,
            fontFamily: FONT_MONO,
          }}
        >
          Key takeaways
        </div>

        <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 32, maxWidth: 1500 }}>
          {items.slice(0, 5).map((item, index) => {
            // Stagger 250ms between cards (~8 frames at 30fps). Each card
            // arrives with a small rotateZ correction — starts tilted, settles
            // straight — for a "snapping into place" feel.
            const enterFrame = beat2Start + 18 + index * 8;
            const enterSpring = spring({
              frame: frame - enterFrame,
              fps,
              config: SETTLE,
            });
            const opacity = interpolate(enterSpring, [0, 1], [0, 1]);
            const slideX = interpolate(enterSpring, [0, 1], [-60, 0]);
            const rotateZ = interpolate(enterSpring, [0, 1], [-5, 0]);
            return (
              <div
                key={item}
                style={{
                  opacity,
                  transform: `translateX(${slideX}px) rotate(${rotateZ}deg)`,
                  transformOrigin: "left center",
                  display: "flex",
                  alignItems: "center",
                  gap: 28,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 48,
                    fontWeight: 800,
                    color: COLORS.cyan,
                    fontVariantNumeric: "tabular-nums",
                    width: 80,
                    textAlign: "right",
                  }}
                >
                  0{index + 1}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 40,
                    color: COLORS.text,
                    fontWeight: 600,
                    lineHeight: 1.25,
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}
        </div>

        {/* Closing beat: PHANTOM wordmark grows into place over the final
            ~2 seconds, surrounded by three expanding halo rings.  This is
            the last frame the viewer sees — it has to land. */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            letterSpacing: 14,
            textTransform: "uppercase",
            color: COLORS.text,
            fontSize: interpolate(
              spring({ frame: frame - haloStart, fps, config: SETTLE }),
              [0, 1],
              [44, 64],
            ),
            opacity: interpolate(frame, [haloStart, haloStart + 12], [0, 1], {
              extrapolateRight: "clamp",
            }),
            textShadow: `0 0 24px ${COLORS.cyan}44`,
          }}
        >
          PHANTOM
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_MONO,
            fontSize: 14,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "rgba(245,245,240,0.55)",
            opacity: interpolate(frame, [haloStart + 6, haloStart + 24], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          phantom.video
        </div>
      </AbsoluteFill>
      </CameraMove>
      <HaloRings startFrame={haloStart} durationFrames={50} maxRadius={520} />
    </AbsoluteFill>
  );
};
