import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beaufort Floor Live",
    short_name: "Floor Live",
    description: "Métricas de planta en vivo. · Live plant metrics.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ src: "/icon.png", sizes: "64x64", type: "image/png" }],
  };
}
