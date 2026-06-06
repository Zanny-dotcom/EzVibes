import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { ContextMenu } from "../components/ContextMenu";
import { Cursor } from "../components/Cursor";
import { FolderIcon } from "../components/FolderIcon";
import { TerminalMock } from "../components/TerminalMock";
import { WindowFrame } from "../components/WindowFrame";
import { fontFamily, palette } from "../theme/tokens";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const MENU_ITEMS = [
  { label: "Open", emoji: "📁" },
  { label: "Launch Claude", emoji: "✦", highlight: true },
  { label: "Rename", emoji: "✎" },
  { label: "Delete", emoji: "🗑" },
];

const FOLDERS: Array<{ label: string; glow?: boolean }> = [
  { label: "Birthday card for mom", glow: true },
  { label: "Mom's website" },
  { label: "Recipe book" },
  { label: "Wedding plans" },
];

// Canvas assumed 1920x1080 landscape.
const CANVAS_W = 1920;

const EXPLORER_W = 1100;
const EXPLORER_H = 680;
const EXPLORER_X = (CANVAS_W - EXPLORER_W) / 2;
const EXPLORER_Y = 180;

// 2x2 grid of FolderIcon size=170 inside the explorer body (after 56px header).
const GRID_CELL_W = 300;
const GRID_CELL_H = 270;
const GRID_COLS = 2;
const GRID_LEFT = EXPLORER_X + (EXPLORER_W - GRID_CELL_W * GRID_COLS) / 2;
const GRID_TOP = EXPLORER_Y + 56 + 50; // header height + top padding

// "Birthday card for mom" sits at column 0, row 0.
const BIRTHDAY_CX = GRID_LEFT + GRID_CELL_W / 2;
const BIRTHDAY_CY = GRID_TOP + 170 / 2;

// Context menu placed just to the right of the highlighted folder.
const MENU_W = 280;
const MENU_X = BIRTHDAY_CX + 110;
const MENU_Y = BIRTHDAY_CY - 20;

// Approx center y for the 2nd row ("Launch Claude").
// ContextMenu row ~ padding(13) + fontSize(19) + padding(13) = ~52px tall.
const MENU_ROW_H = 52;
const LAUNCH_CLAUDE_ROW_Y = MENU_Y + MENU_ROW_H * 1 + MENU_ROW_H / 2;

// Session window (foreground).
const SESSION_W = 1200;
const SESSION_H = 620;
const SESSION_X = (CANVAS_W - SESSION_W) / 2;
const SESSION_Y = 240;

export const ScenePickAndAsk: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Folder right-click pulse: scale 1.0 -> 1.05 -> 1.0 across frames 60..80.
  const folderPulse = interpolate(frame, [60, 70, 80], [1, 1.05, 1], CLAMP);

  // Context menu opacity 0->1 and scale 0.9->1 with spring across 100..130.
  const menuSpring = spring({
    frame: frame - 100,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.6 },
  });
  const menuOpacity = interpolate(frame, [100, 130], [0, 1], CLAMP);
  const menuScale = interpolate(menuSpring, [0, 1], [0.9, 1], CLAMP);
  // Menu visible until the explorer fully hands off to the session window.
  const menuVisible = frame >= 100 && frame < 360;

  // Cursor positions.
  const cursorStartX = BIRTHDAY_CX + 35;
  const cursorStartY = BIRTHDAY_CY + 40;
  const cursorEndX = MENU_X + 70;
  const cursorEndY = LAUNCH_CLAUDE_ROW_Y;

  const cursorX = interpolate(
    frame,
    [200, 270],
    [cursorStartX, cursorEndX],
    CLAMP
  );
  const cursorY = interpolate(
    frame,
    [200, 270],
    [cursorStartY, cursorEndY],
    CLAMP
  );
  const cursorVisible = frame < 320;

  // Click ripple at the Launch Claude row around frame 270.
  const rippleProgress = interpolate(frame, [268, 295], [0, 1], CLAMP);
  const rippleSize = interpolate(rippleProgress, [0, 1], [10, 100], CLAMP);
  const rippleOpacity = interpolate(rippleProgress, [0, 1], [0.65, 0], CLAMP);
  const rippleVisible = frame >= 266 && frame <= 300;

  // Explorer transition: dim down and shrink slightly across 280..360.
  const explorerOpacity = interpolate(frame, [280, 360], [1, 0.4], CLAMP);
  const explorerScale = interpolate(frame, [280, 360], [1, 0.94], CLAMP);

  // Session window springs in from the birthday folder origin.
  const sessionSpring = spring({
    frame: frame - 280,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.9 },
  });
  const sessionOpacity = interpolate(frame, [280, 340], [0, 1], CLAMP);
  const sessionCenterX = SESSION_X + SESSION_W / 2;
  const sessionCenterY = SESSION_Y + SESSION_H / 2;
  const originDX = BIRTHDAY_CX - sessionCenterX;
  const originDY = BIRTHDAY_CY - sessionCenterY;
  const sessionTX = interpolate(sessionSpring, [0, 1], [originDX, 0], CLAMP);
  const sessionTY = interpolate(sessionSpring, [0, 1], [originDY, 0], CLAMP);
  const sessionScale = interpolate(sessionSpring, [0, 1], [0.15, 1], CLAMP);
  const sessionVisible = frame >= 280;

  // Terminal lines, typed on letter by letter.
  const userTextFull = "A birthday card website for my mom";
  const aiReplyFull = "Got it. Building it now…";

  const userCount = Math.max(
    0,
    Math.min(userTextFull.length, Math.floor((frame - 400) / 1.6))
  );
  const aiCount = Math.max(
    0,
    Math.min(aiReplyFull.length, Math.floor((frame - 500) / 1.6))
  );

  const lines: Array<{ who: "user" | "ai"; text: string }> = [
    { who: "ai", text: "Hi! What do you want to build today?" },
  ];
  if (frame >= 400) {
    lines.push({ who: "user", text: userTextFull.slice(0, userCount) });
  }
  if (frame >= 500) {
    lines.push({ who: "ai", text: aiReplyFull.slice(0, aiCount) });
  }

  // Big caption springs in near frame 380.
  const bigCaptionSpring = spring({
    frame: frame - 380,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });
  const bigCaptionOpacity = interpolate(frame, [380, 415], [0, 1], CLAMP);
  const bigCaptionY = interpolate(bigCaptionSpring, [0, 1], [40, 0], CLAMP);

  // Small caption fades in across 460..510.
  const smallCaptionOpacity = interpolate(frame, [460, 510], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      {/* Explorer window with 2x2 folder grid */}
      <div
        style={{
          position: "absolute",
          left: EXPLORER_X,
          top: EXPLORER_Y,
          opacity: explorerOpacity,
          transform: `scale(${explorerScale})`,
          transformOrigin: "center center",
        }}
      >
        <WindowFrame
          width={EXPLORER_W}
          height={EXPLORER_H}
          title="EZvibes — Documents"
          variant="explorer"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "30px 0 0 0",
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLS}, ${GRID_CELL_W}px)`,
              gridAutoRows: `${GRID_CELL_H}px`,
              justifyContent: "center",
              alignContent: "start",
              boxSizing: "border-box",
            }}
          >
            {FOLDERS.map((f, i) => {
              const isBirthday = i === 0;
              return (
                <div
                  key={f.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    transform: isBirthday
                      ? `scale(${folderPulse})`
                      : undefined,
                    transformOrigin: "center center",
                  }}
                >
                  <FolderIcon size={170} label={f.label} glow={f.glow} />
                </div>
              );
            })}
          </div>
        </WindowFrame>
      </div>

      {/* Context menu */}
      {menuVisible ? (
        <div
          style={{
            position: "absolute",
            left: MENU_X,
            top: MENU_Y,
            opacity: menuOpacity,
            transform: `scale(${menuScale})`,
            transformOrigin: "top left",
            zIndex: 5,
          }}
        >
          <ContextMenu items={MENU_ITEMS} width={MENU_W} />
        </div>
      ) : null}

      {/* Click ripple over the Launch Claude row */}
      {rippleVisible ? (
        <div
          style={{
            position: "absolute",
            left: cursorEndX - rippleSize / 2,
            top: cursorEndY - rippleSize / 2,
            width: rippleSize,
            height: rippleSize,
            borderRadius: "50%",
            border: `3px solid ${palette.folderYellowDeep}`,
            opacity: rippleOpacity,
            pointerEvents: "none",
            zIndex: 8,
          }}
        />
      ) : null}

      {/* Cursor */}
      {cursorVisible ? (
        <div
          style={{
            position: "absolute",
            left: cursorX,
            top: cursorY,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <Cursor size={56} />
        </div>
      ) : null}

      {/* Session window (foreground) */}
      {sessionVisible ? (
        <div
          style={{
            position: "absolute",
            left: SESSION_X,
            top: SESSION_Y,
            opacity: sessionOpacity,
            transform: `translate(${sessionTX}px, ${sessionTY}px) scale(${sessionScale})`,
            transformOrigin: "center center",
            zIndex: 10,
          }}
        >
          <WindowFrame
            width={SESSION_W}
            height={SESSION_H}
            title="Birthday card for mom"
            variant="session"
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: 32,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                background: palette.paper,
              }}
            >
              <TerminalMock
                width="100%"
                height={480}
                lines={lines}
                caret={true}
              />
            </div>
          </WindowFrame>
        </div>
      ) : null}

      {/* Big caption above session window */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          opacity: bigCaptionOpacity,
          transform: `translateY(${bigCaptionY}px)`,
          fontFamily: fontFamily.display,
          zIndex: 20,
        }}
      >
        <Caption size="lg" tone="ink" weight={800}>
          Talk to it like a friend.
        </Caption>
      </div>

      {/* Small caption below session window */}
      <div
        style={{
          position: "absolute",
          top: SESSION_Y + SESSION_H + 30,
          left: 0,
          right: 0,
          opacity: smallCaptionOpacity,
          fontFamily: fontFamily.display,
          zIndex: 20,
        }}
      >
        <Caption size="sm" tone="soft">
          Plain English. It builds your idea.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};
