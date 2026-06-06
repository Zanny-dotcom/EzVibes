import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { Cursor } from "../components/Cursor";
import { FolderIcon } from "../components/FolderIcon";
import { WindowFrame } from "../components/WindowFrame";
import { palette, fontFamily } from "../theme/tokens";

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

const WINDOW_WIDTH = 1640;
const WINDOW_HEIGHT = 920;
const WINDOW_TOP = 140;
const WINDOW_LEFT = (CANVAS_WIDTH - WINDOW_WIDTH) / 2;

const FOLDER_LABELS: ReadonlyArray<string> = [
  "Birthday card for mom",
  "Mom's website",
  "Recipe book",
  "Wedding plans",
  "Game ideas",
  "Etsy shop",
  "Travel blog",
  "Workout tracker",
  "Book club site",
  "Photo gallery",
  "Letterbox app",
  "Pet care log",
];

const FOLDER_SIZE = 170;
const GRID_COLUMNS = 4;
const GRID_COL_GAP = 60;
const GRID_ROW_GAP = 30;
const GRID_PADDING_X = 60;
const GRID_PADDING_TOP = 28;
const COMMAND_BAR_HEIGHT = 78;
const WINDOW_HEADER_HEIGHT = 56;

type CommandPillProps = {
  label: string;
  background: string;
  color: string;
  fontSize: number;
};

const CommandPill: React.FC<CommandPillProps> = ({
  label,
  background,
  color,
  fontSize,
}) => (
  <div
    style={{
      background,
      color,
      borderRadius: 999,
      padding: "10px 18px",
      fontFamily: fontFamily.display,
      fontSize,
      fontWeight: 700,
      letterSpacing: "-0.01em",
      boxShadow: `0 4px 10px ${palette.shadowSoft}`,
      whiteSpace: "nowrap",
      border: `1px solid ${palette.panelEdge}`,
    }}
  >
    {label}
  </div>
);

export const SceneReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window slides up from off-screen-bottom into place (0..60).
  const windowProgress = spring({
    frame,
    fps,
    durationInFrames: 60,
    config: { damping: 18, mass: 1, stiffness: 110 },
  });
  const windowTranslateY = interpolate(
    windowProgress,
    [0, 1],
    [CANVAS_HEIGHT, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Big caption above the window (240..360).
  const captionProgress = spring({
    frame: frame - 240,
    fps,
    durationInFrames: 30,
    config: { damping: 16, mass: 1, stiffness: 120 },
  });
  const captionOpacity = interpolate(captionProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionTranslateY = interpolate(captionProgress, [0, 1], [-18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subcaption (300..389).
  const subProgress = spring({
    frame: frame - 300,
    fps,
    durationInFrames: 30,
    config: { damping: 18, mass: 1, stiffness: 110 },
  });
  const subOpacity = interpolate(subProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursor drift (330..389). It travels from the right edge to folder #0.
  const cursorVisible = frame >= 330;
  const cursorT = interpolate(frame, [330, 389], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Resolve folder #0 screen-space position so the cursor lands beside it.
  const innerLeft = WINDOW_LEFT;
  const innerTop = WINDOW_TOP + WINDOW_HEADER_HEIGHT;
  const gridLeft = innerLeft + GRID_PADDING_X;
  const gridTop = innerTop + COMMAND_BAR_HEIGHT + GRID_PADDING_TOP;
  // Center the grid horizontally inside its container so account for that:
  // we use justifyContent center, so compute the actual first-cell origin.
  const gridContentWidth =
    GRID_COLUMNS * FOLDER_SIZE + (GRID_COLUMNS - 1) * GRID_COL_GAP;
  const innerContentWidth = WINDOW_WIDTH - GRID_PADDING_X * 2;
  const gridOffsetX = (innerContentWidth - gridContentWidth) / 2;
  const folder0CenterX = gridLeft + gridOffsetX + FOLDER_SIZE / 2;
  const folder0CenterY = gridTop + FOLDER_SIZE / 2;

  const cursorStartX = CANVAS_WIDTH - 140;
  const cursorStartY = CANVAS_HEIGHT - 220;
  const cursorTargetX = folder0CenterX + 18;
  const cursorTargetY = folder0CenterY + 22;
  const cursorX = interpolate(cursorT, [0, 1], [cursorStartX, cursorTargetX]);
  const cursorY = interpolate(cursorT, [0, 1], [cursorStartY, cursorTargetY]);

  const folder0Glow = frame > 360;

  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      {/* Caption stack above the window */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: captionOpacity,
          transform: `translateY(${captionTranslateY}px)`,
        }}
      >
        <Caption size="lg" tone="ink" weight={800}>
          Every folder is a project. That&rsquo;s it.
        </Caption>
        <div style={{ opacity: subOpacity }}>
          <Caption size="sm" tone="soft">
            Looks like your file explorer. Because it is.
          </Caption>
        </div>
      </div>

      {/* Window slides up from below */}
      <div
        style={{
          position: "absolute",
          left: WINDOW_LEFT,
          top: WINDOW_TOP,
          transform: `translateY(${windowTranslateY}px)`,
        }}
      >
        <WindowFrame
          variant="explorer"
          title="EZvibes - Documents"
          width={WINDOW_WIDTH}
          height={WINDOW_HEIGHT}
        >
          {/* Command bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "20px 60px 18px",
              borderBottom: `1px solid ${palette.panelEdge}`,
              background: palette.paper,
              height: COMMAND_BAR_HEIGHT,
              boxSizing: "border-box",
            }}
          >
            <CommandPill
              label="Launch Claude here"
              background={palette.folderYellow}
              color={palette.ink}
              fontSize={18}
            />
            <CommandPill
              label="inbox"
              background={palette.panel}
              color={palette.inkSoft}
              fontSize={15}
            />
            <CommandPill
              label="ACTIVATE"
              background={palette.panel}
              color={palette.inkSoft}
              fontSize={14}
            />
          </div>

          {/* Folder grid */}
          <div
            style={{
              flex: 1,
              padding: `${GRID_PADDING_TOP}px ${GRID_PADDING_X}px`,
              background: palette.paper,
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${FOLDER_SIZE}px)`,
              columnGap: GRID_COL_GAP,
              rowGap: GRID_ROW_GAP,
              justifyContent: "center",
              alignContent: "start",
            }}
          >
            {FOLDER_LABELS.map((label, i) => {
              const startFrame = 60 + i * 7;
              const folderProgress = spring({
                frame: frame - startFrame,
                fps,
                durationInFrames: 28,
                config: { damping: 14, mass: 1, stiffness: 130 },
              });
              const opacity = interpolate(folderProgress, [0, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const ty = interpolate(folderProgress, [0, 1], [60, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={label}
                  style={{
                    opacity,
                    transform: `translateY(${ty}px)`,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <FolderIcon
                    size={FOLDER_SIZE}
                    label={label}
                    glow={i === 0 ? folder0Glow : false}
                  />
                </div>
              );
            })}
          </div>
        </WindowFrame>
      </div>

      {/* Cursor */}
      {cursorVisible ? (
        <div
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            pointerEvents: "none",
          }}
        >
          <Cursor size={56} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
