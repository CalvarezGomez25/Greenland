import type { Metadata } from "next";
import "./globals.css";
import { NOMBRE_EMPRESA, NOMBRE_PLATAFORMA } from "@/lib/marca";

export const metadata: Metadata = {
  title: `${NOMBRE_PLATAFORMA} · ${NOMBRE_EMPRESA}`,
  description: "Gestión de obras: control financiero, avance y documentos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
