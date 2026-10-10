"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { AMBITOS_CAMBIO } from "@/lib/pmo/cambios";

function Area({ nombre, etiqueta, valor, obligatorio }: { nombre: string; etiqueta: string; valor: string; obligatorio?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-leaf-800">{etiqueta}{obligatorio ? "" : " (opcional)"}</span>
      <textarea name={nombre} rows={3} maxLength={4000} required={obligatorio} defaultValue={valor}
        className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
    </label>
  );
}

export function FormularioCambio({
  accion, iniciales, tipos, riesgos, volverA, soloNotas = false,
}: {
  accion: (a: Estado, d: FormData) => Promise<Estado>;
  iniciales: Record<string, string>;
  tipos: string[];
  riesgos: { id: string; etiqueta: string }[];
  volverA: string;
  soloNotas?: boolean; // desde la aprobación solo se editan notas
}) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  const ambitosMarcados = new Set((estado.valores?.ambitos ?? iniciales.ambitos ?? "").split(",").filter(Boolean));

  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      {soloNotas ? (
        <>
          {["tipo", "descripcion_antes", "descripcion_despues", "justificacion", "impacto_alcance", "impacto_costo", "impacto_dias", "riesgo_id", "contrato_id"].map((k) => <input key={k} type="hidden" name={k} value={v(k)} />)}
          {(iniciales.ambitos ?? "").split(",").filter(Boolean).map((a) => <input key={a} type="hidden" name="ambitos" value={a} />)}
          {iniciales.detectado_sin_formato === "on" && <input type="hidden" name="detectado_sin_formato" value="on" />}
          <p className="text-sm text-muted">Este cambio ya está en aprobación o más adelante: solo se pueden editar las notas, el responsable de implementación y las lecciones aprendidas.</p>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selector etiqueta="Tipo de cambio" name="tipo" required defaultValue={v("tipo")}>
              <option value="">Elige…</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </Selector>
            <Selector etiqueta="Riesgo materializado que lo origina (opcional)" name="riesgo_id" defaultValue={v("riesgo_id")}>
              <option value="">— Ninguno —</option>
              {riesgos.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
            </Selector>
          </div>
          <Area nombre="descripcion_antes" etiqueta="Descripción: cómo está hoy" valor={v("descripcion_antes")} />
          <Area nombre="descripcion_despues" etiqueta="Descripción: cómo quedaría" valor={v("descripcion_despues")} obligatorio />
          <Area nombre="justificacion" etiqueta="Justificación" valor={v("justificacion")} obligatorio />
          <Area nombre="impacto_alcance" etiqueta="Impacto en el alcance" valor={v("impacto_alcance")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Impacto en costo (COP)" name="impacto_costo" inputMode="decimal" defaultValue={v("impacto_costo")} ayuda="Formato colombiano (1.234.567,50). Un ahorro lleva signo menos." />
            <Campo etiqueta="Impacto en tiempo (días)" name="impacto_dias" inputMode="numeric" defaultValue={v("impacto_dias")} ayuda="Positivo suma plazo; negativo lo reduce." />
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium text-leaf-800">Ámbitos afectados</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {AMBITOS_CAMBIO.map(([k, t]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="ambitos" value={k} defaultChecked={ambitosMarcados.has(k)} className="h-4 w-4" /> {t}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="detectado_sin_formato" defaultChecked={v("detectado_sin_formato") === "on" || v("detectado_sin_formato") === "true"} className="h-4 w-4" />
            Es un cambio ya ejecutado que se detectó sin formato (cuenta contra el KPI de cambios controlados)
          </label>
        </>
      )}
      <Campo etiqueta="Responsable de implementación (opcional)" name="responsable_implementacion" maxLength={200} defaultValue={v("responsable_implementacion")} />
      <Area nombre="observaciones" etiqueta="Observaciones" valor={v("observaciones")} />
      <Area nombre="lecciones" etiqueta="Lecciones aprendidas" valor={v("lecciones")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar</BotonEnviar>
        <Link href={volverA} className={claseBoton.contorno}>Cancelar</Link>
      </div>
    </form>
  );
}
