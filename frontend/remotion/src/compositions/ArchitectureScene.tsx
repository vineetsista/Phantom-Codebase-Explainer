import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { Watermark } from "../components/Watermark";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import {
  COLORS,
  type ScriptConnection,
  type ScriptDataFlow,
  type ScriptModule,
  type ScriptSection,
} from "../types";

/**
 * Architecture scene — entry-on-left, dependencies-stacked-on-right.
 *
 * Previous radial layout was reading as "modules on a circle" — abstract
 * and hard to follow. This is a real architecture-diagram layout:
 *
 *     ┌────────────┐                  ┌─────────────────┐
 *     │            │ ─────────────→   │ public-ip       │  ← stacked on
 *     │  index.js  │ ─────────────→   │ p-any           │    the right,
 *     │            │ ─────────────→   │ fetch-extras    │    one per row
 *     │   (entry)  │ ─────────────→   │ appleCheck      │
 *     └────────────┘                  └─────────────────┘
 *
 * - Entry module (always module[0]) lives on the LEFT, large.
 * - Every other module renders as a stacked row on the RIGHT.
 * - Connection arrows go LEFT-TO-RIGHT, drawing when each dep is mentioned.
 * - The active dep (whichever's narration_start_seconds is most recent in
 *   the past) gets a cyan border at 100% opacity; others sit at 35%.
 * - NO camera tracking, NO repositioning, NO particle flows — once a
 *   module appears, it stays put.
 *
 * Three regions, hard-separated:
 *   y    0 → 140    title only
 *   y  160 → 880    diagram only
 *   y  900 → 1080   watermark only
 */
const FPS = 30;
const TITLE_REGION_BOTTOM = 140;
const MODULE_REGION_TOP = 180;
const FOOTER_REGION_TOP = 880;
const MIN_MARGIN_FROM_TITLE = 40;

interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the connection arrow attaches (entry's right edge, dep's left edge). */
  anchorX: number;
  anchorY: number;
}

export const ArchitectureScene: React.FC<{ section: ScriptSection }> = ({
  section,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const data = (section.visuals?.data as {
    modules?: ScriptModule[];
    connections?: ScriptConnection[];
    data_flows?: ScriptDataFlow[];
    hint?: string;
  }) ?? {};

  const modules = (data.modules ?? []).slice(0, 8);
  const hasEntry = modules.length >= 1;
  const deps = hasEntry ? modules.slice(1) : [];

  // Layout. Entry takes the left third; deps stack in the right two-thirds.
  const placements = useMemo<Placement[]>(() => {
    if (modules.length === 0) return [];

    const regionTop = MODULE_REGION_TOP + MIN_MARGIN_FROM_TITLE;
    const regionBottom = FOOTER_REGION_TOP - 40;
    const regionHeight = regionBottom - regionTop;
    const regionCenterY = (regionTop + regionBottom) / 2;

    // Entry module — large, vertically centred in the left third.
    const entryW = 360;
    const entryH = 180;
    const entryCenterX = 320;
    const entryX = entryCenterX - entryW / 2;
    const entryY = regionCenterY - entryH / 2;

    // Dep modules — stacked rows on the right.
    const depCount = deps.length;
    const depW = 480;
    const maxRows = Math.max(1, depCount);
    // Row height scales down with more deps so they all fit.
    const idealRowH = depCount <= 4 ? 100 : depCount <= 6 ? 84 : 72;
    const gapY = depCount <= 4 ? 28 : depCount <= 6 ? 20 : 16;
    const totalStackH = maxRows * idealRowH + (maxRows - 1) * gapY;
    // If still too tall for the region, shrink further.
    const fitScale =
      totalStackH > regionHeight ? regionHeight / totalStackH : 1;
    const rowH = Math.round(idealRowH * fitScale);
    const rowGap = Math.round(gapY * fitScale);
    const stackH = maxRows * rowH + (maxRows - 1) * rowGap;
    const stackTop = regionCenterY - stackH / 2;

    const depCenterX = 1240;
    const depX = depCenterX - depW / 2;

    const out: Placement[] = [];
    // Entry first (module 0)
    out.push({
      x: entryX,
      y: entryY,
      width: entryW,
      height: entryH,
      anchorX: entryX + entryW, // right edge
      anchorY: entryY + entryH / 2, // vertical centre
    });
    // Dep rows
    deps.forEach((_, i) => {
      const rowTop = stackTop + i * (rowH + rowGap);
      out.push({
        x: depX,
        y: rowTop,
        width: depW,
        height: rowH,
        anchorX: depX, // left edge
        anchorY: rowTop + rowH / 2,
      });
    });
    return out;
  }, [modules, deps, width, height]);

  // Frame at which each module/connection appears.
  const moduleStartFrames = useMemo(() => {
    return modules.map((m, index) => {
      const s = m.narration_start_seconds;
      if (typeof s === "number" && s >= 0) {
        return Math.max(30, Math.round(s * FPS) + 30);
      }
      return 30 + index * 30;
    });
  }, [modules]);

  // Active module — last one whose narration_start_seconds is in the past.
  const activeIndex = useMemo(() => {
    let active = -1;
    for (let i = 0; i < moduleStartFrames.length; i++) {
      if (frame >= moduleStartFrames[i] + 14) active = i;
    }
    return active;
  }, [moduleStartFrames, frame]);

  // Connection — entry → dep[i]. Each connection draws when the dep
  // becomes active (when dep i's narration_start_seconds is reached).
  // We don't need a separate `connections` array from the script generator
  // because the layout is implicit: entry always connects to every dep.
  const connectionStartFrames = useMemo(() => {
    return deps.map((_, depIndex) => {
      // deps[depIndex] is modules[depIndex + 1]
      return moduleStartFrames[depIndex + 1] ?? 60;
    });
  }, [deps, moduleStartFrames]);

  // Header opacities.
  const kickerOpacity = interpolate(frame, [4, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      {/* Darken the grid further so the diagram has the visual weight. */}
      <AbsoluteFill
        style={{ background: "rgba(10,10,11,0.45)", pointerEvents: "none" }}
      />

      {/* TITLE REGION */}
      <div
        style={{
          position: "absolute",
          top: 32,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_DISPLAY,
          height: TITLE_REGION_BOTTOM - 32,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: kickerOpacity,
            fontSize: 12,
            color: COLORS.cyan,
            textTransform: "uppercase",
            fontFamily: FONT_MONO,
            letterSpacing: 6,
            marginBottom: 10,
          }}
        >
          {(data.hint ?? "modules").toString().toUpperCase()}
        </div>
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          Architecture
        </div>
      </div>

      {/* DIAGRAM REGION — entry on left, deps stacked on right. */}
      {placements.length > 0 && (
        <>
          {/* Connection lines (SVG layer behind the boxes). */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {deps.map((_, depIndex) => {
              const startFrame = connectionStartFrames[depIndex];
              const entryPlace = placements[0];
              const depPlace = placements[depIndex + 1];
              if (!entryPlace || !depPlace) return null;

              const x1 = entryPlace.anchorX;
              const y1 = entryPlace.anchorY;
              const x2 = depPlace.anchorX;
              const y2 = depPlace.anchorY;
              // Gentle S-curve: control points pull horizontally so the
              // line leaves the entry's right edge going right, and enters
              // the dep's left edge going right.
              const ctrl1X = x1 + (x2 - x1) * 0.4;
              const ctrl2X = x1 + (x2 - x1) * 0.6;

              const dashLength = Math.max(
                500,
                Math.round(Math.hypot(x2 - x1, y2 - y1) * 1.6),
              );
              const drawProgress = interpolate(
                frame,
                [startFrame, startFrame + 18],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const isActive = activeIndex === depIndex + 1;

              return (
                <g key={`conn-${depIndex}`}>
                  <path
                    d={`M ${x1} ${y1} C ${ctrl1X} ${y1}, ${ctrl2X} ${y2}, ${x2} ${y2}`}
                    stroke={isActive ? COLORS.cyan : "rgba(245,245,240,0.20)"}
                    strokeWidth={isActive ? 1.5 : 1}
                    strokeDasharray={dashLength}
                    strokeDashoffset={dashLength * (1 - drawProgress)}
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Small arrowhead dot at the dep end, fades in once the
                      line finishes drawing. */}
                  {drawProgress > 0.85 && (
                    <circle
                      cx={x2}
                      cy={y2}
                      r={3.5}
                      fill={isActive ? COLORS.cyan : "rgba(245,245,240,0.4)"}
                      opacity={(drawProgress - 0.85) / 0.15}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Entry module — module[0]. */}
          {hasEntry && (
            <ModuleBox
              module={modules[0]}
              place={placements[0]}
              startFrame={moduleStartFrames[0]}
              isActive={activeIndex === 0}
              somethingActive={activeIndex >= 0}
              currentFrame={frame}
              fps={fps}
              variant="entry"
            />
          )}

          {/* Dep modules — module[1..]. */}
          {deps.map((m, i) => {
            const moduleIndex = i + 1;
            return (
              <ModuleBox
                key={(m.id || m.name || "") + moduleIndex}
                module={m}
                place={placements[moduleIndex]}
                startFrame={moduleStartFrames[moduleIndex]}
                isActive={activeIndex === moduleIndex}
                somethingActive={activeIndex >= 0}
                currentFrame={frame}
                fps={fps}
                variant="dep"
              />
            );
          })}
        </>
      )}

      <Watermark />
    </AbsoluteFill>
  );
};

interface ModuleBoxProps {
  module: ScriptModule;
  place: Placement;
  startFrame: number;
  isActive: boolean;
  somethingActive: boolean;
  currentFrame: number;
  fps: number;
  variant: "entry" | "dep";
}

const ModuleBox: React.FC<ModuleBoxProps> = ({
  module,
  place,
  startFrame,
  isActive,
  somethingActive,
  currentFrame,
  fps,
  variant,
}) => {
  // Soft 14-frame fade-in plus a small scale settle. No movement after entry.
  const enter = spring({
    frame: currentFrame - startFrame,
    fps,
    config: { damping: 26, stiffness: 90 },
  });
  const enterScale = interpolate(enter, [0, 1], [0.94, 1.0]);
  const enterOpacity = interpolate(enter, [0, 1], [0, 1]);

  const afterEntry = currentFrame >= startFrame + 14;
  let opacity = enterOpacity;
  if (afterEntry) {
    opacity = isActive ? 1 : somethingActive ? 0.35 : 1;
  }

  const label = module.label || module.name || module.id || "Module";
  const filePath = module.file_path || "";
  const isEntry = variant === "entry";

  return (
    <div
      style={{
        position: "absolute",
        left: place.x,
        top: place.y,
        width: place.width,
        height: place.height,
        opacity,
        transform: `scale(${enterScale})`,
        transformOrigin: "center center",
        zIndex: isActive ? 5 : 2,
      }}
    >
      <div
        style={{
          width: place.width,
          height: place.height,
          borderRadius: isEntry ? 16 : 12,
          padding: isEntry ? "22px 28px" : "14px 22px",
          background: isEntry ? "rgba(0,240,255,0.06)" : "rgba(20,20,28,0.92)",
          border: `1px solid ${
            isActive
              ? COLORS.cyan
              : isEntry
                ? "rgba(0,240,255,0.35)"
                : "rgba(255,255,255,0.10)"
          }`,
          boxShadow: isActive
            ? `0 0 28px -8px ${COLORS.cyan}66`
            : isEntry
              ? `0 0 24px -16px ${COLORS.cyan}44`
              : "none",
          fontFamily: FONT_BODY,
          color: COLORS.text,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        {isEntry && (
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: COLORS.cyan,
              marginBottom: 6,
            }}
          >
            Entry
          </div>
        )}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: isEntry ? 30 : 22,
            fontWeight: 700,
            color: COLORS.text,
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
        {filePath && (
          <div
            style={{
              marginTop: isEntry ? 10 : 4,
              fontFamily: FONT_MONO,
              fontSize: isEntry ? 14 : 12,
              color: "rgba(245,245,240,0.5)",
              letterSpacing: 0.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {filePath}
          </div>
        )}
      </div>
    </div>
  );
};
