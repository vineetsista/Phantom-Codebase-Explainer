import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import { COLORS, type ScriptSection } from "../types";

export const OutroScene: React.FC<{
  section: ScriptSection;
  takeaways: string[];
}> = ({ section, takeaways }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = takeaways.length ? takeaways : ((section.visuals?.data as { takeaways?: string[] })?.takeaways ?? []);

  const headerSpring = spring({ frame, fps, config: { damping: 18, stiffness: 130 } });

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 100,
          fontFamily: FONT_DISPLAY,
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
            const enterFrame = 18 + index * 12;
            const enterSpring = spring({
              frame: frame - enterFrame,
              fps,
              config: { damping: 20, stiffness: 120 },
            });
            const opacity = interpolate(enterSpring, [0, 1], [0, 1]);
            const slideX = interpolate(enterSpring, [0, 1], [-40, 0]);
            return (
              <div
                key={item}
                style={{
                  opacity,
                  transform: `translateX(${slideX}px)`,
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

        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_MONO,
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "rgba(245,245,240,0.55)",
            opacity: interpolate(frame, [50, 80], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          phantom.video · repox
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
