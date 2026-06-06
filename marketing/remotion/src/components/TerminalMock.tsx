import React from "react";
import { palette, fontFamily } from "../theme/tokens";

type Line = {
  who: "user" | "ai";
  text: string;
};

type Props = {
  width: number | string;
  height: number | string;
  lines: Line[];
  caret?: boolean;
  style?: React.CSSProperties;
};

export const TerminalMock: React.FC<Props> = ({
  width,
  height,
  lines,
  caret = true,
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: palette.terminalBg,
        color: palette.terminalText,
        borderRadius: 18,
        padding: "28px 32px",
        fontFamily: fontFamily.mono,
        fontSize: 22,
        lineHeight: 1.55,
        boxShadow: `0 24px 48px ${palette.shadowDeep}`,
        boxSizing: "border-box",
        overflow: "hidden",
        ...style,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            color: line.who === "user" ? "#FFD874" : palette.terminalText,
            marginBottom: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          {line.who === "user" ? (
            <>
              <span style={{ color: palette.teal }}>{"> "}</span>
              {line.text}
            </>
          ) : (
            line.text
          )}
        </div>
      ))}
      {caret ? (
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 22,
            background: palette.teal,
            verticalAlign: "middle",
            marginLeft: 4,
          }}
        />
      ) : null}
    </div>
  );
};
