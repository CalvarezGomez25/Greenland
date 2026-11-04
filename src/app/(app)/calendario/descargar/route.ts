import { obtenerSesion } from "@/lib/sesion";
import { hoyColombia } from "@/lib/actividades";
import { cargarEventos } from "@/lib/calendario/eventos";
import { construirICS } from "@/lib/calendario/ics";

// Descarga el calendario de la persona en formato .ics. Solo lee; cada quien recibe únicamente lo que su sesión le deja ver.
export async function GET(req: Request) {
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) return new Response("Inicia sesión para descargar tu calendario.", { status: 401 });
  const base = new URL(req.url).origin;
  const eventos = await cargarEventos(supabase, perfil.id, hoyColombia(), base);
  const cuerpo = construirICS(eventos, new Date(), "PMO360 · Mi calendario");
  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pmo360-mi-calendario.ics"',
      "Cache-Control": "no-store",
    },
  });
}
