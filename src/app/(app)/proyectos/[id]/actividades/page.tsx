import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ACTIVIDADES } from "@/lib/registros/modulos/actividades";
import { ESTADOS_ACTIVIDAD, ETIQUETA_ESTADO_ACTIVIDAD, agruparPorEstado, estaVencida, hoyColombia } from "@/lib/actividades";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { TarjetaActividad, type FilaActividad } from "@/components/tarjeta-actividad";

const HECHAS_VISIBLES = 12;
type Uno<T> = T | T[] | null;
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string | string[]; mias?: string; hechas?: string }> }) {
  const { id } = await params;
  const { ok, mias, hechas } = await searchParams;
  const { supabase, perfil, proyecto, permisos } = await cargarProyecto(id);
  const soloMias = mias === "1";
  const todasLasHechas = hechas === "todas";

  const { data, error } = await supabase
    .from("actividades")
    .select("id, proyecto_id, titulo, descripcion, estado, prioridad, fecha_limite, responsable_id, creado_por, completada_en, perfiles!responsable_id(nombre), riesgos(codigo), wbs_elementos(codigo, nombre)")
    .eq("proyecto_id", id)
    .order("completada_en", { ascending: false, nullsFirst: true })
    .limit(1000);

  type Cruda = Omit<FilaActividad, "responsable" | "riesgo" | "elemento"> & {
    perfiles: Uno<{ nombre: string }>; riesgos: Uno<{ codigo: string }>; wbs_elementos: Uno<{ codigo: string; nombre: string }>;
  };
  const todas: FilaActividad[] = ((data ?? []) as unknown as Cruda[]).map(({ perfiles, riesgos, wbs_elementos, ...a }) => ({
    ...a,
    responsable: uno(perfiles)?.nombre ?? null,
    riesgo: uno(riesgos)?.codigo ?? null,
    elemento: uno(wbs_elementos) ? `${uno(wbs_elementos)!.codigo} ${uno(wbs_elementos)!.nombre}` : null,
  }));
  const visibles = soloMias ? todas.filter((a) => a.responsable_id === perfil?.id) : todas;
  const columnas = agruparPorEstado(visibles);
  const hoy = hoyColombia();

  const abiertas = visibles.filter((a) => a.estado !== "hecha");
  const vencidas = abiertas.filter((a) => estaVencida(a, hoy)).length;
  const gestiona = permisos.gestionar || permisos.analista || permisos.director;
  const puedeCrear = ACTIVIDADES.escribir(permisos);
  const base = `/proyectos/${id}/actividades`;
  const hechasOcultas = !todasLasHechas ? Math.max(0, columnas.hecha.length - HECHAS_VISIBLES) : 0;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Actividades</Titulo>
        {puedeCrear && <Link href={`/proyectos/${id}/r/actividades/nuevo`} className={claseBoton.primario}>Agregar actividad</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">
        {proyecto.nombre} · {abiertas.length} {abiertas.length === 1 ? "abierta" : "abiertas"}
        {vencidas > 0 && <>, <strong className="text-danger">{vencidas} {vencidas === 1 ? "vencida" : "vencidas"}</strong></>}
        {columnas.bloqueada.length > 0 && <>, {columnas.bloqueada.length} {columnas.bloqueada.length === 1 ? "bloqueada" : "bloqueadas"}</>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={base} aria-current={!soloMias ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!soloMias ? "border-leaf-600 bg-leaf-100 font-medium text-leaf-900" : "border-soil-border text-leaf-800 hover:bg-leaf-50"}`}>Todas</Link>
        <Link href={`${base}?mias=1`} aria-current={soloMias ? "page" : undefined} className={`rounded-full border px-3 py-1 ${soloMias ? "border-leaf-600 bg-leaf-100 font-medium text-leaf-900" : "border-soil-border text-leaf-800 hover:bg-leaf-50"}`}>Solo las mías</Link>
      </div>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer la lista{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {!error && todas.length === 0 && (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">
          Aún no hay actividades.{puedeCrear ? " Agrega la primera: ¿qué hay que hacer, quién lo hace y para cuándo?" : ""}
        </p>
      )}
      {todas.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ESTADOS_ACTIVIDAD.map((e) => {
            const lista = e === "hecha" && !todasLasHechas ? columnas.hecha.slice(0, HECHAS_VISIBLES) : columnas[e];
            return (
              <section key={e} aria-label={ETIQUETA_ESTADO_ACTIVIDAD[e]} className="rounded-card bg-leaf-50 p-3">
                <h2 className="flex items-center justify-between px-1 pb-2 font-display text-lg font-bold text-leaf-700">
                  {ETIQUETA_ESTADO_ACTIVIDAD[e]}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-leaf-800">{columnas[e].length}</span>
                </h2>
                {lista.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted">Nada por aquí.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {lista.map((a) => {
                      const esMia = a.responsable_id === perfil?.id;
                      const propiaInterventoria = permisos.interventor && a.creado_por === perfil?.id;
                      return (
                        <TarjetaActividad
                          key={a.id}
                          a={a}
                          hoy={hoy}
                          desde="proyecto"
                          puedeMover={gestiona || esMia}
                          hrefEditar={gestiona || propiaInterventoria ? `/proyectos/${id}/r/actividades/${a.id}` : undefined}
                        />
                      );
                    })}
                  </ul>
                )}
                {e === "hecha" && hechasOcultas > 0 && (
                  <p className="px-1 pt-3 text-xs text-muted">
                    Se muestran las {HECHAS_VISIBLES} más recientes. <Link href={`${base}?${soloMias ? "mias=1&" : ""}hechas=todas`} className="font-medium text-leaf-600 hover:underline">Ver las {columnas.hecha.length}</Link>
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function PaginaActividades({ params, searchParams }: PageProps<"/proyectos/[id]/actividades">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}
