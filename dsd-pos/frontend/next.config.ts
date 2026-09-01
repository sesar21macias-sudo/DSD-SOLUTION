import type { NextConfig } from "next";
import path from "path";

// Sin esto, Turbopack detecta mal la raiz del workspace por un
// package-lock.json suelto en C:\Users\sesar, y todas las subrutas (/pos/*)
// devuelven 404 aunque "/" cargue bien.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
