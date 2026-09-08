import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DSD Seller Hub",
    template: "%s | DSD Seller Hub",
  },
  description:
    "Cada distribuidora con su propia tienda digital, basada en el inventario que de verdad tiene disponible.",
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
    /*
      `suppressHydrationWarning` porque el script de abajo le pone una clase a
      <html> antes de que React hidrate. Sin esto React lo lee como una
      diferencia entre servidor y cliente y llena la consola de avisos; es el
      mismo patron que usa cualquier script de tema oscuro.
    */
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          Marca que si hay JavaScript, antes de que se pinte nada.
          Las animaciones de entrada por scroll empiezan invisibles, y sin esta
          marca un navegador con el script bloqueado —o un lector que falle al
          cargarlo— se quedaria con media pagina en blanco de forma permanente.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'document.documentElement.classList.add("js");' +
              // Red de seguridad: si React nunca llega a hidratar —un error de
              // JavaScript, una red que se corto a medias— nadie se queda
              // mirando una pagina en blanco. A los 4 segundos todo se ve.
              'setTimeout(function(){document.documentElement.classList.add("reveal-all")},4000);',
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
