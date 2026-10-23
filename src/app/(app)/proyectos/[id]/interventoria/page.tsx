import { Suspense } from "react";
import Link from "next/link";
import { cargarProyecto } from "@/lib/contexto-proyecto";
import { Titulo } from "@/components/ui";

const SECCIONES = [
  ["asignaciones", "Asignación", "Contratos vigilados, alcances, vigencia y sub-roles"],
  ["conceptos", "Conceptos", "Pronunciamientos sobre actas, avance, cambios, anticipo y diseños"],
  ["hallazgos", "Hallazgos y requerimientos", "Observaciones, no conformidades e incumplimientos, con plazo de respuesta"],
  ["disenos", "Revisión de diseños", "Ciclos de revisión de planos; listo para licitar"],
  ["evaluaciones", "Evaluación de proveedores", "Calificación por criterios y recomendación"],
  ["asesorias", "Asesoría para decisiones", "Estudios de mercado, investigaciones y apoyo a pliegos"],
  ["informes", "Informes", "Periódico, especial, sancionatorio y final"],
] as const;

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { proyecto, permisos } = await cargarProyecto(id);
  return (
    <>
      <Link href={`/proyectos/${id}`} className="text-sm font-medium text-leaf-600 hover:underline">← Volver al proyecto</Link>
      <div className="mt-4"><Titulo>Interventoría</Titulo></div>
      <p className="mt-3 max-w-3xl text-sm text-muted">{proyecto.nombre} · La interventoría conceptúa, verifica, observa e informa; no aprueba ni modifica datos del contrato, no contrata ni selecciona proveedores. {permisos.interventor ? "Solo ves lo asignado a tu contrato." : ""}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECCIONES.map(([ruta, titulo, texto]) => (
          <li key={ruta}><Link href={`/proyectos/${id}/interventoria/${ruta}`} className="block h-full rounded-card border border-soil-border p-4 transition hover:-translate-y-0.5 hover:shadow-card"><p className="font-display text-lg font-bold text-leaf-700">{titulo}</p><p className="text-sm text-muted">{texto}</p></Link></li>
        ))}
      </ul>
    </>
  );
}

export default function PaginaInterventoria({ params }: PageProps<"/proyectos/[id]/interventoria">) {
  return <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}><Contenido params={params} /></Suspense>;
}
