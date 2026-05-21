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

interface FileSummary {
  path: string;
  language?: string;
  bytes?: number;
}

interface CodeData {
  files?: FileSummary[];
  code?: string;
  path?: string;
  language?: string;
  highlight_lines?: number[];
}

const LINE_HEIGHT = 30;
const CODE_FONT_SIZE = 19;
const MAX_VISIBLE_LINES = 18;

const PALETTE = {
  keyword: "#7B61FF",
  string: "#34D399",
  number: "#F59E0B",
  comment: "#6B6B78",
  symbol: COLORS.cyan,
  ident: COLORS.text,
};

const KEYWORDS = new Set([
  // shared across most languages we touch
  "import", "from", "as", "export", "default", "return", "if", "else",
  "for", "while", "in", "of", "let", "const", "var", "function", "async",
  "await", "class", "extends", "new", "this", "self", "true", "false",
  "null", "None", "True", "False", "def", "lambda", "yield", "raise",
  "try", "except", "finally", "with", "pass", "and", "or", "not",
  "interface", "type", "enum", "public", "private", "static", "void",
  "int", "str", "bool", "float", "list", "dict", "tuple", "set",
  "fn", "let", "mut", "pub", "use", "mod", "impl", "trait", "struct",
  "func", "package", "go", "chan", "map", "switch", "case",
]);

type Tok = { text: string; kind: keyof typeof PALETTE };

function tokenizeLine(line: string): Tok[] {
  // Comment fast-path: rest of the line after #, //, --, etc.
  const commentMatch = line.match(/^(\s*)(#|\/\/|--)(.*)$/);
  if (commentMatch) {
    return [
      { text: commentMatch[1], kind: "ident" },
      { text: commentMatch[2] + commentMatch[3], kind: "comment" },
    ];
  }

  const tokens: Tok[] = [];
  // Regex order matters: strings → numbers → identifiers/keywords → other
  const pattern =
    /(\s+)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z0-9_\s])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    const [whole, ws, str, num, ident, sym] = match;
    if (ws) {
      tokens.push({ text: whole, kind: "ident" });
    } else if (str) {
      tokens.push({ text: whole, kind: "string" });
    } else if (num) {
      tokens.push({ text: whole, kind: "number" });
    } else if (ident) {
      tokens.push({ text: whole, kind: KEYWORDS.has(ident) ? "keyword" : "ident" });
    } else if (sym) {
      tokens.push({ text: whole, kind: "symbol" });
    }
  }
  return tokens;
}

export const CodeWalkthroughScene: React.FC<{ section: ScriptSection }> = ({ section }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = (section.visuals?.data as CodeData) ?? {};
  const lines = useMemo(() => (data.code ?? "").split("\n").slice(0, MAX_VISIBLE_LINES), [data.code]);
  const tokens = useMemo(() => lines.map(tokenizeLine), [lines]);
  const highlights = (data.highlight_lines ?? []).filter(
    (n) => n >= 1 && n <= lines.length,
  );

  // The SCENE's frame budget = real audio length (set by the worker's
  // ffprobe pass) + 1.0s trailing buffer. Falls back to duration_seconds
  // for preview renders without props. Keep this in sync with
  // SCENE_TRAILING_BUFFER_S in types.ts.
  const sceneSeconds =
    (section.audio_duration_seconds ?? section.duration_seconds ?? 12) + 1.0;
  const sceneFrames = Math.round(sceneSeconds * fps);

  // Header springs in first
  const headerSpring = spring({ frame, fps, config: { damping: 20, stiffness: 130 } });

  // Code container fades in after 8 frames
  const codeOpacity = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });

  // Per-line type-on reveal
  const linesRevealedAt = (index: number) => 18 + index * 3;

  // Highlight box position — picks the next highlight line based on frame.
  // Timing is now derived from THIS SCENE's frame budget, not the whole
  // composition (the previous version pulled durationInFrames from
  // useVideoConfig which returns the entire video's duration — that made
  // early scenes hold each highlight for far too long).
  const activeHighlight = useMemo(() => {
    if (highlights.length === 0) return null;
    const startFrame = 60;
    const tail = Math.round(1.0 * FPS); // leave the trailing buffer empty
    const perHighlight = Math.max(
      30,
      Math.floor((sceneFrames - startFrame - tail) / highlights.length),
    );
    if (frame < startFrame) return null;
    const slot = Math.min(
      highlights.length - 1,
      Math.floor((frame - startFrame) / perHighlight),
    );
    const localFrame = (frame - startFrame) % perHighlight;
    const eased = interpolate(localFrame, [0, 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { lineNumber: highlights[slot], appear: eased };
  }, [highlights, frame, sceneFrames]);

  return (
    <AbsoluteFill>
      <BackgroundGrid />
      <Particles count={18} seed={(data.path ?? "x").length * 13 + 11} speed={0.5} />
      <FocusGlow x={50} y={60} radius={62} intensity={0.06} />

      <CameraMove pan="right" intensity={0.5}>
      <div
        style={{
          position: "absolute",
          top: 80,
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
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.cyan,
          }}
        >
          Where the work lives
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 58,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: -1,
          }}
        >
          Code walkthrough
        </div>
        {data.path && (
          <div
            style={{
              marginTop: 12,
              fontFamily: FONT_MONO,
              fontSize: 22,
              color: "rgba(245,245,240,0.55)",
            }}
          >
            {data.path}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          inset: "320px 160px 160px",
          fontFamily: FONT_MONO,
          fontSize: CODE_FONT_SIZE,
          lineHeight: `${LINE_HEIGHT}px`,
          color: COLORS.text,
          background: "rgba(17,17,24,0.78)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          padding: "28px 36px",
          overflow: "hidden",
          opacity: codeOpacity,
          boxShadow: `0 0 80px -32px ${COLORS.cyan}55`,
        }}
      >
        {/* Highlight backplate — sits behind the line text. Position is
            recomputed each frame, no CSS transition (Remotion CSS transitions
            don't render). */}
        {activeHighlight && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 28 + (activeHighlight.lineNumber - 1) * LINE_HEIGHT - 2,
              height: LINE_HEIGHT + 4,
              background: `linear-gradient(90deg, ${COLORS.cyan}28, ${COLORS.cyan}14 60%, transparent)`,
              borderLeft: `2px solid ${COLORS.cyan}`,
              borderRadius: 6,
              opacity: activeHighlight.appear,
              boxShadow: `0 0 32px -8px ${COLORS.cyan}66`,
            }}
          />
        )}
        {/* Wipe-in underline — sweeps left-to-right over ~10 frames at the
            start of each highlight, then stays. */}
        {activeHighlight && (
          <div
            style={{
              position: "absolute",
              left: 56,
              right: 12,
              top: 28 + (activeHighlight.lineNumber - 1) * LINE_HEIGHT + LINE_HEIGHT - 1,
              height: 2,
              background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.cyan}88 80%, transparent)`,
              opacity: activeHighlight.appear,
              transformOrigin: "left center",
              transform: `scaleX(${activeHighlight.appear})`,
              boxShadow: `0 0 12px ${COLORS.cyan}`,
            }}
          />
        )}

        {tokens.map((lineTokens, index) => {
          const start = linesRevealedAt(index);
          const baseOpacity = interpolate(frame, [start, start + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const slide = interpolate(frame, [start, start + 10], [-6, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // When a highlight is active, dim every OTHER line to 35% so the
          // viewer's eye is pulled to the line the narrator is on. The
          // highlighted line also lifts forward in z with a small drop
          // shadow, so it reads as physically closer to the camera.
          const isHighlighted =
            activeHighlight && activeHighlight.lineNumber === index + 1;
          const dim = activeHighlight && !isHighlighted ? 0.35 : 1;
          const opacity = baseOpacity * dim;
          const lift = isHighlighted ? 1.015 : 1;
          return (
            <div
              key={index}
              style={{
                opacity,
                transform: `translateX(${slide}px) scale(${lift})`,
                transformOrigin: "left center",
                position: "relative",
                whiteSpace: "pre",
                filter: isHighlighted ? `drop-shadow(0 2px 8px ${COLORS.cyan}33)` : undefined,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 44,
                  color: isHighlighted ? COLORS.cyan : PALETTE.comment,
                  userSelect: "none",
                  textAlign: "right",
                  paddingRight: 14,
                }}
              >
                {(index + 1).toString().padStart(2, "0")}
              </span>
              {lineTokens.map((tok, ti) => (
                <span key={ti} style={{ color: PALETTE[tok.kind] }}>
                  {tok.text}
                </span>
              ))}
            </div>
          );
        })}

        {lines.length === 0 && (
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

      </CameraMove>
      <Watermark />
    </AbsoluteFill>
  );
};
