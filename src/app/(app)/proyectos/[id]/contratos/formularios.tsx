"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { ETIQUETA_TIPO_CONTRATO, TIPOS_CONTRATO } from "@/lib/obra/contratos";

type Accion = (a: Estado, d: FormData) => Promise<Estado>;

export function FormularioContrato({ accion, iniciales, volverA }: { accion: Accion; iniciales: Record<string, string>; volverA: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Tipo de contrato" name="tipo" required defaultValue={v("tipo") || "obra"}>
          {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_CONTRATO[t]}</option>)}
        </Selector>
        <Campo etiqueta="Contratista / proveedor" name="contratista" required maxLength={200} defaultValue={v("contratista")} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-leaf-800">Objeto del contrato</span>
        <textarea name="objeto" rows={3} required maxLength={1000} defaultValue={v("objeto")} className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
      </label>
      <Campo etiqueta="Valor del contrato (COP)" name="valor" required inputMode="decimal" defaultValue={v("valor")} ayuda="Formato colombiano (1.234.567,50). La retención de garantía se fija con el porcentaje vigente hoy." />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3"><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar><Link href={volverA} className={claseBoton.contorno}>Cancelar</Link></div>
    </form>
  );
}

export function FormularioAnticipo({ accion, pctActual, maximo }: { accion: Accion; pctActual: string; maximo: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string, r: string) => estado.valores?.[k] ?? r;
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta={`Anticipo (% del valor, máximo ${maximo} %)`} name="pct" required inputMode="decimal" defaultValue={v("pct", pctActual)} />
      <Campo etiqueta="Motivo (urgencia o necesidad)" name="motivo" maxLength={500} defaultValue={v("motivo", "")} className="min-w-[260px] flex-1" />
      <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">Autorizar anticipo</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioActa({ accion, hoy }: { accion: Accion; hoy: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string, r: string) => estado.valores?.[k] ?? r;
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Fecha del acta" name="fecha" type="date" required defaultValue={v("fecha", hoy)} />
      <Campo etiqueta="Valor bruto (COP)" name="bruto" required inputMode="decimal" defaultValue={v("bruto", "")} ayuda="La amortización, la retención y el neto se calculan solos." />
      <BotonEnviar className={claseBoton.primario} textoEnviando="Radicando…">Radicar acta</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}
