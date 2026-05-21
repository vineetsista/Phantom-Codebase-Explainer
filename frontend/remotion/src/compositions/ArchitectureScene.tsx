import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { Watermark } from "../components/Watermark";
import { FONT_BODY, FONT_DISPLAY } from "../loadFonts";
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

  return (
    <AbsoluteFill>
      <BackgroundGrid />

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
          config: { damping: 18, stiffness: 140 },
        });
        const c = centers[index];
        const color = BOX_COLORS[index % BOX_COLORS.length];
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        const y = c.y + interpolate(enter, [0, 1], [40, 0]);
        return (
          <div
            key={module.name + index}
            style={{
              position: "absolute",
              left: c.x,
              top: y,
              opacity,
              width: boxW,
              height: boxH,
              borderRadius: 24,
              padding: 28,
              background: "#111118",
              border: `1.5px solid ${color}`,
              boxShadow: `0 0 48px -16px ${color}, 0 0 0 1px rgba(255,255,255,0.04)`,
              fontFamily: FONT_BODY,
              color: COLORS.text,
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700 }}>
              {module.name}
            </div>
            <div style={{ marginTop: 6, color, fontSize: 20 }}>{module.role}</div>
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
        );
      })}

      <Watermark />
    </AbsoluteFill>
  );
};
