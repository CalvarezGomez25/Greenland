"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

type Accion = (a: Estado, d: FormData) => Promise<Estado>;

export function FormularioOrganizacion({ accion }: { accion: Accion }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} key={estado.valores?.listo ?? "i"} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Nombre de la organización" name="nombre" required maxLength={120} defaultValue={estado.valores?.nombre ?? ""} />
      <Selector etiqueta="Tipo" name="tipo">
        <option value="grupo">Grupo</option><option value="empresa">Empresa</option><option value="unidad">Unidad</option>
      </Selector>
      <BotonEnviar className={claseBoton.primario} textoEnviando="Creando…">Crear</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioPortafolio({ accion, organizaciones }: { accion: Accion; organizaciones: { id: string; nombre: string }[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} key={estado.valores?.listo ?? "i"} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Nombre del portafolio" name="nombre" required maxLength={120} defaultValue={estado.valores?.nombre ?? ""} />
      <Selector etiqueta="Organización" name="organizacion" required>
        {organizaciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </Selector>
      <BotonEnviar className={claseBoton.primario} textoEnviando="Creando…">Crear</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}
