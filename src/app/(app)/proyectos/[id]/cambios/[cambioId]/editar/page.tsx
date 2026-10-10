import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { ES_UUID } from "@/lib/formato";
import { esEditable } from "@/lib/pmo/cambios";
import { formatearDecimal, aEscalado } from "@/lib/presupuesto/dinero";
import { Titulo } from "@/components/ui";
import { actualizarCambio } from "../../acciones";
import { cargarOpcionesCambio } from "../../datos";
import { FormularioCambio } from "../../formulario-cambio";

async function Contenido({ params }: { params: Promise<{ id: string; cambioId: string }> }) {
  const { id, cambioId } = await params;
  if (!ES_UUID.test(cambioId)) notFound();
  const { supabase, proyecto, permisos } = await cargarProyecto(id);
  const { data } = await supabase.from("cambios").select("*").eq("id", cambioId).eq("proyecto_id", id).maybeSingle();
  if (!data) notFound();
  const volverA = `/proyectos/${id}/cambios/${cambioId}`;
  const editable = esEditable(data.estado_flujo);
  if (!(permisos.gestionar || (editable && permisos.reportar)) || data.estado_flujo === "cerrado") redirect(volverA);
  const { tipos, riesgos } = await cargarOpcionesCambio(supabase, id, proyecto.portafolio_id);

  const iniciales: Record<string, string> = {};
  for (const k of ["tipo", "descripcion_antes", "descripcion_despues", "justificacion", "impacto_alcance", "responsable_implementacion", "observaciones", "lecciones", "riesgo_id", "contrato_id"]) iniciales[k] = data[k] ?? "";
  iniciales.impacto_costo = formatearDecimal(aEscalado(String(data.impacto_costo), 2), 2);
  iniciales.impacto_dias = String(data.impacto_dias);
  iniciales.ambitos = (data.ambitos as string[]).join(",");
  iniciales.detectado_sin_formato = data.detectado_sin_formato ? "on" : "";
  if (data.impacto_costo < 0 && !iniciales.impacto_costo.startsWith("-")) iniciales.impacto_costo = `-${iniciales.impacto_costo}`;

  return (
    <>
      <Link href={volverA} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al cambio</Link>
      <div className="mt-4"><Titulo>Editar {data.codigo}</Titulo></div>
      <div className="mt-6"><FormularioCambio accion={actualizarCambio.bind(null, id, cambioId)} iniciales={iniciales} tipos={tipos} riesgos={riesgos} volverA={volverA} soloNotas={!editable} /></div>
    </>
  );
}

export default function PaginaEditarCambio({ params }: PageProps<"/proyectos/[id]/cambios/[cambioId]/editar">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
