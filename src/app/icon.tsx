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
          <path d="M16 7 L17 12 L21 13 L17 14 L16 18 L15 14 L11 13 L15 12 Z" />
          <path
            d="M6 21 L7 24 L10 25 L7 26 L6 29 L5 26 L2 25 L5 24 Z"
            transform="translate(2,0)"
          />
          <path
            d="M26 21 L27 24 L30 25 L27 26 L26 29 L25 26 L22 25 L25 24 Z"
            transform="translate(-2,0)"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
