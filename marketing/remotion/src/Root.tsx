import React from "react";
import { Composition } from "remotion";
import { TOTAL_FRAMES, FPS } from "./theme/tokens";
import { MainVideo } from "./compositions/MainVideo";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="EZvibesMain"
        component={MainVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="EZvibesShorts"
        component={MainVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
