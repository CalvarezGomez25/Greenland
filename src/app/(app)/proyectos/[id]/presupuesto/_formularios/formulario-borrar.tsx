"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

// Formulario genérico para borrar algo: el motivo es obligatorio y queda en el registro de cambios.
export function FormularioBorrar({
  accion,
  campos = {},
  textoBoton = "Borrar",
  ayuda,
  alCancelar,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  campos?: Record<string, string>;
  textoBoton?: string;
  ayuda?: string;
  alCancelar?: () => void;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex flex-col gap-3">
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      {ayuda && <p className="text-sm text-muted">{ayuda}</p>}
      <Campo
        etiqueta="Motivo (obligatorio)"
        name="motivo"
        required
        minLength={3}
        maxLength={500}
        defaultValue={estado.valores?.motivo ?? ""}
      />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.peligro} textoEnviando="Borrando…">
          {textoBoton}
        </BotonEnviar>
        {alCancelar && (
          <button type="button" onClick={alCancelar} className={claseBoton.contorno}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
