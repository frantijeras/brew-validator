import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
        }}
      >
        <svg
          viewBox="0 0 32 32"
          width="32"
          height="32"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 14 L25 14 L23 26 L9 26 Z" />
          <ellipse cx="16" cy="14" rx="9" ry="2" />
          <path d="M10 6 L10 10 M8 8 L12 8" />
          <path d="M22 6 L22 10 M20 8 L24 8" />
          <path d="M16 3 L16 6 M14 4.5 L18 4.5" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
