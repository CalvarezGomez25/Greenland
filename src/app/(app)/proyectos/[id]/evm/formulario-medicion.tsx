"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioMedicion({ accion, iniciales }: { accion: (a: Estado, d: FormData) => Promise<Estado>; iniciales: Record<string, string> }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="grid max-w-3xl gap-4 sm:grid-cols-3">
      <Campo etiqueta="Fecha de corte" name="fecha_corte" type="date" required defaultValue={v("fecha_corte")} />
      <Campo etiqueta="BAC (COP)" name="bac" required inputMode="decimal" defaultValue={v("bac")} ayuda="Presupuesto base de costo" />
      <Campo etiqueta="PV — valor planificado (COP)" name="pv" required inputMode="decimal" defaultValue={v("pv")} />
      <Campo etiqueta="EV — valor ganado (COP)" name="ev" required inputMode="decimal" defaultValue={v("ev")} />
      <Campo etiqueta="AC — costo real (COP)" name="ac" required inputMode="decimal" defaultValue={v("ac")} />
      <p className="self-end text-xs text-muted">Formato colombiano (1.234.567,50). Si ya hay una medición con esa fecha, se corrige.</p>
      {estado.error && <div className="sm:col-span-3"><Aviso>{estado.error}</Aviso></div>}
      <div className="sm:col-span-3"><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar medición</BotonEnviar></div>
    </form>
  );
}
