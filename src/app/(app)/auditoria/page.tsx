import { Suspense } from "react";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { formatearFechaHora } from "@/lib/formato";
import { Selector, Titulo, claseBoton } from "@/components/ui";

type Fila = { id: number; usuario_id: string | null; fecha: string; tabla: string; registro_id: string | null; proyecto_id: string | null; campo: string; valor_anterior: string | null; valor_nuevo: string | null };

const corto = (t: string | null) => (t === null ? "—" : t.length > 80 ? `${t.slice(0, 80)}…` : t);

async function Contenido({ searchParams }: { searchParams: Promise<{ tabla?: string; proyecto?: string }> }) {
  const { tabla, proyecto } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) redirect("/");
  let q = supabase.from("auditoria").select("id, usuario_id, fecha, tabla, registro_id, proyecto_id, campo, valor_anterior, valor_nuevo").order("id", { ascending: false }).limit(300);
  if (tabla && /^[a-z_]{1,40}$/.test(tabla)) q = q.eq("tabla", tabla);
  if (proyecto && /^[0-9a-f-]{36}$/i.test(proyecto)) q = q.eq("proyecto_id", proyecto);
  const [{ data }, { data: perfiles }, { data: proyectos }, { data: tablas }] = await Promise.all([
    q,
    supabase.from("perfiles").select("id, nombre"),
    supabase.from("proyectos").select("id, nombre").order("nombre"),
    supabase.from("auditoria").select("tabla").limit(1000),
  ]);
  const filas = (data ?? []) as Fila[];
  if (!perfil.rol_global && filas.length === 0 && (proyectos ?? []).length === 0) redirect("/");
  const nombres = new Map(((perfiles ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const nomProy = new Map(((proyectos ?? []) as { id: string; nombre: string }[]).map((p) => [p.id, p.nombre]));
  const lasTablas = [...new Set(((tablas ?? []) as { tabla: string }[]).map((t) => t.tabla))].sort();

  return (
    <>
      <Titulo>Auditoría</Titulo>
      <p className="mt-3 text-sm text-muted">Quién cambió qué y cuándo (últimos 300 movimientos). Solo lectura.</p>
      <form className="mt-5 flex flex-wrap items-end gap-3">
        <Selector etiqueta="Tabla" name="tabla" defaultValue={tabla ?? ""}>
          <option value="">Todas</option>
          {lasTablas.map((t) => <option key={t} value={t}>{t}</option>)}
        </Selector>
        <Selector etiqueta="Proyecto" name="proyecto" defaultValue={proyecto ?? ""}>
          <option value="">Todos</option>
          {((proyectos ?? []) as { id: string; nombre: string }[]).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
        <button className={claseBoton.secundario}>Filtrar</button>
      </form>
      {filas.length === 0 ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">No hay movimientos para mostrar.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["Fecha", "Quién", "Tabla", "Proyecto", "Campo", "Antes", "Después"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap px-3 py-2">{formatearFechaHora(f.fecha)}</td>
                  <td className="px-3 py-2">{(f.usuario_id && nombres.get(f.usuario_id)) || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.tabla}</td>
                  <td className="px-3 py-2">{(f.proyecto_id && nomProy.get(f.proyecto_id)) || "—"}</td>
                  <td className="px-3 py-2">{f.campo}</td>
                  <td className="max-w-[200px] break-words px-3 py-2 text-muted">{corto(f.valor_anterior)}</td>
                  <td className="max-w-[200px] break-words px-3 py-2">{corto(f.valor_nuevo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function PaginaAuditoria({ searchParams }: PageProps<"/auditoria">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido searchParams={searchParams} /></Suspense>;
}
