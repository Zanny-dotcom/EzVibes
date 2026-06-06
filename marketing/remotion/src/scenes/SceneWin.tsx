import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { palette, fontFamily } from "../theme/tokens";
import { Caption } from "../components/Caption";
import { Cursor } from "../components/Cursor";
import { FolderIcon } from "../components/FolderIcon";
import { WindowFrame } from "../components/WindowFrame";
import { TabChip } from "../components/TabChip";

// ---------------------------------------------------------------------------
// PART A — Visual project management (frames 0–300)
// PART B — Panel Mode (frames 300–600)
// ---------------------------------------------------------------------------

type FolderEntry = {
  name: string;
  state: "default" | "minimized";
};

const explorerFolders: FolderEntry[] = [
  { name: "Mom's website", state: "minimized" },
  { name: "Resume", state: "default" },
  { name: "Game ideas", state: "minimized" },
  { name: "Recipes", state: "default" },
  { name: "Family photos", state: "default" },
  { name: "Etsy shop", state: "minimized" },
  { name: "Taxes 2025", state: "default" },
  { name: "Letters", state: "default" },
  { name: "Music", state: "default" },
  { name: "Trip to Italy", state: "default" },
  { name: "Cookbook", state: "default" },
  { name: "Notes", state: "default" },
];

type ActivityRow = {
  time: string;
  text: string;
};

const activityRows: ActivityRow[] = [
  { time: "2:14 PM", text: "Added contact form" },
  { time: "2:18 PM", text: "Fixed the green button" },
  { time: "2:24 PM", text: "Closed CODEX tab" },
  { time: "2:25 PM", text: "Started CLAUDE tab" },
  { time: "2:31 PM", text: "Added a photo gallery" },
];

const TYPED_TEXT = "make this rounder and green";

export const SceneWin: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // -------------------------------------------------------------------------
  // PART A
  // -------------------------------------------------------------------------

  // Explorer window springs in (0–60).
  const explorerSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.9 },
    durationInFrames: 60,
  });
  const explorerScale = interpolate(explorerSpring, [0, 1], [0.92, 1]);
  const explorerOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Session window springs in (60–150).
  const sessionSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.85 },
    durationInFrames: 60,
  });
  const sessionOpacity = interpolate(frame, [60, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sessionTy = interpolate(sessionSpring, [0, 1], [40, 0]);

  // "What Was Made" sidebar slides in from the right (150–230).
  const sidebarSpring = spring({
    frame: frame - 150,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.9 },
    durationInFrames: 70,
  });
  const sidebarTx = interpolate(sidebarSpring, [0, 1], [420, 0]);
  const sidebarOpacity = interpolate(frame, [150, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Part A caption (220–300).
  const captionAOpacity = interpolate(frame, [220, 250, 290, 300], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionATy = interpolate(captionAOpacity, [0, 1], [10, 0]);

  // Part A fade-out (290–340) — explorer dims to focus PART B, session/sidebar leave.
  const partAFade = interpolate(frame, [290, 340], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sessionVisible = frame < 340;
  const sidebarVisible = frame < 340;

  // -------------------------------------------------------------------------
  // PART B
  // -------------------------------------------------------------------------

  // Explorer re-anchors and stays through PART B.
  const explorerPartBOpacity = interpolate(frame, [300, 360], [partAFade, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ◫ button appears (300–340) then gets clicked at ~340.
  const panelBtnOpacity = interpolate(frame, [300, 340], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelBtnPulse = (() => {
    if (frame < 335 || frame > 360) return 1;
    const local = (frame - 335) / 25;
    return 1 + Math.sin(local * Math.PI) * 0.12;
  })();

  // Cursor 1 → panel-mode button (305..345). Then cursor 2 → ACTIVATE chip (380..420).
  // Then cursor 3 → Send button (500..540).
  const cursorPhase = (() => {
    if (frame < 305) return "hidden" as const;
    if (frame < 348) return "toPanel" as const;
    if (frame < 380) return "atPanel" as const;
    if (frame < 420) return "toActivate" as const;
    if (frame < 500) return "atActivate" as const;
    if (frame < 540) return "toSend" as const;
    return "atSend" as const;
  })();

  // ACTIVATE chip highlight + floating label (360–420 fade in, persists until transformed).
  const highlightOpacity = interpolate(frame, [360, 400], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // After click on activate (~420) the highlight chip recedes a little, composer takes focus.
  const highlightFade = interpolate(frame, [490, 540], [1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Composer popup (420–480 spring in, persists until end).
  const composerSpring = spring({
    frame: frame - 420,
    fps,
    config: { damping: 16, stiffness: 130, mass: 0.85 },
    durationInFrames: 50,
  });
  const composerOpacity = interpolate(frame, [420, 460], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const composerScale = interpolate(composerSpring, [0, 1], [0.85, 1]);
  // Composer fades a touch at end while the button transforms.
  const composerHold = interpolate(frame, [540, 595], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typed text grows char-by-char between 420..500.
  const typedChars = Math.max(
    0,
    Math.min(
      TYPED_TEXT.length,
      Math.floor(
        interpolate(frame, [430, 500], [0, TYPED_TEXT.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      )
    )
  );
  const typedText = TYPED_TEXT.slice(0, typedChars);
  // Caret blink.
  const caretOn = Math.floor(frame / 8) % 2 === 0;

  // Send button click pulse around 535.
  const sendPulse = (() => {
    if (frame < 530 || frame > 555) return 1;
    const local = (frame - 530) / 25;
    return 1 + Math.sin(local * Math.PI) * 0.12;
  })();

  // ACTIVATE button transformation (540–600). Yellow → green; radius 16 → 999.
  const morph = interpolate(frame, [540, 600], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const morphedBg = (() => {
    // Cross-fade backgrounds by blending hex via interpolate on RGB channels.
    const yellow = [244, 196, 48];
    const green = [44, 203, 87];
    const r = Math.round(interpolate(morph, [0, 1], [yellow[0], green[0]]));
    const g = Math.round(interpolate(morph, [0, 1], [yellow[1], green[1]]));
    const b = Math.round(interpolate(morph, [0, 1], [yellow[2], green[2]]));
    return `rgb(${r}, ${g}, ${b})`;
  })();
  const morphedRadius = interpolate(morph, [0, 1], [16, 999]);

  // Part B caption (420–600).
  const captionBOpacity = interpolate(frame, [420, 450, 595, 600], [0, 1, 1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionBTy = interpolate(captionBOpacity, [0, 1], [10, 0]);

  // -------------------------------------------------------------------------
  // Layout constants
  // -------------------------------------------------------------------------

  const explorerW = 1640;
  const explorerH = 920;
  const explorerLeft = (width - explorerW) / 2;
  const explorerTop = (height - explorerH) / 2 - 20;

  // Session window position (overlapping explorer top-right area).
  const sessionW = 520;
  const sessionH = 300;
  const sessionLeft = explorerLeft + explorerW - sessionW - 220;
  const sessionTop = explorerTop + 280;

  // Sidebar position (right side of canvas).
  const sidebarW = 360;
  const sidebarH = 700;
  const sidebarLeft = width - sidebarW - 60;
  const sidebarTop = (height - sidebarH) / 2;

  // Panel-mode button (top-right of explorer header).
  const panelBtnSize = 48;
  const panelBtnLeft = explorerLeft + explorerW - 110;
  const panelBtnTop = explorerTop + 4;

  // Command bar mock — ACTIVATE pill in explorer body.
  const cmdBarTop = explorerTop + 100;
  const cmdBarLeft = explorerLeft + 60;
  // ACTIVATE pill within the command bar.
  const activatePillLeft = cmdBarLeft + 220;
  const activatePillTop = cmdBarTop + 6;
  const activatePillW = 180;
  const activatePillH = 56;

  // Highlight chip above the pill.
  const highlightChipLeft = activatePillLeft - 10;
  const highlightChipTop = activatePillTop - 56;

  // Composer popup — below the pill.
  const composerW = 420;
  const composerH = 220;
  const composerLeft = activatePillLeft - 30;
  const composerTop = activatePillTop + activatePillH + 24;

  // Cursor position calculation.
  const cursorPos = (() => {
    // Default off-screen far right.
    const offscreen = { x: width + 80, y: height / 2 };
    if (cursorPhase === "hidden") return offscreen;

    const panelTarget = {
      x: panelBtnLeft + panelBtnSize / 2,
      y: panelBtnTop + panelBtnSize / 2,
    };
    const activateTarget = {
      x: activatePillLeft + activatePillW / 2,
      y: activatePillTop + activatePillH / 2,
    };
    const sendTarget = {
      x: composerLeft + composerW - 70,
      y: composerTop + composerH - 38,
    };

    if (cursorPhase === "toPanel") {
      const t = interpolate(frame, [305, 348], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        x: interpolate(t, [0, 1], [width + 80, panelTarget.x]),
        y: interpolate(t, [0, 1], [height - 100, panelTarget.y]),
      };
    }
    if (cursorPhase === "atPanel") return panelTarget;
    if (cursorPhase === "toActivate") {
      const t = interpolate(frame, [380, 420], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        x: interpolate(t, [0, 1], [panelTarget.x, activateTarget.x]),
        y: interpolate(t, [0, 1], [panelTarget.y, activateTarget.y]),
      };
    }
    if (cursorPhase === "atActivate") return activateTarget;
    if (cursorPhase === "toSend") {
      const t = interpolate(frame, [500, 540], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        x: interpolate(t, [0, 1], [activateTarget.x, sendTarget.x]),
        y: interpolate(t, [0, 1], [activateTarget.y, sendTarget.y]),
      };
    }
    return sendTarget;
  })();

  // Cursor click bump.
  const cursorBump = (() => {
    const windows = [340, 420, 540];
    for (const w of windows) {
      if (frame >= w - 4 && frame <= w + 8) {
        const local = (frame - (w - 4)) / 12;
        return 1 - Math.sin(local * Math.PI) * 0.18;
      }
    }
    return 1;
  })();

  // Activity row stagger (entries appear between 180..280).
  const activityRowOpacity = (i: number) => {
    const start = 180 + i * 20;
    return interpolate(frame, [start, start + 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  // Faint terminal lines fade in across session frame.
  const termLineOpacity = (i: number) => {
    const start = 110 + i * 10;
    return interpolate(frame, [start, start + 25], [0, 0.65], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  return (
    <AbsoluteFill style={{ background: palette.cream, fontFamily: fontFamily.display }}>
      {/* ----------------------------------------------------------------- */}
      {/* PART A captions live at top                                         */}
      {/* ----------------------------------------------------------------- */}
      {captionAOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 0,
            width,
            display: "flex",
            justifyContent: "center",
            opacity: captionAOpacity,
            transform: `translateY(${captionATy}px)`,
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <Caption size="lg" tone="ink" weight={800} align="center">
            See what's alive. Read what was made.
          </Caption>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Explorer window                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          position: "absolute",
          left: explorerLeft,
          top: explorerTop,
          width: explorerW,
          height: explorerH,
          opacity: Math.min(explorerOpacity, explorerPartBOpacity),
          transform: `scale(${explorerScale})`,
          transformOrigin: "center center",
        }}
      >
        <WindowFrame
          variant="explorer"
          title="EZvibes — Documents"
          width={explorerW}
          height={explorerH}
        >
          {/* Command bar mock — shows during PART B with an ACTIVATE pill */}
          <div
            style={{
              position: "absolute",
              top: 32,
              left: 38,
              right: 38,
              height: 68,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: interpolate(frame, [300, 360], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                padding: "12px 22px",
                background: palette.panel,
                border: `1px solid ${palette.panelEdge}`,
                borderRadius: 12,
                color: palette.inkSoft,
                fontWeight: 600,
                fontSize: 18,
              }}
            >
              Home
            </div>
            <div
              style={{
                padding: "12px 22px",
                background: palette.panel,
                border: `1px solid ${palette.panelEdge}`,
                borderRadius: 12,
                color: palette.inkSoft,
                fontWeight: 600,
                fontSize: 18,
              }}
            >
              Documents
            </div>
            {/* ACTIVATE pill — the one that gets transformed in PART B */}
            <div
              style={{
                marginLeft: "auto",
                width: activatePillW,
                height: activatePillH,
                background: morphedBg,
                color: palette.ink,
                borderRadius: morphedRadius,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "0.06em",
                boxShadow: `0 8px 18px ${palette.shadowMid}`,
                transition: "all 60ms linear",
              }}
            >
              ACTIVATE
            </div>
          </div>

          {/* Folder grid (4×3) */}
          <div
            style={{
              position: "absolute",
              top: 130,
              left: 38,
              right: 38,
              bottom: 38,
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: 18,
              padding: "20px 10px",
              alignItems: "center",
              justifyItems: "center",
            }}
          >
            {explorerFolders.map((f, i) => {
              const entryStart = 10 + i * 4;
              const enter = spring({
                frame: frame - entryStart,
                fps,
                config: { damping: 16, stiffness: 130, mass: 0.7 },
                durationInFrames: 28,
              });
              const fOpacity = interpolate(enter, [0, 1], [0, 1]);
              const fTy = interpolate(enter, [0, 1], [16, 0]);
              return (
                <div
                  key={f.name}
                  style={{
                    opacity: fOpacity,
                    transform: `translateY(${fTy}px)`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <FolderIcon
                    size={150}
                    label={f.name}
                    state={f.state}
                    showLabel={true}
                  />
                </div>
              );
            })}
          </div>
        </WindowFrame>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* ◫ panel-mode button (overlays explorer header, PART B)            */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          position: "absolute",
          left: panelBtnLeft,
          top: panelBtnTop,
          width: panelBtnSize,
          height: panelBtnSize,
          borderRadius: "50%",
          background: palette.folderYellow,
          color: palette.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fontFamily.display,
          fontSize: 26,
          fontWeight: 800,
          boxShadow: `0 6px 14px ${palette.shadowMid}`,
          border: `2px solid ${palette.folderYellowDeep}`,
          opacity: panelBtnOpacity,
          transform: `scale(${panelBtnPulse})`,
          transformOrigin: "center center",
          zIndex: 20,
        }}
      >
        {"◫"}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Session window (PART A)                                            */}
      {/* ----------------------------------------------------------------- */}
      {sessionVisible && (
        <div
          style={{
            position: "absolute",
            left: sessionLeft,
            top: sessionTop,
            width: sessionW,
            height: sessionH,
            opacity: sessionOpacity * partAFade,
            transform: `translateY(${sessionTy}px)`,
            zIndex: 15,
          }}
        >
          <WindowFrame
            variant="session"
            title="Mom's website"
            width={sessionW}
            height={sessionH}
          >
            {/* Tab strip */}
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 14,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <TabChip label="CLAUDE" active={true} variant="claude" />
              <TabChip label="CODEX 2" variant="codex" />
            </div>
            {/* Terminal mock */}
            <div
              style={{
                position: "absolute",
                top: 70,
                left: 14,
                right: 14,
                height: 180,
                background: palette.terminalBg,
                borderRadius: 10,
                padding: "14px 18px",
                fontFamily: fontFamily.mono,
                color: palette.terminalText,
                fontSize: 13,
                lineHeight: 1.6,
                boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04)`,
              }}
            >
              <div style={{ opacity: termLineOpacity(0) }}>
                <span style={{ color: palette.green }}>$</span> Added contact form
              </div>
              <div style={{ opacity: termLineOpacity(1) }}>
                <span style={{ color: palette.green }}>$</span> Wiring up form
                handler...
              </div>
              <div style={{ opacity: termLineOpacity(2) }}>
                <span style={{ color: palette.green }}>$</span> Done.
              </div>
              <div
                style={{
                  opacity: termLineOpacity(3),
                  color: palette.muted,
                }}
              >
                claude &gt; awaiting input_
              </div>
            </div>
          </WindowFrame>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* "What Was Made" sidebar (PART A)                                   */}
      {/* ----------------------------------------------------------------- */}
      {sidebarVisible && (
        <div
          style={{
            position: "absolute",
            left: sidebarLeft,
            top: sidebarTop,
            width: sidebarW,
            height: sidebarH,
            background: palette.panel,
            borderLeft: `1px solid ${palette.panelEdge}`,
            borderTop: `1px solid ${palette.panelEdge}`,
            borderBottom: `1px solid ${palette.panelEdge}`,
            borderTopLeftRadius: 22,
            borderBottomLeftRadius: 22,
            padding: 22,
            opacity: sidebarOpacity * partAFade,
            transform: `translateX(${sidebarTx}px)`,
            boxShadow: `-12px 0 30px ${palette.shadowMid}`,
            zIndex: 18,
          }}
        >
          <div
            style={{
              fontFamily: fontFamily.display,
              fontSize: 22,
              fontWeight: 800,
              color: palette.ink,
              letterSpacing: "-0.01em",
            }}
          >
            What Was Made
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: fontFamily.display,
              fontSize: 14,
              color: palette.inkSoft,
              fontWeight: 500,
            }}
          >
            Mom's website
          </div>
          <div
            style={{
              height: 1,
              background: palette.panelEdge,
              margin: "18px 0",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activityRows.map((row, i) => {
              const op = activityRowOpacity(i);
              const ty = interpolate(op, [0, 1], [8, 0]);
              return (
                <div
                  key={row.text}
                  style={{
                    opacity: op,
                    transform: `translateY(${ty}px)`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: palette.green,
                      marginTop: 6,
                      boxShadow: `0 0 0 3px rgba(44,203,87,0.18)`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div
                      style={{
                        fontFamily: fontFamily.mono,
                        fontSize: 12,
                        color: palette.muted,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {row.time}
                    </div>
                    <div
                      style={{
                        fontFamily: fontFamily.display,
                        fontSize: 16,
                        fontWeight: 600,
                        color: palette.ink,
                        lineHeight: 1.3,
                      }}
                    >
                      {row.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* PART B — highlight chip + dashed outline on ACTIVATE              */}
      {/* ----------------------------------------------------------------- */}
      {highlightOpacity > 0 && (
        <>
          {/* Dashed outline over the pill */}
          <div
            style={{
              position: "absolute",
              left: activatePillLeft - 6,
              top: activatePillTop - 6,
              width: activatePillW + 12,
              height: activatePillH + 12,
              border: `2px dashed ${palette.folderYellowDeep}`,
              borderRadius: morphedRadius + 6,
              opacity: highlightOpacity * highlightFade,
              zIndex: 22,
              pointerEvents: "none",
            }}
          />
          {/* Floating chip "ACTIVATE button" */}
          <div
            style={{
              position: "absolute",
              left: highlightChipLeft,
              top: highlightChipTop,
              background: palette.ink,
              color: palette.cream,
              padding: "8px 14px",
              borderRadius: 8,
              fontFamily: fontFamily.display,
              fontSize: 16,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: `0 8px 16px ${palette.shadowMid}`,
              opacity: highlightOpacity * highlightFade,
              zIndex: 23,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: palette.folderYellow,
              }}
            />
            ACTIVATE button
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* PART B — composer popup                                            */}
      {/* ----------------------------------------------------------------- */}
      {composerOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: composerLeft,
            top: composerTop,
            width: composerW,
            height: composerH,
            background: palette.panel,
            border: `2px solid ${palette.folderYellow}`,
            borderRadius: 16,
            boxShadow: `0 18px 30px ${palette.shadowDeep}`,
            opacity: composerOpacity * composerHold,
            transform: `scale(${composerScale})`,
            transformOrigin: "top left",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            zIndex: 30,
          }}
        >
          <div
            style={{
              fontFamily: fontFamily.display,
              fontSize: 16,
              fontWeight: 700,
              color: palette.inkSoft,
              letterSpacing: "-0.01em",
            }}
          >
            Panel Mode
          </div>
          <div
            style={{
              flex: 1,
              background: palette.cream,
              border: `1px solid ${palette.panelEdge}`,
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: fontFamily.display,
              fontSize: 18,
              color: palette.ink,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {typedText}
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 20,
                background: palette.ink,
                marginLeft: 2,
                verticalAlign: "text-bottom",
                opacity: caretOn ? 1 : 0,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                background: palette.folderYellow,
                color: palette.ink,
                padding: "10px 22px",
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "0.02em",
                boxShadow: `0 6px 14px ${palette.shadowMid}`,
                transform: `scale(${sendPulse})`,
                transformOrigin: "center center",
              }}
            >
              Send
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* PART B caption — bottom of canvas (420–600)                        */}
      {/* ----------------------------------------------------------------- */}
      {captionBOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 0,
            width,
            display: "flex",
            justifyContent: "center",
            opacity: captionBOpacity,
            transform: `translateY(${captionBTy}px)`,
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <Caption size="lg" tone="ink" weight={800} align="center">
            Point at anything. Tell it what to change.
          </Caption>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Cursor                                                              */}
      {/* ----------------------------------------------------------------- */}
      {cursorPhase !== "hidden" && (
        <div
          style={{
            position: "absolute",
            left: cursorPos.x,
            top: cursorPos.y,
            transform: `scale(${cursorBump})`,
            transformOrigin: "top left",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <Cursor size={56} />
        </div>
      )}
    </AbsoluteFill>
  );
};
