import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hay otros lockfiles arriba en el arbol de carpetas; anclar el trazado aqui
  // evita que Next incluya archivos de proyectos vecinos en el bundle.
  outputFileTracingRoot: path.resolve(),
  images: {
    // El optimizador de imagenes de Next no corre en Workers; las fotos de
    // producto se sirven tal cual desde su origen.
    unoptimized: true,
  },
};

export default nextConfig;

// Da acceso a los bindings de Cloudflare (D1, secrets) durante `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
