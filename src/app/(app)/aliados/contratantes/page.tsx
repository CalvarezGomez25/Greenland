import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { formatearNit, type Contratante } from "@/lib/aliados";
import { Titulo, claseBoton } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

async function Contenido({ searchParams }: { searchParams: Promise<{ ok?: string | string[] }> }) {
  const { ok } = await searchParams;
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_contratantes");
  const { data, error } = await supabase.from("contratantes").select("id, codigo, razon_social, nit, representante_legal, municipio, tope_smmlv, estado").order("codigo");
  const lista = (data ?? []) as Pick<Contratante, "id" | "codigo" | "razon_social" | "nit" | "representante_legal" | "municipio" | "tope_smmlv" | "estado">[];
  const { data: proys } = await supabase.from("proyectos").select("contratante_id, codigo, nombre").not("contratante_id", "is", null);
  const usos = new Map<string, string[]>();
  for (const p of (proys ?? []) as { contratante_id: string; codigo: string | null; nombre: string }[]) usos.set(p.contratante_id, [...(usos.get(p.contratante_id) ?? []), p.codigo ?? p.nombre]);

  return (
    <>
      <Link href="/aliados" className="text-sm font-medium text-leaf-600 hover:underline">← Volver a aliados y proveedores</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <Titulo>Contratantes</Titulo>
        {puedeEditar === true && <Link href="/aliados/contratantes/nuevo" className={claseBoton.primario}>Agregar contratante</Link>}
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted">Las sociedades del grupo que contratan. Cada proyecto tiene un contratante (se asigna en la pantalla de contratos del proyecto) y su tope de contratación sin asamblea.{puedeEditar !== true && " Solo el administrador y el director general los editan."}</p>
      <div className="mt-4"><AvisoResultado ok={ok} /></div>
      {error && <p className="mt-4 text-sm text-danger">No se pudieron leer los contratantes{error.code ? ` (código ${error.code})` : ""}.</p>}
      {lista.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">Aún no hay contratantes.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800"><tr>{["Código", "Razón social", "NIT", "Tope (SMMLV)", "Proyectos", ""].map((t) => <th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr></thead>
            <tbody className="divide-y divide-soil-border">
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 align-top">{c.codigo}</td>
                  <td className="px-3 py-2 align-top font-medium text-leaf-900">{c.razon_social}{c.estado === "inactivo" && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-normal">Inactivo</span>}<p className="text-xs font-normal text-muted">{c.representante_legal ?? ""}</p></td>
                  <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums">{c.nit ? formatearNit(c.nit) : "—"}</td>
                  <td className="px-3 py-2 align-top tabular-nums">{c.tope_smmlv ?? "General"}</td>
                  <td className="px-3 py-2 align-top">{(usos.get(c.id) ?? []).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-right align-top"><Link href={`/aliados/contratantes/${c.id}`} className="font-medium text-leaf-600 hover:underline">{puedeEditar === true ? "Editar" : "Ver"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaContratantes({ searchParams }: PageProps<"/aliados/contratantes">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido searchParams={searchParams} /></Suspense>;
}
