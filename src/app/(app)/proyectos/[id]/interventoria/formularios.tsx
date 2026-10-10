"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { ALCANCES } from "@/lib/interventoria";
import type { Opcion } from "@/lib/registros/tipos";

export function FormularioAlcance({ accion, interventoria, obra }: { accion: (a: Estado, d: FormData) => Promise<Estado>; interventoria: Opcion[]; obra: Opcion[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex max-w-2xl flex-col gap-4">
      <Selector etiqueta="Contrato de interventoría" name="contrato_interventoria_id" defaultValue={estado.valores?.contrato_interventoria_id ?? ""}>
        <option value="">— Sin contrato registrado —</option>{interventoria.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </Selector>
      <Selector etiqueta="Contrato vigilado" name="contrato_vigilado_id" defaultValue={estado.valores?.contrato_vigilado_id ?? ""} ayuda="Sin contrato vigilado (antes de la obra) solo se accede a documentos, revisiones de diseño y asesorías.">
        <option value="">— Ninguno (diseños y asesoría antes de la obra) —</option>{obra.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </Selector>
      <fieldset>
        <legend className="text-[13px] font-medium text-leaf-800">Alcances que cubre</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{ALCANCES.map(([k, t]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name="alcances" value={k} className="h-4 w-4" /> {t}</label>)}</div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Vigente desde (opcional)" name="fecha_inicio" type="date" /><Campo etiqueta="Vigente hasta (opcional)" name="fecha_fin" type="date" />
      </div>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Crear asignación</BotonEnviar></div>
    </form>
  );
}
