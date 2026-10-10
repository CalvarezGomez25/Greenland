import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { desdeJson } from "@/lib/presupuesto/dinero";
import { centavos } from "@/lib/pmo/formato";
import { diasDesde, ETIQUETA_ESTADO_CAMBIO, ETIQUETA_NIVEL_CAMBIO, esPendiente, type EstadoCambio } from "@/lib/pmo/cambios";
import { formatearFecha } from "@/lib/formato";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

type Fila = { id: string; codigo: string; fecha_solicitud: string; tipo: string; descripcion_despues: string; impacto_costo: number | string; impacto_dias: number; nivel: keyof typeof ETIQUETA_NIVEL_CAMBIO | null; estado_flujo: EstadoCambio; en_aprobacion_desde: string | null; detectado_sin_formato: boolean };

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { id } = await params;
  const { ok } = await searchParams;
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const { data, error } = await supabase.from("cambios").select("id, codigo, fecha_solicitud, tipo, descripcion_despues, impacto_costo, impacto_dias, nivel, estado_flujo, en_aprobacion_desde, detectado_sin_formato").eq("proyecto_id", id).order("fecha_solicitud", { ascending: false }).order("codigo", { ascending: false }).limit(500);
  const filas = (data ?? []) as Fila[];
  const pendientes = filas.filter((f) => esPendiente(f.estado_flujo)).length;
  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Control de cambios</Titulo>
        {permisos.gestionar && <Link href={`/proyectos/${id}/cambios/nuevo`} className={claseBoton.primario}>Registrar cambio</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre} · {pendientes} pendiente(s) · Ningún cambio se ejecuta sin aprobación formal.</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudieron leer los cambios{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {filas.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay cambios registrados.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["Código", "Fecha", "Tipo", "Descripción", "Costo (COP)", "Días", "Nivel", "Estado"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {filas.map((f) => {
                const espera = f.estado_flujo === "aprobacion" ? diasDesde(f.en_aprobacion_desde) : null;
                return (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-3 py-2"><Link href={`/proyectos/${id}/cambios/${f.id}`} className="font-medium text-leaf-700 hover:underline">{f.codigo}</Link>{f.detectado_sin_formato && <span className="ml-1 text-xs text-muted">(sin formato)</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatearFecha(f.fecha_solicitud)}</td>
                    <td className="px-3 py-2">{f.tipo}</td>
                    <td className="max-w-[260px] truncate px-3 py-2" title={f.descripcion_despues}>{f.descripcion_despues}</td>
                    <td className="px-3 py-2">{centavos(desdeJson(f.impacto_costo, 2))}</td>
                    <td className="px-3 py-2">{f.impacto_dias}</td>
                    <td className="px-3 py-2">{f.nivel ? ETIQUETA_NIVEL_CAMBIO[f.nivel] : "—"}</td>
                    <td className="px-3 py-2">{ETIQUETA_ESTADO_CAMBIO[f.estado_flujo]}{espera !== null && <span className="block text-xs text-muted">{espera} día(s) esperando decisión</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaCambios({ params, searchParams }: PageProps<"/proyectos/[id]/cambios">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
