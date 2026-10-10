"use client";

import { BotonEnviar } from "@/components/boton-enviar";
import { claseBoton } from "@/components/ui";

export function BotonBorrar({ accion, texto }: { accion: () => Promise<void>; texto: string }) {
  return (
    <form
      action={accion}
      onSubmit={(e) => {
        if (!window.confirm(`¿Seguro que quieres eliminar ${texto}? No se puede deshacer.`)) e.preventDefault();
      }}
    >
      <BotonEnviar className={claseBoton.peligro} textoEnviando="Eliminando…">Eliminar</BotonEnviar>
    </form>
  );
}
