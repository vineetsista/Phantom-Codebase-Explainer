import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../types";

/**
 * Brief RGB-channel split applied to children for `durationFrames` starting at
 * `startFrame`. The cyan and magenta layers separate horizontally by a few
 * pixels, then snap back. Once per video — too much of this and you get a
 * music-video look that fights the rest of the design.
 *
 * Implemented with two duplicated children offset by translateX, blended
 * with `mix-blend-mode: screen`. Pure render-able — no CSS animation.
 */
export const ChromaticGlitch: React.FC<{
  startFrame: number;
  durationFrames?: number;
  amplitude?: number;
  children: React.ReactNode;
}> = ({ startFrame, durationFrames = 6, amplitude = 6, children }) => {
  const frame = useCurrentFrame();
  const rel = frame - startFrame;

  // Triangular envelope: 0 → amplitude → 0 across the duration window.
  // Off entirely outside the window so the rest of the scene is untouched.
  let offset = 0;
  if (rel >= 0 && rel <= durationFrames) {
    const half = durationFrames / 2;
    offset =
      rel <= half
        ? interpolate(rel, [0, half], [0, amplitude])
        : interpolate(rel, [half, durationFrames], [amplitude, 0]);
  }

  if (offset === 0) {
    return <>{children}</>;
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          color: COLORS.cyan,
          transform: `translate3d(${-offset}px, 0, 0)`,
          mixBlendMode: "screen",
          opacity: 0.85,
        }}
      >
        {children}
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          color: "#FF00C8",
          transform: `translate3d(${offset}px, 0, 0)`,
          mixBlendMode: "screen",
          opacity: 0.85,
        }}
      >
        {children}
      </span>
      <span style={{ position: "relative" }}>{children}</span>
    </span>
  );
};
