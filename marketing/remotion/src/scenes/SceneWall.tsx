import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Caption } from "../components/Caption";
import { TerminalMock } from "../components/TerminalMock";
import { fontFamily } from "../theme/tokens";

const TERMINAL_LINES = [
  { who: "user" as const, text: "npm install -g @anthropic-ai/claude-code" },
  { who: "ai" as const, text: "npm ERR! code EACCES" },
  { who: "user" as const, text: "sudo chmod +x ./claude" },
  {
    who: "ai" as const,
    text: "bash: cd: ~/Projects/my-app: No such file or directory",
  },
  { who: "user" as const, text: 'export PATH="$HOME/.local/bin:$PATH"' },
  { who: "ai" as const, text: "gyp ERR! stack Error: Cannot find module" },
];

const GLYPH_CHARS = "0123456789abcdef:/-";
const GLYPH_ROWS = 6;
const GLYPH_COLS = 30;

// Deterministic glyph grid — stable across renders without relying on
// Math.random at frame time.
const buildGlyphGrid = (): string[] => {
  const rows: string[] = [];
  for (let r = 0; r < GLYPH_ROWS; r += 1) {
    let row = "";
    for (let c = 0; c < GLYPH_COLS; c += 1) {
      const seed = (r * 131 + c * 17 + 7) % GLYPH_CHARS.length;
      const idx = (seed * 31 + r * 5 + c * 3) % GLYPH_CHARS.length;
      row += GLYPH_CHARS[idx];
      row += "  ";
    }
    rows.push(row);
  }
  return rows;
};

const GLYPH_GRID = buildGlyphGrid();

const ScaryGlyphs: React.FC<{ opacity: number }> = ({ opacity }) => {
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: fontFamily.mono,
    fontSize: 28,
    color: "rgba(120, 220, 140, 0.08)",
    opacity,
    pointerEvents: "none",
    userSelect: "none",
    letterSpacing: "0.04em",
    lineHeight: 1.6,
  };
  return (
    <div style={wrapperStyle}>
      {GLYPH_GRID.map((row, i) => (
        <div key={i} style={{ whiteSpace: "pre" }}>
          {row}
        </div>
      ))}
    </div>
  );
};

export const SceneWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frames 0..30: full black fade-in.
  const bgFade = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scary glyphs fade in slightly behind the bg.
  const glyphFade = interpolate(frame, [10, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline slides up into the upper third, frames 30..120.
  const headlineProgress = interpolate(frame, [30, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(headlineProgress, [0, 1], [80, 0]);
  const headlineOpacity = interpolate(
    headlineProgress,
    [0, 0.4, 1],
    [0, 0.7, 1]
  );

  // Terminal: spring zoom-in starting at frame 90.
  const terminalSpring = spring({
    frame: frame - 90,
    fps,
    config: { damping: 14, mass: 0.8 },
  });
  const terminalScale = interpolate(terminalSpring, [0, 1], [0.6, 1]);
  const terminalOpacity = interpolate(frame, [90, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle shake + sideways drift between frames 240..330.
  const shakeActive = frame >= 240 && frame <= 330;
  const shakeX = shakeActive ? Math.sin(frame * 0.6) * 4 : 0;
  const driftX = interpolate(frame, [240, 330], [0, -36], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Second caption: "But this scares you off?", frames 180..270.
  const secondProgress = interpolate(frame, [180, 270], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondY = interpolate(secondProgress, [0, 1], [60, 0]);
  const secondOpacity = interpolate(secondProgress, [0, 0.4, 1], [0, 0.6, 1]);

  // Final empathetic caption: frames 300..359.
  const finalProgress = interpolate(frame, [300, 359], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalY = interpolate(finalProgress, [0, 1], [40, 0]);
  const finalOpacity = interpolate(finalProgress, [0, 0.5, 1], [0, 0.6, 1]);

  const rootStyle: React.CSSProperties = {
    background: "#0A0D11",
  };

  // A pure black overlay that fades away in the first second to deliver a
  // true black fade-in over the dark base.
  const blackOverlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "#000000",
    opacity: 1 - bgFade,
    pointerEvents: "none",
  };

  const headlineWrap: React.CSSProperties = {
    position: "absolute",
    top: 160,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    transform: `translateY(${headlineY}px)`,
    opacity: headlineOpacity,
  };

  const terminalWrap: React.CSSProperties = {
    position: "absolute",
    top: 360,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    transform: `translate(${shakeX + driftX}px, 0) scale(${terminalScale})`,
    opacity: terminalOpacity,
  };

  const secondCaptionWrap: React.CSSProperties = {
    position: "absolute",
    top: 940,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    transform: `translateY(${secondY}px)`,
    opacity: secondOpacity,
  };

  const finalCaptionWrap: React.CSSProperties = {
    position: "absolute",
    top: 1030,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    transform: `translateY(${finalY}px)`,
    opacity: finalOpacity,
  };

  return (
    <AbsoluteFill style={rootStyle}>
      <ScaryGlyphs opacity={glyphFade} />
      <div style={blackOverlayStyle} />
      <div style={headlineWrap}>
        <Caption size="xl" tone="white">
          Want to build apps?
        </Caption>
      </div>
      <div style={terminalWrap}>
        <TerminalMock
          width={1200}
          height={520}
          lines={TERMINAL_LINES}
          caret={true}
        />
      </div>
      <div style={secondCaptionWrap}>
        <Caption size="lg" tone="white">
          But this scares you off?
        </Caption>
      </div>
      <div style={finalCaptionWrap}>
        <Caption size="md" tone="soft">
          Yeah. Most people give up here.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};
