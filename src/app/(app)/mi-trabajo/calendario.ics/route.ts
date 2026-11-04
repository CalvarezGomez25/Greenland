import { obtenerSesion } from "@/lib/sesion";
import { hoyColombia } from "@/lib/actividades";
import { cargarEventos } from "@/lib/calendario/eventos";
import { construirICS } from "@/lib/calendario/ics";

// Descarga el calendario de la persona (.ics): sus actividades y los vencimientos de sus proyectos. Solo lee.
export async function GET(req: Request) {
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) return new Response("Inicia sesión para descargar tu calendario.", { status: 401 });
  const { data: asig } = await supabase.from("miembros_proyecto").select("proyecto_id").eq("usuario_id", perfil.id);
  const proyectos = ((asig ?? []) as { proyecto_id: string }[]).map((m) => m.proyecto_id);
  const eventos = await cargarEventos(supabase, perfil.id, hoyColombia(), new URL(req.url).origin, proyectos);
  return new Response(construirICS(eventos, new Date(), "PMO360 · Mi calendario"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pmo360-mi-calendario.ics"',
      "Cache-Control": "no-store",
    },
  });
}
