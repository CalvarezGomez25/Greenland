"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioFestivo({ accion }: { accion: (a: Estado, d: FormData) => Promise<Estado> }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} key={estado.valores?.listo ?? "i"} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Fecha" name="fecha" type="date" required defaultValue={estado.valores?.fecha ?? ""} />
      <Campo etiqueta="Nombre" name="nombre" required maxLength={100} defaultValue={estado.valores?.nombre ?? ""} />
      <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Agregar festivo</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}
