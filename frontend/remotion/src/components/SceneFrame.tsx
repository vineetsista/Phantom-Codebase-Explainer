import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/**
 * Wraps a scene's visual content in an opacity ramp at the start and end of
 * its allocated frame window. When consecutive `<Sequence>`s overlap by the
 * same number of frames (see PhantomVideo's placement math), this ramp
 * functions as a true visual crossfade — the previous scene fades out while
 * the next one fades in, no black flash at the boundary.
 *
 * `transitionFrames` defaults to 9 (0.3 s @ 30 fps), matching
 * SCENE_TRANSITION_S in types.ts.
 */

const DEFAULT_TRANSITION_FRAMES = 9;

export const SceneFrame: React.FC<{
  durationInFrames: number;
  /** Frames over which to fade in at the start and out at the end. Must match
   * the Sequence overlap in PhantomVideo for a clean crossfade. */
  transitionFrames?: number;
  children: React.ReactNode;
}> = ({ durationInFrames, transitionFrames = DEFAULT_TRANSITION_FRAMES, children }) => {
  const frame = useCurrentFrame();
  const fade = Math.max(1, Math.min(transitionFrames, Math.floor(durationInFrames / 2)));
  const opacity = interpolate(
    frame,
    [0, fade, Math.max(0, durationInFrames - fade), durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
