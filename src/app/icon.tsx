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
          borderRadius: "20%",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 3 C5 -3, 19 -3, 17 3" />
          <path d="M4 6 L5.5 17 C6.5 19.5, 17.5 19.5, 18.5 17 L20 6" strokeWidth="1.5" />
          <path d="M3.5 6 C3.5 8, 20.5 8, 20.5 6" strokeWidth="2.2" />
          <line x1="7.5" y1="18" x2="7" y2="22" />
          <line x1="12" y1="18.5" x2="12" y2="22" />
          <line x1="16.5" y1="18" x2="17" y2="22" />
          <circle cx="9" cy="11" r="1" />
          <circle cx="13" cy="12.5" r="0.8" />
          <circle cx="11" cy="14" r="0.7" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
