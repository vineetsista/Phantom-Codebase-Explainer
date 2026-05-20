import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";

import { COLORS } from "../types";

/**
 * Matrix-style code rain — vertical falling characters on the edges of the
 * frame. Intentionally subtle: mostly faded, blurred slightly, off the
 * critical reading area. Used in the Intro scene as ambient atmosphere.
 *
 * Columns are deterministic (seeded by their index) so the same number of
 * columns always produces the same visual — important because Remotion needs
 * stable rendering across frames.
 */

const CHARS = "01><=>{}()[]/\\|+-*=#$@%&;:,.";

interface Column {
  x: number;
  speed: number;
  offset: number;
  chars: string[];
  opacity: number;
}

function buildColumns(side: "left" | "right", count: number, height: number): Column[] {
  return Array.from({ length: count }).map((_, index) => {
    const seed = side === "left" ? index : 1000 + index;
    const x =
      side === "left"
        ? 16 + index * 28
        : -16 - index * 28; // negative = anchored to right edge
    return {
      x,
      speed: 0.4 + random(`speed-${seed}`) * 0.6,
      offset: random(`offset-${seed}`) * height,
      opacity: 0.18 + random(`opacity-${seed}`) * 0.22,
      chars: Array.from({ length: 60 }).map((_, j) =>
        CHARS[Math.floor(random(`char-${seed}-${j}`) * CHARS.length)],
      ),
    };
  });
}

export const CodeRain: React.FC<{ side?: "both" | "left" | "right" }> = ({
  side = "both",
}) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();

  const left = useMemo(
    () => (side !== "right" ? buildColumns("left", 4, height) : []),
    [side, height],
  );
  const right = useMemo(
    () => (side !== "left" ? buildColumns("right", 4, height) : []),
    [side, height],
  );

  return (
    <>
      {left.length > 0 && (
        <RainGroup side="left" frame={frame} fps={fps} columns={left} height={height} />
      )}
      {right.length > 0 && (
        <RainGroup side="right" frame={frame} fps={fps} columns={right} height={height} />
      )}
    </>
  );
};

function RainGroup({
  side,
  frame,
  fps,
  columns,
  height,
}: {
  side: "left" | "right";
  frame: number;
  fps: number;
  columns: Column[];
  height: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 180,
        overflow: "hidden",
        pointerEvents: "none",
        maskImage: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, black, transparent)`,
        WebkitMaskImage: `linear-gradient(${side === "left" ? "90deg" : "270deg"}, black, transparent)`,
        filter: "blur(0.6px)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 18,
        color: COLORS.cyan,
      }}
    >
      {columns.map((col, index) => {
        const travel = (frame / fps) * 60 * col.speed; // px per second
        const y = ((col.offset + travel) % (height + 800)) - 400;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: Math.abs(col.x),
              top: y,
              opacity: col.opacity,
              lineHeight: 1.1,
              transform: "translateZ(0)",
            }}
          >
            {col.chars.map((ch, charIndex) => {
              const fade = interpolate(charIndex, [0, col.chars.length - 1], [1, 0]);
              return (
                <div key={charIndex} style={{ opacity: fade }}>
                  {ch}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
