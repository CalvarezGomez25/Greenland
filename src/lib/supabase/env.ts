// Limpia un valor pegado a mano: quita espacios y comillas de los extremos.
function limpiar(valor: string | undefined): string {
  return (valor ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

// Deja solo la dirección base del proyecto (https://CODIGO.supabase.co).
// Corrige un error frecuente: copiar la URL de la API de datos, que termina en
// "/rest/v1/". Con ese tramo de más, Supabase responde 404 al iniciar sesión.
export function normalizarUrl(valor: string | undefined): string {
  const limpio = limpiar(valor);
  if (!limpio) return "";
  try {
    return new URL(limpio).origin;
  } catch {
    return "";
  }
}

// Lee las dos variables públicas de conexión. Si faltan o no son válidas, el
// error dice exactamente qué configurar (en vez de fallar con un mensaje confuso).
export function datosConexion() {
  const url = normalizarUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const clave = limpiar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !clave) {
    throw new Error(
      "Faltan o no son válidas las variables NEXT_PUBLIC_SUPABASE_URL (debe ser " +
        "https://CODIGO.supabase.co) y NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configúralas en el entorno (ver .env.example).",
    );
  }
  return { url, clave };
}
