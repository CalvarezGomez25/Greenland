import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { formatearNit } from "@/lib/aliados";
import { ES_UUID } from "@/lib/formato";
import { aEscalado, formatearDecimal } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { crearContrato } from "../acciones";
import { FormularioContrato } from "../formularios";

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ proceso?: string }> }) {
  const { id } = await params;
  const { proceso } = await searchParams;
  const { supabase, permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) redirect(`/proyectos/${id}/contratos`);
  const { data: ts } = await supabase.from("terceros").select("id, nit, razon_social").eq("estado", "activo").order("razon_social").limit(1000);
  const terceros = ((ts ?? []) as { id: string; nit: string; razon_social: string }[]).map((t) => ({ id: t.id, etiqueta: `${t.razon_social} (${formatearNit(t.nit)})` }));
  // Desde un proceso adjudicado: se precargan el adjudicatario, el objeto, el tipo y el valor de la oferta ganadora.
  const iniciales: Record<string, string> = {};
  let origen: string | null = null;
  if (proceso && ES_UUID.test(proceso)) {
    const { data: pr } = await supabase.from("procesos").select("id, codigo, objeto, tipo_servicio, estado, contrato_id, adjudicatario_id").eq("id", proceso).eq("proyecto_id", id).maybeSingle();
    if (pr && pr.estado === "adjudicada" && !pr.contrato_id && pr.adjudicatario_id) {
      const { data: of } = await supabase.from("ofertas").select("valor_total").eq("proceso_id", pr.id).eq("estado", "adjudicada").maybeSingle();
      const tipos: Record<string, string> = { obra_civil: "obra", estructuras: "obra", hidraulicas: "obra", vias: "obra", diseno: "consultoria", interventoria: "interventoria", suministro: "suministro" };
      Object.assign(iniciales, { proceso_id: pr.id, tercero_id: pr.adjudicatario_id, objeto: pr.objeto, tipo: tipos[pr.tipo_servicio] ?? "otro" });
      if (of?.valor_total != null) iniciales.valor = formatearDecimal(aEscalado(String(of.valor_total), 2), 2);
      origen = pr.codigo;
    }
  }
  return (
    <>
      <Link href={`/proyectos/${id}/contratos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los contratos</Link>
      <div className="mt-4"><Titulo>Registrar contrato</Titulo></div>
      {origen && <p className="mt-3 rounded-card bg-leaf-50 p-3 text-sm">Datos tomados de la adjudicación del proceso <strong>{origen}</strong>: revísalos antes de guardar. Al guardar, el contrato queda vinculado al proceso.</p>}
      <p className="mt-3 text-sm text-muted">El contratista se elige del maestro de aliados y proveedores. El contrato de interventoría se registra aquí como cualquier otro; su valor puede entrar al presupuesto como un rubro.</p>
      <div className="mt-6"><FormularioContrato accion={crearContrato.bind(null, id)} iniciales={iniciales} volverA={`/proyectos/${id}/contratos`} terceros={terceros} /></div>
    </>
  );
}

export default function PaginaNuevoContrato({ params, searchParams }: PageProps<"/proyectos/[id]/contratos/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
