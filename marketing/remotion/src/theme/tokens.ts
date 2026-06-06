export const palette = {
  folderYellow: "#F4C430",
  folderYellowDeep: "#E0A800",
  folderShadow: "#9C7800",
  amber: "#F0A030",
  amberDeep: "#C97A00",
  teal: "#2BB5B3",
  green: "#2CCB57",
  greenDeep: "#1F9E42",
  cream: "#FFF8E7",
  paper: "#FFFDF7",
  ink: "#1B1B1B",
  inkSoft: "#3A3A3A",
  muted: "#8A8A8A",
  panel: "#FFFFFF",
  panelEdge: "#E6DFC9",
  terminalBg: "#1B1F24",
  terminalText: "#E6E6E6",
  scaryRed: "#C7332B",
  scaryBlue: "#4B6BCB",
  shadowSoft: "rgba(0, 0, 0, 0.08)",
  shadowMid: "rgba(0, 0, 0, 0.18)",
  shadowDeep: "rgba(0, 0, 0, 0.28)",
};

export const fontFamily = {
  display:
    '"Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  mono:
    '"JetBrains Mono", "Cascadia Mono", "Consolas", "SFMono-Regular", monospace',
};

export const DURATION_SECONDS = 120;
export const FPS = 30;
export const TOTAL_FRAMES = DURATION_SECONDS * FPS;

export const sceneRanges = {
  wall: { from: 0, durationInFrames: 12 * FPS },
  promise: { from: 12 * FPS, durationInFrames: 10 * FPS },
  reveal: { from: 22 * FPS, durationInFrames: 13 * FPS },
  pickAndAsk: { from: 35 * FPS, durationInFrames: 20 * FPS },
  magic: { from: 55 * FPS, durationInFrames: 25 * FPS },
  win: { from: 80 * FPS, durationInFrames: 20 * FPS },
  cta: { from: 100 * FPS, durationInFrames: 20 * FPS },
} as const;

export type Orientation = "landscape" | "portrait";

export const getOrientation = (width: number, height: number): Orientation =>
  width >= height ? "landscape" : "portrait";

export const pickByOrientation = <T,>(
  orientation: Orientation,
  landscape: T,
  portrait: T
): T => (orientation === "landscape" ? landscape : portrait);
