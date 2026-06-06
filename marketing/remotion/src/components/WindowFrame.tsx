import React from "react";
import { palette } from "../theme/tokens";

type Props = {
  width: number | string;
  height: number | string;
  title?: string;
  children: React.ReactNode;
  variant?: "explorer" | "session";
  style?: React.CSSProperties;
};

export const WindowFrame: React.FC<Props> = ({
  width,
  height,
  title,
  children,
  variant = "explorer",
  style,
}) => {
  const headerBg =
    variant === "session" ? palette.folderYellow : palette.cream;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 22,
        overflow: "hidden",
        background: palette.panel,
        boxShadow: `0 30px 60px ${palette.shadowDeep}, 0 8px 22px ${palette.shadowMid}`,
        border: `1px solid ${palette.panelEdge}`,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: 56,
          background: headerBg,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 12,
          borderBottom: `1px solid ${palette.panelEdge}`,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#FF5F57",
          }}
        />
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#FEBC2E",
          }}
        />
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#28C840",
          }}
        />
        {title ? (
          <span
            style={{
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: 18,
              fontWeight: 600,
              color: palette.ink,
              opacity: 0.65,
            }}
          >
            {title}
          </span>
        ) : null}
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};
