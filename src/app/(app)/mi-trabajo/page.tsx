import { Suspense } from "react";
import Link from "next/link";
import { obtenerSesion } from "@/lib/sesion";
import { agruparPorVencimiento, hoyColombia, type ItemTablero } from "@/lib/actividades";
import { mostrarMisProyectos } from "@/lib/navegacion";
import { AvisoResultado } from "@/components/aviso-resultado";
import { Aviso, Titulo } from "@/components/ui";
import { TableroActividades } from "@/components/tablero-actividades";

export const metadata = { title: "Mi trabajo · PMO360" };
const HECHAS_VISIBLES = 8;
type Uno<T> = T | T[] | null;
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function Contenido({ searchParams }: { searchParams: Promise<{ ok?: string | string[]; hechas?: string }> }) {
  const { ok, hechas } = await searchParams;
  const todasLasHechas = hechas === "todas";
  const { supabase, perfil } = await obtenerSesion();
  const { data, error } = perfil
    ? await supabase
        .from("actividades")
        .select("id, proyecto_id, titulo, descripcion, estado, prioridad, fecha_limite, responsable_id, completada_en, riesgos(codigo), wbs_elementos(codigo, nombre), proyectos(codigo, nombre)")
        .eq("responsable_id", perfil.id)
        .limit(1000)
    : { data: [], error: null };

  // «Mis proyectos»: aquellos donde la persona está asignada (quien no ve todo el portafolio entra aquí primero).
  const { data: asignaciones } = perfil ? await supabase.from("miembros_proyecto").select("proyecto_id").eq("usuario_id", perfil.id) : { data: [] };
  const idsAsignados = ((asignaciones ?? []) as { proyecto_id: string }[]).map((m) => m.proyecto_id);
  const { data: proyectosData } = idsAsignados.length > 0
    ? await supabase.from("proyectos").select("id, nombre, codigo, cliente, ubicacion, estado").in("id", idsAsignados).order("nombre")
    : { data: null };
  const misProyectos = (proyectosData ?? []) as { id: string; nombre: string; codigo: string | null; cliente: string | null; ubicacion: string | null; estado: string }[];

  type Cruda = Omit<ItemTablero, "responsable" | "riesgo" | "elemento" | "proyecto" | "puedeMover" | "hrefEditar" | "hrefProyecto"> & {
    completada_en: string | null;
    riesgos: Uno<{ codigo: string }>; wbs_elementos: Uno<{ codigo: string; nombre: string }>; proyectos: Uno<{ codigo: string | null; nombre: string }>;
  };
  const crudas = (data ?? []) as unknown as Cruda[];
  const completadaEn = new Map(crudas.map((a) => [a.id, a.completada_en ?? ""]));
  const todas: ItemTablero[] = crudas.map(({ riesgos, wbs_elementos, proyectos, completada_en, ...a }) => {
    void completada_en;
    const pr = uno(proyectos);
    const w = uno(wbs_elementos);
    return {
      ...a,
      responsable: perfil?.nombre ?? null,
      riesgo: uno(riesgos)?.codigo ?? null,
      elemento: w ? `${w.codigo} ${w.nombre}` : null,
      proyecto: pr ? (pr.codigo ? `${pr.codigo} · ${pr.nombre}` : pr.nombre) : null,
      puedeMover: true,
      hrefProyecto: `/proyectos/${a.proyecto_id}/actividades`,
    };
  });

  const hoy = hoyColombia();
  const abiertas = todas.filter((a) => a.estado !== "hecha");
  const hechasRecientes = todas.filter((a) => a.estado === "hecha").sort((x, y) => (completadaEn.get(y.id) ?? "").localeCompare(completadaEn.get(x.id) ?? ""));
  const hechasMostradas = todasLasHechas ? hechasRecientes : hechasRecientes.slice(0, HECHAS_VISIBLES);
  const grupos = agruparPorVencimiento(abiertas, hoy);

  return (
    <>
      <Titulo>Mi trabajo</Titulo>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Tus actividades de todos los proyectos, en un tablero por estado. Arrastra una tarjeta a otra columna a medida que avanzas.
      </p>
      <p className="mt-2 text-sm text-muted">
        {abiertas.length} {abiertas.length === 1 ? "abierta" : "abiertas"}
        {grupos.vencidas.length > 0 && <>, <strong className="text-danger">{grupos.vencidas.length} {grupos.vencidas.length === 1 ? "vencida" : "vencidas"}</strong></>}
        {grupos.esta_semana.length > 0 && <>, {grupos.esta_semana.length} {grupos.esta_semana.length === 1 ? "vence" : "vencen"} en los próximos 7 días</>}
      </p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer tu trabajo{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {!error && (
        <div className="mt-6">
          <TableroActividades
            items={[...abiertas, ...hechasMostradas]}
            hoy={hoy}
            ocultasHechas={hechasRecientes.length - hechasMostradas.length}
            verTodasHref="/mi-trabajo?hechas=todas"
            vacio="No tienes actividades. Cuando te asignen una, aparecerá aquí."
          />
        </div>
      )}
      {perfil && mostrarMisProyectos(perfil.rol_global, idsAsignados.length) && (
        <section className="mt-10" aria-labelledby="t-mis-proyectos">
          <h2 id="t-mis-proyectos" className="font-display text-2xl font-bold text-leaf-700">Mis proyectos</h2>
          {misProyectos.length === 0 ? (
            <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Todavía no tienes proyectos asignados, o tu asignación aún no está vigente. Pide al administrador o al gerente del proyecto que te asigne.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {misProyectos.map((p) => (
                <li key={p.id}>
                  <Link href={`/proyectos/${p.id}`} className="block h-full rounded-card bg-leaf-100 p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                    <h3 className="font-display text-lg font-bold text-leaf-700">{p.nombre}</h3>
                    <p className="mt-1 text-sm">{[p.codigo, p.cliente, p.ubicacion].filter(Boolean).join(" · ")}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="mt-8 text-sm text-muted">
        ¿Quieres ver el tablero de un proyecto completo? Elígelo en el menú lateral y entra a <strong>Actividades</strong>. <Link href="/glosario" className="font-medium text-leaf-600 hover:underline">Ver la guía</Link>.
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
