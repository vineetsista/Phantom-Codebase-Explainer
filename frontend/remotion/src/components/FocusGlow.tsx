import React from "react";
import { AbsoluteFill } from "remotion";

import { COLORS } from "../types";

/**
 * Soft radial gradient behind the primary subject of a scene. Pulls the eye
 * toward where the narration is pointing without going so bright that it
 * competes with the content itself.
 *
 * Positioned by `x` / `y` as percentages (0-100) of the composition's
 * dimensions. Defaults to dead center.
 */
export const FocusGlow: React.FC<{
  x?: number;
  y?: number;
  /** Radius of the gradient stop, as a % of the smaller composition axis. */
  radius?: number;
  /** Peak opacity of the gradient at the center. Default 0.08. */
  intensity?: number;
  color?: string;
}> = ({
  x = 50,
  y = 50,
  radius = 60,
  intensity = 0.08,
  color = COLORS.cyan,
}) => {
  // Hex → rgba so we can apply the intensity to a non-rgba brand color.
  const rgba = hexToRgba(color, intensity);
  const transparent = hexToRgba(color, 0);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${rgba} 0%, ${transparent} ${radius}%)`,
        pointerEvents: "none",
      }}
    />
  );
};

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
