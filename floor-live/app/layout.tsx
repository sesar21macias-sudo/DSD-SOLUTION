import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Big_Shoulders, Big_Shoulders_Stencil, Instrument_Serif } from "next/font/google";
import { I18nProvider } from "@/components/I18n";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

// Títulos: serif elegante, igual que Progression.
const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

// Números de marcador: condensada, se lee de lejos y cabe grande en la tele.
const shoulders = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-shoulders",
  display: "swap",
  adjustFontFallback: false,
});

// Rótulos tipo esténcil de fábrica, solo para etiquetas cortas.
const stencil = Big_Shoulders_Stencil({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-stencil-face",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: "Beaufort Floor Live", template: "%s · Floor Live" },
  description: "Métricas de planta en vivo en cada pantalla. · Live plant metrics on every screen.",
  applicationName: "Beaufort Floor Live",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Floor Live" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} ${shoulders.variable} ${stencil.variable}`}
    >
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
