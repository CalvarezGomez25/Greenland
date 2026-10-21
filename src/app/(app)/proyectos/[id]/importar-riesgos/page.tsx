import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";
import { importarRiesgos } from "./acciones";
import { ImportarRiesgos } from "./formulario";

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { proyecto, permisos } = await cargarProyecto(id);
  if (!permisos.gestionar) redirect(`/proyectos/${id}/r/riesgos`);
  return (
    <>
      <Link href={`/proyectos/${id}/r/riesgos`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver a riesgos</Link>
      <div className="mt-4"><Titulo>Importar riesgos desde Excel</Titulo></div>
      <p className="mt-3 text-sm text-muted">{proyecto.nombre}</p>
      <div className="mt-6 max-w-2xl rounded-card border-[1.5px] border-soil-border p-5 text-sm">
        <h2 className="font-display text-lg font-bold text-leaf-700">Cómo debe ser el archivo</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Libro de Excel <strong>.xlsx</strong> con una hoja llamada <strong>Registro</strong>: una fila por riesgo y los encabezados en la primera fila.</li>
          <li>Columnas reconocidas: <strong>ID, Frente, Categoría, Riesgo, Causa / disparador, Consecuencia, Probabilidad, Impacto, Mitigación / acción, Momento de control, Responsable (rol propuesto), Responsable (nombre), Fecha objetivo, Estado, Base / referencia</strong>. Obligatorias: ID, Categoría, Riesgo, Probabilidad e Impacto.</li>
          <li>Probabilidad e Impacto: <strong>Baja, Media o Alta</strong> (equivalen a 1, 2 y 4 de la escala 1 a 5 de la plataforma) o un número de 1 a 5. El nivel y el puntaje los calcula la plataforma.</li>
          <li>Estado: Abierto, Materializado o Cerrado.</li>
          <li>Si un ID ya existe en el proyecto, ese riesgo se <strong>actualiza</strong>; los demás se crean. Nada se borra. Si hay errores no se importa nada.</li>
        </ul>
      </div>
      <div className="mt-8"><ImportarRiesgos accion={importarRiesgos.bind(null, id)} /></div>
    </>
  );
}

export default function PaginaImportarRiesgos({ params }: PageProps<"/proyectos/[id]/importar-riesgos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}
