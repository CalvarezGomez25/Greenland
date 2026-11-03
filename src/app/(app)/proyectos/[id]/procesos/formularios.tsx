"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { CRITERIOS, ETIQUETA_ESTADO_OFERTA, ETIQUETA_ESTADO_PROCESO, ETIQUETA_TIPO_SERVICIO } from "@/lib/contratos/ofertas";

type Accion = (a: Estado, d: FormData) => Promise<Estado>;

export function FormularioProceso({ accion, iniciales, volverA }: { accion: Accion; iniciales: Record<string, string>; volverA: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  const adjudicado = iniciales.estado === "adjudicada";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      <Campo etiqueta="Objeto y alcance" name="objeto" required maxLength={1000} defaultValue={v("objeto")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Tipo de servicio" name="tipo_servicio" defaultValue={v("tipo_servicio") || "otro"}>{Object.entries(ETIQUETA_TIPO_SERVICIO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</Selector>
        <Selector etiqueta="Estado" name="estado" defaultValue={v("estado") || "en_preparacion"} ayuda={adjudicado ? "Devolver la adjudicación solo es posible si aún no hay contrato." : "«Adjudicada» se llega con «Adjudicar» en la oferta ganadora."}>
          {Object.entries(ETIQUETA_ESTADO_PROCESO).filter(([k]) => k !== "adjudicada" || adjudicado).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </Selector>
        <Campo etiqueta="Modalidad (opcional)" tema="modalidad_proceso" name="modalidad" maxLength={100} defaultValue={v("modalidad")} />
        <Campo etiqueta="Gestor del proceso (opcional)" name="gestor" maxLength={200} defaultValue={v("gestor")} />
        <Campo etiqueta="Fecha de invitación" name="fecha_invitacion" type="date" defaultValue={v("fecha_invitacion")} />
        <Campo etiqueta="Cierre de propuestas" name="cierre_propuestas" type="date" defaultValue={v("cierre_propuestas")} />
        <Campo etiqueta="Presupuesto de referencia (COP, opcional)" tema="presupuesto_referencia" name="presupuesto_referencia" inputMode="decimal" defaultValue={v("presupuesto_referencia")} />
        <Campo etiqueta="Enlace a la carpeta (opcional)" name="enlace" type="url" maxLength={500} defaultValue={v("enlace")} />
      </div>
      <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={1000} defaultValue={v("observaciones")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3"><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar proceso</BotonEnviar><Link href={volverA} className={claseBoton.contorno}>Cancelar</Link></div>
    </form>
  );
}

export function FormularioOferta({ accion, oferentes, iniciales = {}, edicion = false, volverA }: { accion: Accion; oferentes: { id: string; etiqueta: string }[]; iniciales?: Record<string, string>; edicion?: boolean; volverA?: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  const marca = (k: string) => (estado.valores ? estado.valores[k] === "on" : iniciales[k] === "on");
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {edicion ? <p className="self-end text-sm"><strong>Oferente:</strong> {iniciales.oferente}</p> : (
          <div className="flex flex-col gap-1.5">
            <Selector etiqueta="Oferente (maestro de aliados)" tema="maestro_aliados" name="tercero_id" required defaultValue={v("tercero_id")}>
              <option value="">Elige…</option>
              {oferentes.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
            </Selector>
            <span className="text-xs text-muted">¿No está? <Link href="/aliados/nuevo" className="font-medium text-leaf-600 underline">Agrégalo al maestro</Link>.</span>
          </div>
        )}
        <Campo etiqueta="Ronda" tema="ronda_oferta" name="ronda" inputMode="numeric" maxLength={2} defaultValue={v("ronda") || "1"} ayuda={edicion ? "La ronda no cambia: registra otra oferta en la nueva ronda." : "Cada ronda se compara por separado."} readOnly={edicion} />
        <Selector etiqueta="Estado" name="estado" defaultValue={v("estado") || "invitado"} ayuda="«Adjudicada» se llega con «Adjudicar».">
          {Object.entries(ETIQUETA_ESTADO_OFERTA).filter(([k]) => k !== "adjudicada" || iniciales.estado === "adjudicada").map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </Selector>
        <Selector etiqueta="¿Habilitada? (jurídica, técnica y financiera)" tema="oferta_habilitada" name="habilitada" defaultValue={v("habilitada")}>
          <option value="">Sin definir</option><option value="si">Sí</option><option value="no">No (no recibe puntaje total)</option>
        </Selector>
        <Campo etiqueta="Fecha de recepción" name="fecha_recepcion" type="date" defaultValue={v("fecha_recepcion")} />
        <Campo etiqueta="Vigencia de la oferta hasta" name="vigencia_hasta" type="date" defaultValue={v("vigencia_hasta")} />
        <Campo etiqueta="Valor total (COP)" name="valor_total" inputMode="decimal" defaultValue={v("valor_total")} />
        <Campo etiqueta="Plazo (días)" name="plazo_dias" inputMode="numeric" maxLength={4} defaultValue={v("plazo_dias")} />
        <Campo etiqueta="AIU (%)" tema="aiu" name="aiu_pct" inputMode="decimal" defaultValue={v("aiu_pct")} />
        <Campo etiqueta="Anticipo (%)" tema="anticipo" name="anticipo_pct" inputMode="decimal" defaultValue={v("anticipo_pct")} />
      </div>
      <fieldset className="rounded-card border border-soil-border p-4">
        <legend className="px-1 text-sm font-medium text-leaf-800">Calificación cualitativa (1 a 5; se necesitan los cinco criterios)</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          {CRITERIOS.map((c) => (
            <Selector key={c.campo} etiqueta={c.etiqueta} name={c.campo} defaultValue={v(c.campo)}>
              <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Selector>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="incluye_polizas" defaultChecked={marca("incluye_polizas")} />Incluye pólizas</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="apu_discriminado" defaultChecked={marca("apu_discriminado")} />APU y AIU discriminados</label>
      </div>
      <Campo etiqueta="Enlace a la propuesta (opcional)" name="enlace" type="url" maxLength={500} defaultValue={v("enlace")} />
      <Campo etiqueta="Observaciones (opcional)" name="observaciones" maxLength={1000} defaultValue={v("observaciones")} />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div className="flex gap-3">
        <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">{edicion ? "Guardar cambios" : "Registrar oferta"}</BotonEnviar>
        {edicion && volverA && <Link href={volverA} className={claseBoton.contorno}>Cancelar</Link>}
      </div>
    </form>
  );
}
