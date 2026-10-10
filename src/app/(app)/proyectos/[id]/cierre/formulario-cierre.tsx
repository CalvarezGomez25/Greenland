"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioCierre({ accion, hoy }: { accion: (a: Estado, d: FormData) => Promise<Estado>; hoy: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string, r = "") => estado.valores?.[k] ?? r;
  return (
    <form action={enviar} onSubmit={(e) => { if (!window.confirm("¿Cerrar el proyecto? Saldrá del dashboard activo y quedará en el histórico.")) e.preventDefault(); }} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha de entrega" name="fecha_entrega" type="date" required defaultValue={v("fecha_entrega", hoy)} />
        <Campo etiqueta="Quién recibe el proyecto" name="receptor" required maxLength={200} defaultValue={v("receptor")} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Observaciones del acta de entrega (opcional)</span>
        <textarea name="observaciones" rows={3} maxLength={4000} defaultValue={v("observaciones")} className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
      </label>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div><BotonEnviar className={claseBoton.primario} textoEnviando="Cerrando…">Cerrar el proyecto</BotonEnviar></div>
    </form>
  );
}
