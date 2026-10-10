import { Suspense } from "react";
import { obtenerSesion } from "@/lib/sesion";
import { ES_UUID } from "@/lib/formato";
import { BarraProyecto } from "@/components/barra-proyecto";

async function EncabezadoProyecto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ES_UUID.test(id)) return null;
  const { supabase } = await obtenerSesion();
  const { data } = await supabase.from("proyectos").select("nombre, codigo").eq("id", id).maybeSingle();
  if (!data) return null;
  return <BarraProyecto id={id} nombre={data.nombre as string} codigo={(data.codigo as string | null) ?? null} />;
}

export default function LayoutProyecto({ children, params }: LayoutProps<"/proyectos/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-4 h-8" />}>
        <EncabezadoProyecto params={params} />
      </Suspense>
      {children}
    </>
  );
}
