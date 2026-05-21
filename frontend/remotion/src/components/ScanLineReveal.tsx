import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../types";

/**
 * Wraps content with a top-to-bottom cyan scan-line reveal. While the line
 * sweeps, content above it is fully visible; content below is hidden by a
 * mask. After the sweep completes, the line fades out and content stays.
 *
 * Used for the Architecture scene's module boxes — gives the load-in a
 * "data arriving" feel instead of a generic fade.
 */
export const ScanLineReveal: React.FC<{
  startFrame: number;
  durationFrames?: number;
  height?: number | string;
  children: React.ReactNode;
}> = ({ startFrame, durationFrames = 18, height = "100%", children }) => {
  const frame = useCurrentFrame();
  const rel = frame - startFrame;
  const progress = interpolate(rel, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineOpacity = interpolate(
    rel,
    [0, 2, durationFrames - 4, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div style={{ position: "relative", height, overflow: "hidden" }}>
      {/* Content. Clipped vertically to the sweep position. */}
      <div
        style={{
          height: "100%",
          clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)`,
        }}
      >
        {children}
      </div>
      {/* The line itself. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${progress * 100}%`,
          height: 2,
          background: COLORS.cyan,
          opacity: lineOpacity,
          boxShadow: `0 0 16px ${COLORS.cyan}`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
