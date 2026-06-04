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
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Glass body */}
          <path d="M5.5 4.5 L18 4.5 L15.5 19.5 L8 19.5 L5.5 4.5" />
          {/* Handle */}
          <path d="M18 7.5 C20.5 7.5 21.5 8.5 21.5 10 L21.5 10.5 C21.5 12 20.5 13 18 13" />
          {/* Foam */}
          <path d="M5 5 C9 2 14.5 2 18.5 5" strokeWidth="2.5" />
          {/* Bubbles */}
          <circle cx="9.5" cy="8.5" r="0.8" fill="#f59e0b" stroke="none" />
          <circle cx="13" cy="10.5" r="0.7" fill="#f59e0b" stroke="none" />
          <circle cx="10" cy="13" r="0.6" fill="#f59e0b" stroke="none" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
