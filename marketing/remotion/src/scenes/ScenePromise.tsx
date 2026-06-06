import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { Caption } from "../components/Caption";
import { FolderIcon } from "../components/FolderIcon";
import { palette, fontFamily } from "../theme/tokens";

type Sparkle = {
  startFrame: number;
  endFrame: number;
  angle: number;
  distance: number;
  size: number;
  delay: number;
};

const SPARKLES: Sparkle[] = [
  { startFrame: 95, endFrame: 200, angle: -110, distance: 290, size: 10, delay: 0 },
  { startFrame: 105, endFrame: 215, angle: -55, distance: 320, size: 8, delay: 8 },
  { startFrame: 120, endFrame: 220, angle: 30, distance: 300, size: 11, delay: 18 },
  { startFrame: 130, endFrame: 215, angle: 85, distance: 270, size: 9, delay: 26 },
  { startFrame: 110, endFrame: 210, angle: 155, distance: 310, size: 8, delay: 12 },
  { startFrame: 140, endFrame: 220, angle: -160, distance: 260, size: 10, delay: 32 },
];

export const ScenePromise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background dark-to-cream over frames 0..60.
  // Dark exit: #0A0D11 (10, 13, 17) -> Cream: #FFF8E7 (255, 248, 231).
  const bgR = interpolate(frame, [0, 60], [10, 255], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgG = interpolate(frame, [0, 60], [13, 248], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bgB = interpolate(frame, [0, 60], [17, 231], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const backgroundColor = `rgb(${Math.round(bgR)}, ${Math.round(bgG)}, ${Math.round(bgB)})`;

  // Subtle warm radial sunrise glow, 0 -> 0.4 opacity over the same wash.
  const radialOpacity = interpolate(frame, [0, 60], [0, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Folder bouncy spring entrance (frames 30..150 nominal).
  const folderSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, mass: 1.1, stiffness: 80 },
  });
  const folderEntryY = interpolate(folderSpring, [0, 1], [200, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const folderOpacity = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Gentle bob starting at frame 150.
  const folderBob = frame >= 150 ? Math.sin((frame - 150) * 0.06) * 10 : 0;
  const folderTranslateY = folderEntryY + folderBob;

  // Big caption spring-in around frame 120 with slight slide-up.
  const captionSpring = spring({
    frame: frame - 120,
    fps,
    config: { damping: 16, mass: 1, stiffness: 90 },
  });
  const captionOpacity = interpolate(captionSpring, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionSlideY = interpolate(captionSpring, [0, 1], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Sub-caption ghost line fades in between frames 220..260, then holds.
  const subCaptionOpacity = interpolate(frame, [220, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor, fontFamily: fontFamily.display }}>
      {/* Warm radial sunrise highlight */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255, 232, 175, 1) 0%, rgba(255, 232, 175, 0) 55%)",
          opacity: radialOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Sparkle dots drifting outward from around the folder */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {SPARKLES.map((s, i) => {
          const driftStart = s.startFrame + s.delay;
          const t = interpolate(frame, [driftStart, s.endFrame], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const opacity = interpolate(
            frame,
            [driftStart, driftStart + 18, s.endFrame - 25, s.endFrame],
            [0, 0.85, 0.85, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const radians = (s.angle * Math.PI) / 180;
          const radius = t * s.distance;
          const dx = Math.cos(radians) * radius;
          const dy = Math.sin(radians) * radius;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                width: s.size,
                height: s.size,
                marginLeft: -(s.size / 2),
                marginTop: -(s.size / 2),
                background: palette.amber,
                borderRadius: "50%",
                transform: `translate(${dx}px, ${dy}px)`,
                opacity,
                boxShadow: `0 0 14px ${palette.amber}, 0 0 6px ${palette.folderYellow}`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Folder centered horizontally; vertical anchor at ~38% from top */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: "calc(38% - 240px)",
        }}
      >
        <div
          style={{
            transform: `translateY(${folderTranslateY}px)`,
            opacity: folderOpacity,
          }}
        >
          <FolderIcon
            size={420}
            label="Birthday card for mom"
            glow={true}
            showLabel={true}
          />
        </div>
      </AbsoluteFill>

      {/* Big headline caption at ~64% from top */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: "64%",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: captionOpacity,
            transform: `translateY(${captionSlideY}px)`,
          }}
        >
          <Caption
            size="xl"
            tone="ink"
            weight={800}
            maxWidth={1200}
            style={{ lineHeight: 1.1 }}
          >
            What if making apps was as easy as opening a folder?
          </Caption>
        </div>
      </AbsoluteFill>

      {/* Sub-caption ghost line at ~80% from top */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: "80%",
          pointerEvents: "none",
        }}
      >
        <div style={{ opacity: subCaptionOpacity }}>
          <Caption size="md" tone="soft" weight={500} maxWidth={1000}>
            No commands. No setup. No &lsquo;cd&rsquo;.
          </Caption>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
