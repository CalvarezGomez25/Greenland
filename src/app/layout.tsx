import type { Metadata } from "next";
import "./globals.css";
import { LEMA_PLATAFORMA, NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "@/lib/marca";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`,
  description: `${LEMA_PLATAFORMA}: portafolio, obra, contratos e interventoría.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
