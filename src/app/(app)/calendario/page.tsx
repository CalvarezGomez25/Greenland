import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { hoyColombia } from "@/lib/actividades";
import { formatearFecha } from "@/lib/formato";
import { cargarEventos, ETIQUETA_TIPO_EVENTO, type EventoPlataforma } from "@/lib/calendario/eventos";
import { enlaceGoogle, enlaceOutlook } from "@/lib/calendario/ics";
import { Titulo, claseBoton } from "@/components/ui";
import { Ayuda } from "@/components/ayuda";

export const metadata = { title: "Mi calendario · PMO360" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesDe = (f: string) => { const m = MESES[Number(f.slice(5, 7)) - 1]; return `${m[0].toUpperCase()}${m.slice(1)} de ${f.slice(0, 4)}`; };

async function Contenido() {
  const { supabase, perfil } = await obtenerSesion();
  const hoy = hoyColombia();
  const eventos = perfil ? await cargarEventos(supabase, perfil.id, hoy) : [];
  const vencidos = eventos.filter((e) => e.fecha < hoy);
  const proximos = eventos.filter((e) => e.fecha >= hoy);
  const meses = new Map<string, EventoPlataforma[]>();
  for (const e of proximos) { const k = mesDe(e.fecha); meses.set(k, [...(meses.get(k) ?? []), e]); }

  const fila = (e: EventoPlataforma, pasado = false) => (
    <li key={e.uid} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border border-soil-border bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-leaf-900">{e.titulo}</p>
        <p className="text-xs text-muted"><span className={pasado ? "font-medium text-danger" : ""}>{formatearFecha(e.fecha)}</span> · {ETIQUETA_TIPO_EVENTO[e.tipo]}</p>
      </div>
      <p className="flex gap-3 text-xs">
        <a href={enlaceGoogle(e)} target="_blank" rel="noreferrer" className="font-medium text-leaf-600 hover:underline">Google Calendar</a>
        <a href={enlaceOutlook(e)} target="_blank" rel="noreferrer" className="font-medium text-leaf-600 hover:underline">Outlook</a>
      </p>
    </li>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <span className="inline-flex items-center gap-2"><Titulo>Mi calendario</Titulo><Ayuda tema="calendario_ics" /></span>
        <a href="/calendario/descargar" className={claseBoton.primario}>Descargar calendario (.ics)</a>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Las fechas de tu trabajo en un solo lugar: tus actividades, los cierres de propuestas, los vencimientos de pólizas y de documentos de los contratistas, los compromisos
        pendientes y los fines de contrato de los proyectos que puedes ver. Con el botón descargas un archivo que se importa en Google Calendar, Outlook o Apple Calendar;
        con los enlaces de cada fila agregas un solo evento.
      </p>
      <p className="mt-2 max-w-3xl text-xs text-muted">
        El archivo es una copia de hoy: si cambian las fechas, vuelve a descargarlo. Cada evento tiene un identificador fijo, así que al importarlo de nuevo se actualiza en lugar de repetirse.
        La plataforma no se conecta a tu correo ni a tu calendario ni envía nada por ti.
      </p>
      {eventos.length === 0 ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">No hay fechas próximas. Aparecen aquí cuando tengas actividades con fecha límite o haya vencimientos en tus proyectos.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {vencidos.length > 0 && (
            <section aria-labelledby="t-venc">
              <h2 id="t-venc" className="font-display text-xl font-bold text-danger">Vencidas en los últimos 30 días ({vencidos.length})</h2>
              <ul className="mt-2 flex flex-col gap-2">{vencidos.map((e) => fila(e, true))}</ul>
            </section>
          )}
          {[...meses.entries()].map(([mes, lista]) => (
            <section key={mes} aria-label={mes}>
              <h2 className="font-display text-xl font-bold text-leaf-700">{mes}</h2>
              <ul className="mt-2 flex flex-col gap-2">{lista.map((e) => fila(e))}</ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-8 text-sm text-muted">Los avisos por correo de lo que vence siguen funcionando aparte (resumen diario e informe semanal). <Link href="/glosario" className="font-medium text-leaf-600 hover:underline">Ayuda</Link></p>
    </>
  );
}

export default function PaginaCalendario() {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido /></Suspense>;
}
