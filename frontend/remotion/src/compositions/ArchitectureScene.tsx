import React, { useMemo } from "react";
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
import { Particles } from "../components/Particles";
import { ScanLineReveal } from "../components/ScanLineReveal";
import { Watermark } from "../components/Watermark";
import { FONT_BODY, FONT_DISPLAY } from "../loadFonts";
import { SETTLE, pulse } from "../components/motion";
import { COLORS, type ScriptModule, type ScriptSection } from "../types";

const BOX_COLORS = [
  "#00F0FF",
  "#7B61FF",
  "#34D399",
  "#F59E0B",
  "#F472B6",
  "#60A5FA",
];

export const ArchitectureScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const data = section.visuals?.data as {
    modules?: ScriptModule[];
    hint?: string;
  };
  const modules = (data?.modules ?? []).slice(0, 8);
  const cols = Math.min(4, Math.max(2, modules.length));
  const rows = Math.max(1, Math.ceil(modules.length / cols));

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [14, 28], [0, 1], { extrapolateRight: "clamp" });

  const boxW = 380;
  const boxH = 200;
  const gutterX = 60;
  const gutterY = 70;
  const gridW = cols * boxW + (cols - 1) * gutterX;
  const gridH = rows * boxH + (rows - 1) * gutterY;
  const startX = (width - gridW) / 2;
  const startY = (height - gridH) / 2 + 60;

  const centers = useMemo(() => {
    return modules.map((_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (boxW + gutterX);
      const y = startY + row * (boxH + gutterY);
      return { x, y, cx: x + boxW / 2, cy: y + boxH / 2 };
    });
  }, [modules.length, startX, startY, cols]);

  // The "active module" rotates through modules as the scene plays —
  // synthesises the per-narration mention without needing structured
  // timing from the script. Module N is "active" during the Nth equal
  // slice of the scene's middle section.
  const totalFrames = Math.round(
    ((section.audio_duration_seconds ?? section.duration_seconds ?? 22) + 1.0) * 30,
  );
  const activeWindow = Math.max(60, Math.floor((totalFrames - 90) / Math.max(1, modules.length)));
  const activeIndex = Math.min(
    modules.length - 1,
    Math.max(0, Math.floor((frame - 60) / activeWindow)),
  );

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <Particles count={20} seed={modules.length * 41 + 1} speed={0.8} />
      <FocusGlow x={50} y={55} radius={70} intensity={0.07} />

      <CameraMove pan="left" intensity={0.7}>
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_DISPLAY,
        }}
      >
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -1,
          }}
        >
          Architecture
        </div>
        <div
          style={{
            opacity: subtitleOpacity,
            marginTop: 12,
            fontSize: 26,
            color: COLORS.cyan,
            textTransform: "capitalize",
          }}
        >
          {data?.hint ?? "modules"}
        </div>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {centers.map((c, index) => {
          const next = centers[index + 1];
          if (!next) return null;
          const startsAt = 20 + index * 8;
          const progress = interpolate(
            frame,
            [startsAt, startsAt + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const dashLength = 800;
          return (
            <path
              key={`arc-${index}`}
              d={`M ${c.cx} ${c.cy} Q ${(c.cx + next.cx) / 2} ${
                Math.min(c.cy, next.cy) - 60
              }, ${next.cx} ${next.cy}`}
              stroke={COLORS.cyan}
              strokeOpacity={0.45}
              strokeWidth={1.5}
              strokeDasharray={`${dashLength * progress} ${dashLength}`}
              fill="none"
            />
          );
        })}
      </svg>

      {modules.map((module, index) => {
        const enterFrame = 30 + index * 6;
        const enter = spring({
          frame: frame - enterFrame,
          fps,
          config: SETTLE,
        });
        const c = centers[index];
        const color = BOX_COLORS[index % BOX_COLORS.length];

        // Currently-being-narrated module gets a lift forward + a slight
        // y-axis tilt + a breathing pulse. Other modules dim and recede.
        const isActive = activeIndex === index && frame > 60;
        const isAfterEntry = frame >= enterFrame + 12;
        const pulseScale = isActive && isAfterEntry ? pulse(frame, fps) : 1;
        const dimOpacity = isActive
          ? 1
          : isAfterEntry && frame > 60
            ? 0.55
            : interpolate(enter, [0, 1], [0, 1]);
        const tiltDeg = isActive ? 5 : 0;
        const liftScale = isActive ? 1.05 : 1;
        const y = c.y + interpolate(enter, [0, 1], [40, 0]);

        return (
          <div
            key={module.name + index}
            style={{
              position: "absolute",
              left: c.x,
              top: y,
              opacity: dimOpacity,
              width: boxW,
              height: boxH,
              transform: `perspective(900px) rotateY(${tiltDeg}deg) scale(${liftScale * pulseScale})`,
              transformOrigin: "center center",
              zIndex: isActive ? 2 : 1,
            }}
          >
            <ScanLineReveal startFrame={enterFrame} durationFrames={14} height={boxH}>
              <div
                style={{
                  width: boxW,
                  height: boxH,
                  borderRadius: 24,
                  padding: 28,
                  background: "#111118",
                  border: `1.5px solid ${isActive ? COLORS.cyan : color}`,
                  boxShadow: isActive
                    ? `0 0 64px -8px ${COLORS.cyan}, 0 0 0 1px rgba(0,240,255,0.18)`
                    : `0 0 48px -16px ${color}, 0 0 0 1px rgba(255,255,255,0.04)`,
                  fontFamily: FONT_BODY,
                  color: COLORS.text,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700 }}>
                  {module.name}
                </div>
                <div style={{ marginTop: 6, color: isActive ? COLORS.cyan : color, fontSize: 20 }}>
                  {module.role}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    fontSize: 18,
                    color: "rgba(245,245,240,0.62)",
                    lineHeight: 1.4,
                  }}
                >
                  {(module.description ?? "").slice(0, 90)}
                </div>
              </div>
            </ScanLineReveal>
          </div>
        );
      })}

      </CameraMove>
      <Watermark />
    </AbsoluteFill>
  );
};
