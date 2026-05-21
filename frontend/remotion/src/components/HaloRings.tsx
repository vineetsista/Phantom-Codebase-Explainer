import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../types";

/**
 * Three concentric rings expanding outward from a centerpoint and fading.
 * Used as the closing beat of the OutroScene — a small ceremony around the
 * brand mark before the cut.
 */
export const HaloRings: React.FC<{
  startFrame: number;
  durationFrames?: number;
  maxRadius?: number;
  rings?: number;
  color?: string;
}> = ({
  startFrame,
  durationFrames = 60,
  maxRadius = 320,
  rings = 3,
  color = COLORS.cyan,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: rings }).map((_, index) => {
        const ringStart = startFrame + index * 8;
        const rel = frame - ringStart;
        if (rel < 0) return null;
        const radius = interpolate(rel, [0, durationFrames], [0, maxRadius], {
          extrapolateRight: "clamp",
        });
        const opacity = interpolate(rel, [0, durationFrames * 0.6, durationFrames], [0.55, 0.18, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              border: `1.5px solid ${color}`,
              opacity,
              boxShadow: `0 0 32px ${color}33`,
            }}
          />
        );
      })}
    </div>
  );
};
