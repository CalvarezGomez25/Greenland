import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ACTIVIDADES } from "@/lib/registros/modulos/actividades";
import { estaVencida, hoyColombia, type ItemTablero } from "@/lib/actividades";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { TableroActividades } from "@/components/tablero-actividades";

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
    .limit(1000);

  type Cruda = Omit<ItemTablero, "responsable" | "riesgo" | "elemento" | "puedeMover" | "hrefEditar" | "hrefProyecto"> & {
    creado_por: string | null; completada_en: string | null;
    perfiles: Uno<{ nombre: string }>; riesgos: Uno<{ codigo: string }>; wbs_elementos: Uno<{ codigo: string; nombre: string }>;
  };
  const gestiona = permisos.gestionar || permisos.analista || permisos.director;
  const crudas = ((data ?? []) as unknown as Cruda[]).filter((a) => !soloMias || a.responsable_id === perfil?.id);
  const completadaEn = new Map(crudas.map((a) => [a.id, a.completada_en ?? ""]));
  const todas: ItemTablero[] = crudas.map(({ perfiles, riesgos, wbs_elementos, creado_por, completada_en, ...a }) => {
    void completada_en;
    const w = uno(wbs_elementos);
    return {
      ...a,
      responsable: uno(perfiles)?.nombre ?? null,
      riesgo: uno(riesgos)?.codigo ?? null,
      elemento: w ? `${w.codigo} ${w.nombre}` : null,
      puedeMover: gestiona || a.responsable_id === perfil?.id,
      hrefEditar: gestiona || (permisos.interventor && creado_por === perfil?.id) ? `/proyectos/${id}/r/actividades/${a.id}` : undefined,
    };
  });

  const hoy = hoyColombia();
  const abiertas = todas.filter((a) => a.estado !== "hecha");
  const hechasRecientes = todas.filter((a) => a.estado === "hecha").sort((x, y) => (completadaEn.get(y.id) ?? "").localeCompare(completadaEn.get(x.id) ?? ""));
  const hechasMostradas = todasLasHechas ? hechasRecientes : hechasRecientes.slice(0, HECHAS_VISIBLES);
  const vencidas = abiertas.filter((a) => estaVencida(a, hoy)).length;
  const bloqueadas = abiertas.filter((a) => a.estado === "bloqueada").length;
  const puedeCrear = ACTIVIDADES.escribir(permisos);
  const base = `/proyectos/${id}/actividades`;

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
        {bloqueadas > 0 && <>, {bloqueadas} {bloqueadas === 1 ? "bloqueada" : "bloqueadas"}</>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={base} aria-current={!soloMias ? "page" : undefined} className={`rounded-full border px-3 py-1 ${!soloMias ? "border-leaf-600 bg-white font-medium text-leaf-500" : "border-soil-border text-leaf-800 hover:bg-leaf-50"}`}>Todas</Link>
        <Link href={`${base}?mias=1`} aria-current={soloMias ? "page" : undefined} className={`rounded-full border px-3 py-1 ${soloMias ? "border-leaf-600 bg-white font-medium text-leaf-500" : "border-soil-border text-leaf-800 hover:bg-leaf-50"}`}>Solo las mías</Link>
      </div>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer la lista{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {!error && (
        <div className="mt-6">
          <TableroActividades
            items={[...abiertas, ...hechasMostradas]}
            hoy={hoy}
            ocultasHechas={hechasRecientes.length - hechasMostradas.length}
            verTodasHref={`${base}?${soloMias ? "mias=1&" : ""}hechas=todas`}
            vacio={`Aún no hay actividades.${puedeCrear ? " Agrega la primera: ¿qué hay que hacer, quién lo hace y para cuándo?" : ""}`}
          />
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
