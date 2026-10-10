// Lectura del formulario de cambios (los valores definitivos los valida y calcula la base de datos).

import { leerNumeroColombiano } from "../presupuesto/csv";
import { AMBITOS_CAMBIO } from "./cambios";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Un identificador que no es UUID válido se descarta (la base de datos también comprueba que sea del proyecto).
const uuidONulo = (v: string): string | null => (UUID.test(v) ? v : null);

export type DatosCambio = Record<string, string | string[] | boolean | null>;

// Impacto en costo en formato colombiano; admite signo "-" (un ahorro).
export function leerImpacto(texto: string): { ok: true; valor: string } | { ok: false; error: string } {
  const t = texto.trim();
  if (t === "") return { ok: true, valor: "0" };
  const negativo = t.startsWith("-");
  const cuerpo = t.replace(/^[-+]\s*/, "");
  const r = leerNumeroColombiano(cuerpo, 2, 13);
  if (!r.ok) return { ok: false, error: `El impacto en costo ${r.motivo}.` };
  return { ok: true, valor: negativo && Number(r.valor) !== 0 ? `-${r.valor}` : r.valor };
}

export function leerDatosCambio(datos: FormData): { datos: DatosCambio } | { error: string } {
  const txt = (k: string) => String(datos.get(k) ?? "").trim();
  const impacto = leerImpacto(txt("impacto_costo"));
  if (!impacto.ok) return { error: impacto.error };
  const dias = txt("impacto_dias");
  if (dias !== "" && !/^-?\d{1,4}$/.test(dias)) return { error: "El impacto en días debe ser un número entero (puede ser negativo)." };
  const validos = new Set(AMBITOS_CAMBIO.map(([k]) => k));
  const ambitos = datos.getAll("ambitos").map(String).filter((a) => validos.has(a));
  return {
    datos: {
      tipo: txt("tipo"),
      descripcion_antes: txt("descripcion_antes"),
      descripcion_despues: txt("descripcion_despues"),
      justificacion: txt("justificacion"),
      impacto_alcance: txt("impacto_alcance"),
      impacto_costo: impacto.valor,
      impacto_dias: dias === "" ? "0" : dias,
      ambitos,
      riesgo_id: uuidONulo(txt("riesgo_id")),
      contrato_id: uuidONulo(txt("contrato_id")),
      responsable_implementacion: txt("responsable_implementacion"),
      observaciones: txt("observaciones"),
      lecciones: txt("lecciones"),
      detectado_sin_formato: datos.get("detectado_sin_formato") === "on",
    },
  };
}
