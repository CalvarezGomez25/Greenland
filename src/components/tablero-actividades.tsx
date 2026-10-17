"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moverActividad } from "@/app/(app)/actividades/acciones";
import {
  ESTADOS_ACTIVIDAD, ETIQUETA_ESTADO_ACTIVIDAD, ETIQUETA_PRIORIDAD, agruparPorEstado, conEstado, esEstadoActividad, estaVencida, textoPlazo,
  type EstadoActividad, type ItemTablero, type PrioridadActividad,
} from "@/lib/actividades";
import { formatearFecha } from "@/lib/formato";

const CLASE_PRIORIDAD: Record<PrioridadActividad, string> = {
  alta: "bg-red-100 text-red-900 border-red-500",
  media: "bg-amber-100 text-amber-900 border-amber-500",
  baja: "bg-leaf-100 text-leaf-800 border-leaf-400",
};
const insignia = "inline-block rounded-full border px-2 py-0.5 text-xs font-medium";

// Tablero Kanban: una columna por estado. En computador se arrastran las tarjetas entre columnas; en celular, o con el
// teclado, se usa el selector «Mover a». El cambio se ve al instante y, si la base de datos lo rechaza, vuelve a su lugar.
export function TableroActividades({
  items, hoy, ocultasHechas = 0, verTodasHref, vacio,
}: {
  items: ItemTablero[];
  hoy: string;
  ocultasHechas?: number;
  verTodasHref?: string;
  vacio?: string;
}) {
  const [lista, mover] = useOptimistic(items, (actual, cambio: { id: string; estado: EstadoActividad }) => conEstado(actual, cambio.id, cambio.estado));
  const [, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EstadoActividad | null>(null);
  const columnas = agruparPorEstado(lista);

  function cambiar(a: ItemTablero, estado: EstadoActividad) {
    setArrastrando(null);
    setSobre(null);
    if (!a.puedeMover || a.estado === estado) return;
    setError(null);
    empezar(async () => {
      mover({ id: a.id, estado });
      const r = await moverActividad(a.proyecto_id, a.id, estado);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <p aria-live="polite" role={error ? "alert" : undefined} className={error ? "mb-3 rounded-[10px] border border-danger/40 bg-red-50 px-3.5 py-2.5 text-sm text-danger" : "sr-only"}>
        {error ?? ""}
      </p>
      {lista.length === 0 && vacio && <p className="mb-4 rounded-card bg-leaf-50 p-6 text-sm text-muted">{vacio}</p>}
      <p className="mb-2 text-xs text-muted">Arrastra una tarjeta a otra columna para cambiar su estado. En el celular, usa «Mover a».</p>
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {ESTADOS_ACTIVIDAD.map((e) => {
          const tarjetas = columnas[e];
          const total = tarjetas.length + (e === "hecha" ? ocultasHechas : 0);
          const activa = sobre === e && arrastrando !== null;
          return (
            <section
              key={e}
              aria-label={ETIQUETA_ESTADO_ACTIVIDAD[e]}
              onDragOver={(ev) => { if (arrastrando) { ev.preventDefault(); if (sobre !== e) setSobre(e); } }}
              onDrop={(ev) => {
                ev.preventDefault();
                // la tarjeta que se arrastra se toma del estado; los datos del arrastre solo son un respaldo
                const a = lista.find((x) => x.id === (arrastrando ?? ev.dataTransfer.getData("text/plain")));
                if (a) cambiar(a, e); else { setArrastrando(null); setSobre(null); }
              }}
              className={`min-w-[200px] flex-1 basis-0 rounded-card bg-leaf-50 p-3 transition-shadow ${activa ? "ring-2 ring-leaf-500" : ""}`}
            >
              <h2 className="flex items-center justify-between px-1 pb-2 font-display text-lg font-bold text-leaf-700">
                {ETIQUETA_ESTADO_ACTIVIDAD[e]}
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-leaf-800">{total}</span>
              </h2>
              <ul className="flex min-h-16 flex-col gap-2">
                {tarjetas.map((a) => (
                  <Tarjeta key={a.id} a={a} hoy={hoy} arrastrando={arrastrando === a.id} onArrastrar={(v) => { setArrastrando(v ? a.id : null); if (!v) setSobre(null); }} onMover={(estado) => cambiar(a, estado)} />
                ))}
                {tarjetas.length === 0 && (
                  <li className="rounded-[10px] border border-dashed border-soil-border px-3 py-4 text-center text-xs text-muted">
                    {activa ? "Suelta aquí" : "Nada por aquí."}
                  </li>
                )}
              </ul>
              {e === "hecha" && ocultasHechas > 0 && verTodasHref && (
                <p className="px-1 pt-3 text-xs text-muted">
                  Se muestran las más recientes. <Link href={verTodasHref} className="font-medium text-leaf-600 hover:underline">Ver todas ({total})</Link>
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Tarjeta({
  a, hoy, arrastrando, onArrastrar, onMover,
}: {
  a: ItemTablero;
  hoy: string;
  arrastrando: boolean;
  onArrastrar: (empieza: boolean) => void;
  onMover: (estado: EstadoActividad) => void;
}) {
  const vencida = estaVencida(a, hoy);
  return (
    <li
      draggable={a.puedeMover}
      onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", a.id); ev.dataTransfer.effectAllowed = "move"; onArrastrar(true); }}
      onDragEnd={() => onArrastrar(false)}
      className={`rounded-card border bg-white p-3 text-sm shadow-sm ${vencida ? "border-red-500" : "border-soil-border"} ${a.puedeMover ? "cursor-grab active:cursor-grabbing" : ""} ${arrastrando ? "opacity-40" : ""}`}
    >
      {a.proyecto && (
        <p className="mb-1 text-xs text-muted">
          {a.hrefProyecto ? <Link href={a.hrefProyecto} className="hover:underline">{a.proyecto}</Link> : a.proyecto}
        </p>
      )}
      <p className="font-medium text-leaf-900">{a.titulo}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`${insignia} ${CLASE_PRIORIDAD[a.prioridad]}`}>Prioridad {ETIQUETA_PRIORIDAD[a.prioridad].toLowerCase()}</span>
        {a.fecha_limite && (
          vencida
            ? <span className={`${insignia} border-red-500 bg-red-100 text-red-900`}>{textoPlazo(a.fecha_limite, hoy)}</span>
            : <span className="text-xs text-muted">{a.estado === "hecha" ? `Límite ${formatearFecha(a.fecha_limite)}` : `${textoPlazo(a.fecha_limite, hoy)} · ${formatearFecha(a.fecha_limite)}`}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{a.responsable ? `Responsable: ${a.responsable}` : "Sin responsable asignado"}</p>
      {(a.riesgo || a.elemento) && (
        <p className="mt-1 text-xs text-muted">
          {a.riesgo && <>Riesgo {a.riesgo}</>}
          {a.riesgo && a.elemento && " · "}
          {a.elemento && <>EDT {a.elemento}</>}
        </p>
      )}
      {(a.puedeMover || a.hrefEditar) && (
        <div className="mt-3 flex items-end gap-2 border-t border-soil-border pt-2">
          {a.puedeMover && (
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs text-muted">
              Mover a
              <select
                value={a.estado}
                aria-label={`Mover «${a.titulo}» a otra columna`}
                onChange={(ev) => { if (esEstadoActividad(ev.target.value)) onMover(ev.target.value); }}
                className="h-8 w-full min-w-0 rounded-lg border border-soil-border bg-white px-2 text-xs text-leaf-900 focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/30"
              >
                {ESTADOS_ACTIVIDAD.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_ACTIVIDAD[e]}</option>)}
              </select>
            </label>
          )}
          {a.hrefEditar && <Link href={a.hrefEditar} className="pb-2 text-xs font-medium text-leaf-600 hover:underline">Editar</Link>}
        </div>
      )}
    </li>
  );
}
