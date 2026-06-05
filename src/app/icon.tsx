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
          {/* AI Star 4-point */}
          <path
            d="M16 1 L17.2 5 L21 6.5 L17.2 8 L16 12 L14.8 8 L11 6.5 L14.8 5 Z"
            fill="#f59e0b"
            stroke="none"
          />
          {/* Cauldron rim */}
          <ellipse cx="16" cy="15" rx="9" ry="2.5" />
          {/* Cauldron body */}
          <path d="M7 15 L25 15 L23 27 Q22 28.5 16 28.5 Q10 28.5 9 27 Z" />
          {/* Bubble left */}
          <circle cx="11" cy="20" r="1.2" fill="#f59e0b" fillOpacity="0.5" />
          {/* Bubble right */}
          <circle cx="19" cy="22" r="1" fill="#f59e0b" fillOpacity="0.5" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
