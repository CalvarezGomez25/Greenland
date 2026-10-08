"use client";

import { useActionState } from "react";
import { asignarMiembro, type EstadoMiembro } from "./acciones";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Selector, claseBoton } from "@/components/ui";
import { ETIQUETA_ROL_PROYECTO, ROLES_PROYECTO } from "@/lib/tipos";

export function FormularioAsignar({
  proyectoId,
  candidatos,
}: {
  proyectoId: string;
  candidatos: { id: string; nombre: string; correo: string | null }[];
}) {
  const [estado, accion] = useActionState<EstadoMiembro, FormData>(
    asignarMiembro.bind(null, proyectoId),
    {},
  );

  if (candidatos.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay más personas para asignar. Crea usuarios nuevos desde el panel de Supabase
        (Authentication → Users).
      </p>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Selector etiqueta="Persona" name="usuario_id" required defaultValue="">
          <option value="" disabled>
            Elegir…
          </option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.correo && c.correo !== c.nombre ? ` (${c.correo})` : ""}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Rol en este proyecto" name="rol" required defaultValue="consulta">
          {ROLES_PROYECTO.map((r) => (
            <option key={r} value={r}>
              {ETIQUETA_ROL_PROYECTO[r]}
            </option>
          ))}
        </Selector>
        <BotonEnviar className={claseBoton.primario} textoEnviando="Asignando…">
          Asignar
        </BotonEnviar>
      </div>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      {estado.ok && <Aviso tipo="ok">{estado.ok}</Aviso>}
    </form>
  );
}
