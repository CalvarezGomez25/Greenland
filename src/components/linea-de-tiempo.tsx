import Link from "next/link";
import { construirLineaDeTiempo, textoPlazo, type ItemTablero } from "@/lib/actividades";
import { formatearFechaCorta } from "@/lib/formato";
import { DesplazarAHoy } from "./desplazar-a-hoy";
import { Ayuda } from "./ayuda";
import type { EventoPlataforma } from "@/lib/calendario/eventos";

// Un color por proyecto, dentro de la paleta del sistema de diseño.
export const COLORES_PROYECTO = ["#4c700b", "#7c401d", "#386631", "#7fa62e", "#2f5517", "#a9c96c", "#5d870e", "#b23a22"];
export const colorDeProyecto = (i: number) => COLORES_PROYECTO[i % COLORES_PROYECTO.length];
const ALTO = 138;
const EJE = 76; // altura del eje dentro del lienzo
const ROTULO = 200; // cabe porque los vecinos de un mismo lado están a 2 separaciones (240 px) // ancho de cada rótulo

export type Proyecto = { id: string; etiqueta: string };
// Los vencimientos de contratos y procesos se dibujan en la misma línea, con rombo hueco: no son tareas tuyas, son fechas que vigilas.
type Venc = { venc: EventoPlataforma };
type ItemLinea = ItemTablero | (Omit<ItemTablero, "venc"> & Venc);
const esVenc = (i: ItemLinea): i is ItemLinea & Venc => "venc" in i;
const comoItem = (e: EventoPlataforma): ItemLinea => ({
  id: e.uid, proyecto_id: e.proyectoId ?? "", titulo: e.titulo, descripcion: null, estado: "por_hacer", prioridad: "media", fecha_limite: e.fecha, responsable_id: null,
  responsable: null, riesgo: null, elemento: null, proyecto: e.proyecto, puedeMover: false, hrefEditar: e.ruta, hrefProyecto: e.ruta, venc: e,
} as unknown as ItemLinea);

export type ControlesLinea = { vencimientos: number; verVencimientos: boolean; hrefAlternar: string; hrefCalendario: string };

// «Mi trabajo»: horizonte de tiempo entre lo más atrasado y lo más lejano que tienes pendiente.
export function LineaDeTiempo({ items, hoy, proyectos, vencimientos = [], controles }: { items: ItemTablero[]; hoy: string; proyectos: Proyecto[]; vencimientos?: EventoPlataforma[]; controles?: ControlesLinea }) {
  const linea = construirLineaDeTiempo<ItemLinea>([...items, ...vencimientos.filter((e) => e.tipo !== "actividad").map(comoItem)], hoy);
  const botones = controles && (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      {controles.vencimientos > 0 && (
        <Link href={controles.hrefAlternar} scroll={false} aria-pressed={controles.verVencimientos} className={`rounded-full border-[1.5px] border-leaf-600 px-3 py-0.5 font-medium ${controles.verVencimientos ? "bg-leaf-600 text-white" : "text-leaf-600 hover:bg-leaf-50"}`}>
          Vencimientos de mis proyectos ({controles.vencimientos})
        </Link>
      )}
      <a href={controles.hrefCalendario} className="rounded-full border-[1.5px] border-leaf-600 px-3 py-0.5 font-medium text-leaf-600 hover:bg-leaf-50" title="Descarga un archivo .ics para Google Calendar, Outlook o Apple Calendar">Agregar a mi calendario</a>
      <Ayuda tema="calendario_ics" />
    </p>
  );
  if (linea.hitos.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {botones}
        <p className="rounded-card bg-leaf-50 p-6 text-sm text-muted">No tienes actividades pendientes con fecha límite. Cuando las tengas, verás aquí su recorrido en el tiempo.</p>
      </div>
    );
  }

  const color = new Map(proyectos.map((p, i) => [p.id, colorDeProyecto(i)]));
  const proximo = linea.hitos.find((h) => h.dias >= 0);
  const resumen = [
    linea.vencidas > 0 && `${linea.vencidas} ${linea.vencidas === 1 ? "retrasada" : "retrasadas"}`,
    proximo && `próxima: ${textoPlazo(proximo.fecha, hoy).replace("Vence", "vence")}`,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="t-linea-tiempo" className="rounded-card bg-leaf-50 px-3 pb-1 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-leaf-500 pb-1">
        <h2 id="t-linea-tiempo" className="font-display text-lg font-bold leading-tight text-leaf-700">Línea de tiempo</h2>
        {resumen && <p className="font-display text-xs font-bold text-leaf-600">{resumen}</p>}
      </div>
      {botones && <div className="mt-1">{botones}</div>}

      <p className="mt-1 text-xs text-muted sm:hidden">Desliza hacia los lados para recorrer el tiempo.</p>
      <DesplazarAHoy xHoy={linea.xHoy} etiqueta="Línea de tiempo de tus actividades pendientes, de las retrasadas a las futuras">
        <div className="relative" style={{ width: linea.ancho, height: ALTO }}>
          {/* Eje: tramo atrasado en rojo suave, tramo por venir en gris */}
          <div className="absolute rounded-full bg-red-200" style={{ left: 0, width: linea.xHoy, top: EJE - 3, height: 6 }} />
          <div className="absolute rounded-full bg-soil-border" style={{ left: linea.xHoy, width: linea.ancho - linea.xHoy, top: EJE - 3, height: 6 }} />

          {/* Hoy */}
          <div className="absolute border-l-2 border-dashed border-danger/60" style={{ left: linea.xHoy, top: 16, height: ALTO - 16 }} aria-hidden="true" />
          <span className="absolute -translate-x-1/2 rounded-full bg-danger whitespace-nowrap px-2 text-[11px] font-medium leading-4 text-white" style={{ left: linea.xHoy, top: 0 }}>
            HOY · {formatearFechaCorta(hoy)}
          </span>
          <span className="absolute h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-danger" style={{ left: linea.xHoy, top: EJE - 6 }} aria-hidden="true" />

          {linea.hitos.map((h, i) => {
            const arriba = i % 2 === 0;
            const unica = h.items.length === 1 ? h.items[0] : null;
            const soloVenc = h.items.every(esVenc);
            const colorHito = color.get(h.items[0].proyecto_id) ?? colorDeProyecto(0);
            const atrasado = h.dias < 0;
            const codigos = [...new Set(h.items.map((a) => (a.proyecto ?? "").split(" · ")[0]))].filter(Boolean).join(", ");
            const texto = (
              <>
                <span className="block truncate font-display text-xs font-bold leading-4 text-leaf-900">
                  {unica ? unica.titulo : soloVenc ? `${h.items.length} vencimientos` : h.items.every((a) => !esVenc(a)) ? `${h.items.length} actividades` : `${h.items.length} pendientes`}
                </span>
                <span className="block truncate text-[11px] leading-4">
                  <span className={`font-medium ${atrasado ? "text-danger" : "text-leaf-600"}`}>{atrasado ? "" : "~"}{formatearFechaCorta(h.fecha)}{h.dias === 0 ? " · hoy" : ""}</span>
                  {codigos && <span className="text-muted"> · {codigos}</span>}
                </span>
              </>
            );
            const estiloRotulo = { left: h.x - ROTULO / 2, width: ROTULO, ...(arriba ? { bottom: ALTO - EJE + 14 } : { top: EJE + 14 }) };
            return (
              <div key={h.fecha}>
                <span className="absolute w-px bg-leaf-300" style={{ left: h.x, ...(arriba ? { top: EJE - 14, height: 14 } : { top: EJE, height: 14 }) }} aria-hidden="true" />
                <span
                  className={`absolute h-3 w-3 -translate-x-1/2 rotate-45 ${soloVenc ? "border-2 bg-white" : "border-2 border-white"}`}
                  style={soloVenc ? { left: h.x, top: EJE - 6, borderColor: colorHito } : { left: h.x, top: EJE - 6, backgroundColor: colorHito }}
                  aria-hidden="true"
                />
                {h.items.length > 1 && (
                  <span className="absolute -translate-x-1/2 text-[8px] font-medium leading-none text-white" style={{ left: h.x, top: EJE - 4 }} aria-hidden="true">{h.items.length}</span>
                )}
                <div className="absolute text-center" style={estiloRotulo} title={h.items.map((a) => a.titulo).join("\n")}>
                  {unica
                    ? <Link href={esVenc(unica) ? unica.venc.ruta : `/proyectos/${unica.proyecto_id}/actividades`} className="block rounded-lg px-1 hover:bg-white">{texto}</Link>
                    : <div className="px-1">{texto}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </DesplazarAHoy>

      {/* Lectura para lectores de pantalla */}
      <ol className="sr-only">
        {linea.hitos.map((h) => (
          <li key={h.fecha}>{formatearFechaCorta(h.fecha)}: {h.items.map((a) => `${a.titulo} (${a.proyecto ?? "sin proyecto"})`).join("; ")}</li>
        ))}
      </ol>

    </section>
  );
}
