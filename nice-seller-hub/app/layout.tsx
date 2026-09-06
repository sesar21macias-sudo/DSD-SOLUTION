import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NICE Seller Hub",
    template: "%s | NICE Seller Hub",
  },
  description:
    "Cada distribuidora NICE con su propia tienda digital, basada en el inventario que de verdad tiene disponible.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  // La tienda se ve en el telefono; dejar hacer zoom es accesibilidad basica.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
