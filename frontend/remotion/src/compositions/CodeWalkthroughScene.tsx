import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { BackgroundGrid } from "../components/BackgroundGrid";
import { CameraMove } from "../components/CameraMove";
import { FocusGlow } from "../components/FocusGlow";
import { Particles } from "../components/Particles";
import { Watermark } from "../components/Watermark";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../loadFonts";
import { COLORS, FPS, type ScriptSection } from "../types";

/**
 * Teach-like-a-human code walkthrough.
 *
 * The previous scene was a static editor with line highlights — a backdrop.
 * This version walks through code the way a senior engineer does at a
 * whiteboard:
 *
 *   - Auto-scrolls so the line being discussed is centred in the viewport
 *   - Zooms in to ~130% on lines marked `emphasis: true`
 *   - Type-on reveal for exactly ONE line per scene (the `punchline`),
 *     synced to the duration of its narration
 *   - Floating annotation with a drawn curved arrow on lines that carry
 *     a `annotation` string
 *   - Optional split panel that slides in from the right when a highlight
 *     declares a `cross_reference` to another file
 *
 * Backdrop layers (background grid, particles, focus glow) and editor
 * chrome (window dots, file path in the title bar) frame the panel.
 */

const LINE_HEIGHT = 30;
const CODE_FONT_SIZE = 19;
const VISIBLE_LINES = 14; // rows visible in the editor viewport
const EDITOR_PAD_TOP = 28;
const EDITOR_PAD_LEFT = 36;
const TITLE_BAR_HEIGHT = 44;
const PANEL_INSET = {
  left: 140,
  right: 140,
  top: 250,
  bottom: 130,
};

const PALETTE = {
  keyword: "#7B61FF",
  string: "#34D399",
  number: "#F59E0B",
  comment: "#6B6B78",
  symbol: COLORS.cyan,
  ident: COLORS.text,
};

const KEYWORDS = new Set([
  "import", "from", "as", "export", "default", "return", "if", "else",
  "for", "while", "in", "of", "let", "const", "var", "function", "async",
  "await", "class", "extends", "new", "this", "self", "true", "false",
  "null", "None", "True", "False", "def", "lambda", "yield", "raise",
  "try", "except", "finally", "with", "pass", "and", "or", "not",
  "interface", "type", "enum", "public", "private", "static", "void",
  "int", "str", "bool", "float", "list", "dict", "tuple", "set",
  "fn", "mut", "pub", "use", "mod", "impl", "trait", "struct",
  "func", "package", "go", "chan", "map", "switch", "case",
]);

interface Highlight {
  line_number: number;
  code: string;
  narration_start_seconds?: number;
  emphasis?: boolean;
  punchline?: boolean;
  annotation?: string;
  cross_reference?: {
    to_file: string;
    to_definition?: string;
    to_line?: number;
  };
}

interface CodeData {
  code?: string;
  path?: string;
  language?: string;
  highlights?: Highlight[];
  highlight_lines?: number[];
}

type Tok = { text: string; kind: keyof typeof PALETTE };

function tokenizeLine(line: string): Tok[] {
  const commentMatch = line.match(/^(\s*)(#|\/\/|--)(.*)$/);
  if (commentMatch) {
    return [
      { text: commentMatch[1], kind: "ident" },
      { text: commentMatch[2] + commentMatch[3], kind: "comment" },
    ];
  }
  const tokens: Tok[] = [];
  const pattern =
    /(\s+)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z0-9_\s])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    const [whole, ws, str, num, ident, sym] = match;
    if (ws) tokens.push({ text: whole, kind: "ident" });
    else if (str) tokens.push({ text: whole, kind: "string" });
    else if (num) tokens.push({ text: whole, kind: "number" });
    else if (ident) tokens.push({ text: whole, kind: KEYWORDS.has(ident) ? "keyword" : "ident" });
    else if (sym) tokens.push({ text: whole, kind: "symbol" });
  }
  return tokens;
}

export const CodeWalkthroughScene: React.FC<{ section: ScriptSection }> = ({
  section,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const data = (section.visuals?.data as CodeData) ?? {};
  const rawLines = useMemo(
    () => (data.code ?? "").replace(/\r/g, "").split("\n"),
    [data.code],
  );
  const tokens = useMemo(() => rawLines.map(tokenizeLine), [rawLines]);

  // Coerce highlights array. Tolerate the legacy `highlight_lines` shape so
  // the scene still renders against old DB rows.
  const highlights = useMemo<Highlight[]>(() => {
    if (data.highlights && data.highlights.length) {
      return data.highlights.filter(
        (h) => h.line_number >= 1 && h.line_number <= rawLines.length,
      );
    }
    return (data.highlight_lines || [])
      .filter((n) => n >= 1 && n <= rawLines.length)
      .map((n, i) => ({
        line_number: n,
        code: rawLines[n - 1] ?? "",
        emphasis: i === 0,
        punchline: i === 0,
      }));
  }, [data.highlights, data.highlight_lines, rawLines]);

  // Total scene duration in frames, identical math to the assembler.
  const sceneSeconds =
    (section.audio_duration_seconds ?? section.duration_seconds ?? 12) + 1.0;
  const sceneFrames = Math.round(sceneSeconds * fps);

  // Header timing
  const headerSpring = spring({ frame, fps, config: { damping: 20, stiffness: 130 } });
  const codeOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Map highlights to absolute start/end frames. Each highlight runs until
  // the next one starts, or until the scene ends.
  const highlightRanges = useMemo(() => {
    if (!highlights.length) return [];
    const startOffsetFrames = 30; // 1-second pause after the scene's header lands
    return highlights.map((h, i) => {
      const startSec = h.narration_start_seconds ?? i * 5.0;
      const startFrame = startOffsetFrames + Math.round(startSec * FPS);
      const nextStartSec =
        i + 1 < highlights.length
          ? highlights[i + 1].narration_start_seconds ?? (i + 1) * 5.0
          : sceneSeconds;
      const endFrame = startOffsetFrames + Math.round(nextStartSec * FPS);
      return { highlight: h, startFrame, endFrame };
    });
  }, [highlights, sceneSeconds]);

  // Find the currently-active highlight (last one whose start has passed).
  const activeRangeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < highlightRanges.length; i++) {
      if (frame >= highlightRanges[i].startFrame) idx = i;
    }
    return idx;
  }, [highlightRanges, frame]);
  const activeRange = activeRangeIndex >= 0 ? highlightRanges[activeRangeIndex] : null;
  const activeHighlight = activeRange?.highlight ?? null;
  const activeLineNumber = activeHighlight?.line_number ?? null;

  // Auto-scroll: keep the active line centred in the viewport.
  const targetLine = activeLineNumber ?? 1;
  const targetScrollTop = Math.max(0, (targetLine - Math.floor(VISIBLE_LINES / 2) - 1) * LINE_HEIGHT);
  const scrollSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  // Scroll is itself spring-interpolated toward target. Achieved by
  // remembering a per-frame value via interpolation between the previous
  // and current target — Remotion is stateless, so we approximate by
  // letting the latest target dominate over time.
  const scrollOffset = -targetScrollTop * scrollSpring;

  // Zoom on emphasis. When the active highlight has emphasis=true, the
  // editor panel scales to 1.18 centered on the active line, then settles
  // back when emphasis ends.
  const isEmphasis = !!activeHighlight?.emphasis;
  const emphasisSpring = spring({
    frame: activeRange ? frame - activeRange.startFrame : 0,
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const baseScale = isEmphasis ? 1.18 : 1.0;
  const panelScale = isEmphasis ? interpolate(emphasisSpring, [0, 1], [1.0, baseScale]) : baseScale;
  // Center the zoom on the line being highlighted.
  const viewportHeight = LINE_HEIGHT * VISIBLE_LINES;
  const lineYInViewport =
    activeLineNumber != null
      ? (activeLineNumber - 1) * LINE_HEIGHT + scrollOffset
      : viewportHeight / 2;
  const zoomOriginPct = Math.max(0, Math.min(100, (lineYInViewport / viewportHeight) * 100));

  // Type-on punchline. Find the punchline highlight; if it's currently
  // active, compute charsRevealed based on frame progression through its
  // window.
  const punchlineIndex = highlights.findIndex((h) => h.punchline);
  const punchlineRange = punchlineIndex >= 0 ? highlightRanges[punchlineIndex] : null;
  const punchlineActive = activeRangeIndex === punchlineIndex && punchlineRange != null;

  // For the punchline line specifically, compute how many chars are revealed.
  const punchlineCharsRevealed = punchlineRange
    ? Math.max(
        0,
        Math.min(
          (punchlineRange.highlight.code || "").length,
          Math.round(
            interpolate(
              frame,
              [punchlineRange.startFrame, punchlineRange.startFrame + 60],
              [0, (punchlineRange.highlight.code || "").length],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          ),
        ),
      )
    : 0;

  // Cross-reference panel
  const crossRef = activeHighlight?.cross_reference;
  const xrefStart = activeRange?.startFrame ?? 0;
  const xrefProgress = crossRef
    ? interpolate(frame, [xrefStart + 10, xrefStart + 30], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  // Left panel shrinks; right panel slides in.
  const leftPanelWidthPct = crossRef ? 50 + (1 - xrefProgress) * 50 : 100;

  const panelWidth = width - PANEL_INSET.left - PANEL_INSET.right;
  const panelHeight = height - PANEL_INSET.top - PANEL_INSET.bottom;

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <Particles count={18} seed={(data.path ?? "x").length * 13 + 11} speed={0.5} />
      <FocusGlow x={50} y={60} radius={62} intensity={0.06} />

      <CameraMove pan="right" intensity={0.35}>
        {/* Header */}
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: FONT_DISPLAY,
            opacity: headerSpring,
            transform: `translateY(${interpolate(headerSpring, [0, 1], [16, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 16,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COLORS.cyan,
            }}
          >
            Where the work lives
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: -1,
            }}
          >
            Code walkthrough
          </div>
        </div>

        {/* Editor panel container — pre-zoom so the chrome stays put while
            the inner content scales. */}
        <div
          style={{
            position: "absolute",
            left: PANEL_INSET.left,
            top: PANEL_INSET.top,
            width: panelWidth,
            height: panelHeight,
            display: "flex",
            opacity: codeOpacity,
            gap: 0,
          }}
        >
          {/* LEFT PANEL — the main file */}
          <div
            style={{
              width: `${leftPanelWidthPct}%`,
              height: "100%",
              background: "rgba(17,17,24,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18,
              boxShadow: `0 0 80px -32px ${COLORS.cyan}55`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              transition: "none",
            }}
          >
            <TitleBar path={data.path} />
            {/* Inner viewport — clips the scroll content. Scales for emphasis. */}
            <div
              style={{
                position: "relative",
                height: viewportHeight,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `scale(${panelScale})`,
                  transformOrigin: `50% ${zoomOriginPct}%`,
                }}
              >
                {/* The scrollable code surface. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: EDITOR_PAD_TOP + scrollOffset,
                    fontFamily: FONT_MONO,
                    fontSize: CODE_FONT_SIZE,
                    lineHeight: `${LINE_HEIGHT}px`,
                  }}
                >
                  {/* Highlight backplate */}
                  {activeLineNumber != null && (
                    <div
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        top: (activeLineNumber - 1) * LINE_HEIGHT - 2,
                        height: LINE_HEIGHT + 4,
                        background: `linear-gradient(90deg, ${COLORS.cyan}28, ${COLORS.cyan}14 60%, transparent)`,
                        borderLeft: `2px solid ${COLORS.cyan}`,
                        borderRadius: 6,
                        boxShadow: `0 0 32px -8px ${COLORS.cyan}66`,
                      }}
                    />
                  )}
                  {/* Wipe-in cyan underline */}
                  {activeRange && (
                    <div
                      style={{
                        position: "absolute",
                        left: EDITOR_PAD_LEFT + 8,
                        right: 12,
                        top:
                          (activeLineNumber! - 1) * LINE_HEIGHT +
                          LINE_HEIGHT -
                          1,
                        height: 2,
                        background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.cyan}88 80%, transparent)`,
                        transformOrigin: "left center",
                        transform: `scaleX(${interpolate(
                          frame,
                          [activeRange.startFrame, activeRange.startFrame + 12],
                          [0, 1],
                          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                        )})`,
                        boxShadow: `0 0 12px ${COLORS.cyan}`,
                      }}
                    />
                  )}

                  {/* Lines */}
                  {tokens.map((lineTokens, index) => {
                    const lineNum = index + 1;
                    const isCurrent = lineNum === activeLineNumber;
                    const isPunchlineLine =
                      punchlineRange?.highlight.line_number === lineNum;
                    const dim =
                      activeLineNumber != null && !isCurrent ? 0.35 : 1;
                    const lift = isCurrent ? 1.015 : 1;

                    // Punchline type-on: render code substring up to chars
                    // revealed. Other lines render normally.
                    let lineContent: React.ReactNode;
                    if (isPunchlineLine && punchlineActive) {
                      const fullLine = punchlineRange.highlight.code || "";
                      const visible = fullLine.slice(0, punchlineCharsRevealed);
                      lineContent = (
                        <span style={{ whiteSpace: "pre" }}>
                          {tokenizeLine(visible).map((t, ti) => (
                            <span key={ti} style={{ color: PALETTE[t.kind] }}>
                              {t.text}
                            </span>
                          ))}
                          {punchlineCharsRevealed < fullLine.length && (
                            <span
                              style={{
                                display: "inline-block",
                                width: "0.55ch",
                                background: COLORS.cyan,
                                marginLeft: "0.05ch",
                              }}
                            />
                          )}
                        </span>
                      );
                    } else if (isPunchlineLine && !punchlineActive) {
                      // Punchline line is empty until its moment arrives.
                      const elapsed = punchlineRange
                        ? frame >= punchlineRange.startFrame
                        : false;
                      if (!elapsed) {
                        lineContent = (
                          <span style={{ color: "rgba(255,255,255,0.15)" }}>
                            {/* placeholder underline */}
                            ─────────────────
                          </span>
                        );
                      } else {
                        // Punchline already passed — show fully.
                        lineContent = lineTokens.map((t, ti) => (
                          <span key={ti} style={{ color: PALETTE[t.kind] }}>
                            {t.text}
                          </span>
                        ));
                      }
                    } else {
                      lineContent = lineTokens.map((t, ti) => (
                        <span key={ti} style={{ color: PALETTE[t.kind] }}>
                          {t.text}
                        </span>
                      ));
                    }

                    return (
                      <div
                        key={index}
                        style={{
                          opacity: dim,
                          transform: `translateX(0px) scale(${lift})`,
                          transformOrigin: "left center",
                          position: "relative",
                          whiteSpace: "pre",
                          height: LINE_HEIGHT,
                          paddingLeft: EDITOR_PAD_LEFT,
                          filter: isCurrent
                            ? `drop-shadow(0 2px 8px ${COLORS.cyan}33)`
                            : undefined,
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            width: 44,
                            color: isCurrent ? COLORS.cyan : PALETTE.comment,
                            userSelect: "none",
                            textAlign: "right",
                            paddingRight: 14,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {lineNum.toString().padStart(2, "0")}
                        </span>
                        {lineContent}
                      </div>
                    );
                  })}

                  {rawLines.length === 0 && (
                    <div
                      style={{
                        padding: "40px 0",
                        color: "rgba(245,245,240,0.5)",
                        fontStyle: "italic",
                        fontFamily: FONT_BODY,
                      }}
                    >
                      // No source excerpt available for this repo
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — cross-reference target file */}
          {crossRef && xrefProgress > 0.02 && (
            <div
              style={{
                width: `${100 - leftPanelWidthPct}%`,
                height: "100%",
                marginLeft: 16,
                background: "rgba(17,17,24,0.85)",
                border: "1px solid rgba(0,240,255,0.30)",
                borderRadius: 18,
                boxShadow: `0 0 80px -32px ${COLORS.cyan}77`,
                overflow: "hidden",
                opacity: xrefProgress,
                transform: `translateX(${interpolate(xrefProgress, [0, 1], [40, 0])}px)`,
                flexShrink: 0,
              }}
            >
              <TitleBar path={crossRef.to_file} accent />
              <div
                style={{
                  padding: "20px 24px",
                  fontFamily: FONT_MONO,
                  fontSize: 15,
                  color: PALETTE.ident,
                  lineHeight: 1.55,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontStyle: "italic",
                    color: COLORS.cyan,
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  defined in {crossRef.to_file}
                </div>
                <div
                  style={{
                    background: "rgba(0,240,255,0.04)",
                    border: "1px solid rgba(0,240,255,0.18)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: PALETTE.ident,
                  }}
                >
                  <span style={{ color: PALETTE.keyword }}>function</span>{" "}
                  <span style={{ color: COLORS.cyan }}>
                    {crossRef.to_definition || "definition"}
                  </span>
                  <span style={{ color: PALETTE.ident }}>() {"{"}</span>
                  <div style={{ color: PALETTE.comment, paddingLeft: 18 }}>
                    // line {crossRef.to_line ?? "?"} —{" "}
                    {crossRef.to_file.split("/").pop()}
                  </div>
                  <span style={{ color: PALETTE.ident }}>{"}"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Annotation with curved connector arrow. Renders outside the
            editor panel so it can extend into the right margin. */}
        {activeHighlight?.annotation && activeRange && (
          <Annotation
            text={activeHighlight.annotation}
            startFrame={activeRange.startFrame}
            endFrame={activeRange.endFrame}
            lineY={
              PANEL_INSET.top +
              TITLE_BAR_HEIGHT +
              EDITOR_PAD_TOP +
              (activeLineNumber! - 1) * LINE_HEIGHT +
              scrollOffset +
              LINE_HEIGHT / 2
            }
            panelRightEdge={PANEL_INSET.left + (panelWidth * leftPanelWidthPct) / 100}
            compWidth={width}
          />
        )}
      </CameraMove>

      <Watermark />
    </AbsoluteFill>
  );
};

/** Editor title bar — file path + macOS-style window dots. */
const TitleBar: React.FC<{ path?: string; accent?: boolean }> = ({ path, accent }) => (
  <div
    style={{
      height: TITLE_BAR_HEIGHT,
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 14,
      borderBottom: `1px solid ${
        accent ? "rgba(0,240,255,0.20)" : "rgba(255,255,255,0.06)"
      }`,
      background: accent
        ? "rgba(0,240,255,0.04)"
        : "rgba(0,0,0,0.25)",
    }}
  >
    <div style={{ display: "flex", gap: 8 }}>
      <Dot color="#FF5F57" />
      <Dot color="#FEBC2E" />
      <Dot color="#28C840" />
    </div>
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 13,
        color: accent ? COLORS.cyan : "rgba(245,245,240,0.55)",
        letterSpacing: 0.4,
      }}
    >
      {path || "—"}
    </div>
  </div>
);

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: color,
      boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
    }}
  />
);

/** Floating annotation with a curved SVG path back to the highlighted line. */
const Annotation: React.FC<{
  text: string;
  startFrame: number;
  endFrame: number;
  lineY: number;
  panelRightEdge: number;
  compWidth: number;
}> = ({ text, startFrame, endFrame, lineY, panelRightEdge, compWidth }) => {
  const frame = useCurrentFrame();
  // Fade in over 9 frames (~300ms), hold, fade out over 21 frames (~700ms).
  const fadeOutStart = endFrame - 21;
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 9, fadeOutStart, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (opacity <= 0.01) return null;

  // Annotation card position: right of the panel, vertically centred on the
  // highlighted line. minWidth keeps short text from collapsing into a
  // single narrow column; maxWidth caps long text at a readable 2-3 line
  // block.
  const CARD_MIN_WIDTH = 200;
  const CARD_MAX_WIDTH = 300;
  const cardLeft = panelRightEdge + 36;
  const cardWidth = Math.max(
    CARD_MIN_WIDTH,
    Math.min(CARD_MAX_WIDTH, compWidth - cardLeft - 60),
  );
  const cardTop = lineY - 26;

  // Path origin (right edge of the panel, at line y) → card centre-left.
  // Drawn as a quadratic Bezier with a single control point pulled toward
  // the midpoint, giving a graceful curve instead of a straight line.
  const pathStartX = panelRightEdge - 2;
  const pathStartY = lineY;
  const pathEndX = cardLeft + 4;
  const pathEndY = cardTop + 28;
  const ctrlX = (pathStartX + pathEndX) / 2;
  const ctrlY = (pathStartY + pathEndY) / 2 + 8;

  return (
    <>
      <svg
        width={compWidth}
        height={1080}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          opacity,
        }}
      >
        <path
          d={`M ${pathStartX} ${pathStartY} Q ${ctrlX} ${ctrlY}, ${pathEndX} ${pathEndY}`}
          stroke={COLORS.cyan}
          strokeWidth={1.25}
          fill="none"
          strokeOpacity={0.7}
        />
        <circle cx={pathStartX} cy={pathStartY} r={3} fill={COLORS.cyan} />
        <circle cx={pathEndX} cy={pathEndY} r={3} fill={COLORS.cyan} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: cardLeft,
          top: cardTop,
          width: cardWidth,
          minWidth: CARD_MIN_WIDTH,
          maxWidth: CARD_MAX_WIDTH,
          padding: "14px 18px",
          fontFamily: FONT_BODY,
          fontStyle: "italic",
          fontSize: 18,
          color: COLORS.text,
          background: "rgba(20,20,28,0.94)",
          border: `1px solid ${COLORS.cyan}55`,
          borderRadius: 12,
          boxShadow: `0 8px 32px -8px ${COLORS.cyan}33`,
          opacity,
          // wrap on natural word boundaries — 2-3 lines for a 6-10 word annotation
          wordBreak: "normal",
          overflowWrap: "normal",
          lineHeight: 1.35,
        }}
      >
        {text}
      </div>
    </>
  );
};
