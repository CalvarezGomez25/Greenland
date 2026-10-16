import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { ETIQUETA_GRUPO, GRUPOS_VENCIMIENTO, agruparPorVencimiento, hoyColombia } from "@/lib/actividades";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Aviso, Titulo } from "@/components/ui";
import { TarjetaActividad, type FilaActividad } from "@/components/tarjeta-actividad";

export const metadata = { title: "Mi trabajo · PMO360" };
type Uno<T> = T | T[] | null;
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function Contenido({ searchParams }: { searchParams: Promise<{ ok?: string | string[] }> }) {
  const { ok } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  const { data, error } = perfil
    ? await supabase
        .from("actividades")
        .select("id, proyecto_id, titulo, descripcion, estado, prioridad, fecha_limite, responsable_id, creado_por, riesgos(codigo), wbs_elementos(codigo, nombre), proyectos(codigo, nombre)")
        .eq("responsable_id", perfil.id)
        .neq("estado", "hecha")
        .limit(1000)
    : { data: [], error: null };

  type Cruda = Omit<FilaActividad, "responsable" | "riesgo" | "elemento" | "proyecto"> & {
    riesgos: Uno<{ codigo: string }>; wbs_elementos: Uno<{ codigo: string; nombre: string }>; proyectos: Uno<{ codigo: string | null; nombre: string }>;
  };
  const filas: FilaActividad[] = ((data ?? []) as unknown as Cruda[]).map(({ riesgos, wbs_elementos, proyectos, ...a }) => {
    const pr = uno(proyectos);
    const w = uno(wbs_elementos);
    return { ...a, responsable: perfil?.nombre ?? null, riesgo: uno(riesgos)?.codigo ?? null, elemento: w ? `${w.codigo} ${w.nombre}` : null, proyecto: pr ? (pr.codigo ? `${pr.codigo} · ${pr.nombre}` : pr.nombre) : null };
  });
  const hoy = hoyColombia();
  const grupos = agruparPorVencimiento(filas, hoy);

  return (
    <>
      <Titulo>Mi trabajo</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Todas las actividades que tienes asignadas, de todos tus proyectos, de la más urgente a la menos urgente. Cuando termines una, márcala como hecha.
      </p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer tu trabajo{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {!error && filas.length === 0 && (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">No tienes actividades pendientes. Cuando te asignen una, aparecerá aquí.</p>
      )}
      <div className="mt-6 flex flex-col gap-6">
        {GRUPOS_VENCIMIENTO.filter((g) => grupos[g].length > 0).map((g) => (
          <section key={g} aria-label={ETIQUETA_GRUPO[g]}>
            <h2 className={`font-display text-xl font-bold ${g === "vencidas" ? "text-danger" : "text-leaf-700"}`}>
              {ETIQUETA_GRUPO[g]} <span className="text-sm font-medium text-muted">({grupos[g].length})</span>
            </h2>
            <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {grupos[g].map((a) => (
                <TarjetaActividad key={a.id} a={a} hoy={hoy} desde="mi-trabajo" puedeMover hrefProyecto={`/proyectos/${a.proyecto_id}/actividades`} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        ¿Quieres ver el tablero de un proyecto? Elígelo en el menú lateral y entra a <strong>Actividades</strong>. <Link href="/glosario" className="font-medium text-leaf-600 hover:underline">Ver la guía</Link>.
      </p>
    </>
  );
}

export default function PaginaMiTrabajo({ searchParams }: PageProps<"/mi-trabajo">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}
