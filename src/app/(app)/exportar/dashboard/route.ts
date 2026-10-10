import type { NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/sesion";
import { cargarDashboard } from "@/lib/pmo/dashboard";
import { documentoDashboard } from "@/lib/exportar/dashboard";
import { formatoDe, respuestaDescarga } from "@/lib/exportar/respuesta";
import { ETIQUETA_ESTADO, ETIQUETA_FASE } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const { supabase, perfil } = await obtenerSesion();
  if (!perfil) return new Response("Sin perfil", { status: 403 });
  const p = req.nextUrl.searchParams;
  const f = { estado: p.get("estado") ?? undefined, fase: p.get("fase") ?? undefined, portafolio: p.get("portafolio") ?? undefined, gerente: p.get("gerente") ?? undefined };
  const d = await cargarDashboard(supabase, f);
  if (!d) return new Response("No se pudieron cargar los datos", { status: 500 });
  const partes = [
    f.estado ? `Estado: ${f.estado === "todos" ? "todos" : (ETIQUETA_ESTADO as Record<string, string>)[f.estado] ?? f.estado}` : "Proyectos vigentes (activos y en pausa)",
    f.fase ? `Fase: ${(ETIQUETA_FASE as Record<string, string>)[f.fase] ?? f.fase}` : null,
    f.portafolio ? `Portafolio: ${d.portafolios.find((x) => x.id === f.portafolio)?.nombre ?? "—"}` : null,
    f.gerente ? `Gerente: ${d.gerentes.find((x) => x.id === f.gerente)?.nombre ?? "—"}` : null,
  ].filter(Boolean) as string[];
  return respuestaDescarga(documentoDashboard(d, partes.join(" · ")), formatoDe(p.get("formato")), `dashboard-${d.hoy}`);
}
