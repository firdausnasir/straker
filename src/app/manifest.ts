import type { MetadataRoute } from "next";

// Web app manifest (served at /manifest.webmanifest). Colors mirror the
// Statement palette: paper background, oxblood theme. `display: standalone`
// drops browser chrome when installed to the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Straker — Commitment Tracker",
    short_name: "Straker",
    description: "Track subscriptions, recurring bills, and loans in MYR and USD.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfbf9",
    theme_color: "#8e2c3a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
