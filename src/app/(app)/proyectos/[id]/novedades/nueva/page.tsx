import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { hoyColombia } from "@/lib/actividades";
import { ETIQUETA_TIPO_CONTRATO } from "@/lib/obra/contratos";
import { Aviso, Titulo } from "@/components/ui";
import { FormularioNovedad } from "../formulario-novedad";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await cargarProyecto(id);
  const { data } = await supabase.from("contratos").select("id, tipo, contratista").eq("proyecto_id", id).order("contratista");
  const contratos = ((data ?? []) as { id: string; tipo: string; contratista: string }[]).map((c) => ({ id: c.id, etiqueta: `${c.contratista} · ${ETIQUETA_TIPO_CONTRATO[c.tipo] ?? c.tipo}` }));
  return (
    <>
      <Link href={`/proyectos/${id}/novedades`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a las novedades</Link>
      <div className="mt-4"><Titulo>Registrar novedad</Titulo></div>
      <div className="mt-6">{contratos.length === 0 ? <Aviso>Este proyecto aún no tiene contratos a los que puedas registrar novedades.</Aviso> : <FormularioNovedad proyectoId={id} contratos={contratos} hoy={hoyColombia()} />}</div>
    </>
  );
}

export default function PaginaNuevaNovedad({ params }: PageProps<"/proyectos/[id]/novedades/nueva">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
