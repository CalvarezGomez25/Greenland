import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { aEscalado, formatearDecimal } from "@/lib/presupuesto/dinero";
import { formatearNit } from "@/lib/aliados";
import { Titulo } from "@/components/ui";
import { actualizarContrato } from "../../acciones";
import { FormularioContrato } from "../../formularios";

async function Contenido({ params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id, contratoId } = await params;
  if (!ES_UUID.test(contratoId)) notFound();
  const { supabase, permisos } = await cargarProyecto(id);
  const volverA = `/proyectos/${id}/contratos/${contratoId}`;
  if (!permisos.gestionar) redirect(volverA);
  const { data } = await supabase.from("contratos").select("tipo, contratista, tercero_id, objeto, valor").eq("id", contratoId).eq("proyecto_id", id).maybeSingle();
  if (!data) notFound();
  const { data: ts } = await supabase.from("terceros").select("id, nit, razon_social").or(`estado.eq.activo,id.eq.${data.tercero_id ?? "00000000-0000-0000-0000-000000000000"}`).order("razon_social").limit(1000);
  const terceros = ((ts ?? []) as { id: string; nit: string; razon_social: string }[]).map((t) => ({ id: t.id, etiqueta: `${t.razon_social} (${formatearNit(t.nit)})` }));
  const iniciales = { tipo: data.tipo, contratista: data.contratista, tercero_id: data.tercero_id ?? "", objeto: data.objeto, valor: formatearDecimal(aEscalado(String(data.valor), 2), 2) };
  return (
    <>
      <Link href={volverA} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al contrato</Link>
      <div className="mt-4"><Titulo>Editar contrato</Titulo></div>
      <div className="mt-6"><FormularioContrato accion={actualizarContrato.bind(null, id, contratoId)} iniciales={iniciales} volverA={volverA} terceros={terceros} /></div>
    </>
  );
}

export default function PaginaEditarContrato({ params }: PageProps<"/proyectos/[id]/contratos/[contratoId]/editar">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
