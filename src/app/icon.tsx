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
          {/* Star 4-point (top) */}
          <path
            d="M16 1.5 L17.2 4.8 L20.5 6 L17.2 7.2 L16 10.5 L14.8 7.2 L11.5 6 L14.8 4.8 Z"
            fill="#f59e0b"
            stroke="none"
          />
          {/* Foam bubbles */}
          <circle cx="10" cy="9" r="1.4" fill="#f59e0b" fillOpacity="0.85" />
          <circle cx="14" cy="8" r="1.6" fill="#f59e0b" fillOpacity="0.85" />
          <circle cx="18.5" cy="8" r="1.5" fill="#f59e0b" fillOpacity="0.85" />
          <circle cx="22" cy="9.2" r="1.2" fill="#f59e0b" fillOpacity="0.85" />
          {/* Mug body */}
          <path d="M7 12 L25 12 L24 28 Q24 29 23 29 L9 29 Q8 29 8 28 Z" />
          {/* Handle */}
          <path d="M25 16 Q29 16 29 20 Q29 24 25 24" />
          {/* Liquid line */}
          <line x1="9" y1="14.5" x2="23" y2="14.5" strokeOpacity="0.45" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
