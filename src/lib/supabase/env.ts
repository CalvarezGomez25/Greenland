// Lee las dos variables públicas de conexión. Si faltan, el error dice
// exactamente qué configurar (en vez de fallar con un mensaje confuso).
export function datosConexion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) {
    throw new Error(
      "Faltan las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configúralas en el entorno (ver .env.example).",
    );
  }
  return { url, clave };
}
