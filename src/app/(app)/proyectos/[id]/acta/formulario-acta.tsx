"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

export type ValoresActa = Record<string, string>;

const AREAS: [string, string][] = [
  ["proposito", "Propósito y justificación"],
  ["objetivo_smart", "Objetivo SMART"],
  ["beneficios", "Beneficios esperados"],
  ["alcance_incluido", "Alcance incluido"],
  ["alcance_excluido", "Alcance excluido"],
  ["supuestos", "Supuestos"],
  ["restricciones", "Restricciones"],
  ["contratistas_externos", "Contratistas externos"],
];

export function FormularioActa({ accion, iniciales }: { accion: (a: Estado, d: FormData) => Promise<Estado>; iniciales: ValoresActa }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      {AREAS.map(([k, t]) => (
        <label key={k} className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-leaf-800">{t}</span>
          <textarea name={k} rows={3} maxLength={4000} defaultValue={v(k)}
            className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
        </label>
      ))}
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Presupuesto total estimado (COP)" name="presupuesto_estimado" inputMode="decimal" defaultValue={v("presupuesto_estimado")} ayuda="Es una referencia: el BAC nace del presupuesto aprobado." />
        <Campo etiqueta="Fuente de financiamiento" name="fuente_financiamiento" maxLength={500} defaultValue={v("fuente_financiamiento")} />
        <Campo etiqueta="Personas en el equipo" name="equipo_n" inputMode="numeric" defaultValue={v("equipo_n")} />
      </div>
      <p className="text-sm text-muted">Si cambias el contenido de un acta ya firmada, las firmas se anulan y hay que firmar de nuevo.</p>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar acta</BotonEnviar></div>
    </form>
  );
}
