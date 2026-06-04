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
          <path d="M6 4 C6 -1, 18 -1, 18 4" />
          <path d="M4.5 5.5 L6 17 C6.6 20, 9 22, 12 22 C15 22, 17.4 20, 18 17 L19.5 5.5" />
          <path d="M4 5.5 C4 6.5, 20 6.5, 20 5.5" strokeWidth="2" />
          <circle cx="9" cy="10" r="1.2" />
          <circle cx="14" cy="12" r="0.9" />
          <circle cx="11" cy="14" r="1" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
