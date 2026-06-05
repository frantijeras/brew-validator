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
          {/* Cauldron body */}
          <path d="M6 12 L26 12 L24 26 Q23 28.5 16 28.5 Q9 28.5 8 26 Z" />
          {/* Cauldron rim */}
          <ellipse cx="16" cy="12" rx="10" ry="2.5" />
          {/* AI Star 4-point */}
          <path
            d="M16 16 L17.4 19.2 L21 20.5 L17.4 21.8 L16 25 L14.6 21.8 L11 20.5 L14.6 19.2 Z"
            fill="#f59e0b"
            stroke="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
