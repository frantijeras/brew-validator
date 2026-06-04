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
          viewBox="0 0 32 32"
          width="28"
          height="28"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Handle */}
          <path d="M9 6 C9 -2, 23 -2, 23 6" strokeWidth="2.5" />
          {/* Rim */}
          <ellipse cx="16" cy="7" rx="10" ry="3" strokeWidth="2.5" />
          {/* Bowl */}
          <path d="M6 7 C6 7, 4 28, 10 27 C14 26.5, 18 26.5, 22 27 C28 28, 26 7, 26 7" />
          {/* Bubbles */}
          <circle cx="12" cy="15" r="2" />
          <circle cx="18" cy="19" r="1.5" />
          <circle cx="14" cy="22" r="1" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
