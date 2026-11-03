import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ETIQUETA_TIPO_TERCERO, TIPOS_TERCERO, esNitTemporal, formatearNit, type Tercero } from "@/lib/aliados";
import { desdeJson, formatearPesos } from "@/lib/presupuesto/dinero";
import { Titulo, claseBoton, claseCampo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

// Quita los signos que tienen sentido especial en un filtro de PostgREST (coma, paréntesis, comodines).
const limpiar = (t: string) => t.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = limpiar(uno(sp.q)), tipo = uno(sp.tipo), ver = uno(sp.ver);
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_aliados");

  let consulta = supabase.from("terceros").select("id, nit, razon_social, tipo_tercero, especialidad, municipio, estado").order("razon_social").limit(500);
  if (q) consulta = consulta.or(`razon_social.ilike.%${q}%,nit.ilike.%${q.replace(/[.\s]/g, "")}%,especialidad.ilike.%${q}%`);
  if ((TIPOS_TERCERO as readonly string[]).includes(tipo)) consulta = consulta.eq("tipo_tercero", tipo);
  if (ver === "pend") consulta = consulta.like("nit", "PEND-%");
  else if (ver === "inactivos") consulta = consulta.eq("estado", "inactivo");
  else consulta = consulta.eq("estado", "activo");
  const { data, error } = await consulta;
  const lista = (data ?? []) as Pick<Tercero, "id" | "nit" | "razon_social" | "tipo_tercero" | "especialidad" | "municipio" | "estado">[];

  // Contratos de cada tercero (solo los que esta persona puede ver, según las reglas de acceso de la base).
  const resumen = new Map<string, { n: number; valor: bigint }>();
  if (lista.length) {
    const { data: cs } = await supabase.from("contratos").select("tercero_id, valor").in("tercero_id", lista.map((t) => t.id)).limit(5000);
    for (const c of (cs ?? []) as { tercero_id: string; valor: number | string }[]) {
      const r = resumen.get(c.tercero_id) ?? { n: 0, valor: 0n };
      r.n += 1; r.valor += desdeJson(c.valor, 2) * 10_000n;
      resumen.set(c.tercero_id, r);
    }
  }
  const { count: pendientes } = await supabase.from("terceros").select("id", { count: "exact", head: true }).like("nit", "PEND-%").eq("estado", "activo");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo>Aliados y proveedores</Titulo>
        <div className="flex flex-wrap gap-3">
          <Link href="/aliados/contratantes" className={claseBoton.contorno}>Contratantes</Link>
          <Link href="/aliados/plantillas" className={claseBoton.contorno}>Plantillas de documentos</Link>
          {puedeEditar === true && <Link href="/aliados/nuevo" className={claseBoton.primario}>Agregar tercero</Link>}
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Maestro único de contratistas, proveedores, consultores e interventores. Cada tercero se escribe una sola vez, con su NIT o cédula, y se elige al registrar un
        contrato en cualquier proyecto. Aquí ves el tercero completo; en cada proyecto solo ves sus contratos.
      </p>
      <div className="mt-4"><AvisoResultado ok={sp.ok} /></div>
      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, NIT o especialidad" aria-label="Buscar terceros" className={`${claseCampo} min-w-0 flex-1 sm:max-w-sm`} />
        <select name="tipo" defaultValue={tipo} aria-label="Tipo de tercero" className={`${claseCampo} w-auto`}>
          <option value="">Todos los tipos</option>
          {TIPOS_TERCERO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_TERCERO[t]}</option>)}
        </select>
        <select name="ver" defaultValue={ver} aria-label="Qué mostrar" className={`${claseCampo} w-auto`}>
          <option value="">Activos</option>
          <option value="pend">Sin RUT (PEND-)</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <button type="submit" className={claseBoton.contorno}>Filtrar</button>
      </form>
      {(pendientes ?? 0) > 0 && ver !== "pend" && (
        <p className="mt-3 text-sm text-muted">{pendientes} {pendientes === 1 ? "tercero activo está" : "terceros activos están"} con identificador temporal (PEND-) a la espera del RUT. <Link href="/aliados?ver=pend" className="font-medium text-leaf-600 underline">Verlos</Link></p>
      )}
      {error && <p className="mt-4 text-sm text-danger">No se pudo leer el maestro{error.code ? ` (código ${error.code})` : ""}.</p>}
      {lista.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">{q || tipo || ver ? "Ningún tercero coincide con el filtro." : "Aún no hay terceros. Se crean con «Agregar tercero»."}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["NIT / cédula", "Razón social", "Tipo", "Especialidad", "Municipio", "Contratos", ""].map((t) => <th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {lista.map((t) => {
                const r = resumen.get(t.id);
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums">{formatearNit(t.nit)}{esNitTemporal(t.nit) && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Sin RUT</span>}</td>
                    <td className="px-3 py-2 align-top font-medium text-leaf-900">{t.razon_social}{t.estado === "inactivo" && <span className="ml-2 rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-normal">Inactivo</span>}</td>
                    <td className="px-3 py-2 align-top">{ETIQUETA_TIPO_TERCERO[t.tipo_tercero]}</td>
                    <td className="px-3 py-2 align-top">{t.especialidad ?? "—"}</td>
                    <td className="px-3 py-2 align-top">{t.municipio ?? "—"}</td>
                    <td className="px-3 py-2 align-top tabular-nums">{r ? <>{r.n}<span className="block text-xs text-muted">{formatearPesos(r.valor)}</span></> : "—"}</td>
                    <td className="px-3 py-2 text-right align-top"><Link href={`/aliados/${t.id}`} className="font-medium text-leaf-600 hover:underline">{puedeEditar === true ? "Editar" : "Ver"}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lista.length === 500 && <p className="mt-3 text-xs text-muted">Se muestran los primeros 500. Usa la búsqueda para acotar.</p>}
    </>
  );
}

export default function PaginaAliados({ searchParams }: PageProps<"/aliados">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido searchParams={searchParams} /></Suspense>;
}
