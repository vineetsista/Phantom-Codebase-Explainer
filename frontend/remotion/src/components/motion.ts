/**
 * Phantom's motion grammar — the spring configs and interpolation curves
 * every scene shares so the video reads as one piece, not four.
 *
 * Imported by every composition. If you find yourself reaching for a one-off
 * spring config inside a scene, add it here first.
 */

import { spring, interpolate } from "remotion";

/** A spring with a satisfying settle: arrives with a small overshoot, then
 * relaxes. Used for "things landing into their final position" — title
 * letters, module boxes, takeaway cards. */
export const SETTLE = { damping: 12, stiffness: 90 } as const;

/** A faster, harder spring for elements that should snap rather than settle.
 * Used for cursors, highlights, anything micro-interactive. */
export const SNAP = { damping: 18, stiffness: 200 } as const;

/** Grow-in transform: scale from 0.92 → 1.0 with a small upward translate.
 * Pair with `appearOpacity` for the standard "thing appearing" effect. */
export function growIn(frame: number, fps: number, startFrame = 0, cfg = SETTLE) {
  const s = spring({ frame: frame - startFrame, fps, config: cfg });
  const scale = interpolate(s, [0, 1], [0.92, 1.0]);
  const y = interpolate(s, [0, 1], [12, 0]);
  return { scale, y, opacity: interpolate(s, [0, 1], [0, 1]) };
}

/** Standard appear-opacity ramp — 300ms (9 frames at 30fps) from 0 to 1. */
export function appearOpacity(frame: number, startFrame = 0, durationFrames = 9) {
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Subtle 1.0 → 1.02 → 1.0 breathing pulse for elements that are currently
 * "active" (the line the narrator is on, the module being mentioned). The
 * period is 1.2s = 36 frames at 30fps. Two-amplitude sine via cosine. */
export function pulse(frame: number, fps: number, amplitude = 0.02, periodSec = 1.2) {
  const t = (frame / fps) / periodSec;
  return 1 + amplitude * 0.5 * (1 - Math.cos(2 * Math.PI * t));
}

/** Cinematic crossfade ramp for content showing/hiding over a short window. */
export function rampInOut(
  frame: number,
  startFrame: number,
  durationFrames: number,
  fadeFrames = 6,
) {
  return interpolate(
    frame,
    [
      startFrame,
      startFrame + fadeFrames,
      startFrame + durationFrames - fadeFrames,
      startFrame + durationFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}
