import { ImageResponse } from "next/og";

export const alt = "RbNotes -- a minimalist, Vim-first notes app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colors lifted straight from public/logo.svg and the app's own theme
// tokens (rbnotes-theme.ts), not reinvented, so the shared-link preview
// actually looks like the product.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0c0e10",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 24,
              backgroundColor: "#121416",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div style={{ fontSize: 92, fontWeight: 700, color: "#e2e8f0" }}>R</div>
            <div
              style={{
                position: "absolute",
                right: 30,
                bottom: 34,
                width: 16,
                height: 42,
                backgroundColor: "#4be277",
              }}
            />
          </div>
          <div style={{ fontSize: 104, fontWeight: 700, color: "#e2e2e5", letterSpacing: -2 }}>
            RbNotes
          </div>
        </div>
        <div style={{ marginTop: 40, fontSize: 34, color: "#869585" }}>
          A minimalist, Vim-first notes app
        </div>
      </div>
    ),
    { ...size },
  );
}
