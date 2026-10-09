"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function BotonPlantilla({ accion }: { accion: (anterior: Estado, datos: FormData) => Promise<Estado> }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <BotonEnviar className={claseBoton.primario} textoEnviando="Creando…">
        Crear los conceptos habituales (en 0 %)
      </BotonEnviar>
      {estado.error && <Aviso>{estado.error}</Aviso>}
    </form>
  );
}
