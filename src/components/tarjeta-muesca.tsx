import Link from "next/link";
import type { ReactNode } from "react";
import { Ayuda } from "@/components/ayuda";
import type { TemaAyuda } from "@/lib/glosario";

// Tarjeta con muesca del sistema de diseño GreenLand: sin relleno, contorno de 1,5 px en #027001, esquinas de 20 px y el
// título en una pill verde sólida montada sobre el borde superior. El contenido va centrado.
export function TarjetaMuesca({ titulo, tema, href, clase = "", children }: { titulo: string; tema?: TemaAyuda; href?: string; clase?: string; children: ReactNode }) {
  const caja = "block px-4 pb-4 pt-6 text-center lg:flex lg:h-full lg:flex-col lg:items-center lg:justify-center";
  const contenido = href ? <Link href={href} className={caja}>{children}</Link> : <div className={caja}>{children}</div>;
  const pill = <span className="absolute left-1/2 top-0 z-10 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-leaf-500 px-3 py-0.5 text-center text-[11px] font-medium leading-tight text-white">{titulo}</span>;
  const base = `rounded-card border-[1.5px] border-leaf-500 bg-white lg:h-full ${clase}`;
  return tema
    ? <Ayuda modo="tarjeta" tema={tema} className={base}>{pill}{contenido}</Ayuda>
    : <div className={`relative ${base}`}>{pill}{contenido}</div>;
}
