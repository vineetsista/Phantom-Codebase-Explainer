import React from "react";
import { AbsoluteFill } from "remotion";

import { COLORS } from "../types";

export const BackgroundGrid: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            `linear-gradient(${COLORS.grid} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.grid} 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 20% -10%, rgba(0,240,255,0.15), transparent 50%), radial-gradient(ellipse at 80% 110%, rgba(123,97,255,0.18), transparent 50%)",
        }}
      />
    </AbsoluteFill>
  );
};
