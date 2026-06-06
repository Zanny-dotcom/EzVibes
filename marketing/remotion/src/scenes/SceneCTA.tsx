import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { Caption } from "../components/Caption";
import { FolderIcon } from "../components/FolderIcon";
import { fontFamily, FPS, palette } from "../theme/tokens";

const CANVAS_W = 1920;
const FOLDER_SIZE = 520;
const FOLDER_CENTER_Y = 350;

const PILLS = ["No terminal.", "No setup.", "No code."] as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();

  // Folder spring-in (0..45)
  const folderSpring = spring({
    frame,
    fps: FPS,
    config: { damping: 11, mass: 0.9, stiffness: 95 },
    durationInFrames: 45,
  });
  const folderScale = interpolate(folderSpring, [0, 1], [0.7, 1], clamp);
  const folderOpacity = interpolate(frame, [0, 45], [0, 1], clamp);

  // Constant float (after 280)
  const floatPhase = ((frame - 280) / (FPS * 3.5)) * Math.PI * 2;
  const floatY = frame >= 280 ? Math.sin(floatPhase) * 6 : 0;

  // Final glow swell (450..600)
  const glowPhase = ((frame - 450) / (FPS * 2.5)) * Math.PI * 2;
  const glowAmount =
    frame >= 450 ? 0.55 + (Math.sin(glowPhase) + 1) * 0.5 * 0.25 : 0.55;
  const glowBlur = frame >= 450 ? 28 + glowAmount * 40 : 28;

  // Z stamp (30..80)
  const zSpring = spring({
    frame: frame - 30,
    fps: FPS,
    config: { damping: 12, mass: 0.8, stiffness: 110 },
    durationInFrames: 50,
  });
  const zScale = interpolate(zSpring, [0, 1], [1.4, 1], clamp);
  const zOpacity = interpolate(frame, [30, 80], [0, 1], clamp);

  // Brand caption (90..180)
  const brandOpacity = interpolate(frame, [90, 180], [0, 1], clamp);
  const brandTranslate = interpolate(frame, [90, 180], [24, 0], clamp);

  // Subcaption (150..240)
  const subOpacity = interpolate(frame, [150, 240], [0, 1], clamp);
  const subTranslate = interpolate(frame, [150, 240], [24, 0], clamp);

  // Tagline (220..300)
  const tagOpacity = interpolate(frame, [220, 300], [0, 1], clamp);
  const tagTranslate = interpolate(frame, [220, 300], [16, 0], clamp);

  // Pills (320..420), staggered
  const pillStates = PILLS.map((_, i) => {
    const start = 320 + i * 18;
    const pillSpring = spring({
      frame: frame - start,
      fps: FPS,
      config: { damping: 13, mass: 0.7, stiffness: 120 },
      durationInFrames: 40,
    });
    const opacity = interpolate(frame, [start, start + 40], [0, 1], clamp);
    const translate = interpolate(pillSpring, [0, 1], [18, 0], clamp);
    const scale = interpolate(pillSpring, [0, 1], [0.9, 1], clamp);
    return { opacity, translate, scale };
  });

  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      {/* Gentle radial highlight, ~6% brighter at center */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />

      {/* Folder + Z stamp */}
      <div
        style={{
          position: "absolute",
          left: CANVAS_W / 2,
          top: FOLDER_CENTER_Y,
          transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${folderScale})`,
          opacity: folderOpacity,
          filter: `drop-shadow(0 0 ${glowBlur}px rgba(244,196,48,${glowAmount}))`,
          transition: "filter 120ms ease",
        }}
      >
        <div style={{ position: "relative" }}>
          <FolderIcon
            size={FOLDER_SIZE}
            label="EZvibes"
            showLabel={false}
            glow={true}
            state="default"
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "44%",
              transform: `translate(-50%, -50%) scale(${zScale})`,
              opacity: zOpacity,
              fontFamily: fontFamily.display,
              fontWeight: 900,
              fontSize: 240,
              color: palette.ink,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            Z
          </div>
        </div>
      </div>

      {/* Pills row (y=560) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 560,
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        {PILLS.map((label, i) => {
          const { opacity, translate, scale } = pillStates[i];
          return (
            <div
              key={label}
              style={{
                opacity,
                transform: `translateY(${translate}px) scale(${scale})`,
                borderRadius: 999,
                background: palette.panel,
                border: `1px solid ${palette.panelEdge}`,
                padding: "12px 24px",
                fontSize: 22,
                fontWeight: 600,
                color: palette.ink,
                fontFamily: fontFamily.display,
                letterSpacing: "-0.01em",
                boxShadow: `0 6px 16px ${palette.shadowSoft}`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Brand caption (y=680) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 680,
          opacity: brandOpacity,
          transform: `translateY(${brandTranslate}px)`,
        }}
      >
        <Caption size="xl" tone="ink" weight={900}>
          EZvibes
        </Caption>
      </div>

      {/* Subcaption (y=790) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 790,
          opacity: subOpacity,
          transform: `translateY(${subTranslate}px)`,
        }}
      >
        <Caption size="lg" tone="soft" weight={600}>
          vibecoding, for everyone
        </Caption>
      </div>

      {/* Tagline (y=900) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 900,
          opacity: tagOpacity,
          transform: `translateY(${tagTranslate}px)`,
        }}
      >
        <Caption size="md" tone="soft" weight={500}>
          Open a folder. Get started.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};
