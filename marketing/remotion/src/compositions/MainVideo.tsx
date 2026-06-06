import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { sceneRanges, palette } from "../theme/tokens";
import { SceneWall } from "../scenes/SceneWall";
import { ScenePromise } from "../scenes/ScenePromise";
import { SceneReveal } from "../scenes/SceneReveal";
import { ScenePickAndAsk } from "../scenes/ScenePickAndAsk";
import { SceneMagic } from "../scenes/SceneMagic";
import { SceneWin } from "../scenes/SceneWin";
import { SceneCTA } from "../scenes/SceneCTA";

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: palette.cream }}>
      <Sequence from={sceneRanges.wall.from} durationInFrames={sceneRanges.wall.durationInFrames}>
        <SceneWall />
      </Sequence>
      <Sequence from={sceneRanges.promise.from} durationInFrames={sceneRanges.promise.durationInFrames}>
        <ScenePromise />
      </Sequence>
      <Sequence from={sceneRanges.reveal.from} durationInFrames={sceneRanges.reveal.durationInFrames}>
        <SceneReveal />
      </Sequence>
      <Sequence from={sceneRanges.pickAndAsk.from} durationInFrames={sceneRanges.pickAndAsk.durationInFrames}>
        <ScenePickAndAsk />
      </Sequence>
      <Sequence from={sceneRanges.magic.from} durationInFrames={sceneRanges.magic.durationInFrames}>
        <SceneMagic />
      </Sequence>
      <Sequence from={sceneRanges.win.from} durationInFrames={sceneRanges.win.durationInFrames}>
        <SceneWin />
      </Sequence>
      <Sequence from={sceneRanges.cta.from} durationInFrames={sceneRanges.cta.durationInFrames}>
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
