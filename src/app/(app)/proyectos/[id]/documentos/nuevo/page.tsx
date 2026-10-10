import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";
import { prepararSubidaDocumento, registrarDocumento } from "../acciones";
import { FormularioDocumento } from "../formulario-documento";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, permisos } = await cargarProyecto(id);
  if (!(permisos.reportar || permisos.interventor)) redirect(`/proyectos/${id}/documentos`);
  const [{ data: cs }, { data: cb }] = await Promise.all([
    supabase.from("contratos").select("id, contratista").eq("proyecto_id", id).order("creado_en"),
    supabase.from("cambios").select("id, codigo").eq("proyecto_id", id).order("codigo"),
  ]);
  const vinculos = [
    ...((cs ?? []) as { id: string; contratista: string }[]).map((c) => ({ tipo: "contrato", id: c.id, etiqueta: `Contrato: ${c.contratista}` })),
    ...((cb ?? []) as { id: string; codigo: string }[]).map((c) => ({ tipo: "cambio", id: c.id, etiqueta: `Cambio ${c.codigo}` })),
  ];
  return (
    <>
      <Link href={`/proyectos/${id}/documentos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a los documentos</Link>
      <div className="mt-4"><Titulo>Subir documento</Titulo></div>
      <div className="mt-6">
        <FormularioDocumento proyectoId={id} tipoPermitido={permisos.interventor ? "informe" : undefined} vinculos={permisos.interventor ? [] : vinculos} preparar={prepararSubidaDocumento} registrar={registrarDocumento} volverA={`/proyectos/${id}/documentos`} />
      </div>
    </>
  );
}

export default function PaginaNuevoDocumento({ params }: PageProps<"/proyectos/[id]/documentos/nuevo">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
