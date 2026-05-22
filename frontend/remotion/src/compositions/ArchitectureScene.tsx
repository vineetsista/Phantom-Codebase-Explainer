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
 * Architecture scene — slide-cycling deep dive (v3).
 *
 * Previous version (entry-on-left, deps-stacked-on-right) had two
 * problems the user reported as "fully out of sync":
 *
 *   1. With 6-8 modules, the right stack got crowded and the active-
 *      highlight cyan border was the only signal — too quiet to
 *      teach.
 *   2. The narrator's voice was describing one module while the
 *      newly-anchored timing was activating another (root cause: the
 *      label-matching bug, fixed in voice_generator.py; but even with
 *      correct timing, the static-board layout couldn't carry
 *      richer information than a label).
 *
 * The v3 redesign cycles through modules ONE AT A TIME — the same
 * mental model that works in the code walkthrough. Each module gets
 * its own slide:
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │   MONOLITH · ARCHITECTURE                       │
 *   │                                                 │
 *   │              MODULE 03 / 08                     │
 *   │                                                 │
 *   │              ZodType                            │
 *   │              ──────────────                     │
 *   │              packages/zod/src/v3/types.ts       │
 *   │                                                 │
 *   │     Every schema inherits from this base       │
 *   │     class. Defines the parse contract that     │
 *   │     all validators must implement.             │
 *   │                                                 │
 *   │   ●  ●  ●  ○  ○  ○  ○  ○                       │
 *   │   index  types  ZodType  parse  ZodError ...    │
 *   └─────────────────────────────────────────────────┘
 *
 * Cards slide in from the right when the narrator moves on. Previous
 * card slides out left. Progress dots fill in. Tiny labels below the
 * dots give an at-a-glance overview of where we are in the tour.
 *
 * Why this is more "in sync": only ONE module is visible at a time,
 * so the audio-visual binding is unambiguous. If the narrator says
 * "ZodType", the entire screen is ZodType. There's no "which of the
 * 8 boxes is the active one" guessing game.
 */
const FPS = 30;
const SLIDE_DURATION_FRAMES = 16; // 0.53s slide transition

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

  const modules = (data.modules ?? []).slice(0, 10);

  // Compute the entry frame for each module slide. After alignment sync,
  // narration_start_seconds is the moment the narrator first names this
  // module. We add a 1s lead-in so the first slide isn't blank while the
  // header is still animating.
  const moduleStartFrames = useMemo(() => {
    return modules.map((m, i) => {
      const s = m.narration_start_seconds;
      if (typeof s === "number" && s >= 0) {
        return Math.max(30, Math.round(s * FPS) + 30);
      }
      return 30 + i * 120; // sensible fallback if alignment didn't fire
    });
  }, [modules]);

  // Active module = last one whose start frame has elapsed.
  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < moduleStartFrames.length; i++) {
      if (frame >= moduleStartFrames[i]) idx = i;
    }
    return Math.max(0, idx);
  }, [moduleStartFrames, frame]);

  // Slide transition: when activeIndex changes, the new card slides in
  // from the right while the old one slides out left. Calculate per-card
  // slide progress so we can render outgoing and incoming concurrently.
  const enterProgress = (i: number) => {
    const start = moduleStartFrames[i] ?? 0;
    const next = moduleStartFrames[i + 1];
    const end = start + SLIDE_DURATION_FRAMES;
    const exitStart = next != null ? next - SLIDE_DURATION_FRAMES / 2 : Infinity;
    const exitEnd = next != null ? next + SLIDE_DURATION_FRAMES / 2 : Infinity;

    if (frame < start) return { opacity: 0, translateX: 80 };
    if (frame < end) {
      const t = (frame - start) / SLIDE_DURATION_FRAMES;
      return {
        opacity: t,
        translateX: 80 * (1 - t),
      };
    }
    if (frame < exitStart) return { opacity: 1, translateX: 0 };
    if (frame < exitEnd) {
      const t = (frame - exitStart) / SLIDE_DURATION_FRAMES;
      return {
        opacity: 1 - t,
        translateX: -80 * t,
      };
    }
    return { opacity: 0, translateX: -80 };
  };

  // Header animation.
  const kickerOpacity = interpolate(frame, [4, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pill-style progress dots at the bottom — each module gets a dot.
  // Already-visited dots are cyan-filled; the current one pulses; future
  // dots are dim outlines. Below the dots, the active module's name
  // also appears in mono, with neighbours faded.
  const dotSize = 14;
  const dotGap = 18;

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <AbsoluteFill
        style={{ background: "rgba(10,10,11,0.55)", pointerEvents: "none" }}
      />

      {/* HEADER — minimal, doesn't compete with the card */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 0,
          right: 0,
          textAlign: "center",
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
          {(data.hint ?? "architecture").toString().toUpperCase()}
        </div>
        <div
          style={{
            opacity: titleOpacity,
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -1,
            lineHeight: 1,
            fontFamily: FONT_DISPLAY,
          }}
        >
          Architecture
        </div>
      </div>

      {/* CARD STACK — each module renders its own card; slide animations
          are driven by enterProgress(). Only one card is visually
          dominant at a time. */}
      {modules.map((m, i) => {
        const { opacity, translateX } = enterProgress(i);
        if (opacity <= 0.01) return null;
        return (
          <ModuleCard
            key={(m.id || m.label || "") + i}
            module={m as ScriptModule & { description?: string }}
            index={i}
            total={modules.length}
            opacity={opacity}
            translateX={translateX}
            isActive={i === activeIndex}
          />
        );
      })}

      {/* PROGRESS DOTS + name strip — bottom of the frame */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: dotGap,
            alignItems: "center",
          }}
        >
          {modules.map((_, i) => {
            const visited = i <= activeIndex;
            const active = i === activeIndex;
            const pulseScale = active
              ? 1 + 0.12 * 0.5 * (1 - Math.cos((frame / fps) * 2 * Math.PI / 0.9))
              : 1;
            return (
              <div
                key={i}
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: visited ? COLORS.cyan : "transparent",
                  border: `1.5px solid ${visited ? COLORS.cyan : "rgba(255,255,255,0.25)"}`,
                  boxShadow: active ? `0 0 18px ${COLORS.cyan}aa` : "none",
                  transform: `scale(${pulseScale})`,
                  transition: "none",
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 13,
            color: "rgba(245,245,240,0.55)",
            letterSpacing: 1.5,
            textAlign: "center",
            maxWidth: 1400,
            lineHeight: 1.6,
          }}
        >
          {modules.map((m, i) => (
            <span
              key={(m.id || m.label || "") + i}
              style={{
                marginRight: 14,
                color:
                  i === activeIndex
                    ? COLORS.cyan
                    : i < activeIndex
                      ? "rgba(245,245,240,0.55)"
                      : "rgba(245,245,240,0.22)",
                fontWeight: i === activeIndex ? 700 : 400,
              }}
            >
              {m.label || m.id || ""}
            </span>
          ))}
        </div>
      </div>

      <Watermark />
    </AbsoluteFill>
  );
};

interface ModuleCardProps {
  module: ScriptModule & { description?: string };
  index: number;
  total: number;
  opacity: number;
  translateX: number;
  isActive: boolean;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  index,
  total,
  opacity,
  translateX,
  isActive,
}) => {
  const { width, height } = useVideoConfig();
  const label = module.label || module.name || module.id || "Module";
  const filePath = module.file_path || "";
  const description = module.description || "";

  // Card sized proportionally to viewport. ~67% of width / 75% of height
  // — leaves visual breathing room on all sides.
  const cardWidth = Math.round(width * 0.67);
  const cardHeight = Math.round(height * 0.5);
  const cardTopPct = 0.32;

  return (
    <div
      style={{
        position: "absolute",
        top: Math.round(height * cardTopPct),
        left: "50%",
        marginLeft: -cardWidth / 2,
        width: cardWidth,
        opacity,
        transform: `translateX(${translateX}px)`,
        pointerEvents: "none",
      }}
    >
      {/* MODULE COUNTER — top mono kicker */}
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 14,
          color: COLORS.cyan,
          letterSpacing: 6,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        MODULE {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* CARD — outlined panel with module info */}
      <div
        style={{
          position: "relative",
          background: "rgba(17,17,24,0.85)",
          border: `1px solid ${isActive ? COLORS.cyan : "rgba(255,255,255,0.10)"}`,
          borderRadius: 24,
          padding: "56px 72px",
          minHeight: cardHeight - 60,
          boxShadow: isActive
            ? `0 0 80px -28px ${COLORS.cyan}aa`
            : "0 12px 40px rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
        }}
      >
        {/* Module name — huge */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            // Scale font with card width — 84px at 1920 → ~56px at 1280
            fontSize: Math.round(cardWidth * 0.066),
            fontWeight: 700,
            color: COLORS.text,
            lineHeight: 1.0,
            letterSpacing: -2,
            textAlign: "center",
          }}
        >
          {label}
        </div>

        {/* File path — mono, dim */}
        {filePath && (
          <div
            style={{
              marginTop: 18,
              fontFamily: FONT_MONO,
              fontSize: 16,
              color: "rgba(245,245,240,0.5)",
              letterSpacing: 1,
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            {filePath}
          </div>
        )}

        {/* Description callout */}
        {description && (
          <div
            style={{
              marginTop: 44,
              fontFamily: FONT_BODY,
              // Scale description text with card width too.
              fontSize: Math.round(cardWidth * 0.022),
              color: COLORS.text,
              lineHeight: 1.5,
              textAlign: "center",
              maxWidth: Math.round(cardWidth * 0.85),
              marginLeft: "auto",
              marginRight: "auto",
              fontWeight: 400,
            }}
          >
            {description}
          </div>
        )}

        {/* Corner accent — cyan glow on top-left */}
        <div
          style={{
            position: "absolute",
            top: -1,
            left: -1,
            width: 64,
            height: 64,
            borderTop: `2px solid ${COLORS.cyan}`,
            borderLeft: `2px solid ${COLORS.cyan}`,
            borderTopLeftRadius: 24,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 64,
            height: 64,
            borderBottom: `2px solid ${COLORS.cyan}`,
            borderRight: `2px solid ${COLORS.cyan}`,
            borderBottomRightRadius: 24,
          }}
        />
      </div>
    </div>
  );
};
