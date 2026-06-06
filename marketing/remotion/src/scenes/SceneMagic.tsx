import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fontFamily } from "../theme/tokens";
import { Caption } from "../components/Caption";
import { Cursor } from "../components/Cursor";
import { FolderIcon } from "../components/FolderIcon";
import { WindowFrame } from "../components/WindowFrame";
import { GreenChip } from "../components/GreenChip";

const CARD_W = 880;
const CARD_H = 460;

type StepCardProps = {
  stepLabel: string;
  title: string;
  enterFrom: number;
  exitFrom: number;
  exitTo: number;
  visibleUntil: number;
  bump?: { at: number };
  children: React.ReactNode;
};

const StepCard: React.FC<StepCardProps> = ({
  stepLabel,
  title,
  enterFrom,
  exitFrom,
  exitTo,
  visibleUntil,
  bump,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < enterFrom || frame > visibleUntil) {
    return null;
  }

  const enterSpring = spring({
    frame: frame - enterFrom,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 110 },
  });
  const scaleIn = 0.92 + 0.08 * enterSpring;
  const opacityIn = interpolate(frame, [enterFrom, enterFrom + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const yIn = interpolate(enterSpring, [0, 1], [40, 0]);

  const exitOpacity = interpolate(frame, [exitFrom, exitTo], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitY = interpolate(frame, [exitFrom, exitTo], [0, -60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let bumpScale = 1;
  if (bump) {
    const b = frame - bump.at;
    if (b >= 0 && b <= 10) {
      bumpScale = interpolate(b, [0, 5, 10], [1, 0.97, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, calc(-50% + ${yIn + exitY}px)) scale(${
          scaleIn * bumpScale
        })`,
        width: CARD_W,
        minHeight: CARD_H,
        background: palette.panel,
        borderRadius: 28,
        boxShadow: `0 30px 60px ${palette.shadowDeep}`,
        border: `1px solid ${palette.panelEdge}`,
        padding: "44px 48px",
        opacity: opacityIn * exitOpacity,
        fontFamily: fontFamily.display,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {stepLabel ? (
        <div
          style={{
            alignSelf: "flex-start",
            background: palette.folderYellow,
            color: palette.ink,
            fontWeight: 700,
            fontSize: 20,
            padding: "8px 18px",
            borderRadius: 999,
            marginBottom: 24,
            letterSpacing: "-0.01em",
          }}
        >
          {stepLabel}
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}
      <Caption size="lg" tone="ink" weight={800} align="left">
        {title}
      </Caption>
      <div style={{ marginTop: 28, flex: 1 }}>{children}</div>
    </div>
  );
};

const CursorAt: React.FC<{
  fromFrame: number;
  toFrame: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  visibleUntil: number;
}> = ({ fromFrame, toFrame, fromX, fromY, toX, toY, visibleUntil }) => {
  const frame = useCurrentFrame();
  if (frame < fromFrame || frame > visibleUntil) return null;
  const x = interpolate(frame, [fromFrame, toFrame], [fromX, toX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [fromFrame, toFrame], [fromY, toY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(
    frame,
    [fromFrame, fromFrame + 6, visibleUntil - 6, visibleUntil],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <Cursor size={60} />
    </div>
  );
};

const ChoiceButton: React.FC<{
  label: string;
  selected?: boolean;
  bumpAt?: number;
  parentEnter: number;
}> = ({ label, selected = false, bumpAt, parentEnter }) => {
  const frame = useCurrentFrame();
  let bumpScale = 1;
  if (bumpAt !== undefined) {
    const b = frame - bumpAt;
    if (b >= 0 && b <= 10) {
      bumpScale = interpolate(b, [0, 5, 10], [1, 0.97, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }
  const fadeIn = interpolate(
    frame,
    [parentEnter + 8, parentEnter + 24],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <div
      style={{
        width: 640,
        height: 80,
        borderRadius: 18,
        background: selected ? palette.folderYellow : palette.panel,
        border: selected
          ? `2px solid ${palette.folderYellowDeep}`
          : `1px solid ${palette.panelEdge}`,
        display: "flex",
        alignItems: "center",
        paddingLeft: 28,
        fontSize: 28,
        fontWeight: selected ? 800 : 600,
        color: palette.ink,
        letterSpacing: "-0.01em",
        boxShadow: selected
          ? `0 10px 22px ${palette.shadowMid}`
          : `0 4px 10px ${palette.shadowSoft}`,
        transform: `scale(${bumpScale})`,
        opacity: fadeIn,
        boxSizing: "border-box",
      }}
    >
      {label}
    </div>
  );
};

const ActionCard: React.FC<{
  appearAt: number;
  text: string;
  emphasis?: boolean;
}> = ({ appearAt, text, emphasis = false }) => {
  const frame = useCurrentFrame();
  if (frame < appearAt) return null;
  const opacity = interpolate(frame, [appearAt, appearAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [appearAt, appearAt + 18], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        width: 560,
        minHeight: 62,
        background: palette.cream,
        borderLeft: `6px solid ${palette.green}`,
        borderRadius: 14,
        padding: "14px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: fontFamily.display,
        fontSize: emphasis ? 32 : 26,
        fontWeight: emphasis ? 800 : 600,
        color: palette.ink,
        opacity,
        transform: `translateY(${y}px)`,
        letterSpacing: "-0.01em",
        boxSizing: "border-box",
      }}
    >
      <span>{text}</span>
      <span
        style={{
          color: palette.greenDeep,
          fontSize: emphasis ? 34 : 28,
          fontWeight: 800,
        }}
      >
        ✓
      </span>
    </div>
  );
};

const BouncingDots: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = [0, 1, 2];
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 30,
      }}
    >
      {dots.map((i) => {
        const phase = frame * 0.18 + i * 1.1;
        const s = 0.7 + 0.3 * (Math.sin(phase) * 0.5 + 0.5);
        const o = 0.4 + 0.6 * (Math.sin(phase) * 0.5 + 0.5);
        return (
          <div
            key={i}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: palette.folderYellow,
              transform: `scale(${s})`,
              opacity: o,
            }}
          />
        );
      })}
    </div>
  );
};

export const SceneMagic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step ranges
  const step1Enter = 0;
  const step1Bump = 130;
  const step1Exit = 150;
  const step1End = 180;

  const step2Enter = 180;
  const step2Bump = 295;
  const step2Exit = 310;
  const step2End = 340;

  const step3Enter = 340;
  const step3Send = 500;
  const workingStart = 510;
  const actionsStart = 540;

  // Bottom caption fade 600-660
  const captionFade = interpolate(frame, [600, 660], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Green chip spring at 640
  const chipSpring = spring({
    frame: frame - 640,
    fps,
    config: { damping: 9, mass: 0.7, stiffness: 120 },
  });
  const chipScale = chipSpring;
  const chipRotate = interpolate(chipSpring, [0, 1], [-8, 0]);
  const chipFloat = frame >= 660 ? Math.sin((frame - 660) * 0.08) * 4 : 0;
  const chipVisible = frame >= 640;

  // Typed text in step 3
  const typeStart = 380;
  const typeEnd = 490;
  const fullText = "Add a button so they can RSVP";
  const typedCount = Math.floor(
    interpolate(frame, [typeStart, typeEnd], [0, fullText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedText = fullText.slice(0, typedCount);
  const showCaret =
    frame >= typeStart && frame <= typeEnd + 10 && Math.floor(frame / 8) % 2 === 0;

  const inWorking = frame >= workingStart;

  // Send button bump at 500
  const sendBumpScale = (() => {
    const b = frame - step3Send;
    if (b >= 0 && b <= 10) {
      return interpolate(b, [0, 5, 10], [1, 0.97, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    return 1;
  })();

  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      {/* Dimmed background EZvibes app */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.35,
          filter: "blur(0.5px)",
        }}
      >
        <WindowFrame
          variant="explorer"
          title="EZvibes"
          width={1640}
          height={920}
        >
          <div
            style={{
              padding: 48,
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 36,
              alignContent: "start",
            }}
          >
            {[
              "Birthday card",
              "Mom's website",
              "Recipe book",
              "Wedding",
              "Photos",
            ].map((name) => (
              <div
                key={name}
                style={{ display: "flex", justifyContent: "center" }}
              >
                <FolderIcon size={120} label={name} />
              </div>
            ))}
          </div>
        </WindowFrame>
      </div>

      {/* STEP 1 — What do you want to do? */}
      <StepCard
        stepLabel="Step 1 of 3"
        title="What do you want to do?"
        enterFrom={step1Enter}
        exitFrom={step1Exit}
        exitTo={step1End}
        visibleUntil={step1End}
        bump={{ at: step1Bump }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            alignItems: "center",
          }}
        >
          <ChoiceButton
            label="Add a feature"
            selected
            bumpAt={step1Bump}
            parentEnter={step1Enter}
          />
          <ChoiceButton label="Fix a bug" parentEnter={step1Enter} />
          <ChoiceButton
            label="Start a new project"
            parentEnter={step1Enter}
          />
        </div>
      </StepCard>
      <CursorAt
        fromFrame={90}
        toFrame={130}
        fromX={1700}
        fromY={620}
        toX={1100}
        toY={560}
        visibleUntil={step1End}
      />

      {/* STEP 2 — Which project? */}
      <StepCard
        stepLabel="Step 2 of 3"
        title="Which project?"
        enterFrom={step2Enter}
        exitFrom={step2Exit}
        exitTo={step2End}
        visibleUntil={step2End}
        bump={{ at: step2Bump }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 8,
            padding: "0 8px",
          }}
        >
          {[
            { name: "Birthday card for mom", glow: true },
            { name: "Mom's website", glow: false },
            { name: "Recipe book", glow: false },
            { name: "Wedding plans", glow: false },
          ].map((f) => (
            <div
              key={f.name}
              style={{
                display: "flex",
                justifyContent: "center",
                padding: 10,
                borderRadius: 18,
                border: f.glow
                  ? `2px solid ${palette.folderYellowDeep}`
                  : "2px solid transparent",
                background: f.glow
                  ? "rgba(244,196,48,0.10)"
                  : "transparent",
              }}
            >
              <FolderIcon size={130} label={f.name} glow={f.glow} />
            </div>
          ))}
        </div>
      </StepCard>
      <CursorAt
        fromFrame={260}
        toFrame={295}
        fromX={1500}
        fromY={700}
        toX={830}
        toY={620}
        visibleUntil={step2End}
      />

      {/* STEP 3 — Describe it / Working / Actions */}
      <StepCard
        stepLabel={inWorking ? "" : "Step 3 of 3"}
        title={inWorking ? "Working on it…" : "Describe it in your own words."}
        enterFrom={step3Enter}
        exitFrom={1000}
        exitTo={1001}
        visibleUntil={749}
      >
        {!inWorking ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: 720,
                minHeight: 140,
                background: palette.paper,
                border: `2px solid ${palette.folderYellow}`,
                borderRadius: 18,
                padding: 28,
                fontFamily: fontFamily.display,
                fontSize: 30,
                fontWeight: 500,
                color: palette.ink,
                letterSpacing: "-0.01em",
                display: "flex",
                alignItems: "center",
                boxShadow: `inset 0 2px 4px ${palette.shadowSoft}`,
                boxSizing: "border-box",
              }}
            >
              {typedText}
              {showCaret ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 32,
                    background: palette.ink,
                    marginLeft: 4,
                  }}
                />
              ) : null}
            </div>
            <div
              style={{
                width: 140,
                height: 56,
                borderRadius: 14,
                background: palette.folderYellow,
                color: palette.ink,
                fontWeight: 800,
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 18px ${palette.shadowMid}`,
                letterSpacing: "-0.01em",
                transform: `scale(${sendBumpScale})`,
              }}
            >
              Send
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              marginTop: 8,
            }}
          >
            {frame < actionsStart ? <BouncingDots /> : null}
            {frame >= 540 ? (
              <ActionCard appearAt={540} text="Building your feature…" />
            ) : null}
            {frame >= 570 ? (
              <ActionCard appearAt={570} text="Saving your changes…" />
            ) : null}
            {frame >= 600 ? (
              <ActionCard appearAt={600} text="Sharing your work…" />
            ) : null}
            {frame >= 630 ? (
              <ActionCard appearAt={630} text="Done!" emphasis />
            ) : null}
          </div>
        )}
      </StepCard>
      <CursorAt
        fromFrame={480}
        toFrame={500}
        fromX={1300}
        fromY={780}
        toX={1020}
        toY={780}
        visibleUntil={workingStart}
      />

      {/* Green chip top-left */}
      {chipVisible ? (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            transform: `translateY(${chipFloat}px) scale(${chipScale}) rotate(${chipRotate}deg)`,
            transformOrigin: "left center",
            zIndex: 100,
          }}
        >
          <GreenChip count={1} label="feature added today" size="lg" />
        </div>
      ) : null}

      {/* Bottom caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          display: "flex",
          justifyContent: "center",
          opacity: captionFade,
        }}
      >
        <Caption size="md" tone="soft">
          No commands. No setup. Just describe what you want.
        </Caption>
      </div>
    </AbsoluteFill>
  );
};
