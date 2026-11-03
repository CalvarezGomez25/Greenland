"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BotonEnviar } from "@/components/boton-enviar";
import { Aviso, Campo, Selector, claseBoton } from "@/components/ui";
import type { Estado } from "@/lib/presupuesto/estado";
import { ETIQUETA_TIPO_CONTRATO, TIPOS_CONTRATO } from "@/lib/obra/contratos";

type Accion = (a: Estado, d: FormData) => Promise<Estado>;

export type OpcionTercero = { id: string; etiqueta: string };

export function FormularioContrato({ accion, iniciales, volverA, terceros }: { accion: Accion; iniciales: Record<string, string>; volverA: string; terceros: OpcionTercero[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Tipo de contrato" name="tipo" required defaultValue={v("tipo") || "obra"}>
          {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_CONTRATO[t]}</option>)}
        </Selector>
        <div className="flex flex-col gap-1.5">
          <Selector etiqueta="Contratista / proveedor (maestro de aliados)" name="tercero_id" required={!iniciales.contratista} defaultValue={v("tercero_id")}>
            <option value="">{iniciales.contratista ? "Sin ligar al maestro" : "Elige un tercero…"}</option>
            {terceros.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
          </Selector>
          <span className="text-xs text-muted">¿No está en la lista? <Link href="/aliados/nuevo" className="font-medium text-leaf-600 underline">Agrégalo al maestro</Link> y vuelve.</span>
        </div>
      </div>
      {iniciales.contratista && !iniciales.tercero_id && (
        <Campo etiqueta="Contratista (texto de un contrato anterior)" name="contratista" required maxLength={200} defaultValue={v("contratista")} ayuda="Elige arriba un tercero del maestro para reemplazar este texto." />
      )}
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

export function FormularioAsignacion({ accion, destinos, sinAsignar }: { accion: Accion; destinos: { grupo: string; opciones: { valor: string; etiqueta: string }[] }[]; sinAsignar: string }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex flex-wrap items-end gap-3">
      <Selector etiqueta="Capítulo o adicional" name="destino" required defaultValue={v("destino")} className="min-w-[260px] flex-1">
        <option value="" disabled>Elige…</option>
        {destinos.map((g) => (
          <optgroup key={g.grupo} label={g.grupo}>{g.opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}</optgroup>
        ))}
      </Selector>
      <Campo etiqueta="Valor asignado (COP)" name="valor" required inputMode="decimal" defaultValue={v("valor")} ayuda={`Sin asignar: ${sinAsignar}. Si ya existe, reemplaza el valor.`} />
      <BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Asignar</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioDatosContractuales({ accion, iniciales }: { accion: Accion; iniciales: Record<string, string> }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? iniciales[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Consecutivo (plataforma de contratos)" name="consecutivo" maxLength={60} defaultValue={v("consecutivo")} />
        <Campo etiqueta="Orden de servicio SAP" name="orden_servicio_sap" maxLength={60} defaultValue={v("orden_servicio_sap")} />
        <Campo etiqueta="Fecha de firma" name="fecha_firma" type="date" defaultValue={v("fecha_firma")} />
        <Campo etiqueta="Fecha del acta de inicio" name="fecha_acta_inicio" type="date" defaultValue={v("fecha_acta_inicio")} />
        <Campo etiqueta="Plazo (número)" name="plazo_valor" inputMode="numeric" maxLength={4} defaultValue={v("plazo_valor")} />
        <Selector etiqueta="Unidad del plazo" name="plazo_unidad" defaultValue={v("plazo_unidad")}>
          <option value="">Sin plazo</option>
          <option value="dias_calendario">Días calendario</option>
          <option value="dias_habiles">Días hábiles</option>
          <option value="meses">Meses</option>
        </Selector>
      </div>
      <Campo etiqueta="Autorización de asamblea (acta y fecha)" name="autorizacion_asamblea" maxLength={200} defaultValue={v("autorizacion_asamblea")} ayuda="Se necesita cuando el valor supera el tope de contratación sin asamblea del contratante." />
      {estado.error && <Aviso>{estado.error}</Aviso>}
      <div><BotonEnviar className={claseBoton.primario} textoEnviando="Guardando…">Guardar datos contractuales</BotonEnviar></div>
    </form>
  );
}

export function FormularioDevolverEtapa({ accion, opciones }: { accion: Accion; opciones: { n: number; nombre: string }[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  const v = (k: string) => estado.valores?.[k] ?? "";
  return (
    <form action={enviar} key={estado.valores ? JSON.stringify(estado.valores) : "i"} className="flex flex-wrap items-end gap-3">
      <Selector etiqueta="Devolver a la etapa" name="etapa" required defaultValue={v("etapa")}>
        <option value="">Elige…</option>
        {opciones.map((o) => <option key={o.n} value={o.n}>{o.n}. {o.nombre}</option>)}
      </Selector>
      <Campo etiqueta="Motivo (obligatorio)" name="motivo" required minLength={3} maxLength={500} defaultValue={v("motivo")} className="min-w-[240px] flex-1" />
      <BotonEnviar className={claseBoton.contorno} textoEnviando="Guardando…">Devolver</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}

export function FormularioContratanteProyecto({ accion, actual, opciones }: { accion: Accion; actual: string; opciones: { id: string; etiqueta: string }[] }) {
  const [estado, enviar] = useActionState(accion, {} as Estado);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <Selector etiqueta="Contratante del proyecto" name="contratante_id" defaultValue={actual}>
        <option value="">Sin contratante</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
      </Selector>
      <BotonEnviar className={claseBoton.contorno} textoEnviando="Guardando…">Guardar</BotonEnviar>
      {estado.error && <div className="w-full"><Aviso>{estado.error}</Aviso></div>}
    </form>
  );
}
