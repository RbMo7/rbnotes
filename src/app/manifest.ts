import type { MetadataRoute } from "next";

/**
 * Signed-in-only app, so there's no marketing chrome here -- just enough
 * for "Add to Home Screen" to work and launch full-screen without the
 * browser chrome, matching the editor's own dark theme (see globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RbNotes",
    short_name: "RbNotes",
    description:
      "A minimalist, Vim-first notes app. Notes are buffers: :w to save, :q to leave, / to search -- no mouse required.",
    start_url: "/",
    display: "standalone",
    background_color: "#121416",
    theme_color: "#121416",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
