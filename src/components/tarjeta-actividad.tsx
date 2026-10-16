import Link from "next/link";
import { cambiarEstadoActividad } from "@/app/(app)/actividades/acciones";
import {
  ESTADOS_ACTIVIDAD, ETIQUETA_ESTADO_ACTIVIDAD, ETIQUETA_PRIORIDAD, estaVencida, textoPlazo,
  type EstadoActividad, type PrioridadActividad,
} from "@/lib/actividades";
import { formatearFecha } from "@/lib/formato";

export type FilaActividad = {
  id: string;
  proyecto_id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoActividad;
  prioridad: PrioridadActividad;
  fecha_limite: string | null;
  responsable_id: string | null;
  creado_por: string | null;
  responsable: string | null; // nombre
  riesgo: string | null; // código
  elemento: string | null; // código y nombre de la EDT
  proyecto?: string | null; // «GL-001 · Nombre», solo en «Mi trabajo»
};

const CLASE_PRIORIDAD: Record<PrioridadActividad, string> = {
  alta: "bg-red-100 text-red-900 border-red-500",
  media: "bg-amber-100 text-amber-900 border-amber-500",
  baja: "bg-leaf-100 text-leaf-800 border-leaf-400",
};
const insignia = "inline-block rounded-full border px-2 py-0.5 text-xs font-medium";

// Una actividad como tarjeta. Las flechas de estado y el enlace de edición solo se muestran a quien puede usarlos;
// la base de datos vuelve a comprobar el permiso.
export function TarjetaActividad({
  a, hoy, puedeMover, hrefEditar, hrefProyecto, desde,
}: {
  a: FilaActividad;
  hoy: string;
  puedeMover: boolean;
  hrefEditar?: string;
  hrefProyecto?: string;
  desde: "proyecto" | "mi-trabajo";
}) {
  const vencida = estaVencida(a, hoy);
  return (
    <li className={`rounded-card border bg-white p-3 text-sm shadow-sm ${vencida ? "border-red-500" : "border-soil-border"}`}>
      {a.proyecto && (
        <p className="mb-1 text-xs text-muted">
          {hrefProyecto ? <Link href={hrefProyecto} className="hover:underline">{a.proyecto}</Link> : a.proyecto}
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
      {(puedeMover || hrefEditar) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-soil-border pt-2">
          {puedeMover && (
            <form action={cambiarEstadoActividad} className="flex flex-wrap items-center gap-1.5">
              <input type="hidden" name="proyecto_id" value={a.proyecto_id} />
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="desde" value={desde} />
              {ESTADOS_ACTIVIDAD.filter((e) => e !== a.estado).map((e) => (
                <button key={e} type="submit" name="estado" value={e} className="rounded-full border border-leaf-600 px-2.5 py-1 text-xs font-medium text-leaf-700 hover:bg-leaf-50">
                  {e === "hecha" ? "Marcar hecha" : `Pasar a ${ETIQUETA_ESTADO_ACTIVIDAD[e].toLowerCase()}`}
                </button>
              ))}
            </form>
          )}
          {hrefEditar && <Link href={hrefEditar} className="ml-auto text-xs font-medium text-leaf-600 hover:underline">Editar</Link>}
        </div>
      )}
    </li>
  );
}
