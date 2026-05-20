import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../types";

/**
 * Phantom "P" mark that draws itself in via SVG path animation. Used at the
 * start of the Intro scene and the end of the Outro scene.
 */
export const LogoMark: React.FC<{ size?: number; startFrame?: number }> = ({
  size = 96,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame);
  const strokeProgress = interpolate(t, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fillOpacity = interpolate(t, [16, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const haloOpacity = interpolate(t, [6, 28], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pathLength = 220;
  const dashOffset = pathLength - pathLength * strokeProgress;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -size * 0.4,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.cyan}55, transparent 70%)`,
          filter: "blur(24px)",
          opacity: haloOpacity,
        }}
      />
      <svg viewBox="0 0 32 32" width={size} height={size}>
        <defs>
          <linearGradient id="logo-fill" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor={COLORS.cyan} />
            <stop offset="100%" stopColor={COLORS.violet} />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="6"
          fill="none"
          stroke="url(#logo-fill)"
          strokeWidth="1.2"
          strokeDasharray={pathLength}
          strokeDashoffset={dashOffset}
        />
        <path
          d="M11 23V9h6.5a4.5 4.5 0 0 1 0 9H14v5h-3Zm3-8h3.2a1.8 1.8 0 0 0 0-3.6H14V15Z"
          fill={COLORS.text}
          fillOpacity={fillOpacity}
        />
      </svg>
    </div>
  );
};
