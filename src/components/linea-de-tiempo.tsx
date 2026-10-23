import Link from "next/link";
import { construirLineaDeTiempo, textoPlazo, type ItemTablero } from "@/lib/actividades";
import { formatearFechaCorta } from "@/lib/formato";
import { DesplazarAHoy } from "./desplazar-a-hoy";

// Un color por proyecto, dentro de la paleta del sistema de diseño.
export const COLORES_PROYECTO = ["#4c700b", "#7c401d", "#386631", "#7fa62e", "#2f5517", "#a9c96c", "#5d870e", "#b23a22"];
export const colorDeProyecto = (i: number) => COLORES_PROYECTO[i % COLORES_PROYECTO.length];
const ALTO = 172;
const EJE = 88; // altura del eje dentro del lienzo
const ROTULO = 124; // ancho de cada rótulo

export type Proyecto = { id: string; etiqueta: string };

// «Mi trabajo»: horizonte de tiempo entre lo más atrasado y lo más lejano que tienes pendiente.
export function LineaDeTiempo({ items, hoy, proyectos }: { items: ItemTablero[]; hoy: string; proyectos: Proyecto[] }) {
  const linea = construirLineaDeTiempo(items, hoy);
  if (linea.hitos.length === 0) {
    return <p className="rounded-card bg-leaf-50 p-6 text-sm text-muted">No tienes actividades pendientes con fecha límite. Cuando las tengas, verás aquí su recorrido en el tiempo.</p>;
  }

  const color = new Map(proyectos.map((p, i) => [p.id, colorDeProyecto(i)]));
  const proximo = linea.hitos.find((h) => h.dias >= 0);
  const resumen = [
    linea.vencidas > 0 && `${linea.vencidas} ${linea.vencidas === 1 ? "retrasada" : "retrasadas"}`,
    proximo && `próxima: ${textoPlazo(proximo.fecha, hoy).replace("Vence", "vence")}`,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="t-linea-tiempo" className="rounded-card bg-leaf-50 px-4 pb-2 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-leaf-500 pb-1">
        <h2 id="t-linea-tiempo" className="font-display text-xl font-bold text-leaf-700">Línea de tiempo</h2>
        {resumen && <p className="font-display text-sm font-bold text-leaf-600">{resumen}</p>}
      </div>

      <p className="mt-1 text-xs text-muted sm:hidden">Desliza hacia los lados para recorrer el tiempo.</p>
      <DesplazarAHoy xHoy={linea.xHoy} etiqueta="Línea de tiempo de tus actividades pendientes, de las retrasadas a las futuras">
        <div className="relative" style={{ width: linea.ancho, height: ALTO }}>
          {/* Eje: tramo atrasado en rojo suave, tramo por venir en gris */}
          <div className="absolute rounded-full bg-red-200" style={{ left: 0, width: linea.xHoy, top: EJE - 3, height: 6 }} />
          <div className="absolute rounded-full bg-soil-border" style={{ left: linea.xHoy, width: linea.ancho - linea.xHoy, top: EJE - 3, height: 6 }} />

          {/* Hoy */}
          <div className="absolute border-l-2 border-dashed border-danger/60" style={{ left: linea.xHoy, top: 22, height: ALTO - 22 }} aria-hidden="true" />
          <span className="absolute -translate-x-1/2 rounded-full bg-danger px-2.5 text-xs font-medium leading-5 text-white" style={{ left: linea.xHoy, top: 0 }}>
            HOY · {formatearFechaCorta(hoy)}
          </span>
          <span className="absolute h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-danger" style={{ left: linea.xHoy, top: EJE - 6 }} aria-hidden="true" />

          {linea.hitos.map((h, i) => {
            const arriba = i % 2 === 0;
            const unica = h.items.length === 1 ? h.items[0] : null;
            const colorHito = color.get(h.items[0].proyecto_id) ?? colorDeProyecto(0);
            const atrasado = h.dias < 0;
            const codigos = [...new Set(h.items.map((a) => (a.proyecto ?? "").split(" · ")[0]))].filter(Boolean).join(", ");
            const texto = (
              <>
                <span className="block font-display text-sm font-bold leading-tight text-leaf-900 [overflow-wrap:anywhere] line-clamp-1">
                  {unica ? unica.titulo : `${h.items.length} actividades`}
                </span>
                <span className={`block text-xs font-medium ${atrasado ? "text-danger" : "text-leaf-600"}`}>
                  {atrasado ? "" : "~"}{formatearFechaCorta(h.fecha)}{h.dias === 0 ? " · hoy" : ""}
                </span>
                {codigos && <span className="block truncate text-[11px] leading-tight text-muted">{codigos}</span>}
              </>
            );
            const estiloRotulo = { left: h.x - ROTULO / 2, width: ROTULO, ...(arriba ? { bottom: ALTO - EJE + 18 } : { top: EJE + 18 }) };
            return (
              <div key={h.fecha}>
                <span className="absolute w-px bg-leaf-300" style={{ left: h.x, ...(arriba ? { top: EJE - 18, height: 18 } : { top: EJE, height: 18 }) }} aria-hidden="true" />
                <span
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-2 border-white"
                  style={{ left: h.x, top: EJE - 7, backgroundColor: colorHito }}
                  aria-hidden="true"
                />
                {h.items.length > 1 && (
                  <span className="absolute -translate-x-1/2 text-[9px] font-medium text-white" style={{ left: h.x, top: EJE - 6 }} aria-hidden="true">{h.items.length}</span>
                )}
                <div className="absolute text-center" style={estiloRotulo} title={h.items.map((a) => a.titulo).join("\n")}>
                  {unica
                    ? <Link href={`/proyectos/${unica.proyecto_id}/actividades`} className="block rounded-[10px] px-1 hover:bg-white">{texto}</Link>
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
