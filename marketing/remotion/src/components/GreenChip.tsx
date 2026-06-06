import React from "react";
import { palette, fontFamily } from "../theme/tokens";

type Props = {
  count?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
};

export const GreenChip: React.FC<Props> = ({
  count = 1,
  label = "feature added today",
  size = "md",
}) => {
  const scale = size === "lg" ? 1.4 : size === "sm" ? 0.75 : 1;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * scale,
        padding: `${14 * scale}px ${22 * scale}px`,
        background: `linear-gradient(135deg, ${palette.green}, ${palette.greenDeep})`,
        color: "white",
        borderRadius: 999,
        boxShadow: `0 12px 28px rgba(31,158,66,0.35), inset 0 1px 0 rgba(255,255,255,0.3)`,
        fontFamily: fontFamily.display,
        fontWeight: 700,
        fontSize: 26 * scale,
        letterSpacing: "-0.01em",
      }}
    >
      <span
        style={{
          width: 36 * scale,
          height: 36 * scale,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22 * scale,
          fontWeight: 800,
        }}
      >
        ✓
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 * scale }}>
        <span style={{ fontWeight: 800 }}>+{count}</span>
        <span style={{ fontWeight: 500, opacity: 0.95 }}>{label}</span>
      </span>
    </div>
  );
};
