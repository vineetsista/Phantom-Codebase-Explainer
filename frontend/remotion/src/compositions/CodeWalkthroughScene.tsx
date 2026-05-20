import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { Watermark } from "../components/Watermark";
import { COLORS, type ScriptSection } from "../types";

interface FileSummary {
  path: string;
  language?: string;
  bytes?: number;
}

export const CodeWalkthroughScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const files = ((section.visuals?.data as { files?: FileSummary[] })?.files ?? []).slice(0, 6);

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
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.cyan,
            opacity: interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Where the work lives
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -1,
            opacity: interpolate(frame, [4, 20], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Code walkthrough
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: "260px 120px 160px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {files.map((file, index) => {
          const enterFrame = 24 + index * 10;
          const opacity = interpolate(frame, [enterFrame, enterFrame + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const slideX = interpolate(frame, [enterFrame, enterFrame + 14], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={file.path}
              style={{
                opacity,
                transform: `translateX(${slideX}px)`,
                margin: "0 0 18px",
                padding: "20px 28px",
                borderRadius: 16,
                background: "rgba(17,17,24,0.85)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: COLORS.cyan,
                  boxShadow: `0 0 14px ${COLORS.cyan}`,
                }}
              />
              <span style={{ flex: 1, fontSize: 30, color: COLORS.text }}>{file.path}</span>
              {file.language && (
                <span
                  style={{
                    fontSize: 18,
                    color: COLORS.cyan,
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: `1px solid ${COLORS.cyan}55`,
                    background: `${COLORS.cyan}10`,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {file.language}
                </span>
              )}
              {typeof file.bytes === "number" && (
                <span style={{ fontSize: 22, color: "rgba(245,245,240,0.5)" }}>
                  {(file.bytes / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Subtle scan-line that sweeps across the file list */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: interpolate(
            frame,
            [0, durationInFrames],
            [260, 260 + 460],
            { extrapolateRight: "clamp" },
          ),
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, transparent)`,
          opacity: 0.4,
        }}
      />

      <Watermark />
    </AbsoluteFill>
  );
};
