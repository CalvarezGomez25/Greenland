import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { obtenerDefinicion } from "@/lib/registros/definiciones";
import type { Fila } from "@/lib/registros/tipos";
import type { FilaParametro } from "@/lib/pmo/parametros";
import { Aviso, Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string; modulo: string }>; searchParams: Promise<{ ok?: string | string[] }> }) {
  const { id, modulo } = await params;
  const { ok } = await searchParams;
  const def = obtenerDefinicion(modulo);
  if (!def) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  if (!def.ver(permisos)) redirect(`/proyectos/${id}`);

  let consulta = supabase.from(def.tabla).select(def.seleccion).eq("proyecto_id", id);
  for (const o of def.orden) consulta = consulta.order(o.columna, { ascending: o.asc ?? true });
  const [{ data, error }, opciones, { data: parametros }] = await Promise.all([
    consulta.limit(1000),
    def.opciones ? def.opciones(supabase, id) : Promise.resolve({}),
    supabase.from("parametros").select("ambito, ambito_id, clave, valor"),
  ]);
  let filas = (data ?? []) as unknown as Fila[];
  if (def.ordenar) filas = def.ordenar(filas);
  const ctx = { opciones, parametros: (parametros ?? []) as FilaParametro[], proyecto: { id, portafolio_id: proyecto.portafolio_id }, permisos };
  const puede = def.escribir(permisos);
  const base = `/proyectos/${id}/r/${modulo}`;

  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>{def.titulo}</Titulo>
        {puede && <Link href={`${base}/nuevo`} className={claseBoton.primario}>Agregar {def.singular}</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}{def.descripcion ? ` · ${def.descripcion}` : ""}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <div className="mt-4"><Aviso>No se pudo leer la lista{error.code ? ` (código ${error.code})` : ""}.</Aviso></div>}
      {def.extra && <div className="mt-6">{def.extra(filas, ctx)}</div>}
      {filas.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay registros.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>
                {def.columnas.map((c) => <th key={c.etiqueta} className="px-3 py-2 font-medium">{c.etiqueta}</th>)}
                {puede && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {filas.map((f) => (
                <tr key={String(f.id)}>
                  {def.columnas.map((c) => <td key={c.etiqueta} className="px-3 py-2 align-top">{c.valor(f, ctx)}</td>)}
                  {puede && (
                    <td className="px-3 py-2 text-right">
                      <Link href={`${base}/${f.id}`} className="font-medium text-leaf-600 hover:underline">Editar</Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaModulo({ params, searchParams }: PageProps<"/proyectos/[id]/r/[modulo]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}
