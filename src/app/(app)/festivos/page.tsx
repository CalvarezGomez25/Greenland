import { Suspense } from "react";
import { exigirAdministrador } from "@/lib/sesion";
import { formatearFecha } from "@/lib/formato";
import { Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/boton-enviar";
import { agregarFestivo, quitarFestivo } from "./acciones";
import { FormularioFestivo } from "./formulario";

async function Contenido({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio } = await searchParams;
  const { supabase } = await exigirAdministrador();
  const a = /^\d{4}$/.test(anio ?? "") ? Number(anio) : new Date().getFullYear();
  const { data } = await supabase.from("festivos").select("fecha, nombre").gte("fecha", `${a}-01-01`).lte("fecha", `${a}-12-31`).order("fecha");
  const lista = (data ?? []) as { fecha: string; nombre: string }[];
  return (
    <>
      <Titulo>Calendario de festivos</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">Se usa para contar los días hábiles de los plazos de respuesta a hallazgos. Los festivos de Colombia (2026 a 2040) están calculados con la regla de la Ley 51 de 1983 (fijos, trasladados al lunes y los de Semana Santa). Confírmalos cada año con el calendario oficial y agrega o quita fechas si hace falta.</p>
      <form className="mt-4 flex items-end gap-3" aria-label="Año"><label className="flex flex-col gap-1.5"><span className="text-[13px] font-medium text-leaf-800">Año</span><input name="anio" defaultValue={a} inputMode="numeric" className="h-[42px] w-28 rounded-[10px] border border-soil-border px-3.5" /></label><button className="inline-flex h-10 items-center rounded-full bg-leaf-100 px-5 text-sm font-medium text-leaf-900">Ver</button></form>
      <ul className="mt-6 divide-y divide-soil-border rounded-card border border-soil-border text-sm">
        {lista.length === 0 && <li className="p-4 text-muted">No hay festivos cargados para {a}.</li>}
        {lista.map((f) => (
          <li key={f.fecha} className="flex items-center justify-between gap-3 p-3"><span><strong>{formatearFecha(f.fecha)}</strong> · {f.nombre}</span>
            <form action={quitarFestivo.bind(null, f.fecha)}><BotonEnviar className="text-sm font-medium text-danger underline" textoEnviando="…">Quitar</BotonEnviar></form></li>
        ))}
      </ul>
      <div className="mt-6 rounded-card bg-leaf-50 p-5"><h2 className="mb-3 font-display text-lg font-bold text-leaf-700">Agregar un festivo</h2><FormularioFestivo accion={agregarFestivo} /></div>
    </>
  );
}

export default function PaginaFestivos({ searchParams }: PageProps<"/festivos">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido searchParams={searchParams} /></Suspense>;
}
