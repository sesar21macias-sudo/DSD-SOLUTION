import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agente WhatsApp",
  description: "Dashboard local del agente de WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
