"use client";

import { useActionState, useState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { FormularioBorrar } from "./formulario-borrar";

export function FormularioGasto({
  accion,
  meses,
  registrados,
  mesSugerido,
}: {
  accion: (anterior: Estado, datos: FormData) => Promise<Estado>;
  meses: number;
  registrados: number[];
  mesSugerido: number;
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (clave: string) => estado.valores?.[clave] ?? "";

  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "inicial"} className="flex max-w-xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Mes" name="mes" required defaultValue={v("mes") || String(mesSugerido)}>
          {Array.from({ length: meses }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              Mes {m}
              {registrados.includes(m) ? " (ya registrado: se corregirá)" : ""}
            </option>
          ))}
        </Selector>
        <Campo
          etiqueta="Gasto del mes (COP)"
          name="valor"
          required
          inputMode="decimal"
          defaultValue={v("valor")}
          ayuda="Formato colombiano (1.234.567,50). Hasta 2 decimales."
        />
      </div>
      <Campo etiqueta="Motivo (opcional)" name="motivo" maxLength={500} defaultValue={v("motivo")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div>
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">
          Guardar gasto
        </BotonEnviar>
      </div>
    </form>
  );
}

// Botón "Borrar" de una fila que se despliega en un formulario con el motivo obligatorio.
export function BorrarMes({ accion, mes }: { accion: (anterior: Estado, datos: FormData) => Promise<Estado>; mes: number }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-sm font-medium text-danger underline">
        Borrar
      </button>
    );
  }
  return (
    <div className="min-w-[260px] rounded-[10px] border border-danger/30 bg-red-50 p-3 text-left">
      <FormularioBorrar accion={accion} campos={{ mes: String(mes) }} textoBoton={`Borrar mes ${mes}`} alCancelar={() => setAbierto(false)} />
    </div>
  );
}
