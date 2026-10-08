import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { datosConexion } from "./env";

// Cliente de Supabase para Server Components y Server Actions.
// La sesión viaja en cookies que el navegador no puede leer (httpOnly).
export async function crearClienteServidor() {
  const almacen = await cookies();
  const { url, clave } = datosConexion();

  return createServerClient(url, clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) =>
            almacen.set(name, value, options),
          );
        } catch {
          // Desde un Server Component no se pueden escribir cookies; no pasa
          // nada: el proxy (src/proxy.ts) ya renueva la sesión en cada visita.
        }
      },
    },
  });
}
