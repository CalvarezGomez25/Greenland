// Envío de correos. El proveedor se elige por variables de entorno (ver README):
//  - Gmail u otro SMTP:  SMTP_USUARIO + SMTP_CLAVE (+ SMTP_SERVIDOR, SMTP_PUERTO, CORREO_REMITENTE)
//  - Resend:             RESEND_API_KEY + CORREO_REMITENTE (dirección de un dominio verificado en Resend)
//  - Pruebas:            CORREO_PROVEEDOR=consola (escribe en el registro, no envía nada)
// Si no hay ninguno configurado, no se envía nada y la plataforma funciona igual.
import nodemailer from "nodemailer";
import { NOMBRE_PLATAFORMA } from "../marca";

export type Proveedor = "smtp" | "resend" | "consola";
export type Adjunto = { nombre: string; contenido: Uint8Array; tipo: string };
export type Correo = { para: string; asunto: string; texto: string; html: string; adjuntos?: Adjunto[] };
export type ResultadoEnvio = { ok: boolean; proveedor: Proveedor | null; error?: string };

const env = (k: string) => (process.env[k] ?? "").trim();

export function proveedorConfigurado(): Proveedor | null {
  if (env("CORREO_PROVEEDOR") === "consola") return "consola";
  if (env("RESEND_API_KEY") && env("CORREO_REMITENTE")) return "resend";
  if (env("SMTP_USUARIO") && env("SMTP_CLAVE")) return "smtp";
  return null;
}

// Dirección base de la plataforma para los enlaces de los correos (sin barra final).
export function urlBase(): string {
  const explicita = env("URL_PUBLICA");
  const vercel = env("VERCEL_PROJECT_PRODUCTION_URL") || env("VERCEL_URL");
  const u = explicita || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return u.replace(/\/+$/, "");
}

const remitente = () => env("CORREO_REMITENTE") || `${NOMBRE_PLATAFORMA} <${env("SMTP_USUARIO")}>`;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function enviarCorreo(c: Correo): Promise<ResultadoEnvio> {
  const proveedor = proveedorConfigurado();
  if (!proveedor) return { ok: false, proveedor: null, error: "No hay proveedor de correo configurado." };
  if (!EMAIL.test(c.para)) return { ok: false, proveedor, error: "Dirección de correo no válida." };
  try {
    if (proveedor === "consola") {
      console.log(`[correo:consola] para=${c.para} asunto=${c.asunto} adjuntos=${(c.adjuntos ?? []).map((a) => `${a.nombre} (${a.contenido.byteLength} B)`).join(", ") || "ninguno"}\n${c.texto}`);
      return { ok: true, proveedor };
    }
    if (proveedor === "resend") {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: remitente(), to: [c.para], subject: c.asunto, text: c.texto, html: c.html, ...(c.adjuntos?.length ? { attachments: c.adjuntos.map((a) => ({ filename: a.nombre, content: Buffer.from(a.contenido).toString("base64") })) } : {}) }),
        signal: AbortSignal.timeout(c.adjuntos?.length ? 30_000 : 15_000),
      });
      if (!r.ok) return { ok: false, proveedor, error: `Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}` };
      return { ok: true, proveedor };
    }
    const puerto = Number(env("SMTP_PUERTO") || 465);
    const transporte = nodemailer.createTransport({
      host: env("SMTP_SERVIDOR") || "smtp.gmail.com", port: puerto, secure: puerto === 465,
      auth: { user: env("SMTP_USUARIO"), pass: env("SMTP_CLAVE") },
      connectionTimeout: 15_000, socketTimeout: c.adjuntos?.length ? 40_000 : 20_000,
    });
    await transporte.sendMail({ from: remitente(), to: c.para, subject: c.asunto, text: c.texto, html: c.html, attachments: (c.adjuntos ?? []).map((a) => ({ filename: a.nombre, content: Buffer.from(a.contenido), contentType: a.tipo })) });
    return { ok: true, proveedor };
  } catch (e) {
    return { ok: false, proveedor, error: e instanceof Error ? e.message.slice(0, 200) : "Error desconocido" };
  }
}
