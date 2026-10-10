// Resumen diario de decisiones pendientes por correo. Lo llama el cron de Vercel (vercel.json) con
// "Authorization: Bearer CRON_SECRET". Entra con un usuario de lectura (rol Analista PMO) en vez de usar la
// clave secreta de Supabase: así solo puede ver lo que ese rol puede ver.
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { datosConexion } from "@/lib/supabase/env";
import { cargarDecisiones } from "@/lib/pmo/dashboard";
import { hoyColombia } from "@/lib/pmo/cargar";
import { enviarCorreo, proveedorConfigurado, urlBase } from "@/lib/alertas/correo";
import { componerResumen, repartirDecisiones, type Persona } from "@/lib/alertas/resumen";

const json = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  await connection();
  const secreto = (process.env.CRON_SECRET ?? "").trim();
  if (!secreto) return json({ error: "CRON_SECRET no está configurado." }, 503);
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) return json({ error: "No autorizado." }, 401);

  const proveedor = proveedorConfigurado();
  if (!proveedor) return json({ omitido: "No hay proveedor de correo configurado." });
  const usuario = (process.env.ALERTAS_USUARIO ?? "").trim();
  const clave = (process.env.ALERTAS_CLAVE ?? "").trim();
  if (!usuario || !clave) return json({ omitido: "Faltan ALERTAS_USUARIO y ALERTAS_CLAVE (usuario de lectura con rol Analista PMO)." });

  const { url, clave: anon } = datosConexion();
  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: errorIngreso } = await supabase.auth.signInWithPassword({ email: usuario, password: clave });
  if (errorIngreso) {
    console.error("Alertas: no se pudo iniciar sesión con el usuario de alertas:", errorIngreso.message);
    return json({ error: "No se pudo iniciar sesión con el usuario de alertas." }, 502);
  }

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
