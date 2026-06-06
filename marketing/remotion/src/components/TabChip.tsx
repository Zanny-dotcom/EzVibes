import React from "react";
import { palette, fontFamily } from "../theme/tokens";

type Props = {
  label: string;
  active?: boolean;
  variant?: "claude" | "codex";
};

export const TabChip: React.FC<Props> = ({
  label,
  active = false,
  variant = "claude",
}) => {
  const base = variant === "codex" ? palette.teal : palette.amber;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        background: active
          ? base
          : `${base}33`,
        color: active ? "white" : palette.ink,
        fontFamily: fontFamily.display,
        fontSize: 18,
        fontWeight: 700,
        borderRadius: 12,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: active
          ? `0 6px 14px rgba(201,122,0,0.35)`
          : "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "white" : base,
        }}
      />
      {label}
    </div>
  );
};
