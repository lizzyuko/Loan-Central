"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
          <div style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h1 style={{ fontSize: "1.75rem" }}>Something went wrong</h1>
            <p style={{ color: "var(--color-text-secondary)" }}>We hit an unexpected problem. Please try again.</p>
            <div>
              <button
                type="button"
                onClick={reset}
                style={{ padding: "0.75rem 1.25rem", borderRadius: 10, border: 0, background: "var(--color-primary)", color: "var(--color-on-primary)" }}
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
