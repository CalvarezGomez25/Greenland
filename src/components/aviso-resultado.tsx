import { Aviso } from "@/components/ui";

// Mensajes de éxito que se muestran tras una acción. Solo se muestran textos fijos de esta lista:
// nunca se refleja en pantalla lo que venga en la dirección.
const MENSAJES: Record<string, string> = {
  importacion: "Presupuesto importado correctamente.",
  partida: "Partida guardada.",
  partida_borrada: "Partida eliminada.",
  costos: "Costos adicionales actualizados.",
  plantilla: "Se crearon los conceptos habituales. Ahora completa sus porcentajes.",
  gasto: "Gasto actualizado.",
};

export function AvisoResultado({ ok }: { ok?: string | string[] }) {
  const clave = Array.isArray(ok) ? ok[0] : ok;
  const mensaje = clave ? MENSAJES[clave] : undefined;
  return mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null;
}
