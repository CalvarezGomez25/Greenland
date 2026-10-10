// Cliente de Supabase para el NAVEGADOR, usado solo para subir archivos con una dirección firmada que el
// servidor entrega después de verificar permisos (la clave pública no permite nada más por sí sola).
import { createClient } from "@supabase/supabase-js";
import { datosConexion } from "./env";

export function crearClienteNavegador() {
  const { url, clave } = datosConexion();
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
