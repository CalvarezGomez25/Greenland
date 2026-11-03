import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { ETIQUETA_TIPO_TERCERO, esNitTemporal } from "@/lib/aliados";
import { ETAPAS } from "@/lib/contratos/vigilancia";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { FormularioTercero } from "../formulario-tercero";
import { guardarTercero } from "../acciones";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nuevo = id === "nuevo";
  if (!nuevo && !ES_UUID.test(id)) notFound();
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_aliados");
  if (nuevo && puedeEditar !== true) redirect("/aliados");

  const iniciales: Record<string, string> = {};
  let contratos: { id: string; proyecto_id: string; tipo: string; objeto: string; valor: number | string; etapa: number; proyectos: { codigo: string | null; nombre: string } | { codigo: string | null; nombre: string }[] | null }[] = [];
  let nit = "";
  if (!nuevo) {
    const { data } = await supabase.from("terceros").select("nit, tipo_persona, razon_social, tipo_tercero, especialidad, municipio, direccion, correo_notificacion, telefono, representante_legal, estado, fuente, observaciones").eq("id", id).maybeSingle();
    if (!data) notFound();
    for (const [k, x] of Object.entries(data as Record<string, string | null>)) iniciales[k] = x ?? "";
    nit = iniciales.nit;
    const { data: cs } = await supabase.from("contratos").select("id, proyecto_id, tipo, objeto, valor, etapa, proyectos(codigo, nombre)").eq("tercero_id", id).order("creado_en");
    contratos = (cs ?? []) as unknown as typeof contratos;
  }
  const soloLectura = puedeEditar !== true;

  return (
    <>
      <Link href="/aliados" className="text-sm font-medium text-leaf-600 hover:underline">← Volver al maestro</Link>
      <div className="mt-4"><Titulo>{nuevo ? "Agregar tercero" : soloLectura ? "Tercero" : "Editar tercero"}</Titulo></div>
      {!nuevo && esNitTemporal(nit) && (
        <p className="mt-3 max-w-2xl rounded-card bg-amber-50 p-3 text-sm text-amber-900">Este tercero tiene un identificador temporal. Cuando llegue el RUT, reemplaza el campo «NIT o cédula» por el definitivo: los contratos se conservan.</p>
      )}
      <div className="mt-6"><FormularioTercero accion={guardarTercero.bind(null, nuevo ? null : id)} iniciales={iniciales} soloLectura={soloLectura} /></div>

      {!nuevo && (
        <section className="mt-10" aria-labelledby="t-contratos">
          <h2 id="t-contratos" className="font-display text-2xl font-bold text-leaf-700">Contratos de este tercero</h2>
          <p className="mt-1 text-sm text-muted">Solo aparecen los de proyectos que puedes ver. Un {ETIQUETA_TIPO_TERCERO[iniciales.tipo_tercero]?.toLowerCase() ?? "tercero"} puede tener contratos en varios proyectos.</p>
          {contratos.length === 0 ? (
            <p className="mt-3 rounded-card bg-leaf-50 p-5 text-sm text-muted">Aún no tiene contratos registrados con este tercero.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-card border border-soil-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Proyecto", "Contrato", "Valor (COP)", "Etapa"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-soil-border">
                  {contratos.map((c) => {
                    const pr = Array.isArray(c.proyectos) ? c.proyectos[0] : c.proyectos;
                    return (
                      <tr key={c.id}>
                        <td className="px-3 py-2">{pr?.codigo ? `${pr.codigo} · ` : ""}{pr?.nombre ?? "—"}</td>
                        <td className="px-3 py-2"><Link href={`/proyectos/${c.proyecto_id}/contratos/${c.id}`} className="font-medium text-leaf-700 hover:underline">{ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo}</Link><p className="text-xs text-muted">{c.objeto.length > 70 ? `${c.objeto.slice(0, 70)}…` : c.objeto}</p></td>
                        <td className="px-3 py-2 tabular-nums">{formatearPesos(desdeJson(c.valor, 2) * 10_000n)}</td>
                        <td className="px-3 py-2">{c.etapa}. {ETAPAS[c.etapa - 1]?.nombre}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function PaginaTercero({ params }: PageProps<"/aliados/[id]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
