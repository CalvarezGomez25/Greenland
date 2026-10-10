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
  guardado: "Guardado.",
  eliminado: "Registro eliminado.",
  parametro: "Parámetro actualizado.",
  rol: "Rol actualizado.",
  ficha: "Datos del proyecto actualizados.",
  linea_base: "Presupuesto aprobado: quedó como línea base de costo (BAC).",
  avance: "Avance actualizado.",
  anticipo: "Anticipo autorizado.",
  cerrado: "Proyecto cerrado. Sale del dashboard y queda en el histórico.",
  reabierto: "Proyecto reabierto.",
  acta: "Acta de pago radicada.",
  estado_acta: "Estado del acta actualizado.",
  retencion: "Retención liberada.",
  retencion_revertida: "Liberación de la retención revertida.",
  calculada: "Valor ganado calculado y guardado.",
};

export function AvisoResultado({ ok }: { ok?: string | string[] }) {
  const clave = Array.isArray(ok) ? ok[0] : ok;
  const mensaje = clave ? MENSAJES[clave] : undefined;
  if (clave === "calculada_no") return <Aviso>No se pudo calcular: faltan la línea base de costo (aprueba el presupuesto) o las tareas del cronograma con sus pesos.</Aviso>;
  if (clave === "linea_base_no") return <Aviso>No se pudo aprobar el presupuesto: revisa que tenga valor y que no esté ya aprobado.</Aviso>;
  if (clave === "no_reabierto") return <Aviso>No se pudo reabrir el proyecto: solo el administrador reabre un proyecto cerrado.</Aviso>;
  if (clave === "no_borrado") return <Aviso>No se pudo eliminar: el registro está en uso o no tienes permiso.</Aviso>;
  return mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null;
}
