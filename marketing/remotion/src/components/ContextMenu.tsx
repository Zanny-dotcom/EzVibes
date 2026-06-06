import React from "react";
import { palette, fontFamily } from "../theme/tokens";

type Item = {
  label: string;
  highlight?: boolean;
  emoji?: string;
};

type Props = {
  items: Item[];
  width?: number;
  style?: React.CSSProperties;
};

export const ContextMenu: React.FC<Props> = ({
  items,
  width = 280,
  style,
}) => {
  return (
    <div
      style={{
        width,
        background: palette.panel,
        borderRadius: 14,
        border: `1px solid ${palette.panelEdge}`,
        boxShadow: `0 22px 44px ${palette.shadowDeep}`,
        overflow: "hidden",
        fontFamily: fontFamily.display,
        ...style,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "13px 18px",
            fontSize: 19,
            fontWeight: item.highlight ? 700 : 500,
            color: palette.ink,
            background: item.highlight ? palette.folderYellow : "transparent",
            borderBottom:
              i < items.length - 1 ? `1px solid ${palette.panelEdge}` : "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {item.emoji ? <span style={{ fontSize: 22 }}>{item.emoji}</span> : null}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};
