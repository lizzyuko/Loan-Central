import { ImageResponse } from "next/og";

// iOS home-screen icon: the Loan Central mark on the brand colour.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c5a4b" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M21.6 10.4a8 8 0 1 0 0 11.2" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2.6" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
