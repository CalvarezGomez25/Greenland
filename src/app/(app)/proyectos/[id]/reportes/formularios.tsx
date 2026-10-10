"use client";

import { useActionState } from "react";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";

type Accion = (a: Estado, d: FormData) => Promise<Estado>;

export function FormularioNuevoReporte({ accion, hoy }: { accion: Accion; hoy: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Un día de la semana a reportar" name="fecha_reporte" type="date" required defaultValue={estado.valores?.fecha_reporte ?? hoy} />
      <BotonEnviar className={claseBoton.primario} textoEnviando="Creando…">Crear reporte</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioEvaluacion({ accion, mesActual }: { accion: Accion; mesActual: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <Campo etiqueta="Mes" name="mes" type="month" required defaultValue={estado.valores?.mes ?? mesActual} />
      <Selector etiqueta="Puntaje del patrocinador" name="puntaje" required defaultValue={estado.valores?.puntaje ?? ""}>
        <option value="">Elige…</option>
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
      </Selector>
      <BotonEnviar className={claseBoton.secundario} textoEnviando="Guardando…">Guardar evaluación</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioReporte({ accion, iniciales }: { accion: Accion; iniciales: Record<string, string> }) {
  const [estado, enviar, pendiente] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  const area = (k: string, t: string) => (
    <label key={k} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-leaf-800">{t}</span>
      <textarea name={k} rows={3} maxLength={4000} defaultValue={v(k)} className="w-full rounded-[10px] border border-soil-border bg-white px-3.5 py-2.5 text-[15px] font-light text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-[3px] focus:ring-leaf-500/30" />
    </label>
  );
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Estado general que reporta el gerente" name="estado_reportado" required defaultValue={v("estado_reportado") || "verde"}>
          <option value="verde">Verde — En tiempo y presupuesto</option>
          <option value="amarillo">Amarillo — Con alertas</option>
          <option value="rojo">Rojo — Requiere atención</option>
        </Selector>
        <Campo etiqueta="Próxima revisión" name="proxima_revision" type="date" defaultValue={v("proxima_revision")} />
      </div>
      {area("logros", "Logros de la semana")}
      {area("alertas", "Alertas y riesgos activos")}
      {area("decisiones_requeridas", "Decisiones requeridas de la dirección")}
      {area("proximos_hitos", "Próximos hitos (2 semanas)")}
      <p className="text-sm text-muted">Al enviar, los indicadores quedan fijos y el reporte ya no se puede modificar.</p>
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="accion" value="guardar" disabled={pendiente} className={claseBoton.secundario}>{pendiente ? "Procesando…" : "Guardar borrador"}</button>
        <button type="submit" name="accion" value="enviar" disabled={pendiente} className={claseBoton.primario}>{pendiente ? "Procesando…" : "Guardar y enviar"}</button>
      </div>
    </form>
  );
}
