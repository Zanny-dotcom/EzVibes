import React from "react";

type Props = {
  size?: number;
};

export const Cursor: React.FC<Props> = ({ size = 56 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }}
  >
    <path
      d="M3 2 L21 12 L12.5 13.5 L9.5 21 Z"
      fill="white"
      stroke="black"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);
