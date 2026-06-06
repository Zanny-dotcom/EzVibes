import React from "react";
import { palette } from "../theme/tokens";

type Props = {
  size?: number;
  label?: string;
  glow?: boolean;
  state?: "default" | "active" | "minimized";
  rotation?: number;
  showLabel?: boolean;
};

export const FolderIcon: React.FC<Props> = ({
  size = 200,
  label,
  glow = false,
  state = "default",
  rotation = 0,
  showLabel = true,
}) => {
  const tabH = size * 0.18;
  const bodyH = size * 0.72;
  const width = size;
  const tabW = size * 0.42;

  const fill =
    state === "minimized"
      ? palette.amber
      : state === "active"
      ? "#F8D85C"
      : palette.folderYellow;

  const deep =
    state === "minimized" ? palette.amberDeep : palette.folderYellowDeep;

  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `rotate(${rotation}deg)`,
        filter: glow
          ? `drop-shadow(0 0 28px rgba(244,196,48,0.55)) drop-shadow(0 18px 28px ${palette.shadowMid})`
          : `drop-shadow(0 12px 22px ${palette.shadowMid})`,
        transition: "filter 200ms ease",
      }}
    >
      <svg
        width={width}
        height={tabH + bodyH}
        viewBox={`0 0 ${width} ${tabH + bodyH}`}
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={`grad-${size}-${state}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor={deep} />
          </linearGradient>
        </defs>
        <path
          d={`M 0 ${tabH * 0.4}
              Q 0 0 ${tabH * 0.4} 0
              L ${tabW - tabH * 0.4} 0
              Q ${tabW} 0 ${tabW + tabH * 0.3} ${tabH * 0.6}
              L ${tabW + tabH * 0.6} ${tabH}
              L ${width} ${tabH}
              L ${width} ${tabH + bodyH - tabH * 0.3}
              Q ${width} ${tabH + bodyH} ${width - tabH * 0.4} ${tabH + bodyH}
              L ${tabH * 0.4} ${tabH + bodyH}
              Q 0 ${tabH + bodyH} 0 ${tabH + bodyH - tabH * 0.3}
              Z`}
          fill={`url(#grad-${size}-${state})`}
          stroke={palette.folderShadow}
          strokeWidth={Math.max(1, size * 0.008)}
          strokeOpacity={0.35}
        />
        <rect
          x={size * 0.08}
          y={tabH + bodyH * 0.18}
          width={width - size * 0.16}
          height={bodyH * 0.08}
          rx={bodyH * 0.04}
          fill="white"
          opacity={0.25}
        />
      </svg>
      {showLabel && label ? (
        <div
          style={{
            marginTop: size * 0.08,
            fontSize: size * 0.105,
            fontWeight: 600,
            color: palette.ink,
            letterSpacing: "-0.01em",
            textAlign: "center",
            maxWidth: width * 1.25,
            lineHeight: 1.15,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
