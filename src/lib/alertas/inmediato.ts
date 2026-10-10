// Aviso inmediato por correo cuando nace una decisión (por ejemplo, un cambio que pasa a aprobación).
// Nunca interrumpe lo que la persona estaba haciendo: cualquier fallo solo queda en el registro del servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreo, proveedorConfigurado, urlBase } from "./correo";
import { componerAviso } from "./resumen";
import type { Audiencia } from "../pmo/portafolio";

export type Aviso = { proyectoId: string; proyecto: string; audiencia: Audiencia; titulo: string; detalle: string; href: string };

export async function avisarDecision(supabase: SupabaseClient, a: Aviso): Promise<void> {
  try {
    if (!proveedorConfigurado()) return;
    const { data: par } = await supabase.from("parametros").select("valor").eq("ambito", "global").eq("clave", "alertas_correo_activas").maybeSingle();
    if (par?.valor === "no") return;
    const { data, error } = await supabase.rpc("correos_alerta", { p_proyecto: a.proyectoId, p_audiencia: a.audiencia });
    if (error) return void console.error("Alertas: no se pudieron leer los destinatarios:", error.code, error.message);
    const correos = [...new Set(((data ?? []) as { correo: string }[]).map((x) => x.correo.trim().toLowerCase()))];
    if (correos.length === 0) return;
    const armado = componerAviso({ titulo: a.titulo, detalle: a.detalle, proyecto: a.proyecto, href: a.href }, urlBase());
    const envios = Promise.all(correos.map((para) => enviarCorreo({ para, ...armado })));
    const tiempo = new Promise<null>((r) => setTimeout(() => r(null), 10_000));
    const res = await Promise.race([envios, tiempo]);
    for (const r of res ?? []) if (!r.ok) console.error("Alertas: fallo al enviar un aviso:", r.error);
  } catch (e) {
    console.error("Alertas: error inesperado:", e instanceof Error ? e.message : e);
  }
}
