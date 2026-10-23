import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { enlaceTelefono, type Contacto } from "@/lib/contactos";
import { Titulo, claseBoton, claseCampo } from "@/components/ui";
import { AvisoResultado } from "@/components/aviso-resultado";

// Quita los signos que tienen sentido especial en un filtro de PostgREST (coma, paréntesis, comodines).
const limpiarBusqueda = (t: string) => t.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

async function Contenido({ searchParams }: { searchParams: Promise<{ q?: string | string[]; ok?: string | string[] }> }) {
  const sp = await searchParams;
  const q = limpiarBusqueda(Array.isArray(sp.q) ? sp.q[0] ?? "" : sp.q ?? "");
  const { supabase } = await obtenerSesion();
  const { data: permitido } = await supabase.rpc("puede_usar_directorio");
  if (permitido !== true) redirect("/");

  let consulta = supabase.from("contactos").select("id, nombre, rol, correo, telefono").order("nombre").limit(500);
  if (q) consulta = consulta.or(`nombre.ilike.%${q}%,rol.ilike.%${q}%,correo.ilike.%${q}%`);
  const { data, error } = await consulta;
  const lista = (data ?? []) as Contacto[];

  // En qué proyectos (de los que esta persona ve) participa cada contacto.
  const usos = new Map<string, string[]>();
  if (lista.length) {
    const [{ data: vinc }, { data: proys }] = await Promise.all([
      supabase.from("stakeholders").select("contacto_id, proyecto_id").in("contacto_id", lista.map((c) => c.id)).limit(5000),
      supabase.from("proyectos").select("id, codigo, nombre"),
    ]);
    const etiqueta = new Map(((proys ?? []) as { id: string; codigo: string | null; nombre: string }[]).map((p) => [p.id, p.codigo ?? p.nombre]));
    for (const v of (vinc ?? []) as { contacto_id: string; proyecto_id: string }[]) {
      const e = etiqueta.get(v.proyecto_id);
      if (!e) continue;
      const l = usos.get(v.contacto_id) ?? [];
      if (!l.includes(e)) l.push(e);
      usos.set(v.contacto_id, l);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo>Directorio de contactos</Titulo>
        <Link href="/directorio/nuevo" className={claseBoton.primario}>Agregar contacto</Link>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Personas y organizaciones que ya registraste como interesados. Al guardar un interesado con su correo y teléfono, queda aquí para
        reutilizarlo en otros proyectos. Solo el administrador elimina contactos.
      </p>
      <div className="mt-4"><AvisoResultado ok={sp.ok} /></div>
      <form method="get" className="mt-4 flex max-w-xl gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre, rol o correo" aria-label="Buscar contactos" className={`${claseCampo} min-w-0 flex-1`} />
        <button type="submit" className={claseBoton.contorno}>Buscar</button>
      </form>
      {error && <p className="mt-4 text-sm text-danger">No se pudo leer el directorio{error.code ? ` (código ${error.code})` : ""}.</p>}
      {lista.length === 0 && !error ? (
        <p className="mt-6 rounded-card bg-leaf-50 p-6 text-sm text-muted">{q ? "Ningún contacto coincide con la búsqueda." : "Aún no hay contactos. Se crean solos al registrar interesados."}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-soil-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-leaf-100 text-xs uppercase tracking-wider text-leaf-800">
              <tr>{["Nombre", "Rol", "Correo", "Teléfono", "Proyectos", ""].map((t) => <th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-soil-border">
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 align-top font-medium text-leaf-900">{c.nombre}</td>
                  <td className="px-3 py-2 align-top">{c.rol ?? "—"}</td>
                  <td className="px-3 py-2 align-top">{c.correo ? <a href={`mailto:${c.correo}`} className="text-leaf-600 hover:underline">{c.correo}</a> : "—"}</td>
                  <td className="px-3 py-2 align-top">{c.telefono ? <a href={enlaceTelefono(c.telefono)} className="whitespace-nowrap text-leaf-600 hover:underline">{c.telefono}</a> : "—"}</td>
                  <td className="px-3 py-2 align-top">{(usos.get(c.id) ?? []).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-right align-top"><Link href={`/directorio/${c.id}`} className="font-medium text-leaf-600 hover:underline">Editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista.length === 500 && <p className="mt-3 text-xs text-muted">Se muestran los primeros 500. Usa la búsqueda para acotar.</p>}
    </>
  );
}

export default function PaginaDirectorio({ searchParams }: PageProps<"/directorio">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  );
}
