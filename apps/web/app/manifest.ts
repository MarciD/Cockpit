import type { MetadataRoute } from "next";

// Makes the dashboard installable (add-to-home-screen) in standalone mode.
// Colours mirror the Atelier canvas token (`bg` #e8e1d3 in lib/theme.ts); a
// manifest can't reference CSS tokens, so the hex is duplicated intentionally.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "cockpit",
    short_name: "cockpit",
    description: "Personal work dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#e8e1d3",
    theme_color: "#e8e1d3",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
