import React from "react";

import { FONT_MONO } from "../loadFonts";
import { COLORS } from "../types";

export const Watermark: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        right: 36,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid rgba(255,255,255,0.12)`,
        background: "rgba(10,10,11,0.6)",
        backdropFilter: "blur(8px)",
        color: COLORS.text,
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: 3,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 4,
          background: COLORS.cyan,
          boxShadow: `0 0 12px ${COLORS.cyan}`,
        }}
      />
      Phantom · RepoX
    </div>
  );
};
