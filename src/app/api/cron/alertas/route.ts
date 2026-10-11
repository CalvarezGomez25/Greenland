// Resumen diario de decisiones pendientes por correo. Lo llama el cron de Vercel (vercel.json) con
// "Authorization: Bearer CRON_SECRET". Entra con un usuario de lectura (rol Analista PMO) en vez de usar la
// clave secreta de Supabase: así solo puede ver lo que ese rol puede ver.
import { cargarDecisiones } from "@/lib/pmo/dashboard";
import { hoyColombia } from "@/lib/pmo/cargar";
import { enviarCorreo, urlBase } from "@/lib/alertas/correo";
import { iniciarTarea, json } from "@/lib/alertas/cron";
import { componerResumen, repartirDecisiones, type Persona } from "@/lib/alertas/resumen";

export async function GET(req: Request) {
  const tarea = await iniciarTarea(req);
  if ("respuesta" in tarea) return tarea.respuesta;
  const { supabase, proveedor } = tarea;

  try {
    const { data: par } = await supabase.from("parametros").select("valor").eq("ambito", "global").eq("clave", "alertas_correo_activas").maybeSingle();
    if (par?.valor === "no") return json({ omitido: "Las alertas por correo están desactivadas en Parámetros." });

    const cargado = await cargarDecisiones(supabase);
    if (!cargado) return json({ error: "No se pudieron leer los proyectos." }, 500);

    const [{ data: perfiles }, { data: miembros }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre, correo, rol_global"),
      supabase.from("miembros_proyecto").select("proyecto_id, usuario_id").eq("rol", "gerente"),
    ]);
    const lista = (perfiles ?? []) as { id: string; nombre: string; correo: string | null; rol_global: string | null }[];
    const persona = (p: (typeof lista)[number]): Persona => ({ id: p.id, nombre: p.nombre, correo: (p.correo ?? "").trim() });
    let directores = lista.filter((p) => p.rol_global === "director_general").map(persona);
    if (directores.length === 0) directores = lista.filter((p) => p.rol_global === "administrador").map(persona); // sin director: administradores
    const porId = new Map(lista.map((p) => [p.id, persona(p)]));
    const gerentes = new Map<string, Persona[]>();
    for (const m of (miembros ?? []) as { proyecto_id: string; usuario_id: string }[]) {
      const p = porId.get(m.usuario_id);
      if (p) gerentes.set(m.proyecto_id, [...(gerentes.get(m.proyecto_id) ?? []), p]);
    }

    const resumenes = repartirDecisiones(cargado.decisiones, directores, gerentes);
    const hoy = hoyColombia();
    const base = urlBase();
    const resultados = [];
    for (const r of resumenes) resultados.push(await enviarCorreo({ para: r.persona.correo, ...componerResumen(r, base, hoy) }));
    const fallidos = resultados.filter((x) => !x.ok);
    for (const f of fallidos) console.error("Alertas: fallo al enviar un resumen:", f.error);
    return json({ decisiones: cargado.decisiones.length, destinatarios: resumenes.length, enviados: resultados.length - fallidos.length, fallidos: fallidos.length, proveedor });
  } finally {
    await supabase.auth.signOut().catch(() => {});
  }
}
