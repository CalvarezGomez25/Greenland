import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { formatearNit } from "@/lib/aliados";
import { Titulo } from "@/components/ui";
import { FormularioContratante } from "../formulario-contratante";
import { guardarContratante } from "../../acciones";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nuevo = id === "nuevo";
  if (!nuevo && !ES_UUID.test(id)) notFound();
  const { supabase } = await obtenerSesion();
  const { data: puedeVer } = await supabase.rpc("puede_ver_aliados");
  if (puedeVer !== true) redirect("/");
  const { data: puedeEditar } = await supabase.rpc("puede_editar_contratantes");
  if (nuevo && puedeEditar !== true) redirect("/aliados/contratantes");
  const iniciales: Record<string, string> = {};
  if (!nuevo) {
    const { data } = await supabase.from("contratantes").select("razon_social, nit, representante_legal, municipio, correo_notificacion, correo_facturacion, tope_smmlv, estado, observaciones").eq("id", id).maybeSingle();
    if (!data) notFound();
    for (const [k, x] of Object.entries(data as Record<string, string | number | null>)) iniciales[k] = x === null ? "" : String(x);
    if (iniciales.nit) iniciales.nit = formatearNit(iniciales.nit);
  }
  return (
    <>
      <Link href="/aliados/contratantes" className="text-sm font-medium text-leaf-600 hover:underline">← Volver a contratantes</Link>
      <div className="mt-4"><Titulo>{nuevo ? "Agregar contratante" : puedeEditar === true ? "Editar contratante" : "Contratante"}</Titulo></div>
      <div className="mt-6"><FormularioContratante accion={guardarContratante.bind(null, nuevo ? null : id)} iniciales={iniciales} soloLectura={puedeEditar !== true} /></div>
    </>
  );
}

export default function PaginaContratante({ params }: PageProps<"/aliados/contratantes/[id]">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
