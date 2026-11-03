"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export function FormularioDocumento({ accion, tipos }: { accion: (a: Estado, d: FormData) => Promise<Estado>; tipos: { nombre: string; vigencia_dias: number }[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Tipo de documento" name="tipo" required defaultValue={v("tipo")} ayuda="La vigencia sale del tipo; un documento nuevo del mismo tipo reemplaza al anterior.">
          <option value="">Elige…</option>
          {tipos.map((t) => <option key={t.nombre} value={t.nombre}>{t.nombre}{t.vigencia_dias >= 36500 ? "" : ` (${t.vigencia_dias} días)`}</option>)}
        </Selector>
        <Campo etiqueta="Fecha de expedición" name="fecha_expedicion" type="date" required defaultValue={v("fecha_expedicion")} />
        <Campo etiqueta="Enlace al soporte (OneDrive o SharePoint)" name="enlace" type="url" maxLength={500} defaultValue={v("enlace")} />
        <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={500} defaultValue={v("observaciones")} />
      </div>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Registrar documento</BotonEnviar></div>
    </form>
  );
}
