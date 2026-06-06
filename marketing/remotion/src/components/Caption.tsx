import React from "react";
import { palette, fontFamily } from "../theme/tokens";

type Props = {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "ink" | "soft" | "white";
  align?: "left" | "center";
  weight?: number;
  maxWidth?: number | string;
  style?: React.CSSProperties;
};

const sizeMap = {
  sm: 28,
  md: 44,
  lg: 64,
  xl: 92,
};

export const Caption: React.FC<Props> = ({
  children,
  size = "md",
  tone = "ink",
  align = "center",
  weight = 700,
  maxWidth,
  style,
}) => {
  const color =
    tone === "white"
      ? "#FFFFFF"
      : tone === "soft"
      ? palette.inkSoft
      : palette.ink;
  return (
    <div
      style={{
        fontFamily: fontFamily.display,
        fontSize: sizeMap[size],
        color,
        fontWeight: weight,
        textAlign: align,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        maxWidth,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
