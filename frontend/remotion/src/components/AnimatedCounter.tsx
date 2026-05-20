import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { COLORS } from "../types";

interface AnimatedCounterProps {
  value: number;
  startFrame?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
}

/**
 * Counter that ticks up from 0 to `value` between [startFrame, startFrame + durationFrames].
 * Uses a tabular-numeric font so digits don't jitter as they change width.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  startFrame = 0,
  durationFrames = 28,
  prefix = "",
  suffix = "",
  fontSize = 28,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - startFrame);
  const eased = interpolate(t, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });
  const current = Math.round(value * eased);

  return (
    <span
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontVariantNumeric: "tabular-nums",
        fontSize,
        color: COLORS.text,
      }}
    >
      {prefix}
      {current.toLocaleString()}
      {suffix}
    </span>
  );
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
