"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { guiaDeRuta } from "@/lib/guia-de-ruta";

// Barra superior de las pantallas de un proyecto: «Ver guía» del módulo y el nombre del proyecto que se está viendo.
export function BarraProyecto({ id, nombre, codigo }: { id: string; nombre: string; codigo: string | null }) {
  const guia = guiaDeRuta(usePathname());
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      {guia && (
        <Link href={`/glosario#guia-${guia}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf-600 hover:underline">
          <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-leaf-600/60 text-[10px] font-bold leading-none">?</span>
          Ver guía
        </Link>
      )}
      <Link href={`/proyectos/${id}`} title={nombre} className="max-w-full truncate rounded-full border border-soil-border bg-leaf-50 px-3.5 py-1.5 text-sm font-medium text-leaf-900 hover:bg-leaf-100">
        {nombre}{codigo && <span className="ml-2 text-xs font-normal text-muted">{codigo}</span>}
      </Link>
    </div>
  );
}
